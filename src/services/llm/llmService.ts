import { WEATHER_GPT_SYSTEM_PROMPT } from '../../prompts/weatherPrompt.js';
import { LocationInput } from '../../types/api.js';
import { ParsedNLU } from '../../types/nlu.js';
import { RainAnalysisResult, WeatherData } from '../../types/weather.js';
import { getCurrentTimeInTimezone, getFormattedDateInTimezone, getRelativeDateString } from '../../utils/dateUtils.js';
import { logger } from '../../utils/logger.js';
import { openAIClient } from './openaiClient.js';

function formatGujaratiDate(isoDateStr: string, timezone: string = 'Asia/Kolkata'): string {
  const parts = isoDateStr.split('-');
  if (parts.length !== 3) return isoDateStr;
  const formattedDdMmYyyy = `${parts[2]}-${parts[1]}-${parts[0]}`;

  const now = new Date();
  const todayStr = getFormattedDateInTimezone(now, timezone);

  const tmr = new Date(now);
  tmr.setDate(tmr.getDate() + 1);
  const tomorrowStr = getFormattedDateInTimezone(tmr, timezone);

  const dayAfter = new Date(now);
  dayAfter.setDate(dayAfter.getDate() + 2);
  const dayAfterTomorrowStr = getFormattedDateInTimezone(dayAfter, timezone);

  const dayAfterNext = new Date(now);
  dayAfterNext.setDate(dayAfterNext.getDate() + 3);
  const dayAfterNextStr = getFormattedDateInTimezone(dayAfterNext, timezone);

  if (isoDateStr === todayStr) {
    return `આજે (${formattedDdMmYyyy})`;
  } else if (isoDateStr === tomorrowStr) {
    return `કાલે (${formattedDdMmYyyy})`;
  } else if (isoDateStr === dayAfterTomorrowStr) {
    return `પરમદિવસે (${formattedDdMmYyyy})`;
  } else if (isoDateStr === dayAfterNextStr) {
    return `તર-પરમદિવસે (${formattedDdMmYyyy})`;
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

export function translateConditionToGujarati(condition: string): string {
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

export function translateConditionToHindi(condition: string): string {
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

export interface TimeRangeStats {
  labelGu: string;
  labelHi: string;
  labelEn: string;
  maxTemp: number;
  minTemp: number;
  maxRainProb: number;
  totalRainMm: number;
  avgWind: number;
  condition: string;
  isSpecificRange: boolean;
  timePeriodGu: string;
  timePeriodHi: string;
  timePeriodEn: string;
}

export function getTimeRangeStats(
  weatherData: WeatherData,
  targetDateStr: string,
  timeRange?: string,
  specificTimeRange?: { startHour: number; endHour: number }
): TimeRangeStats {
  let startH = 0;
  let endH = 23;

  const tz = weatherData.location.timezone || 'Asia/Kolkata';
  const now = new Date();
  const todayStr = getFormattedDateInTimezone(now, tz);

  const tmr = new Date(now);
  tmr.setDate(tmr.getDate() + 1);
  const tomorrowStr = getFormattedDateInTimezone(tmr, tz);

  const dayAfter = new Date(now);
  dayAfter.setDate(dayAfter.getDate() + 2);
  const dayAfterTomorrowStr = getFormattedDateInTimezone(dayAfter, tz);

  const dayAfterNext = new Date(now);
  dayAfterNext.setDate(dayAfterNext.getDate() + 3);
  const dayAfterNextStr = getFormattedDateInTimezone(dayAfterNext, tz);

  const parts = targetDateStr.split('-');
  const formattedDdMmYyyy = parts.length === 3 ? `${parts[2]}-${parts[1]}-${parts[0]}` : targetDateStr;

  let baseDateLabelGu = `તારીખ ${formattedDdMmYyyy} નું હવામાન`;
  let baseDateLabelHi = `तारीख ${formattedDdMmYyyy} का मौसम`;
  let baseDateLabelEn = `Weather Forecast for ${formattedDdMmYyyy}`;

  let basePeriodGu = `તારીખ ${formattedDdMmYyyy} ના રોજ`;
  let basePeriodHi = `तारीख ${formattedDdMmYyyy} को`;
  let basePeriodEn = `on ${formattedDdMmYyyy}`;

  if (targetDateStr === todayStr) {
    baseDateLabelGu = `આજનું હવામાન (${formattedDdMmYyyy})`;
    baseDateLabelHi = `आज का मौसम (${formattedDdMmYyyy})`;
    baseDateLabelEn = `Today's Weather (${formattedDdMmYyyy})`;
    basePeriodGu = `આજે (${formattedDdMmYyyy})`;
    basePeriodHi = `आज (${formattedDdMmYyyy})`;
    basePeriodEn = `today (${formattedDdMmYyyy})`;
  } else if (targetDateStr === tomorrowStr) {
    baseDateLabelGu = `કાલનું હવામાન (${formattedDdMmYyyy})`;
    baseDateLabelHi = `कल का मौसम (${formattedDdMmYyyy})`;
    baseDateLabelEn = `Tomorrow's Weather (${formattedDdMmYyyy})`;
    basePeriodGu = `કાલે (${formattedDdMmYyyy})`;
    basePeriodHi = `कल (${formattedDdMmYyyy})`;
    basePeriodEn = `tomorrow (${formattedDdMmYyyy})`;
  } else if (targetDateStr === dayAfterTomorrowStr) {
    baseDateLabelGu = `પરમ દિવસનું હવામાન (${formattedDdMmYyyy})`;
    baseDateLabelHi = `परसों का मौसम (${formattedDdMmYyyy})`;
    baseDateLabelEn = `Day After Tomorrow Weather (${formattedDdMmYyyy})`;
    basePeriodGu = `પરમદિવસે (${formattedDdMmYyyy})`;
    basePeriodHi = `परसों (${formattedDdMmYyyy})`;
    basePeriodEn = `day after tomorrow (${formattedDdMmYyyy})`;
  } else if (targetDateStr === dayAfterNextStr) {
    baseDateLabelGu = `તર-પરમ દિવસનું હવામાન (${formattedDdMmYyyy})`;
    baseDateLabelHi = `तर-परसों का मौसम (${formattedDdMmYyyy})`;
    baseDateLabelEn = `3-Day Forecast (${formattedDdMmYyyy})`;
    basePeriodGu = `તર-પરમદિવસે (${formattedDdMmYyyy})`;
    basePeriodHi = `तर-परसों (${formattedDdMmYyyy})`;
    basePeriodEn = `in 3 days (${formattedDdMmYyyy})`;
  }

  let labelGu = baseDateLabelGu;
  let labelHi = baseDateLabelHi;
  let labelEn = baseDateLabelEn;

  let timePeriodGu = basePeriodGu;
  let timePeriodHi = basePeriodHi;
  let timePeriodEn = basePeriodEn;
  let isSpecificRange = false;

  if (timeRange === 'morning' || (specificTimeRange && specificTimeRange.startHour === 6)) {
    startH = 6;
    endH = 12;
    labelGu = `${basePeriodGu} સવારનું હવામાન (સવારે 6:00 થી 12:00)`;
    labelHi = `${basePeriodHi} सुबह का मौसम (सुबह 6:00 से 12:00)`;
    labelEn = `Morning Weather Forecast ${basePeriodEn} (6:00 AM - 12:00 PM)`;
    timePeriodGu = `${basePeriodGu} સવારે (06:00 થી 12:00)`;
    timePeriodHi = `${basePeriodHi} सुबह (06:00 से 12:00)`;
    timePeriodEn = `${basePeriodEn} morning (6:00 AM to 12:00 PM)`;
    isSpecificRange = true;
  } else if (timeRange === 'afternoon' || (specificTimeRange && specificTimeRange.startHour === 12)) {
    startH = 12;
    endH = 17;
    labelGu = `${basePeriodGu} બપોરનું હવામાન (બપોરે 12:00 થી 5:00)`;
    labelHi = `${basePeriodHi} दोपहर का मौसम (दोपहर 12:00 से 5:00)`;
    labelEn = `Afternoon Weather Forecast ${basePeriodEn} (12:00 PM - 5:00 PM)`;
    timePeriodGu = `${basePeriodGu} બપોરે (12:00 થી 05:00)`;
    timePeriodHi = `${basePeriodHi} दोपहर (12:00 से 05:00)`;
    timePeriodEn = `${basePeriodEn} afternoon (12:00 PM to 5:00 PM)`;
    isSpecificRange = true;
  } else if (timeRange === 'evening' || (specificTimeRange && specificTimeRange.startHour === 17)) {
    startH = 17;
    endH = 21;
    labelGu = `${basePeriodGu} સાંજનું હવામાન (સાંજે 5:00 થી 9:00)`;
    labelHi = `${basePeriodHi} शाम का मौसम (शाम 5:00 से 9:00)`;
    labelEn = `Evening Weather Forecast ${basePeriodEn} (5:00 PM - 9:00 PM)`;
    timePeriodGu = `${basePeriodGu} સાંજે (05:00 થી 09:00)`;
    timePeriodHi = `${basePeriodHi} शाम (05:00 से 09:00)`;
    timePeriodEn = `${basePeriodEn} evening (5:00 PM to 9:00 PM)`;
    isSpecificRange = true;
  } else if (timeRange === 'night' || (specificTimeRange && specificTimeRange.startHour === 21)) {
    startH = 21;
    endH = 23;
    labelGu = `${basePeriodGu} રાતનું હવામાન (રાત્રે 9:00 થી સવારે 6:00)`;
    labelHi = `${basePeriodHi} रात का मौसम (रात 9:00 से सुबह 6:00)`;
    labelEn = `Night Weather Forecast ${basePeriodEn} (9:00 PM - 6:00 AM)`;
    timePeriodGu = `${basePeriodGu} રાત્રે (09:00 થી 06:00)`;
    timePeriodHi = `${basePeriodHi} रात (09:00 से 06:00)`;
    timePeriodEn = `${basePeriodEn} night (9:00 PM to 6:00 AM)`;
    isSpecificRange = true;
  }

  const matchingHours = (weatherData.hourly || []).filter((h) => {
    if (!h.time.startsWith(targetDateStr)) return false;
    const dateObj = new Date(h.time);
    const hour = dateObj.getHours();
    return hour >= startH && hour <= endH;
  });

  if (matchingHours.length === 0) {
    const defaultMaxTemp = Math.round(weatherData.daily[0]?.temperatureMax || weatherData.current.temperature);
    const defaultMinTemp = Math.round(weatherData.daily[0]?.temperatureMin || (weatherData.current.temperature - 4));
    return {
      labelGu,
      labelHi,
      labelEn,
      maxTemp: defaultMaxTemp,
      minTemp: defaultMinTemp,
      maxRainProb: weatherData.current.rainProbability || 0,
      totalRainMm: 0,
      avgWind: Math.round(weatherData.current.windSpeed),
      condition: weatherData.current.condition,
      isSpecificRange,
      timePeriodGu,
      timePeriodHi,
      timePeriodEn
    };
  }

  let maxTemp = -Infinity;
  let minTemp = Infinity;
  let maxRainProb = 0;
  let totalRainMm = 0;
  let totalWind = 0;
  let worstCondition = matchingHours[0].condition;

  for (const h of matchingHours) {
    if (h.temperature > maxTemp) maxTemp = h.temperature;
    if (h.temperature < minTemp) minTemp = h.temperature;
    if (h.precipitationProbability > maxRainProb) {
      maxRainProb = h.precipitationProbability;
      worstCondition = h.condition;
    }
    totalRainMm += h.precipitationAmount;
    totalWind += h.windSpeed;
  }

  return {
    labelGu,
    labelHi,
    labelEn,
    maxTemp: Math.round(maxTemp),
    minTemp: Math.round(minTemp),
    maxRainProb,
    totalRainMm: Math.round(totalRainMm * 10) / 10,
    avgWind: Math.round(totalWind / matchingHours.length),
    condition: worstCondition,
    isSpecificRange,
    timePeriodGu,
    timePeriodHi,
    timePeriodEn
  };
}

export class LLMService {
  async parseNLU(question: string, locationContext?: LocationInput): Promise<ParsedNLU> {
    const qLower = question.toLowerCase();

    const isGujaratiQuery =
      /[\u0A80-\u0AFF]/.test(question) ||
      /\b(?:kale|aaje|varsad|padse|hase|nai|ke|sanje|savare|bapore|ma|mein|paramdivas|paramdivase|peramdivas)\b/i.test(question);

    const prompt = `
User Query: "${question}"
Location Context: ${locationContext ? JSON.stringify(locationContext) : 'None'}

Extract JSON:
{
  "intent": "rain_forecast" | "current_weather" | "general_forecast" | "temperature" | "clothing" | "advisory" | "unknown",
  "locationName": string | null,
  "isLocationNeeded": boolean,
  "targetDate": "today" | "tomorrow" | "day_after_tomorrow" | "day_after_next" | "specific_date" | null,
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

    let intent: ParsedNLU['intent'] = 'general_forecast';
    if (/rain|varsad|बारिश|મழை|મજ્હા|મળ|પાણી|વરસાદ|chances of rain|umbrella/i.test(question)) {
      intent = 'rain_forecast';
    } else if (/right now|currently|current|હાલ|અત્યારે|अभी/i.test(question)) {
      intent = 'current_weather';
    } else if (/temp|temperature|તાપમાન|तापमान/i.test(question)) {
      intent = 'temperature';
    }

    let targetDate: ParsedNLU['targetDate'] = 'today';
    if (/tarparamdivas|tar\s*param\s*divas|તરપરમદિવસે|તર\s*પરમ\s*દિવસે|narson|narsong/i.test(question)) {
      targetDate = 'day_after_next';
    } else if (/paramdivas|paramdivase|param\s*divas|peramdivas|પરમદિવસે|પરમદિવસ|parso|parson|day after tomorrow/i.test(question)) {
      targetDate = 'day_after_tomorrow';
    } else if (/tomorrow|kale|કાલે|कल|kal\b/i.test(question)) {
      targetDate = 'tomorrow';
    } else if (/today|aaje|આજે|आज/i.test(question)) {
      targetDate = 'today';
    }

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

    const isGujaratiQuery =
      /[\u0A80-\u0AFF]/.test(question) ||
      /\b(?:kale|aaje|varsad|padse|hase|nai|ke|sanje|savare|bapore|ma|mein)\b/i.test(question);
    const language = isGujaratiQuery ? 'gu' : (/[a-zA-Z]/.test(question) ? 'en' : 'hi');

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
Target Time Window Requested: ${nlu.timeRange || 'full_day'} (${nlu.specificTimeRange ? `hours ${nlu.specificTimeRange.startHour} to ${nlu.specificTimeRange.endHour}` : 'all day'})

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
If the user explicitly asks for MORNING, AFTERNOON, EVENING, or NIGHT, give specific metrics for that exact time window.
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

    const stats = getTimeRangeStats(weatherData, targetDateStr, nlu.timeRange, nlu.specificTimeRange);

    const maxTemp = stats.maxTemp;
    const minTemp = stats.minTemp;
    const rainProb = stats.maxRainProb;
    const rainAmount = stats.totalRainMm;
    const windSpeed = stats.avgWind;

    if (isGujarati) {
      const gujCond = translateConditionToGujarati(stats.condition);

      let summaryHeading = '';
      let rainText = '';
      if (rainProb >= 60) {
        summaryHeading = `હા, ${loc} માં ${stats.timePeriodGu} વરસાદી માહોલ રહેશે અને હળવાથી મધ્યમ વરસાદ (${rainProb}% સંભાવના, ~${rainAmount} mm) પડવાની શક્યતા છે.`;
        rainText = `હળવાથી મધ્યમ વરસાદ (${rainProb}% સંભાવના, ~${rainAmount} mm)`;
      } else if (rainProb >= 30) {
        summaryHeading = `હા, ${loc} માં ${stats.timePeriodGu} વાદળછાયું વાતાવરણ રહેશે અને હળવા ઝાપટાં (${rainProb}% સંભાવના) પડી શકે છે.`;
        rainText = `હળવા ઝાપટાં શક્ય (${rainProb}% સંભાવના)`;
      } else {
        summaryHeading = `${loc} માં ${stats.timePeriodGu} વાતાવરણ મુખ્યત્વે ખુલ્લું અને અનુકૂળ રહેશે. વરસાદની શક્યતા નહિવત (${rainProb}%) છે.`;
        rainText = `નહિવત / વરસાદની ઓછી શક્યતા (${rainProb}%)`;
      }

      let tipText = '';
      if (rainProb >= 50) {
        tipText = '\n\n💡 *સલાહ: બહાર નીકળતી વખતે છત્રી અથવા રેઈનકોટ સાથે રાખવો હિતાવહ છે.*';
      } else if (maxTemp >= 38) {
        tipText = '\n\n💡 *સલાહ: તાપમાન વધુ હોવાથી બપોરના સમયે તડકાથી બચવું અને પુષ્કળ પાણી પીવું.*';
      } else if (windSpeed >= 25) {
        tipText = `\n\n💡 *સલાહ: પવનની ઝડપ ${windSpeed} km/h સુધી હોવાથી વાહન ચલાવતી વખતે સાવચેતી રાખવી.*`;
      } else if (!stats.isSpecificRange) {
        tipText = '\n\n💡 *જો તમારે સવારે, બપોરે કે સાંજે કયા સમયે વાતાવરણ કેવું રહેશે તેની કલાકવાર (hourly) વિગત જોઈએ, તો જણાવો.*';
      }

      return `${summaryHeading}

**${loc} – ${stats.labelGu}**
🌧️ **વરસાદ**: ${rainText}
🌤️ **આકાશ**: ${gujCond}
🌡️ **તાપમાન**: ${minTemp}°C થી ${maxTemp}°C
💨 **પવન**: આશરે ${windSpeed} km/h (ભેજ: ${weatherData.current.humidity}%)

— *India Meteorological Department (IMD) / MoES Data*${tipText}`;
    }

    if (isHindi) {
      const hiCond = translateConditionToHindi(stats.condition);

      let summaryHeading = '';
      let rainText = '';
      if (rainProb >= 60) {
        summaryHeading = `हां, ${loc} में ${stats.timePeriodHi} हल्की से मध्यम बारिश (${rainProb}% संभावना, ~${rainAmount} mm) होने की संभावना है।`;
        rainText = `मध्यम बारिश (${rainProb}% संभावना, ~${rainAmount} mm)`;
      } else if (rainProb >= 30) {
        summaryHeading = `हां, ${loc} में ${stats.timePeriodHi} बादल छाए रहेंगे और हल्की बूंदाबांदी (${rainProb}%) संभव है।`;
        rainText = `हल्की बूंदाबांदी संभव (${rainProb}% संभावना)`;
      } else {
        summaryHeading = `${loc} में ${stats.timePeriodHi} मौसम मुख्यतः साफ और सुहावना रहेगा। बारिश की संभावना कम (${rainProb}%) है।`;
        rainText = `कम संभावना (${rainProb}%)`;
      }

      let tipText = '';
      if (rainProb >= 50) {
        tipText = '\n\n💡 *सलाह: बाहर निकलते समय छाता या रेनकोट साथ रखना बेहतर रहेगा।*';
      } else if (maxTemp >= 38) {
        tipText = '\n\n💡 *सलाह: तापमान अधिक रहने के कारण दोपहर में पर्याप्त पानी पीते रहें।*';
      } else if (windSpeed >= 25) {
        tipText = `\n\n💡 *सलाह: तेज हवाएं (~${windSpeed} km/h) चलने के कारण सावधानी बरतें।*`;
      } else if (!stats.isSpecificRange) {
        tipText = '\n\n💡 *यदि आप सुबह, दोपहर या शाम के समय का विस्तृत पूर्वानुमान जानना चाहते हैं, तो पूछ सकते हैं!*';
      }

      return `${summaryHeading}

**${loc} – ${stats.labelHi}**
🌧️ **बारिश**: ${rainText}
🌤️ **आकाश**: ${hiCond}
🌡️ **तापमान**: ${minTemp}°C से ${maxTemp}°C
💨 **हवा**: लगभग ${windSpeed} km/h (आर्द्रता: ${weatherData.current.humidity}%)

— *India Meteorological Department (IMD) / MoES Data*${tipText}`;
    }

    let summaryHeading = '';
    let rainText = '';
    if (rainProb >= 60) {
      summaryHeading = `Yes, there is a high likelihood of light to moderate rain in ${loc} ${stats.timePeriodEn} (${rainProb}% chance, ~${rainAmount} mm).`;
      rainText = `Light to Moderate Rain (${rainProb}% chance, ~${rainAmount} mm)`;
    } else if (rainProb >= 30) {
      summaryHeading = `Yes, there is a moderate chance of light rain/showers in ${loc} ${stats.timePeriodEn} (${rainProb}% chance).`;
      rainText = `Light Rain / Showers possible (${rainProb}% chance)`;
    } else {
      summaryHeading = `Rain is unlikely in ${loc} ${stats.timePeriodEn} (only ${rainProb}% probability). Weather will be clear and pleasant.`;
      rainText = `Unlikely (${rainProb}% chance)`;
    }

    let tipText = '';
    if (rainProb >= 50) {
      tipText = '\n\n💡 *Tip: Carrying an umbrella or raincoat is recommended.*';
    } else if (maxTemp >= 38) {
      tipText = '\n\n💡 *Tip: High temperatures expected. Stay hydrated throughout the day.*';
    } else if (windSpeed >= 25) {
      tipText = `\n\n💡 *Tip: Strong winds (~${windSpeed} km/h) expected, drive carefully.*`;
    } else if (!stats.isSpecificRange) {
      tipText = '\n\n💡 *Would you like an hourly breakdown for morning, afternoon, or evening? Just ask!*';
    }

    return `${summaryHeading}

**${loc} – ${stats.labelEn}**
🌧️ **Rain**: ${rainText}
🌤️ **Sky**: ${stats.condition}
🌡️ **Temperature**: ${minTemp}°C to ${maxTemp}°C
💨 **Wind**: ~${windSpeed} km/h (Humidity: ${weatherData.current.humidity}%)

— *India Meteorological Department (IMD) / MoES Data*${tipText}`;
  }
}

export const llmService = new LLMService();
