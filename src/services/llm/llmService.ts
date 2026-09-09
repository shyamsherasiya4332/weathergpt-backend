import { WEATHER_GPT_SYSTEM_PROMPT } from '../../prompts/weatherPrompt.js';
import { LocationInput } from '../../types/api.js';
import { ParsedNLU } from '../../types/nlu.js';
import { RainAnalysisResult, WeatherData } from '../../types/weather.js';
import { getCurrentTimeInTimezone, getRelativeDateString } from '../../utils/dateUtils.js';
import { logger } from '../../utils/logger.js';
import { openAIClient } from './openaiClient.js';

function formatGujaratiDate(isoDateStr: string): string {
  const parts = isoDateStr.split('-');
  if (parts.length !== 3) return isoDateStr;
  const formattedDdMmYyyy = `${parts[2]}-${parts[1]}-${parts[0]}`;

  const todayStr = new Date().toISOString().split('T')[0];
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = tomorrow.toISOString().split('T')[0];

  if (isoDateStr === todayStr) {
    return `આજે (${formattedDdMmYyyy})`;
  } else if (isoDateStr === tomorrowStr) {
    return `કાલે (${formattedDdMmYyyy})`;
  } else {
    return `તારીખ ${formattedDdMmYyyy}`;
  }
}

function formatGujaratiTimeWindow(timeWindow: string | undefined): string {
  if (!timeWindow) return 'સાંજે';

  const match = timeWindow.match(/(\d{1,2}):(\d{2})/);
  if (match) {
    const hour = parseInt(match[1], 10);
    let timeOfDay = 'સાંજે';
    let displayHour = hour;

    if (hour >= 0 && hour < 6) {
      timeOfDay = 'રાત્રે';
      displayHour = hour === 0 ? 12 : hour;
    } else if (hour >= 6 && hour < 12) {
      timeOfDay = 'સવારે';
      displayHour = hour;
    } else if (hour >= 12 && hour < 17) {
      timeOfDay = 'બપોરે';
      displayHour = hour === 12 ? 12 : hour - 12;
    } else if (hour >= 17 && hour < 21) {
      timeOfDay = 'સાંજે';
      displayHour = hour - 12;
    } else {
      timeOfDay = 'રાત્રે';
      displayHour = hour - 12;
    }

    return `${timeOfDay} ${displayHour} વાગ્યે`;
  }

  return timeWindow;
}

function translateConditionToGujarati(condition: string): string {
  const c = condition.toLowerCase();
  if (c.includes('clear')) return 'ચોખ્ખું આકાશ';
  if (c.includes('partly cloudy')) return 'અંશતઃ વાદળછાયું';
  if (c.includes('cloud') || c.includes('overcast')) return 'વાદળછાયું વાતાવરણ';
  if (c.includes('thunder')) return 'ગાજવીજ સાથે વરસાદ';
  if (c.includes('drizzle') || c.includes('light rain')) return 'હળવા વરસાદી ઝાપટાં';
  if (c.includes('heavy rain')) return 'ભારે વરસાદ';
  if (c.includes('rain')) return 'વરસાદી માહોલ';
  if (c.includes('fog') || c.includes('mist')) return 'ઝાંખપ / ધુમ્મસ';
  return condition;
}

function translateConditionToHindi(condition: string): string {
  const c = condition.toLowerCase();
  if (c.includes('clear')) return 'साफ आसमान';
  if (c.includes('partly cloudy')) return 'आंशिक रूप से बादल';
  if (c.includes('cloud') || c.includes('overcast')) return 'बादल छाए रहेंगे';
  if (c.includes('thunder')) return 'गरज के साथ बारिश';
  if (c.includes('drizzle') || c.includes('light rain')) return 'हल्की बूंदाबांदी';
  if (c.includes('heavy rain')) return 'भारी बारिश';
  if (c.includes('rain')) return 'बारिश का मौसम';
  if (c.includes('fog') || c.includes('mist')) return 'कोहरा';
  return condition;
}

export class LLMService {
  async parseNLU(question: string, locationContext?: LocationInput): Promise<ParsedNLU> {
    const qLower = question.toLowerCase();

    // Check if query is in Gujarati / Hinglish Gujarati
    const isGujaratiQuery =
      /[\u0A80-\u0AFF]/.test(question) ||
      /\b(?:kale|aaje|varsad|padse|hase|nai|ke|sanje|savare|bapore|ma|mein)\b/i.test(question);

    const prompt = `
User Query: "${question}"
Location Context: ${locationContext ? JSON.stringify(locationContext) : 'None'}

Extract JSON:
{
  "intent": "rain_forecast" | "current_weather" | "general_forecast" | "temperature" | "clothing" | "advisory" | "unknown",
  "locationName": string | null,
  "isLocationNeeded": boolean,
  "targetDate": "today" | "tomorrow" | "specific_date" | null,
  "specificDateStr": "YYYY-MM-DD" | null,
  "timeRange": "full_day" | "morning" | "afternoon" | "evening" | "night" | "specific_hours" | null,
  "specificTimeRange": { "startHour": number, "endHour": number } | null,
  "language": "${isGujaratiQuery ? 'gu' : 'auto'}"
}
`;

    if (openAIClient.isConfigured()) {
      try {
        const responseText = await openAIClient.generateChatCompletion(
          'You are a precise weather intent parser. Output raw JSON only.',
          prompt
        );
        const parsed = JSON.parse(responseText.replace(/```json/g, '').replace(/```/g, '').trim());
        return {
          intent: parsed.intent || 'general_forecast',
          locationName: parsed.locationName || undefined,
          isLocationNeeded: parsed.isLocationNeeded ?? true,
          targetDate: parsed.targetDate || 'today',
          specificDateStr: parsed.specificDateStr || undefined,
          timeRange: parsed.timeRange || 'full_day',
          specificTimeRange: parsed.specificTimeRange || undefined,
          language: isGujaratiQuery ? 'gu' : (parsed.language || 'en'),
          confidence: 0.95
        };
      } catch (error) {
        logger.warn('NLU parsing via LLM failed, using heuristic parser:', error);
      }
    }

    return this.heuristicNLU(question);
  }

  private heuristicNLU(question: string): ParsedNLU {
    const qLower = question.toLowerCase();

    // Intent detection
    let intent: ParsedNLU['intent'] = 'general_forecast';
    if (/rain|varsad|बारिश|મழை|મજ્હા|મળ|પાણી|વરસાદ|chances of rain|umbrella/i.test(question)) {
      intent = 'rain_forecast';
    } else if (/right now|currently|current|હાલ|અત્યારે|अभी/i.test(question)) {
      intent = 'current_weather';
    } else if (/temp|temperature|તાપમાન|तापमान/i.test(question)) {
      intent = 'temperature';
    }

    // Date detection
    let targetDate: ParsedNLU['targetDate'] = 'today';
    if (/tomorrow|kale|કાલે|कल/i.test(question)) {
      targetDate = 'tomorrow';
    } else if (/today|aaje|આજે|आज/i.test(question)) {
      targetDate = 'today';
    }

    // Time range detection
    let timeRange: ParsedNLU['timeRange'] = 'all_day';
    let specificTimeRange: ParsedNLU['specificTimeRange'] = undefined;

    if (/evening|shyam|સાંજે|સંજે|શામ/i.test(question)) {
      timeRange = 'evening';
      specificTimeRange = { startHour: 17, endHour: 21 };
    } else if (/morning|savare|સવારે|સવાર|सुबह/i.test(question)) {
      timeRange = 'morning';
      specificTimeRange = { startHour: 6, endHour: 12 };
    } else if (/afternoon|bapore|બપોરે|દોપહર/i.test(question)) {
      timeRange = 'afternoon';
      specificTimeRange = { startHour: 12, endHour: 17 };
    } else if (/night|ratre|રાત્રે|રાત|रात/i.test(question)) {
      timeRange = 'night';
      specificTimeRange = { startHour: 21, endHour: 23 };
    }

    // Language detection
    const isGujaratiQuery =
      /[\u0A80-\u0AFF]/.test(question) ||
      /\b(?:kale|aaje|varsad|padse|hase|nai|ke|sanje|savare|bapore|ma|mein)\b/i.test(question);
    const language = isGujaratiQuery ? 'gu' : (/[a-zA-Z]/.test(question) ? 'en' : 'hi');

    // Location extraction heuristic
    let locationName: string | undefined = undefined;

    const knownCities = [
      'Statue of Unity', 'Somnath Temple', 'Somnath', 'Gir National Park', 'Gir', 'Sabarmati Riverfront', 'Sabarmati',
      'Rajkot Gujarat', 'Rajkot', 'Morbi Gujarat', 'Morbi', 'Ahmedabad', 'Surat', 'Vadodara', 'Mumbai', 'Delhi',
      'Bangalore', 'Chennai', 'Kolkata', 'Jaipur', 'Pune', 'Hyderabad', 'Junagadh', 'Jamnagar', 'Bhavnagar', 'Anand', 'Nadiad', 'Bhuj', 'Kutch', 'Dwarka'
    ];

    for (const city of knownCities) {
      if (qLower.includes(city.toLowerCase()) || question.includes(city)) {
        locationName = city;
        break;
      }
    }

    if (!locationName) {
      const postMatch = question.match(/([A-Za-z\u0A80-\u0AFF\u0900-\u097F\s]{2,30})\s+(?:ma|માં|મા|me|mein)\b/i);
      if (postMatch) {
        let candidate = postMatch[1].trim();
        candidate = candidate.replace(/^(?:kale|aaje|today|tomorrow|kal|shyam|sanje|savare|morning|evening|night)\s+/i, '').trim();
        if (candidate) {
          locationName = candidate;
        }
      }
    }

    if (!locationName) {
      const inMatch = question.match(/(?:in|at|for|near)\s+([A-Za-z\u0A80-\u0AFF\u0900-\u097F\s]{2,30})/i);
      if (inMatch) {
        let candidate = inMatch[1].trim();
        candidate = candidate.split(/\s+(?:today|tomorrow|tonight|rain|varsad|hase|padse|ke|nai|hoga|kya)\b/i)[0].trim();
        if (candidate) {
          locationName = candidate;
        }
      }
    }

    if (locationName) {
      locationName = locationName
        .replace(/\b(?:gujarat|maharashtra|rajasthan|punjab|haryana|delhi|karnataka|kerala|tamilnadu|india|bharat)\b/gi, '')
        .replace(/\b(?:varsad|rain|weather|forecast|hoga|hogi|padse|hase|ke|nai|kya|aaje|kale|today|tomorrow|shyam|sanje|savare|temp|taapman)\b/gi, '')
        .trim();
      if (locationName.length === 0) {
        locationName = undefined;
      }
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
    const tz = weatherData.location.timezone || 'Asia/Kolkata';
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
    const isGujarati =
      nlu.language === 'gu' ||
      /[\u0A80-\u0AFF]/.test(question) ||
      /\b(?:kale|aaje|varsad|padse|hase|nai|ke|sanje|savare|bapore|ma|mein)\b/i.test(question);
    const isHindi = !isGujarati && (nlu.language === 'hi' || nlu.language === 'hinglish');
    const isRainQuestion = nlu.intent === 'rain_forecast' || nlu.intent === 'advisory';

    const gujaratiDateLabel = formatGujaratiDate(targetDateStr);
    const gujaratiTimeLabel = formatGujaratiTimeWindow(rainAnalysis.peakRainTimeWindow);

    const maxTemp = Math.round(weatherData.daily[0]?.temperatureMax || weatherData.current.temperature);
    const minTemp = Math.round(weatherData.daily[0]?.temperatureMin || (weatherData.current.temperature - 4));
    const rainProb = rainAnalysis.maxRainProbability;
    const rainAmount = rainAnalysis.totalRainAmountMm;
    const windSpeed = Math.round(weatherData.current.windSpeed);

    if (isGujarati) {
      const gujCond = translateConditionToGujarati(weatherData.current.condition);

      let summaryHeading = '';
      let rainText = '';
      if (rainProb >= 60) {
        summaryHeading = `હા, ${gujaratiDateLabel} ${loc} માં હળવાથી મધ્યમ વરસાદની સંભાવના છે. ખાસ કરીને ${gujaratiTimeLabel} દરમ્યાન વાતાવરણ વરસાદી રહેશે.`;
        rainText = `હળવાથી મધ્યમ વરસાદ (${rainProb}% સંભાવના, ~${rainAmount} mm)`;
      } else if (rainProb >= 30) {
        summaryHeading = `હા, ${gujaratiDateLabel} ${loc} માં હળવા વરસાદના છૂટાછવાયા ઝાપટાં પડવાની શક્યતા છે.`;
        rainText = `હળવા ઝાપટાં શક્ય (${rainProb}% સંભાવના)`;
      } else {
        summaryHeading = `${loc} માં ${gujaratiDateLabel} ના રોજ વરસાદની શક્યતા ખૂબ જ ઓછી (${rainProb}%) છે. વાતાવરણ મુખ્યત્વે સાફ કે અંશતઃ વાદળછાયું રહેશે.`;
        rainText = `નહિવત / વરસાદની ઓછી શક્યતા (${rainProb}%)`;
      }

      return `${summaryHeading}

**${loc} – કાલનું હવામાન (${gujaratiDateLabel})**
🌧️ **વરસાદ**: ${rainText}
🌤️ **આકાશ**: ${gujCond}
🌡️ **તાપમાન**: ${minTemp}°C થી ${maxTemp}°C
💨 **પવન**: આશરે ${windSpeed} km/h (ભેજ: ${weatherData.current.humidity}%)

— *India Meteorological Department (IMD) / MoES Data*

💡 *જો તમારે સવારે, બપોરે કે સાંજે કયા સમયે વરસાદ આવવાની સૌથી વધુ શક્યતા છે તેની કલાકવાર (hourly) માહિતી જોઈએ, તો તમે પૂછી શકો છો.*`;
    }

    if (isHindi) {
      const hiCond = translateConditionToHindi(weatherData.current.condition);

      let summaryHeading = '';
      let rainText = '';
      if (rainProb >= 60) {
        summaryHeading = `हां, ${targetDateStr} को ${loc} में हल्की से मध्यम बारिश की संभावना है। विशेष रूप से शाम के समय बारिश हो सकती है।`;
        rainText = `मध्यम बारिश (${rainProb}% संभावना, ~${rainAmount} mm)`;
      } else if (rainProb >= 30) {
        summaryHeading = `हां, ${targetDateStr} को ${loc} में हल्की बूंदाबांदी की संभावना (${rainProb}%) है।`;
        rainText = `हल्की बूंदाबांदी संभव (${rainProb}% संभावना)`;
      } else {
        summaryHeading = `${loc} में ${targetDateStr} को बारिश की संभावना कम (${rainProb}%) है। मौसम मुख्य रूप से साफ रहेगा।`;
        rainText = `कम संभावना (${rainProb}%)`;
      }

      return `${summaryHeading}

**${loc} – कल का मौसम (${targetDateStr})**
🌧️ **बारिश**: ${rainText}
🌤️ **आकाश**: ${hiCond}
🌡️ **तापमान**: ${minTemp}°C से ${maxTemp}°C
💨 **हवा**: लगभग ${windSpeed} km/h (आर्द्रता: ${weatherData.current.humidity}%)

— *India Meteorological Department (IMD) / MoES Data*

💡 *यदि आप सुबह, दोपहर या शाम का प्रति घंटे (Hourly Forecast) विवरण जानना चाहते हैं, तो पूछ सकते हैं!*`;
    }

    // English Default
    let summaryHeading = '';
    let rainText = '';
    if (rainProb >= 60) {
      summaryHeading = `Yes, there is a high chance of light to moderate rain in ${loc} on ${targetDateStr} (${rainProb}% chance).`;
      rainText = `Light to Moderate Rain (${rainProb}% chance, ~${rainAmount} mm)`;
    } else if (rainProb >= 30) {
      summaryHeading = `Yes, there is a moderate chance of light rain/showers in ${loc} on ${targetDateStr} (${rainProb}% chance).`;
      rainText = `Light Rain / Showers possible (${rainProb}% chance)`;
    } else {
      summaryHeading = `Rain is unlikely in ${loc} on ${targetDateStr} (only ${rainProb}% probability).`;
      rainText = `Unlikely (${rainProb}% chance)`;
    }

    return `${summaryHeading}

**${loc} – Weather Forecast (${targetDateStr})**
🌧️ **Rain**: ${rainText}
🌤️ **Sky**: ${weatherData.current.condition}
🌡️ **Temperature**: ${minTemp}°C to ${maxTemp}°C
💨 **Wind**: ~${windSpeed} km/h (Humidity: ${weatherData.current.humidity}%)

— *India Meteorological Department (IMD) / MoES Data*

💡 *Would you like an hourly breakdown for morning, afternoon, or evening? Just ask!*`;
  }
}

export const llmService = new LLMService();
