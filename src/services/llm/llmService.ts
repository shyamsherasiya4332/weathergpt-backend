import { NLU_SYSTEM_PROMPT } from '../../prompts/nluPrompt.js';
import { WEATHER_GPT_SYSTEM_PROMPT } from '../../prompts/weatherPrompt.js';
import { ParsedNLU } from '../../types/nlu.js';
import { RainAnalysisResult, WeatherData } from '../../types/weather.js';
import { getCurrentTimeInTimezone, getRelativeDateString } from '../../utils/dateUtils.js';
import { logger } from '../../utils/logger.js';
import { openAIClient } from './openaiClient.js';

export class LLMService {
  async parseNLU(question: string): Promise<ParsedNLU> {
    const qLower = question.toLowerCase();

    // Determine language heuristic
    let language: 'en' | 'gu' | 'hi' | 'hinglish' = 'en';
    const gujChars = /[\u0A80-\u0AFF]/;
    const devanagariChars = /[\u0900-\u097F]/;

    if (gujChars.test(question)) {
      language = 'gu';
    } else if (devanagariChars.test(question)) {
      language = 'hi';
    } else if (qLower.includes('varsad') || qLower.includes('aaje') || qLower.includes('kale') || qLower.includes('hoga') || qLower.includes('padse')) {
      language = 'hinglish';
    }

    if (openAIClient.isConfigured()) {
      try {
        const rawJson = await openAIClient.generateChatCompletion(
          NLU_SYSTEM_PROMPT,
          `Question: "${question}"`,
          true
        );
        const parsed = JSON.parse(rawJson) as ParsedNLU;
        if (parsed.intent) {
          return { ...parsed, language: parsed.language || language };
        }
      } catch (err) {
        logger.warn('NLU parsing via LLM failed, using heuristic parser:', err);
      }
    }

    // High-performance Heuristic NLU Fallback
    return this.heuristicNLU(question, language);
  }

  private heuristicNLU(question: string, language: 'en' | 'gu' | 'hi' | 'hinglish'): ParsedNLU {
    const qLower = question.toLowerCase();

    // Intent detection
    let intent: ParsedNLU['intent'] = 'current_weather';
    if (
      qLower.includes('rain') ||
      qLower.includes('વરસાદ') ||
      qLower.includes('वर्षा') ||
      qLower.includes('बारिश') ||
      qLower.includes('varsad') ||
      qLower.includes('umbrella') ||
      qLower.includes('છત્રી') ||
      qLower.includes('छतरी')
    ) {
      intent = qLower.includes('umbrella') || qLower.includes('છત્રી') || qLower.includes('छतरी') ? 'advisory' : 'rain_forecast';
    } else if (qLower.includes('temp') || qLower.includes('તાપમાન') || qLower.includes('तापमान') || qLower.includes('garmi')) {
      intent = 'temperature';
    } else if (qLower.includes('forecast') || qLower.includes('3 days') || qLower.includes('આગામી')) {
      intent = 'general_forecast';
    }

    // Date extraction
    let targetDate: ParsedNLU['targetDate'] = 'today';
    if (
      qLower.includes('tomorrow') ||
      qLower.includes('કાલે') ||
      qLower.includes('કાલે') ||
      qLower.includes('कल') ||
      qLower.includes('kal')
    ) {
      targetDate = 'tomorrow';
    } else if (qLower.includes('next 3 days') || qLower.includes('3 days')) {
      targetDate = 'next_3_days';
    }

    // Time range extraction
    let timeRange: ParsedNLU['timeRange'] = 'all_day';
    let specificTimeRange: ParsedNLU['specificTimeRange'] = undefined;

    if (qLower.includes('evening') || qLower.includes('સાંજે') || qLower.includes('शाम')) {
      timeRange = 'evening';
    } else if (qLower.includes('morning') || qLower.includes('સવારે') || qLower.includes('सुबह')) {
      timeRange = 'morning';
    } else if (qLower.includes('afternoon') || qLower.includes('બપોરે') || qLower.includes('दोपहर')) {
      timeRange = 'afternoon';
    } else if (qLower.includes('night') || qLower.includes('રાત્રે') || qLower.includes('रात')) {
      timeRange = 'night';
    }

    // Specific hour extraction e.g. "between 5 pm and 8 pm" or "5 pm to 8 pm"
    const hourRangeMatch = qLower.match(/between\s+(\d{1,2})\s*(pm|am)?\s*(and|to|-)\s*(\d{1,2})\s*(pm|am)?/i);
    if (hourRangeMatch) {
      let start = parseInt(hourRangeMatch[1], 10);
      let end = parseInt(hourRangeMatch[4], 10);
      const isStartPm = hourRangeMatch[2]?.toLowerCase() === 'pm' || hourRangeMatch[5]?.toLowerCase() === 'pm';
      if (isStartPm && start < 12) start += 12;
      if (isStartPm && end < 12) end += 12;

      timeRange = 'specific_hours';
      specificTimeRange = { startHour: start, endHour: end };
    }

    // Location extraction heuristic
    let locationName: string | undefined = undefined;
    const reservedWords = ['today', 'tomorrow', 'tonight', 'morning', 'afternoon', 'evening', 'night', 'rain', 'weather', 'forecast', 'the', 'a', 'an'];
    const inMatch = question.match(/(?:in|at|for|near|મા|માં|મેં)\s+([A-Za-z\u0A80-\u0AFF\u0900-\u097F\s]+)/i);
    if (inMatch) {
      const candidate = inMatch[1].trim();
      if (!reservedWords.includes(candidate.toLowerCase())) {
        locationName = candidate;
      }
    }
    
    if (!locationName) {
      // Direct city check
      const knownCities = ['Morbi', 'Rajkot', 'Ahmedabad', 'Surat', 'Vadodara', 'Mumbai', 'Delhi', 'Bangalore', 'London', 'New York'];
      for (const city of knownCities) {
        if (qLower.includes(city.toLowerCase())) {
          locationName = city;
          break;
        }
      }
      if (question.includes('મોરબી')) locationName = 'Morbi';
    }

    return {
      intent,
      locationName,
      isLocationNeeded: true,
      targetDate,
      timeRange,
      specificTimeRange,
      language,
      confidence: 0.85
    };
  }

  async generateAnswer(
    question: string,
    nlu: ParsedNLU,
    weatherData: WeatherData,
    rainAnalysis: RainAnalysisResult
  ): Promise<string> {
    const tz = weatherData.location.timezone;
    const localNow = getCurrentTimeInTimezone(tz);
    const targetDateStr = getRelativeDateString(nlu.targetDate || 'today', tz, nlu.specificDateStr);

    const userPromptPayload = `
User Question: "${question}"
Detected Language: ${nlu.language}
Location: ${weatherData.location.name}, ${weatherData.location.state || ''} ${weatherData.location.country || ''}
Local Timezone: ${tz}
Current Local Date & Time: ${localNow}
Target Forecast Date: ${targetDateStr}

Live Weather Context:
- Current Temperature: ${weatherData.current.temperature}°C (Feels like ${weatherData.current.apparentTemperature}°C)
- Current Condition: ${weatherData.current.condition}
- Current Rain Probability: ${weatherData.current.rainProbability}%
- Current Humidity: ${weatherData.current.humidity}%
- Current Wind Speed: ${weatherData.current.windSpeed} km/h
- Current UV Index: ${weatherData.current.uvIndex}

Precipitation / Rain Forecast Analysis for target window (${targetDateStr}):
- Maximum Rain Probability: ${rainAnalysis.maxRainProbability}%
- Total Expected Rain Amount: ${rainAnalysis.totalRainAmountMm} mm
- Has Significant Rain Risk: ${rainAnalysis.hasRainRisk ? 'YES' : 'NO'}
- Peak Time Window: ${rainAnalysis.peakRainTimeWindow || 'N/A'}
- Hourly Breakdown (Sample):
${rainAnalysis.hourlyRainBreakdown
  .slice(0, 8)
  .map((h) => `  ${h.time}: ${h.probability}% prob, ${h.amountMm}mm, ${h.condition}`)
  .join('\n')}

Daily Forecast Summary:
${weatherData.daily
  .map((d) => `  ${d.date}: Max ${d.temperatureMax}°C, Min ${d.temperatureMin}°C, Max Rain Prob ${d.precipitationProbabilityMax}%, Rain ${d.precipitationSum}mm, ${d.condition}`)
  .join('\n')}

Synthesize a clear, concise, accurate answer answering the user's exact question in ${nlu.language}.
Follow all rules of WeatherGPT system prompt.
`;

    if (openAIClient.isConfigured()) {
      try {
        const answer = await openAIClient.generateChatCompletion(
          WEATHER_GPT_SYSTEM_PROMPT,
          userPromptPayload
        );
        if (answer && answer.trim().length > 0) {
          return answer.trim();
        }
      } catch (err) {
        logger.warn('LLM answer generation failed, using rule-based fallback:', err);
      }
    }

    // Rule-based Multi-lingual Fallback Generator
    return this.generateFallbackAnswer(question, nlu, weatherData, rainAnalysis, targetDateStr);
  }

  private generateFallbackAnswer(
    question: string,
    nlu: ParsedNLU,
    weatherData: WeatherData,
    rainAnalysis: RainAnalysisResult,
    targetDateStr: string
  ): string {
    const loc = weatherData.location.name;
    const isGujarati = nlu.language === 'gu';
    const isHindi = nlu.language === 'hi' || nlu.language === 'hinglish';
    const isRainQuestion = nlu.intent === 'rain_forecast' || nlu.intent === 'advisory';

    if (isGujarati) {
      if (isRainQuestion) {
        if (rainAnalysis.maxRainProbability >= 60) {
          return `${loc} માં ${targetDateStr} ના રોજ વરસાદની શક્યતા ${rainAnalysis.maxRainProbability}% જેટલી વધારે છે (ખાસ કરીને ${rainAnalysis.peakRainTimeWindow || 'સાંજે'}). બહાર જતી વખતે છત્રી કે રેઇનકોટ સાથે રાખવો હિતાવહ છે. અંદાજિત વરસાદ ${rainAnalysis.totalRainAmountMm} mm છે.`;
        } else if (rainAnalysis.maxRainProbability >= 30) {
          return `${loc} માં ${targetDateStr} ના રોજ વરસાદની હળવી શક્યતા (${rainAnalysis.maxRainProbability}%) છે. વાતાવરણ ${weatherData.current.condition} રહેશે.`;
        } else {
          return `${loc} માં ${targetDateStr} ના રોજ વરસાદની શક્યતા ઓછી છે (${rainAnalysis.maxRainProbability}%). તાપમાન ${weatherData.current.temperature}°C ની આસપાસ રહેશે.`;
        }
      }
      return `${loc} માં હાલનું તાપમાન ${weatherData.current.temperature}°C છે અને વાતાવરણ ${weatherData.current.condition} છે. ${targetDateStr} ના રોજ મહત્તમ તાપમાન ${weatherData.daily[0]?.temperatureMax || 30}°C રહેશે.`;
    }

    if (isHindi) {
      if (isRainQuestion) {
        if (rainAnalysis.maxRainProbability >= 60) {
          return `${loc} में ${targetDateStr} को बारिश की संभावना ${rainAnalysis.maxRainProbability}% है (${rainAnalysis.peakRainTimeWindow || 'विशेष रूप से शाम को'}). छाता साथ रखना बेहतर रहेगा। अनुमानित बारिश ${rainAnalysis.totalRainAmountMm} mm है।`;
        } else {
          return `${loc} में ${targetDateStr} को बारिश की संभावना कम (${rainAnalysis.maxRainProbability}%) है। मौसम ${weatherData.current.condition} रहने की उम्मीद है।`;
        }
      }
      return `${loc} में वर्तमान तापमान ${weatherData.current.temperature}°C है और मौसम ${weatherData.current.condition} है।`;
    }

    // English Default
    if (isRainQuestion) {
      if (rainAnalysis.maxRainProbability >= 60) {
        return `Yes, there is a high chance of rain in ${loc} on ${targetDateStr} (${rainAnalysis.maxRainProbability}% peak probability ${rainAnalysis.peakRainTimeWindow || 'in the evening'}), with expected rainfall of around ${rainAnalysis.totalRainAmountMm} mm. Carrying an umbrella is recommended!`;
      } else if (rainAnalysis.maxRainProbability >= 30) {
        return `There is a moderate chance of rain in ${loc} on ${targetDateStr} with a peak probability of around ${rainAnalysis.maxRainProbability}%. Total precipitation is expected to be ${rainAnalysis.totalRainAmountMm} mm.`;
      } else {
        return `Rain is unlikely in ${loc} on ${targetDateStr}. The maximum rain probability is only ${rainAnalysis.maxRainProbability}%, and conditions will mostly be ${weatherData.current.condition}.`;
      }
    }

    return `The current weather in ${loc} is ${weatherData.current.condition} with a temperature of ${weatherData.current.temperature}°C (feels like ${weatherData.current.apparentTemperature}°C). The maximum temperature for ${targetDateStr} is forecast to reach ${weatherData.daily[0]?.temperatureMax || weatherData.current.temperature}°C.`;
  }
}

export const llmService = new LLMService();
