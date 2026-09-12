import { WEATHER_GPT_SYSTEM_PROMPT } from '../../prompts/weatherPrompt.js';
import { LocationInput } from '../../types/api.js';
import { LocationEntity, ParsedNLU } from '../../types/nlu.js';
import { RainAnalysisResult, WeatherData } from '../../types/weather.js';
import { getCurrentTimeInTimezone, getFormattedDateInTimezone, getRelativeDateString } from '../../utils/dateUtils.js';
import { logger } from '../../utils/logger.js';
import { languageService } from '../language/languageService.js';
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
  async parseNLU(question: string, locationContext?: LocationEntity | LocationInput): Promise<ParsedNLU> {
    // 1. Instant heuristic NLU (runs in <1ms)
    const heuristic = this.heuristicNLU(question, locationContext);

    // If heuristic NLU detected a location or specific intent/date, return immediately without wasting 5-8s on an extra LLM call
    if (
      heuristic.locationName ||
      heuristic.intent !== 'general_forecast' ||
      heuristic.targetDate !== 'today' ||
      !openAIClient.isConfigured()
    ) {
      return heuristic;
    }

    // 2. Fallback to LLM only for completely ambiguous queries with no keywords
    const detectedLangInfo = languageService.detect(question);
    const language = detectedLangInfo.code;
    const fullLangName = detectedLangInfo.name;

    const prompt = `
User Query: "${question}"
Detected Language: ${fullLangName} (${language})
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
  "language": "${language}"
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
          locationName: parsed.locationName || (locationContext && 'name' in locationContext ? locationContext.name : undefined),
          isLocationNeeded: parsed.isLocationNeeded ?? true,
          targetDate: parsed.targetDate || 'today',
          specificDateStr: parsed.specificDateStr || undefined,
          timeRange: parsed.timeRange || 'full_day',
          specificTimeRange: parsed.specificTimeRange || undefined,
          language: language,
          confidence: 0.95
        };
      } catch (error) {
        logger.warn('NLU parsing via LLM failed, using heuristic parser:', error);
      }
    }

    return heuristic;
  }

  private heuristicNLU(question: string, locationContext?: LocationEntity | LocationInput): ParsedNLU {
    const qLower = question.toLowerCase();

    let intent: ParsedNLU['intent'] = 'general_forecast';
    if (/^(?:hello|hi|hey|helo|kem\s*cho|namaste|namaskar|halo|ram\s*ram|su\s*prabhat|good\s*morning|good\s*evening|good\s*afternoon|good\s*night|pranam|jay\s*shree\s*krishna|har\s*har\s*mahadev|kaisa\s*ho|નમસ્તે|નમસ્કાર|કેમ\s*છો|હલો|પ્રણામ|હાય|હેલો|હરિ\s*ઓમ)\b/i.test(question.trim())) {
      intent = 'greeting';
    } else if (/garmi|garmy|ગરમી|ગરીમી|bafaro|બફારો|thandi|ઠંડી|તાપમાન|तापमान|गर्मी|ठंड|temp|temperature|heat|hot|cold|warm|degree|ડિગ્રી/i.test(question)) {
      intent = 'temperature';
    } else if (/rain|varsad|varsat|varshad|barsad|barsat|barish|baarish|बारिश|વરસાદ|ઝાપટાં|બુંદાબુંદી|chances of rain|umbrella/i.test(question)) {
      intent = 'rain_forecast';
    } else if (/right now|currently|current|હાલ|અત્યારે|अभी/i.test(question)) {
      intent = 'current_weather';
    }

    let targetDate: ParsedNLU['targetDate'] = 'today';
    if (/tarparamdivas|tar\s*param\s*divas|તરપરમદિવસે|તર\s*પરમ\s*દિવસે|narson|narsong/i.test(question)) {
      targetDate = 'day_after_next';
    } else if (/paramdivas|paramdivase|param\s*divas|peramdivas|પરમદિવસે|પરમદિવસ|પરમદિન|parso|parson|day after tomorrow/i.test(question)) {
      targetDate = 'day_after_tomorrow';
    } else if (/tomorrow|kale|કાલે|કાલ|कल|kal\b|kalnu|kalni|kalno|kalna|kal\s*nu|kal\s*ni|kal\s*no|kal\s*na/i.test(question)) {
      targetDate = 'tomorrow';
    } else if (/today|aje|aaje|આજે|આજ|आज|aaj\b|aajnu|aajni|aajno|aajna|aaj\s*nu|aaj\s*ni|aaj\s*no|aaj\s*na/i.test(question)) {
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

    const detectedLangInfo = languageService.detect(question);
    const language = detectedLangInfo.code;

    let locationName: string | undefined = undefined;

    const knownCitiesMap: Record<string, string> = {
      // Landmarks & Tourist Sites
      'Statue of Unity': 'Statue of Unity', 'Somnath Temple': 'Somnath Temple', 'Somnath': 'Somnath',
      'Gir National Park': 'Gir National Park', 'Gir': 'Gir', 'Sabarmati Riverfront': 'Sabarmati Riverfront',
      'Sabarmati': 'Sabarmati', 'Rann of Kutch': 'Rann of Kutch', 'Taj Mahal': 'Agra',
      'India Gate': 'Delhi', 'Gateway of India': 'Mumbai', 'Dwarkadhish Temple': 'Dwarka',
      'Dwarka': 'Dwarka', 'New Delhi': 'Delhi', 'Navi Mumbai': 'Navi Mumbai',
      // Major Metros & Capitals
      'Delhi': 'Delhi', 'Mumbai': 'Mumbai', 'Bangalore': 'Bangalore', 'Bengaluru': 'Bengaluru',
      'Hyderabad': 'Hyderabad', 'Chennai': 'Chennai', 'Kolkata': 'Kolkata', 'Pune': 'Pune',
      'Ahmedabad': 'Ahmedabad', 'Surat': 'Surat', 'Jaipur': 'Jaipur', 'Lucknow': 'Lucknow',
      'Kanpur': 'Kanpur', 'Nagpur': 'Nagpur', 'Indore': 'Indore', 'Thane': 'Thane',
      'Bhopal': 'Bhopal', 'Visakhapatnam': 'Visakhapatnam', 'Vizag': 'Visakhapatnam',
      'Patna': 'Patna', 'Vadodara': 'Vadodara', 'Ghaziabad': 'Ghaziabad', 'Ludhiana': 'Ludhiana',
      'Agra': 'Agra', 'Nashik': 'Nashik', 'Faridabad': 'Faridabad', 'Meerut': 'Meerut',
      'Rajkot': 'Rajkot', 'Varanasi': 'Varanasi', 'Kashi': 'Varanasi', 'Srinagar': 'Srinagar',
      'Aurangabad': 'Aurangabad', 'Dhanbad': 'Dhanbad', 'Amritsar': 'Amritsar', 'Prayagraj': 'Prayagraj',
      'Allahabad': 'Prayagraj', 'Ranchi': 'Ranchi', 'Gwalior': 'Gwalior', 'Jabalpur': 'Jabalpur',
      'Coimbatore': 'Coimbatore', 'Vijayawada': 'Vijayawada', 'Jodhpur': 'Jodhpur', 'Madurai': 'Madurai',
      'Raipur': 'Raipur', 'Kota': 'Kota', 'Chandigarh': 'Chandigarh', 'Guwahati': 'Guwahati',
      'Solapur': 'Solapur', 'Mysore': 'Mysore', 'Mysuru': 'Mysuru', 'Gurgaon': 'Gurugram',
      'Gurugram': 'Gurugram', 'Noida': 'Noida', 'Jamshedpur': 'Jamshedpur', 'Cuttack': 'Cuttack',
      'Bhubaneswar': 'Bhubaneswar', 'Kochi': 'Kochi', 'Cochin': 'Kochi', 'Dehradun': 'Dehradun',
      'Shimla': 'Shimla', 'Goa': 'Goa', 'Panaji': 'Panaji', 'Thiruvananthapuram': 'Thiruvananthapuram',
      'Trivandrum': 'Thiruvananthapuram', 'Udaipur': 'Udaipur', 'Jammu': 'Jammu',
      // Gujarat Districts & Cities
      'Morbi': 'Morbi', 'Botad': 'Botad', 'Junagadh': 'Junagadh', 'Jamnagar': 'Jamnagar',
      'Bhavnagar': 'Bhavnagar', 'Anand': 'Anand', 'Nadiad': 'Nadiad', 'Bhuj': 'Bhuj',
      'Kutch': 'Kutch', 'Gandhinagar': 'Gandhinagar', 'Porbandar': 'Porbandar',
      'Surendranagar': 'Surendranagar', 'Mehsana': 'Mehsana', 'Navsari': 'Navsari',
      'Vapi': 'Vapi', 'Valsad': 'Valsad', 'Bharuch': 'Bharuch', 'Palanpur': 'Palanpur',
      'Veraval': 'Veraval', 'Amreli': 'Amreli', 'Godhra': 'Godhra', 'Patan': 'Patan',
      'Dahod': 'Dahod',
      // Global Cities
      'London': 'London', 'New York': 'New York', 'Paris': 'Paris', 'Tokyo': 'Tokyo',
      'Dubai': 'Dubai', 'Singapore': 'Singapore', 'Sydney': 'Sydney', 'Toronto': 'Toronto',
      'Berlin': 'Berlin', 'Rome': 'Rome', 'Madrid': 'Madrid', 'Moscow': 'Moscow',
      'Bangkok': 'Bangkok', 'Chicago': 'Chicago', 'San Francisco': 'San Francisco',
      'Seattle': 'Seattle', 'Los Angeles': 'Los Angeles',
      // Devanagari Names & Inflections
      'मोरबी में': 'Morbi', 'मोरबी का': 'Morbi', 'मोरबी की': 'Morbi', 'मोरबी': 'Morbi',
      'राजकोट में': 'Rajkot', 'राजकोट का': 'Rajkot', 'राजकोट की': 'Rajkot', 'राजकोट': 'Rajkot',
      'अहमदाबाद में': 'Ahmedabad', 'अहमदाबाद का': 'Ahmedabad', 'अहमदाबाद की': 'Ahmedabad', 'अहमदाबाद': 'Ahmedabad',
      'सूरत में': 'Surat', 'सूरत का': 'Surat', 'सूरत की': 'Surat', 'सूरत': 'Surat',
      'वडोदरा में': 'Vadodara', 'वडोदरा': 'Vadodara',
      'भावनगर में': 'Bhavnagar', 'भावनगर': 'Bhavnagar',
      'जामनगर में': 'Jamnagar', 'जामनगर': 'Jamnagar',
      'जूनागढ़ में': 'Junagadh', 'जूनागढ़': 'Junagadh',
      'मुंबईमध्ये': 'Mumbai', 'मुंबईत': 'Mumbai', 'मुंबई': 'Mumbai', 'मुम्बई': 'Mumbai',
      'पुण्यात': 'Pune', 'पुण्यामध्ये': 'Pune', 'पुणे': 'Pune',
      'नागपूर': 'Nagpur', 'नागपुर': 'Nagpur', 'नाशिक': 'Nashik',
      'दिल्ली': 'Delhi', 'नई दिल्ली': 'Delhi', 'जोधपुर': 'Jodhpur',
      'जयपुर': 'Jaipur', 'कोलकाता': 'Kolkata', 'चेन्नई': 'Chennai',
      'हैदराबाद': 'Hyderabad', 'लखनऊ': 'Lucknow', 'कानपुर': 'Kanpur',
      'भोपाल': 'Bhopal', 'इंदौर': 'Indore', 'पटना': 'Patna',
      'आगरा': 'Agra', 'वाराणसी': 'Varanasi', 'प्रयागराज': 'Prayagraj',
      'अमृतसर': 'Amritsar', 'श्रीनगर': 'Srinagar', 'शिमला': 'Shimla',
      'देहरादून': 'Dehradun', 'गोवा': 'Goa', 'चंडीगढ़': 'Chandigarh',
      'गांधीनगर': 'Gandhinagar',
      // Gujarati Names & Inflections
      'અમદાવાદ': 'Ahmedabad', 'અમદાવાદમાં': 'Ahmedabad', 'અમદાવાદનું': 'Ahmedabad',
      'રાજકોટ': 'Rajkot', 'રાજકોટમાં': 'Rajkot', 'રાજકોટનું': 'Rajkot',
      'મોરબી': 'Morbi', 'મોરબીમાં': 'Morbi', 'મોરબીનું': 'Morbi',
      'બોટાદ': 'Botad', 'બોટાદમાં': 'Botad', 'બોટાદનું': 'Botad',
      'સુરત': 'Surat', 'સુરતમાં': 'Surat', 'સુરતનું': 'Surat',
      'વડોદરા': 'Vadodara', 'વડોદરામાં': 'Vadodara', 'વડોદરાનું': 'Vadodara',
      'ભાવનગર': 'Bhavnagar', 'જામનગર': 'Jamnagar', 'જૂનાગઢ': 'Junagadh',
      'ગાંધીનગર': 'Gandhinagar', 'ગાંધીનગરમાં': 'Gandhinagar', 'ગાંધીનગરનું': 'Gandhinagar',
      'દિલ્હી': 'Delhi', 'મુંબઈ': 'Mumbai', 'પૂણે': 'Pune',
      'જયપુર': 'Jaipur', 'કોલકાતા': 'Kolkata', 'ચેન્નાઈ': 'Chennai',
      'બેંગ્લોર': 'Bangalore', 'હૈદરાબાદ': 'Hyderabad',
      
      // Typos & Aliases
      'amdavad': 'Ahmedabad', 'ahemdabad': 'Ahmedabad', 'baroda': 'Vadodara', 'vadodra': 'Vadodara',
      'morbii': 'Morbi', 'morby': 'Morbi', 'bombay': 'Mumbai', 'poona': 'Pune',
      'banaras': 'Varanasi', 'calcutta': 'Kolkata', 'madras': 'Chennai',
      'bhavnagr': 'Bhavnagar', 'jamnagr': 'Jamnagar', 'gandhinagr': 'Gandhinagar',
      'rajkott': 'Rajkot', 'suratt': 'Surat'
    };

    // Sort entries by length descending so longer compound names match before shorter subsets
    const sortedEntries = Object.entries(knownCitiesMap).sort((a, b) => b[0].length - a[0].length);
    for (const [key, val] of sortedEntries) {
      if (/[\u0900-\u0D7F]/.test(key)) {
        if (question.includes(key)) {
          locationName = val;
          break;
        }
      } else {
        const wordRegex = new RegExp(`\\b${key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
        if (wordRegex.test(question)) {
          locationName = val;
          break;
        }
      }
    }

    const nonCityWords = /^(?:india|bharat|desh|country|gujarat|state|rajya|duniya|world|aaje|kale|badha|badhu|kai|kya|kaha|kon|shu|kone|koni|aapda|apda|mara|tamara|badhe|hawa|mausam|vatavaran|varsad|barish|tapman|garmi|thandi|today|tomorrow|yesterday|rain|temp|weather)$/i;

    if (!locationName) {
      // Suffix match for Indic inflections (Gujarati, Hindi, Marathi)
      const suffixMatch = question.match(/([A-Za-z\u0A80-\u0AFF\u0900-\u097F]{2,30})\s*(?:मध्ये|मधे|्यात|ात|ત|તમાં|માં|મા|में|से|કો|को|નું|ની|નો|ના)(?:\s|[.,?!]|$|\b)/i);
      if (suffixMatch) {
        let candidate = suffixMatch[1].trim();
        candidate = candidate.replace(/^(?:kale|aaje|today|tomorrow|kal|shyam|sanje|savare|morning|evening|night|garmi|thandi|aaj|aata)\s*/i, '').trim();
        if (candidate && candidate.length >= 2 && !nonCityWords.test(candidate)) {
          locationName = candidate;
        }
      }
    }

    if (!locationName) {
      // Hindi / Marathi genitive pattern: "लखनऊ का मौसम", "पुणे का तापमान", "गोवा की बारिश"
      const genitiveMatch = question.match(/([A-Za-z\u0A80-\u0AFF\u0900-\u097F\s]{2,30})\s+(?:का|की|કે|चे|ची|च्या)\s+(?:मौसम|हवामान|तापमान|बारिश|गर्मी|थंड)/i);
      if (genitiveMatch) {
        let candidate = genitiveMatch[1].trim();
        candidate = candidate.replace(/^(?:kale|aaje|today|tomorrow|kal|shyam|sanje|savare|morning|evening|night|garmi|thandi)\s+/i, '').trim();
        if (candidate && candidate.length >= 2 && !nonCityWords.test(candidate)) {
          locationName = candidate;
        }
      }
    }

    if (!locationName) {
      const postMatch = question.match(/([A-Za-z\u0A80-\u0AFF\u0900-\u097F\s]{2,30})\s+(?:ma|માં|મા|me|mein)\b/i);
      if (postMatch) {
        let candidate = postMatch[1].trim();
        candidate = candidate.replace(/^(?:kale|aaje|today|tomorrow|kal|shyam|sanje|savare|morning|evening|night|garmi|thandi)\s+/i, '').trim();
        if (candidate && !nonCityWords.test(candidate)) {
          locationName = candidate;
        }
      }
    }

    if (!locationName) {
      // Ensure word boundary before in, at, for, near, of, around so words like "What", "That" don't match
      const inMatch = question.match(/\b(?:in|at|for|near|of|around)\s+([A-Za-z\u0A80-\u0AFF\u0900-\u097F\s]{2,30})/i);
      if (inMatch) {
        let candidate = inMatch[1].trim();
        candidate = candidate.split(/\s+(?:today|tomorrow|tonight|rain|varsad|varsat|hase|hashe|chhe|che|padse|ke|nai|hoga|kya|garmi|thandi)\b/i)[0].trim();
        candidate = candidate.replace(/[.,?!]+$/, '').trim();
        if (candidate && candidate.length >= 2 && !nonCityWords.test(candidate)) {
          locationName = candidate;
        }
      }
    }

    if (locationName) {
      locationName = locationName
        .replace(/\b(?:my\s*location|mara\s*location|mare\s*location|near\s*me|my\s*city|here|અહીં|અહીંનું|મારી\s*જગ્યા|મેરે\s*પાસ|મેરે\s*શહર)\b/gi, '')
        .replace(/\b(?:varsad|varsat|varshad|barsad|barsat|rain|weather|forecast|hoga|hogi|padse|hase|hashe|chhe|che|ke|nai|kya|aaje|aje|kale|today|tomorrow|shyam|sanje|savare|temp|taapman|garmi|garmy|thandi|bafaro|kase|aahe|hawaman)\b/gi, '')
        .replace(/[.,?!]+$/, '')
        .trim();

      // If locationName has extra state specifiers like "Rajkot Gujarat" or "Morbi, Gujarat", extract city
      const cityStateMatch = locationName.match(/^([A-Za-z\u0A80-\u0AFF\u0900-\u097F]{2,25})[\s,]+(?:gujarat|maharashtra|rajasthan|punjab|haryana|karnataka|kerala|tamil\s*nadu|india|bharat)$/i);
      if (cityStateMatch) {
        locationName = cityStateMatch[1].trim();
      }

      if (locationName.length === 0) {
        locationName = undefined;
      }
    }

    // Fall back to context location if available and no location in query
    if (!locationName && locationContext && 'name' in locationContext && locationContext.name) {
      locationName = locationContext.name;
    }

    const isExplicitOffTopic = /what\s*is\s*my\s*name|maru\s*naa?m|mera\s*naa?m|who\s*am\s*i|my\s*age|maru\s*nam|mera\s*nam|who\s*are\s*you|tamaru\s*naam|aapka\s*naam|who\s*made\s*you|kone\s*banavya|kisine\s*banaya|who\s*created|tell\s*me\s*a?\s*joke|chutkule|joke\s*suno|tell\s*story|kahani|recipe|cook|capital\s*of|prime\s*minister|pm\s*of|president|who\s*is\s*the|calculate|2\s*\+\s*2|math|programming|write\s*a?\s*code|song\s*suno|gana\s*gao|song|movie|cinema|how\s*are\s*you|kem\s*cho|kaisa\s*ho|majama|fine|good|bad|thank\s*you|thanks|dhanyawad|aabhar/i.test(question);
    const hasWeatherKeywords = /weather|havaman|vatavaran|mausam|hawa|rain|varsad|barish|garmi|bafaro|thandi|tapman|taapman|temp|temperature|cloud|vadal|badal|sun|tado|dhoop|climate|chhatri|umbrella|storm|toofan|cyclone|flood|pur|wind|pawan|pavan|humidity|uv|degree|ડિગ્રી|ઝાપટાં|ઝાપટું|કાલ|આજ|સાંજ|સવાર|બપોર|રાત|kal|kale|kalnu|aaj|aaje|aajnu|sanj|sanje|savare|bapore|ratre|kevuk?|su\s*hase|kevu\s*chhe/i.test(question);

    if (isExplicitOffTopic || (intent === 'general_forecast' && !hasWeatherKeywords && !locationName && targetDate === 'today' && !/^(?:how|kevu|kaisa|kaha|kya|su|chhe|hai|kal|aaj)\b/i.test(question.trim()))) {
      intent = 'unknown';
    }

    return {
      intent,
      locationName,
      isLocationNeeded: intent !== 'unknown',
      targetDate,
      timeRange,
      specificTimeRange,
      language,
      confidence: 0.85
    };
  }

  isNationalOrComparativeWeatherQuery(question: string): boolean {
    const q = question.toLowerCase();
    
    // Check for comparative or extremes across regions
    const isComparative = /vadhare varsad|sauthi vadhu varsad|highest rain|sabse jyada barish|hottest place|sabse garam|coldest place|sabse thandi|kya jagyaye|kahi jagyaye|kai jagyaye/i.test(q);
    
    // Check if it's asking about India, Gujarat, World, etc. broadly
    const isBroadRegion = /\b(?:india|bharat|gujarat|desh|country|world|duniya)\b/i.test(q);

    // Check for meteorological phenomena (cyclone, monsoon, mavthu, etc.)
    const isPhenomena = /mavthu|cyclone|monsoon|el nino|vavazodu|toofan|bhookamp|earthquake/i.test(q);

    return (isComparative && isBroadRegion) || isPhenomena;
  }

  async generateNationalOrComparativeAnswer(question: string, language: string): Promise<string> {
    const systemPrompt = `You are a highly intelligent meteorologist representing the India Meteorological Department (IMD) and MoES.
You are answering a question about national weather, climate patterns, or comparative extremes in India.
Answer directly, accurately, and naturally. DO NOT invent false numbers.
Focus on actual meteorological patterns (e.g. highest rainfall happens in Meghalaya/Mawsynram and Western Ghats; hottest places in Rajasthan, etc.).
If they ask about current cyclones or monsoon progression, provide a generic but accurate meteorological overview.
IMPORTANT: Reply STRICTLY in the requested language.
If language is 'gu' or Gujarati, use pure Gujarati script. If Hindi, use pure Devanagari.`;

    const userPrompt = `Question: "${question}"\nRequested Language: ${language}\nPlease answer clearly and concisely.`;

    if (openAIClient.isConfigured()) {
      try {
        const answer = await openAIClient.generateChatCompletion(systemPrompt, userPrompt);
        if (answer && answer.trim().length > 0) {
          return answer.trim();
        }
      } catch (err) {
        logger.warn('LLM national answer generation failed, using fallback:', err);
      }
    }

    // Fallback based on language
    if (language === 'gu' || /[\u0A80-\u0AFF]/.test(question)) {
      return "ભારતમાં સૌથી વધુ વરસાદ સામાન્ય રીતે મેઘાલય (મોસીનરામ, ચેરાપુંજી) અને પશ્ચિમ ઘાટ (કેરળ, કોંકણ, કર્ણાટક) માં પડે છે. જો તમને કોઈ ચોક્કસ શહેર વિશે જાણવું હોય, તો કૃપા કરીને તે શહેરનું નામ આપો.";
    } else if (language === 'hi' || /[\u0900-\u097F]/.test(question)) {
      return "भारत में सबसे अधिक बारिश आमतौर पर मेघालय (मावसिनराम, चेरापूंजी) और पश्चिमी घाट (केरल, कोंकण, तटीय कर्नाटक) में होती है। यदि आप किसी विशिष्ट शहर के बारे में जानना चाहते हैं, तो कृपया उसका नाम बताएं।";
    }
    return "In India, the highest rainfall typically occurs in Meghalaya (Mawsynram, Cherrapunji) and the Western Ghats (Kerala, Konkan, Coastal Karnataka). If you want to know about a specific city, please provide its name.";
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

    const targetDateLabel = nlu.targetDate === 'tomorrow' ? 'Tomorrow' : nlu.targetDate === 'day_after_tomorrow' ? 'Day After Tomorrow' : 'Today';
    const targetDateLabelGu = nlu.targetDate === 'tomorrow' ? 'કાલે' : nlu.targetDate === 'day_after_tomorrow' ? 'પરમદિવસે' : 'આજે';
    const fullLangName = languageService.getLanguageName(nlu.language);

    const minTemp = weatherData.daily[0]?.temperatureMin ? Math.round(weatherData.daily[0].temperatureMin) : Math.round(weatherData.current.temperature);
    const maxTemp = weatherData.daily[0]?.temperatureMax ? Math.round(weatherData.daily[0].temperatureMax) : Math.round(weatherData.current.temperature);

    const userPromptPayload = `User Question: "${question}"
User Language: ${nlu.language === 'gu' ? 'Gujarati' : nlu.language === 'hi' ? 'Hindi' : 'English'}

Weather API Data:
- Location: ${weatherData.location.name}
- Target: ${targetDateLabel} (${targetDateStr})
- Current Weather: ${weatherData.current.temperature}°C, ${weatherData.current.condition}, Wind: ${weatherData.current.windSpeed} km/h, Humidity: ${weatherData.current.humidity}%
- Forecast for ${targetDateLabel}:
  * Min Temperature: ${minTemp}°C, Max Temperature: ${maxTemp}°C
  * Rain Probability: ${rainAnalysis.maxRainProbability}% (${rainAnalysis.maxRainProbability >= 60 ? 'શક્યતા વધુ છે / likely' : rainAnalysis.maxRainProbability >= 30 ? 'શક્યતા છે / possible' : 'શક્યતા ઓછી છે / unlikely'})
  * Expected Rainfall: ${rainAnalysis.totalRainAmountMm} mm
  * Expected Sky Condition: ${weatherData.daily[0]?.condition || weatherData.current.condition}
${rainAnalysis.peakRainTimeWindow ? `  * Peak Rain Time Window: ${rainAnalysis.peakRainTimeWindow}` : ''}`;

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

    const fallbackAns = this.generateFallbackAnswer(question, nlu, weatherData, rainAnalysis, targetDateStr);
    return fallbackAns;
  }

  private generateFallbackAnswer(
    question: string,
    nlu: ParsedNLU,
    weatherData: WeatherData,
    rainAnalysis: RainAnalysisResult,
    targetDateStr: string
  ): string {
    const loc = weatherData.location.name;
    const hasIndicScript = /[\u0900-\u0D7F]/.test(question);
    const hasGujaratiScript = /[\u0A80-\u0AFF]/.test(question);
    const hasDevanagariScript = /[\u0900-\u097F]/.test(question);

    const isExplicitEnglish = nlu.language === 'en' && !hasIndicScript;

    const isGujarati = !isExplicitEnglish && (
      nlu.language === 'gu' ||
      hasGujaratiScript ||
      /\b(?:kale|aaje|varsad|padse|hase|bapore|savare|sanje|vatavaran|thase|thashe|kevu|kevi|kevo|ketlu|ketli|ketla|tapman|hawaaman|chhe)\b/i.test(question)
    );
    const isMarathi = !isExplicitEnglish && !isGujarati && (
      nlu.language === 'mr' ||
      (hasDevanagariScript && /कसे|हवामान|आहे|नागपूर|कसा|कशी|झाले|काय|मध्ये/i.test(question)) ||
      /\b(?:kase|kasa|kashi|aahe|ani|madhye|kadhi|kiti)\b/i.test(question)
    );
    const isHindi = !isExplicitEnglish && !isGujarati && !isMarathi && (
      nlu.language === 'hi' ||
      nlu.language === 'hinglish' ||
      hasDevanagariScript ||
      /\b(?:barish|baarish|mausam|hoga|hogi|hoge|kaisa|kaisi|kaise|batao|bataye|aaj|taapman|chata|aandhi)\b/i.test(question)
    );

    const isLaundryQuery = /kapda|કપડાં|સુકવવા|कपड़े|wash|dry|dhova|kapada/i.test(question);
    const isTravelQuery = /travel|driving|trip|musafari|મુસાફરી|જવું|નિક્ળવું|jaay|jaai|સફર|હાઇવે|highway|road/i.test(question);
    const isHumidityQuery = /bafaro|બફારો|ભેજ|humidity|moisture|bafara/i.test(question);
    const isWindQuery = /pavan|પવન|hawa|wind|storm|ઝડપ|દિશા|hava/i.test(question);
    const isColdQuery = /thandi|ઠંડી|cold|chilly|winter|jacket|sweater|ગરમ/i.test(question);
    const isUmbrellaQuery = /chhatri|છત્રી|umbrella|raincoat|રેઈનકોટ|લેવી/i.test(question);
    const isGarmiQuery = nlu.intent === 'temperature' || /garmi|ગરમી|ગરીમી|તાપમાન|temp|heat|hot/i.test(question);
    const isRainQuery = nlu.intent === 'rain_forecast' || /rain|varsad|વરસાદ|ઝાપટાં|બુંદાબુંદી|बारिश/i.test(question);

    const stats = getTimeRangeStats(weatherData, targetDateStr, nlu.timeRange, nlu.specificTimeRange);
    const maxTemp = stats.maxTemp;
    const minTemp = stats.minTemp;
    const rainProb = stats.maxRainProb;
    const windSpeed = stats.avgWind;

    const dateLabelGu = nlu.targetDate === 'tomorrow' ? 'કાલે' : nlu.targetDate === 'day_after_tomorrow' ? 'પરમદિવસે' : 'આજે';
    const dateLabelHi = nlu.targetDate === 'tomorrow' ? 'कल' : nlu.targetDate === 'day_after_tomorrow' ? 'परसों' : 'आज';
    const dateLabelEn = nlu.targetDate === 'tomorrow' ? 'Tomorrow' : nlu.targetDate === 'day_after_tomorrow' ? 'Day After Tomorrow' : 'Today';

    const rainLikelihoodGu = rainProb >= 60 ? 'શક્યતા વધુ છે' : rainProb >= 30 ? 'શક્યતા છે' : 'શક્યતા ઓછી છે';
    const rainLikelihoodHi = rainProb >= 60 ? 'संभावना अधिक है' : rainProb >= 30 ? 'संभावना है' : 'कम संभावना है';
    const rainLikelihoodEn = rainProb >= 60 ? 'likely' : rainProb >= 30 ? 'possible' : 'unlikely';

    // Gujarati Response Handling
    if (isGujarati) {
      const gujCond = translateConditionToGujarati(stats.condition);

      if (isRainQuery) {
        if (rainProb >= 50) {
          return `${loc} માં ${dateLabelGu.toLowerCase()} વરસાદ પડવાની શક્યતા વધુ છે (આશરે ${rainProb}% સંભાવના). બહાર નીકળતી વખતે સાથે છત્રી કે રેઈનકોટ રાખવો હિતાવહ છે.`;
        } else if (rainProb >= 25) {
          return `${loc} માં ${dateLabelGu.toLowerCase()} હળવા વરસાદી ઝાપટાં પડવાની શક્યતા છે (આશરે ${rainProb}% સંભાવના), પરંતુ ભારે વરસાદની શક્યતા ઓછી છે.`;
        } else {
          return `${loc} માં ${dateLabelGu.toLowerCase()} વરસાદની શક્યતા ઓછી (${rainProb}%) છે. વાતાવરણ મુખ્યત્વે ${gujCond} અને સાફ રહેશે.`;
        }
      }

      if (isGarmiQuery) {
        const garmiAdvice = maxTemp >= 38 ? 'બપોરના સમયે ગરમી અને બફારો વધુ અનુભવાશે, જેથી પૂરતું પાણી પીવું હિતાવહ છે.' : 'ગરમીનું પ્રમાણ સામાન્ય રહેશે અને વાતાવરણ અનુકૂળ રહેશે.';
        return `${loc} માં ${dateLabelGu.toLowerCase()} તાપમાન ${minTemp}°C થી ${maxTemp}°C વચ્ચે રહેવાની શક્યતા છે. ${garmiAdvice}`;
      }

      if (isUmbrellaQuery) {
        return rainProb >= 35
          ? `હા, ${loc} માં ${dateLabelGu.toLowerCase()} વરસાદ પડવાની શક્યતા (${rainProb}%) હોવાથી બહાર જતી વખતે સાથે છત્રી કે રેઈનકોટ રાખવો હિતાવહ છે.`
          : `ના, ${loc} માં ${dateLabelGu.toLowerCase()} વરસાદની શક્યતા ઘણી ઓછી (${rainProb}%) હોવાથી છત્રી સાથે રાખવાની ખાસ જરૂર નથી.`;
      }

      if (isLaundryQuery) {
        return rainProb >= 35
          ? `${loc} માં ${dateLabelGu.toLowerCase()} વરસાદ પડવાની શક્યતા (${rainProb}%) હોવાથી કપડાં બહાર સુકવવા યોગ્ય નથી, અંદર સુકવવા હિતાવહ છે.`
          : `${loc} માં ${dateLabelGu.toLowerCase()} આકાશ ખુલ્લું હોવાથી કપડાં બહાર તડકામાં સુકવવા માટે અનુકૂળ સમય છે.`;
      }

      if (isTravelQuery) {
        return rainProb >= 50
          ? `${loc} માં ${dateLabelGu.toLowerCase()} વરસાદી માહોલ હોવાથી મુસાફરી દરમિયાન રસ્તા પર સાવચેતીથી વાહન ચલાવવું.`
          : `${loc} માં ${dateLabelGu.toLowerCase()} મુસાફરી માટે હવામાન અને રસ્તા અનુકૂળ રહેશે.`;
      }

      if (isHumidityQuery) {
        return weatherData.current.humidity >= 70
          ? `${loc} માં ભેજનું પ્રમાણ ${weatherData.current.humidity}% હોવાથી બફારો વધુ અનુભવાશે, સુતરાઉ કપડાં પહેરવા હિતાવહ છે.`
          : `${loc} માં ભેજ અને બફારો સામાન્ય રહેશે.`;
      }

      if (isColdQuery) {
        return minTemp <= 18
          ? `${loc} માં સવારે અને રાત્રે ઠંડી રહેવાની શક્યતા (તાપમાન ${minTemp}°C) હોવાથી હળવા ગરમ કપડાં સાથે રાખવા.`
          : `${loc} માં ઠંડીનું પ્રમાણ સામાન્ય રહેશે.`;
      }

      let summaryGu = `${loc} માં ${dateLabelGu.toLowerCase()} હવામાન મુખ્યત્વે ${gujCond} રહેશે. તાપમાન ${minTemp}°C થી ${maxTemp}°C વચ્ચે રહેશે અને પવનની ઝડપ આશરે ${windSpeed} કિમી/કલાક રહેશે. વરસાદની ${rainLikelihoodGu} (${rainProb}%) છે.`;
      if (rainProb >= 40) summaryGu += ' બહાર જતી વખતે સાથે છત્રી રાખવી હિતાવહ છે.';
      else if (maxTemp >= 38) summaryGu += ' બપોરે પુષ્કળ પાણી પીવું અને સીધા તડકાથી બચવું.';
      else summaryGu += ' હવામાન અનુકૂળ છે, સામાન્ય દિનચર્યા ચાલુ રાખી શકો છો.';

      return summaryGu;
    }

    // Hindi Response Handling
    if (isHindi) {
      const hiCond = translateConditionToHindi(stats.condition);

      if (isRainQuery) {
        if (rainProb >= 50) {
          return `${loc} में ${dateLabelHi.toLowerCase()} बारिश की संभावना अधिक है (लगभग ${rainProb}% संभावना)। बाहर निकलते समय छाता या रेनकोट साथ रखना बेहतर होगा।`;
        } else if (rainProb >= 25) {
          return `${loc} में ${dateLabelHi.toLowerCase()} हल्की बूंदाबांदी संभव है (${rainProb}% संभावना), लेकिन तेज बारिश की संभावना कम है।`;
        } else {
          return `${loc} में ${dateLabelHi.toLowerCase()} बारिश की संभावना बहुत कम (${rainProb}%) है। मौसम साफ रहेगा।`;
        }
      }

      if (isGarmiQuery) {
        return `${loc} में ${dateLabelHi.toLowerCase()} तापमान ${minTemp}°C से ${maxTemp}°C के बीच रहेगा। ${maxTemp >= 38 ? 'दोपहर में तेज गर्मी का असर रहेगा, इसलिए पर्याप्त पानी पिएं।' : 'मौसम सामान्य और आरामदायक बना रहेगा।'}`;
      }

      if (isUmbrellaQuery) {
        return rainProb >= 35
          ? `हाँ, ${loc} में ${dateLabelHi.toLowerCase()} बारिश की संभावना (${rainProb}%) को देखते हुए छाता साथ रखना उचित रहेगा।`
          : `नहीं, ${loc} में ${dateLabelHi.toLowerCase()} बारिश की संभावना कम (${rainProb}%) होने के कारण छाते की आवश्यकता नहीं है।`;
      }

      if (isLaundryQuery) {
        return rainProb >= 35
          ? `${loc} में ${dateLabelHi.toLowerCase()} बारिश की संभावना (${rainProb}%) के कारण कपड़े अंदर सुखाना बेहतर होगा।`
          : `${loc} में ${dateLabelHi.toLowerCase()} धूप खिली रहने के कारण कपड़े बाहर सुखाने के लिए अच्छा दिन है।`;
      }

      if (isTravelQuery) {
        return rainProb >= 50
          ? `${loc} में ${dateLabelHi.toLowerCase()} बारिश के कारण यात्रा करते समय सड़कों पर सावधानी बरतें।`
          : `${loc} में ${dateLabelHi.toLowerCase()} सफर के लिए मौसम और परिस्थितियां बिल्कुल अनुकूल हैं।`;
      }

      let summaryHi = `${loc} में ${dateLabelHi.toLowerCase()} मौसम मुख्यतः ${hiCond} रहेगा। तापमान ${minTemp}°C से ${maxTemp}°C के बीच और हवा की गति ~${windSpeed} किमी/घंटा रहेगी। बारिश की ${rainLikelihoodHi} (${rainProb}%) है।`;
      if (rainProb >= 40) summaryHi += ' बाहर जाते समय छाता साथ रखें।';
      else if (maxTemp >= 38) summaryHi += ' दोपहर में तेज धूप और गर्मी से बचाव के लिए पर्याप्त पानी पिएं।';
      else summaryHi += ' मौसम सामान्य गतिविधियों के लिए पूरी तरह अनुकूल है।';

      return summaryHi;
    }

    // English Response Handling (Default)
    if (isRainQuery) {
      if (rainProb >= 50) {
        return `In ${loc}, rain is likely ${dateLabelEn.toLowerCase()} with a ${rainProb}% probability. Carrying an umbrella or raincoat is advised.`;
      } else if (rainProb >= 25) {
        return `In ${loc}, light passing showers are possible ${dateLabelEn.toLowerCase()} (${rainProb}% chance), but heavy rain is unlikely.`;
      } else {
        return `Rain is unlikely in ${loc} ${dateLabelEn.toLowerCase()} with only a ${rainProb}% chance. Conditions will remain mostly ${stats.condition.toLowerCase()}.`;
      }
    }

    if (isGarmiQuery) {
      return `In ${loc}, temperatures ${dateLabelEn.toLowerCase()} will range from ${minTemp}°C to ${maxTemp}°C. ${maxTemp >= 38 ? 'Afternoon hours will be quite warm, so stay well hydrated.' : 'Temperatures will remain comfortable throughout the day.'}`;
    }

    if (isUmbrellaQuery) {
      return rainProb >= 35
        ? `Yes, rain is possible in ${loc} ${dateLabelEn.toLowerCase()} (${rainProb}% chance), so carrying an umbrella is recommended.`
        : `No umbrella is needed in ${loc} ${dateLabelEn.toLowerCase()} as the rain chance is very low (${rainProb}%).`;
    }

    if (isLaundryQuery) {
      return rainProb >= 35
        ? `Drying clothes outdoors in ${loc} is not recommended ${dateLabelEn.toLowerCase()} due to a ${rainProb}% chance of rain.`
        : `It is a great day to dry clothes outside in ${loc} ${dateLabelEn.toLowerCase()} with low rain risk (${rainProb}%).`;
    }

    if (isTravelQuery) {
      return rainProb >= 50
        ? `Drive carefully in ${loc} as wet roads are likely ${dateLabelEn.toLowerCase()} due to rain.`
        : `Road and weather conditions in ${loc} are favorable for travel ${dateLabelEn.toLowerCase()}.`;
    }

    let summaryEn = `Weather in ${loc} ${dateLabelEn.toLowerCase()} will be mostly ${stats.condition.toLowerCase()}. Temperatures will range between ${minTemp}°C and ${maxTemp}°C with winds around ${windSpeed} km/h. Rain chance is ${rainProb}% (${rainLikelihoodEn}).`;
    if (rainProb >= 40) summaryEn += ' Carrying an umbrella when heading out is advised.';
    else if (maxTemp >= 38) summaryEn += ' Stay hydrated and protect against afternoon heat.';
    else summaryEn += ' Conditions are favorable for regular daily activities.';

    return summaryEn;
  }

  async generateGreeting(question: string, language: string): Promise<string> {
    const fullLangName = languageService.getLanguageName(language);

    if (openAIClient.isConfigured()) {
      try {
        const prompt = `User sent greeting: "${question}". Synthesize a warm, polite, dynamic greeting in ${fullLangName}. Introduce yourself as WeatherGPT and ask which city or village weather they want to check today. Keep it 1-2 natural sentences with appropriate emojis.`;
        const res = await openAIClient.generateChatCompletion(
          'You are WeatherGPT, a friendly AI weather assistant for India.',
          prompt
        );
        if (res && res.trim()) return res.trim();
      } catch (err) {
        logger.warn('LLM greeting generation failed, using fallback:', err);
      }
    }

    const gujGreetings = [
      'નમસ્તે! 🙏 હું WeatherGPT છું. હું તમને ભારતના કોઈપણ શહેર કે ગામનું લાઈવ હવામાન જણાવવામાં મદદ કરી શકું છું. તમારે કયા લોકેશનનું હવામાન જાણવું છે?',
      'હલો! 😊 WeatherGPT માં તમારું સ્વાગત છે. આજે તમે કયા સ્થળનું તાપમાન કે વરસાદનું એનાલિસિસ જોવા માંગો છો? મને જણાવો!',
      'નમસ્કાર! 🌤️ હું તમારો WeatherGPT આસિસ્ટન્ટ છું. તમારે કયા શહેર કે ગામ વિશે હવામાન પૂછવું છે?',
      'જય શ્રી કૃષ્ણ! 🙏 WeatherGPT આપની સેવામાં હાજર છે. તમને કયા લોકેશનનું લાઈવ વેધર અપડેટ જોઈએ છે?'
    ];

    const hiGreetings = [
      'नमस्ते! 🙏 मैं WeatherGPT हूँ। मैं भारत के किसी भी शहर या गाँव के सटीक मौसम की जानकारी दे सकता हूँ। आप किस स्थान का मौसम जानना चाहते हैं?',
      'हेलो! 🌤️ WeatherGPT में आपका स्वागत है। आज आप किस शहर का तापमान या बारिश का अपडेट देखना चाहते हैं?',
      'नमस्कार! 😊 मैं आपका WeatherGPT असिस्टेंट हूँ। कृपया अपना शहर या गाँव बताएं जिसका मौसम आप जानना चाहते हैं।'
    ];

    const enGreetings = [
      'Hello! 👋 I am WeatherGPT, your AI weather assistant. Which city or village weather would you like to check today?',
      'Greetings! 🌤️ Welcome to WeatherGPT. Please tell me which location\'s live weather forecast you\'d like to see!',
      'Hi there! 😊 How can I help you today? Please mention the location whose weather you want to explore.'
    ];

    const mrGreetings = [
      'नमस्कार! 🙏 मी WeatherGPT आहे. मी आपल्याला कोणत्याही शहराचे किंवा गावाचे लाईव्ह हवामान सांगण्यास मदत करू शकतो. आपल्याला कोणत्या ठिकाणाचे हवामान जाणून घ्यायचे आहे?',
      'हॅलो! 🌤️ WeatherGPT मध्ये आपले स्वागत आहे. आज आपण कोणत्या शहराचे हवामान पाहू इच्छिता?'
    ];

    const paGreetings = [
      'ਸਤਿ ਸ਼੍ਰੀ ਅਕਾਲ! 🙏 ਮੈਂ WeatherGPT ਹਾਂ। ਮੈਂ ਭਾਰਤ ਦੇ ਕਿਸੇ ਵੀ ਸ਼ਹਿਰ ਜਾਂ ਪਿੰਡ ਦਾ ਲਾਈਵ ਮੌਸਮ ਦੱਸ ਸਕਦਾ ਹਾਂ। ਤੁਸੀਂ ਕਿਸ ਜਗ੍ਹਾ ਦਾ ਮੌਸਮ ਜਾਣਨਾ ਚਾਹੁੰਦੇ ਹੋ? 🌤️',
      'ਜੀ ਆਇਆਂ ਨੂੰ! 🌤️ WeatherGPT ਵਿੱਚ ਤੁਹਾਡਾ ਸੁਆਗਤ ਹੈ। ਅੱਜ ਤੁਸੀਂ ਕਿਸ ਸ਼ਹਿਰ ਦਾ ਮੌਸਮ ਜਾਂ ਤਾਪਮਾਨ ਦੇਖਣਾ ਚਾਹੁੰਦੇ ਹੋ?'
    ];

    const isPa = language === 'pa' || /[\u0A00-\u0A7F]/.test(question) || /sat\s*sri\s*akal|satsriakal/i.test(question);
    const isGu = !isPa && (language === 'gu' || /[\u0A80-\u0AFF]/.test(question) || /kem\s*cho|namaste|halo|ram\s*ram|su\s*prabhat/i.test(question));
    const isHi = !isPa && !isGu && (language === 'hi' || language === 'hinglish' || /namaste|kaisa\s*ho/i.test(question));
    const isMr = !isPa && !isGu && !isHi && (language === 'mr' || /नमस्कार/i.test(question));

    const pool = isPa ? paGreetings : isGu ? gujGreetings : isHi ? hiGreetings : isMr ? mrGreetings : enGreetings;
    const randomIndex = Math.floor(Math.random() * pool.length);
    return pool[randomIndex];
  }

  async generateOffTopicResponse(question: string, language: string): Promise<string> {
    const fullLangName = languageService.getLanguageName(language);

    const isPa = language === 'pa' || /[\u0A00-\u0A7F]/.test(question);
    const isGu = language === 'gu' || /[\u0A80-\u0AFF]/.test(question);
    const isHi = language === 'hi' || /[\u0900-\u097F]/.test(question);
    const isHinglish = language === 'hinglish';
    const isMr = language === 'mr';

    // Rule-based helpful fallbacks for common general queries (Extremely fast responses)
    if (/who\s*(?:are|r)\s*you|તમે\s*કોણ|કોણ\s*છો|तुम\s*कौन|aap\s*kaun|who\s*made\s*you/i.test(question)) {
      if (isGu) return `હું WeatherGPT છું, તમારો સ્માર્ટ AI આસિસ્ટન્ટ! 🌤️ હું તમને હવામાન, વરસાદ, ખેતીના પાક, વાતાવરણ તેમજ તમારા કોઈપણ સામાન્ય પ્રશ્નોના સચોટ જવાબો આપવામાં મદદ કરી શકું છું. તમે મને કોઈપણ વિષય વિશે પૂછી શકો છો! 😊`;
      if (isHi || isHinglish) return `मैं WeatherGPT हूँ, आपका स्मार्ट AI असिस्टेंट! 🌤️ मैं आपको मौसम, बारिश, खेती-किसानी, जलवायु और आपके किसी भी सामान्य प्रश्न का सही उत्तर देने के लिए यहाँ हूँ। आप मुझसे कुछ भी पूछ सकते हैं! 😊`;
      return `I am WeatherGPT, your smart AI Assistant! 🌤️ I can help you with live weather forecasts, rain alerts, agricultural advisories, and answer any general questions you may have. Feel free to ask me anything! 😊`;
    }

    if (/joke|જોક્સ|જોક|ચુટકુલા/i.test(question)) {
      if (isGu) return `😄 એક મજાનો જોક:\nશિક્ષક: 'વરસાદ' અને 'પરીક્ષા' માં શું સમાનતા છે?\nવિદ્યાર્થી: બંનેની તૈયારી ગમે તેટલી કરો, છેલ્લે ધોવાઈ જ જવાય છે! 🌧️😂`;
      if (isHi || isHinglish) return `😄 एक मज़ेदार जोक:\nटीचर: बारिश और परीक्षा में क्या समानता है?\nछात्र: सर, तैयारी चाहे कितनी भी कर लो, अंत में भीगना ही पड़ता है! 🌧️😂`;
      return `😄 Here's a weather joke for you:\nWhy did the cloud stay home from school?\nBecause it was feeling a little under the weather! ☁️😂`;
    }

    if (openAIClient.isConfigured()) {
      try {
        const prompt = `You are WeatherGPT, a helpful, highly intelligent, multi-talented AI assistant.
User Question: "${question}"
Target Language: ${fullLangName} (${language})

Instructions:
1. Provide a direct, comprehensive, accurate, and friendly answer to the user's question in ${fullLangName}.
2. Use the exact script and language (${fullLangName}) matching the user's query (Gujarati in Gujarati, Hindi in Hindi, English in English, etc.).
3. NEVER refuse to answer or say you only answer weather questions. Be fully responsive, warm, and helpful for whatever the user asks.
4. Keep the tone conversational, helpful, and concise with clean markdown formatting and friendly emojis.`;

        const res = await openAIClient.generateChatCompletion(
          'You are WeatherGPT, a highly responsive, helpful AI assistant.',
          prompt
        );
        if (res && res.trim()) return res.trim();
      } catch (err) {
        logger.warn('LLM general response generation failed, using fallback:', err);
      }
    }

    if (isPa) {
      return `ਮੈਂ WeatherGPT ਤੁਹਾਡਾ ਏਆਈ ਅਸਿਸਟੈਂਟ ਹਾਂ। 🌤️ ਮੈਂ ਤੁਹਾਡੇ ਹਰ ਸਵਾਲ ਦਾ ਜਵਾਬ ਦੇਣ ਅਤੇ ਮੌਸਮ ਬਾਰੇ ਜਾਣਕਾਰੀ ਦੇਣ ਲਈ ਹਾਜ਼ਰ ਹਾਂ। ਕਿਰਪਾ ਕਰਕੇ ਕੋਈ ਵੀ ਸਵਾਲ ਪੁੱਛੋ! 🙏`;
    }

    if (isGu) {
      return `હું WeatherGPT એક એઆઈ આસિસ્ટન્ટ છું. 🌤️ હું તમને હવામાનની સાથે સાથે કોઈપણ માહિતી કે પ્રશ્નનો જવાબ આપવામાં મદદ કરી શકું છું. તમે મને કોઈપણ શહેરના હવામાન કે અન્ય વિષય વિશે પૂછી શકો છો! 🙏`;
    }

    if (isHi) {
      return `मैं WeatherGPT एक एआई असिस्टेंट हूँ। 🌤️ मैं मौसम के साथ-साथ आपके किसी भी सवाल का जवाब देने में आपकी पूरी सहायता कर सकता हूँ। आप मुझसे मौसम या किसी भी विषय पर पूछ सकते हैं! 🙏`;
    }

    if (isHinglish) {
      return `Main WeatherGPT ek AI Assistant hoon. 🌤️ Main weather ke saath saath aapke kisi bhi sawal ka answer de sakta hoon. Aap mujhse mausam ya kisi bhi topic par puchh sakte hain! 🙏`;
    }

    if (isMr) {
      return `मी WeatherGPT एक AI सहाय्यक आहे. 🌤️ मी हवामानासोबतच आपल्या कोणत्याही प्रश्नाचे उत्तर देण्यास तयार आहे. आपण मला कोणत्याही विषयावर विचारू शकता! 🙏`;
    }

    return `I am WeatherGPT, an AI Assistant. 🌤️ I am here to help you with live weather forecasts, agricultural tips, and answer any questions you have. Feel free to ask! 🙏`;
  }

  private appendFollowupSuggestion(rawAnswer: string, language: string, question: string): string {
    if (/તમારે|તમારે\s*વધારે|જો\s*તમારે|यदि\s*आप|अगर\s*आप|if\s*you\s*would\s*like|puchhi\s*sako|જાણવું\s*હોય|ਜੇਕਰ\s*ਤੁਸੀਂ|तुम्हाला\s*आज/i.test(rawAnswer)) {
      return rawAnswer;
    }

    const isGu = language === 'gu' || /[\u0A80-\u0AFF]/.test(question);
    const isHi = language === 'hi' || /[\u0900-\u097F]/.test(question);
    const isHinglish = language === 'hinglish';
    const isMr = language === 'mr';
    const isPa = language === 'pa' || /[\u0A00-\u0A7F]/.test(question);
    const isTa = language === 'ta' || /[\u0B80-\u0BFF]/.test(question);
    const isTe = language === 'te' || /[\u0C00-\u0C7F]/.test(question);
    const isBn = language === 'bn' || /[\u0980-\u09FF]/.test(question);

    let offerSentence = '';

    if (isGu) {
      offerSentence = '\n\nતમારે આજે સાંજે કેવું વાતાવરણ રહેશે અથવા કાલે વરસાદ પડશે કે કેમ તે વધારે માહિતી જાણવી હોય તો મને પૂછી શકો છો! 😊';
    } else if (isHinglish) {
      offerSentence = '\n\nAgar aapko aaj shaam ke mausam ya kal ke rain/temperature ke baare mein aur jaanna hai, toh aap mujhse puch sakte hain! 😊';
    } else if (isHi) {
      offerSentence = '\n\nयदि आप आज शाम के मौसम या कल के बारिश/तापमान के बारे में और जानकारी चाहते हैं, तो मुझसे पूछ सकते हैं! 😊';
    } else if (isMr) {
      offerSentence = '\n\nतुम्हाला आज संध्याकाळचे हवामान किंवा उद्याच्या पावसाची अधिक माहिती हवी असेल तर मला नक्की विचारा! 😊';
    } else if (isPa) {
      offerSentence = '\n\nਜੇਕਰ ਤੁਸੀਂ ਅੱਜ ਸ਼ਾਮ ਦੇ ਮੌਸਮ ਜਾਂ ਕੱਲ੍ਹ ਦੇ ਮੀਂਹ/ਤਾਪਮਾਨ ਬਾਰੇ ਹੋਰ ਜਾਣਕਾਰੀ ਚਾਹੁੰਦੇ ਹੋ, ਤਾਂ ਮੈਨੂੰ ਪੁੱਛ ਸਕਦੇ ਹੋ! 😊';
    } else if (isTa) {
      offerSentence = '\n\nஇன்று மாலை வானிலை அல்லது நாளைய மழை பற்றிய கூடுதல் தகவலுக்கு என்னிடம் கேட்கலாம்! 😊';
    } else if (isTe) {
      offerSentence = '\n\nఈరోజు సాయంత్రం వాతావరణం లేదా రేపటి వర్షం గూర్చి మరింత సమాచారం కావాలంటే నన్ను అడగవచ్చు! 😊';
    } else if (isBn) {
      offerSentence = '\n\nআপনি যদি আজ সন্ধ্যার আবহাওয়া বা আগামীকালের পূর্বাভাস সম্পর্কে আরও জানতে চান, তবে আমাকে জিজ্ঞাসা করতে পারেন! 😊';
    } else {
      offerSentence = '\n\nIf you would like more information, such as the evening weather forecast or tomorrow\'s rain/temperature, feel free to ask me! 😊';
    }

    return rawAnswer.trim() + offerSentence;
  }
}

export const llmService = new LLMService();
