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

    return this.heuristicNLU(question, locationContext);
  }

  private heuristicNLU(question: string, locationContext?: LocationEntity | LocationInput): ParsedNLU {
    const qLower = question.toLowerCase();

    let intent: ParsedNLU['intent'] = 'general_forecast';
    if (/^(?:hello|hi|hey|helo|kem\s*cho|namaste|namaskar|halo|ram\s*ram|su\s*prabhat|good\s*morning|good\s*evening|good\s*afternoon|good\s*night|pranam|jay\s*shree\s*krishna|har\s*har\s*mahadev|kaisa\s*ho|નમસ્તે|નમસ્કાર|કેમ\s*છો|હલો|પ્રણામ|હાય|હેલો|હરિ\s*ઓમ)\b/i.test(question.trim())) {
      intent = 'greeting';
    } else if (/garmi|ગરમી|ગરીમી|bafaro|બફારો|thandi|ઠંડી|તાપમાન|तापमान|गर्मी|ठंड|temp|temperature|heat|hot|cold|warm|degree|ડિગ્રી/i.test(question)) {
      intent = 'temperature';
    } else if (/rain|varsad|बारिश|મழை|મજ્હા|મળ|પાણી|વરસાદ|chances of rain|umbrella/i.test(question)) {
      intent = 'rain_forecast';
    } else if (/right now|currently|current|હાલ|અત્યારે|अभी/i.test(question)) {
      intent = 'current_weather';
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
      'બેંગ્લોર': 'Bangalore', 'હૈદરાબાદ': 'Hyderabad'
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

    if (!locationName) {
      // Suffix match for Indic inflections (Gujarati, Hindi, Marathi)
      const suffixMatch = question.match(/([A-Za-z\u0A80-\u0AFF\u0900-\u097F]{2,30})\s*(?:मध्ये|मधे|्यात|ात|ત|તમાં|માં|મા|में|से|કો|को|નું|ની|નો|ના)(?:\s|[.,?!]|$|\b)/i);
      if (suffixMatch) {
        let candidate = suffixMatch[1].trim();
        candidate = candidate.replace(/^(?:kale|aaje|today|tomorrow|kal|shyam|sanje|savare|morning|evening|night|garmi|thandi|aaj|aata)\s*/i, '').trim();
        if (candidate && candidate.length >= 2) {
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
        if (candidate && candidate.length >= 2) {
          locationName = candidate;
        }
      }
    }

    if (!locationName) {
      const postMatch = question.match(/([A-Za-z\u0A80-\u0AFF\u0900-\u097F\s]{2,30})\s+(?:ma|માં|મા|me|mein)\b/i);
      if (postMatch) {
        let candidate = postMatch[1].trim();
        candidate = candidate.replace(/^(?:kale|aaje|today|tomorrow|kal|shyam|sanje|savare|morning|evening|night|garmi|thandi)\s+/i, '').trim();
        if (candidate) {
          locationName = candidate;
        }
      }
    }

    if (!locationName) {
      // Ensure word boundary before in, at, for, near, of, around so words like "What", "That" don't match
      const inMatch = question.match(/\b(?:in|at|for|near|of|around)\s+([A-Za-z\u0A80-\u0AFF\u0900-\u097F\s]{2,30})/i);
      if (inMatch) {
        let candidate = inMatch[1].trim();
        candidate = candidate.split(/\s+(?:today|tomorrow|tonight|rain|varsad|hase|padse|ke|nai|hoga|kya|garmi|thandi)\b/i)[0].trim();
        candidate = candidate.replace(/[.,?!]+$/, '').trim();
        if (candidate && candidate.length >= 2) {
          locationName = candidate;
        }
      }
    }

    if (locationName) {
      locationName = locationName
        .replace(/\b(?:my\s*location|mara\s*location|mare\s*location|near\s*me|my\s*city|here|અહીં|અહીંનું|મારી\s*જગ્યા|મેરે\s*પાસ|મેરે\s*શહર)\b/gi, '')
        .replace(/\b(?:varsad|rain|weather|forecast|hoga|hogi|padse|hase|ke|nai|kya|aaje|kale|today|tomorrow|shyam|sanje|savare|temp|taapman|garmi|thandi|bafaro|kase|aahe|hawaman)\b/gi, '')
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

    const isExplicitOffTopic = /what\s*is\s*my\s*name|maru\s*naa?m|mera\s*naa?m|who\s*am\s*i|my\s*age|maru\s*nam|mera\s*nam|who\s*are\s*you|tamaru\s*naam|aapka\s*naam|who\s*made\s*you|kone\s*banavya|kisine\s*banaya|who\s*created|tell\s*me\s*a?\s*joke|chutkule|joke\s*suno|tell\s*story|kahani|recipe|cook|capital\s*of|prime\s*minister|pm\s*of|president|who\s*is\s*the|calculate|2\s*\+\s*2|math|programming|write\s*a?\s*code|song\s*suno|gana\s*gao|song|movie|cinema/i.test(question);
    const hasWeatherKeywords = /weather|havaman|vatavaran|mausam|hawa|rain|varsad|barish|garmi|bafaro|thandi|tapman|taapman|temp|temperature|cloud|vadal|badal|sun|tado|dhoop|climate|chhatri|umbrella|storm|toofan|cyclone|flood|pur|wind|pawan|pavan|humidity|uv|degree|ડિગ્રી|ઝાપટાં|ઝાપટું/i.test(question);

    if (isExplicitOffTopic || (intent === 'general_forecast' && !hasWeatherKeywords && !locationName && !/^(?:how|kevu|kaisa|kaha|kya|su|chhe|hai)\b/i.test(question.trim()))) {
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

  async generateAnswer(
    question: string,
    nlu: ParsedNLU,
    weatherData: WeatherData,
    rainAnalysis: RainAnalysisResult
  ): Promise<string> {
    const tz = weatherData.location.timezone || 'Asia/Kolkata';
    const localNow = getCurrentTimeInTimezone(tz);
    const targetDateStr = getRelativeDateString(nlu.targetDate || 'today', tz, nlu.specificDateStr);

    const fullLangName = languageService.getLanguageName(nlu.language);

    const userPromptPayload = `
User Question: "${question}"
Detected Language: ${fullLangName} (Code: ${nlu.language})
CRITICAL LANGUAGE REQUIREMENT: You MUST synthesize your response strictly in the EXACT SAME language and script as the user query (${fullLangName}).
- If the user asked in Gujarati, reply in Gujarati.
- If in Marathi, reply in Marathi.
- If in Hindi, reply in Hindi.
- If in Hinglish or Gujlish (Roman script), reply in Hinglish/Gujlish using Roman script.
- Do NOT default to English unless the question was originally asked in English.

User Intent Focus: ${nlu.intent}
Specific Question Guidance: Answer the user's EXACT question directly in the very first sentence. For example:
- If user asks about drying clothes/laundry: Focus immediately on outdoor drying suitability and rain risk!
- If user asks about travel/driving: Focus immediately on highway road conditions and rain/wind safety!
- If user asks about humidity/bafaro: Focus immediately on humidity % and mugginess!
- If user asks about wind: Focus immediately on wind speed in km/h and gustiness!
- If user asks about cold/thandi: Focus immediately on minimum temperature drop and jacket/sweater advice!
- If user asks about umbrella/raincoat: Answer directly whether an umbrella is required!
- Do NOT output repetitive generic templates across different queries. Make the answer unique to "${weatherData.location.name}" and the user's question.

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

Synthesize a clear, concise, accurate answer answering the user's exact question in ${fullLangName} (${nlu.language}).
Follow all rules of WeatherGPT system prompt.
`;

    if (openAIClient.isConfigured()) {
      try {
        const answer = await openAIClient.generateChatCompletion(
          WEATHER_GPT_SYSTEM_PROMPT,
          userPromptPayload
        );
        if (answer && answer.trim().length > 0) {
          return this.appendFollowupSuggestion(answer.trim(), nlu.language, question);
        }
      } catch (err) {
        logger.warn('LLM answer generation failed, using rule-based fallback:', err);
      }
    }

    const fallbackAns = this.generateFallbackAnswer(question, nlu, weatherData, rainAnalysis, targetDateStr);
    return this.appendFollowupSuggestion(fallbackAns, nlu.language, question);
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
      /\b(?:kale|aaje|varsad|padse|hase|nai|ke|sanje|savare|bapore|ma|mein|garmi|thandi)\b/i.test(question);
    const isMarathi = !isGujarati && (nlu.language === 'mr' || (/[\u0900-\u097F]/.test(question) && /कसे|हवामान|आहे|आज|मुंबई|पुणे|नागपूर|कसा|कशी|झाले|काय|નાही|मध्ये/i.test(question)));
    const isHindi = !isGujarati && !isMarathi && (nlu.language === 'hi' || nlu.language === 'hinglish');

    const isLaundryQuery = /kapda|કપડાં|સુકવવા|कपड़े|wash|dry|dhova|kapada/i.test(question);
    const isTravelQuery = /travel|driving|trip|musafari|મુસાફરી|જવું|નિક્ળવું|jaay|jaai|સફર|હાઇવે|highway|road/i.test(question);
    const isHumidityQuery = /bafaro|બફારો|ભેજ|humidity|moisture|bafara/i.test(question);
    const isWindQuery = /pavan|પવન|hawa|wind|storm|ઝડપ|દિશા|hava/i.test(question);
    const isColdQuery = /thandi|ઠંડી|cold|chilly|winter|jacket|sweater|ગરમ/i.test(question);
    const isUmbrellaQuery = /chhatri|છત્રી|umbrella|raincoat|રેઈનકોટ|લેવી/i.test(question);
    const isAgriQuery = /kheti|ખેતી|પાક|crop|farm|pesticide|irrigation|ખાતર|ખેડૂત/i.test(question);
    const isAqiQuery = /aqi|પ્રદૂષણ|pollution|air quality|હવા/i.test(question);
    const isNightQuery = /ratre|રાત્રે|night|મોડી/i.test(question);
    const isMorningQuery = /savare|સવારે|morning/i.test(question);
    const isEveningQuery = /sanje|સાંજે|evening/i.test(question);
    const isGarmiQuery = nlu.intent === 'temperature' || /garmi|ગરમી|ગરીમી|તાપમાન|temp|heat|hot/i.test(question);
    const isRainQuery = nlu.intent === 'rain_forecast' || /rain|varsad|વરસાદ|ઝાપટાં|બુંદાબુંદી|बारिश/i.test(question);
    const isDetailRequested = /detail|report|full|card|dashboard|રિપોર્ટ|વિગત/i.test(question);

    const stats = getTimeRangeStats(weatherData, targetDateStr, nlu.timeRange, nlu.specificTimeRange);
    const maxTemp = stats.maxTemp;
    const minTemp = stats.minTemp;
    const rainProb = stats.maxRainProb;
    const rainAmount = stats.totalRainMm;
    const windSpeed = stats.avgWind;

    // Gujarati Response Handling
    if (isGujarati) {
      const gujCond = translateConditionToGujarati(stats.condition);
      const peakTimingGu = rainAnalysis.peakRainTimeWindow ? ` (સૌથી વધુ સંભાવના આશરે ${rainAnalysis.peakRainTimeWindow})` : '';
      const isRelativeQuery = /my\s*location|mara\s*location|mare\s*location|near\s*me|here|uper|per|par|અહીં|અહીંનું|મારી\s*જગ્યા|મેરે\s*પાસ|મેરે\s*શહર/i.test(question);
      const locPrefixGu = isRelativeQuery ? `તમારા હાલના location ${loc} મુજબ ` : `${loc} માં `;

      // 1. Laundry / Drying Clothes Query
      if (isLaundryQuery) {
        if (rainProb >= 40) {
          return `${locPrefixGu}${stats.timePeriodGu} વરસાદની ${rainProb}% સંભાવના અને આકાશ ${gujCond} હોવાથી કપડાં બહાર સુકવવા યોગ્ય નથી 🧺. વરસાદથી કપડાં પલળી શકે છે, તેથી ઘરની અંદર અથવા છત નીચે સુકવવા હિતાવહ છે.`;
        } else {
          return `${locPrefixGu}${stats.timePeriodGu} વાતાવરણ મુખ્યત્વે ${gujCond} અને ખુલ્લું રહેશે ☀️. વરસાદની સંભાવના ખૂબ જ ઓછી (${rainProb}%) હોવાથી કપડાં બહાર તડકામાં સુકવવા માટે ઉત્તમ દિવસ છે 🧺!`;
        }
      }

      // 2. Travel / Driving Query
      if (isTravelQuery) {
        if (rainProb >= 50) {
          return `${locPrefixGu}${stats.timePeriodGu} ${rainProb}% વરસાદી સંભાવના (~${rainAmount} mm વરસાદ) અને આશરે ${windSpeed} km/h પવન હોવાથી મુસાફરી કરતી વખતે રસ્તા પર સાવચેતી રાખવી 🚗. વાહન ધીમે ચલાવવું અને હેડલાઇટ ચાલુ રાખવી.`;
        } else {
          return `${locPrefixGu}${stats.timePeriodGu} હવામાન ખુશનુમા અને અનુકૂળ રહેશે 🚗. પવન ${windSpeed} km/h અને આકાશ ${gujCond} રહેશે. રસ્તાઓ પર મુસાફરી કરવા માટે ઉત્તમ સમય છે!`;
        }
      }

      // 3. Humidity / Mugginess Query
      if (isHumidityQuery) {
        const hum = weatherData.current.humidity;
        const humText = hum >= 70
          ? `ભેજનું પ્રમાણ ${hum}% જેટલું વધારે હોવાથી બફારો વધુ અનુભવાશે 💧.`
          : `ભેજનું પ્રમાણ ${hum}% આસપાસ મધ્યમ રહેશે.`;
        return `${locPrefixGu}${stats.timePeriodGu} ${humText} તાપમાન ${minTemp}°C થી ${maxTemp}°C વચ્ચે રહેશે 🌡️.`;
      }

      // 4. Wind Query
      if (isWindQuery) {
        return `${locPrefixGu}${stats.timePeriodGu} પવનની ઝડપ આશરે ${windSpeed} km/h રહેશે 💨. વાતાવરણ ${gujCond} રહેશે અને તાપમાન ${minTemp}°C થી ${maxTemp}°C આસપાસ રહેશે.`;
      }

      // 5. Cold / Winter Query
      if (isColdQuery) {
        if (minTemp <= 18) {
          return `${locPrefixGu}${stats.timePeriodGu} ન્યૂનતમ તાપમાન ${minTemp}°C સુધી ઘટી શકે છે, જેથી સવારે અને રાત્રે ઠંડીનો અહેસાસ થશે ❄️. હળવા ગરમ કપડાં સાથે રાખવા હિતાવહ છે.`;
        } else {
          return `${locPrefixGu}${stats.timePeriodGu} તાપમાન ${minTemp}°C થી ${maxTemp}°C વચ્ચે રહેશે 🌡️. ઠંડીનું પ્રમાણ સામાન્ય રહેશે અને ગરમી-ઠંડીનો સમતોલ અહેસાસ થશે.`;
        }
      }

      // 6. Umbrella / Raincoat Query
      if (isUmbrellaQuery) {
        if (rainProb >= 40) {
          return `હા, ${locPrefixGu}${stats.timePeriodGu} વરસાદની ${rainProb}% સંભાવના હોવાથી બહાર નીકળતી વખતે સાથે છત્રી અથવા રેઈનકોટ રાખવો જરૂરી છે ☂️.`;
        } else {
          return `ના, ${locPrefixGu}${stats.timePeriodGu} વરસાદની સંભાવના ઓછી (${rainProb}%) હોવાથી છત્રી સાથે રાખવાની ખાસ જરૂર નથી 🌤️.`;
        }
      }

      // 7. Time Specific Query (Morning / Evening / Night)
      if (isNightQuery) {
        return `${locPrefixGu}રાત્રિ દરમિયાન તાપમાન ઘટીને ${minTemp}°C સુધી જઈ શકે છે 🌙. પવન ${windSpeed} km/h અને વરસાદની સંભાવના ${rainProb}% છે.`;
      }
      if (isMorningQuery) {
        return `${locPrefixGu}સવારના સમયે તાપમાન આશરે ${minTemp + 2}°C રહેશે 🌅. વાતાવરણ ${gujCond} અને ખુશનુમા રહેશે.`;
      }
      if (isEveningQuery) {
        return `${locPrefixGu}સાંજનું વાતાવરણ મુખ્યત્વે ${gujCond} રહેશે 🌆. તાપમાન આશરે ${maxTemp - 2}°C અને વરસાદની સંભાવના ${rainProb}%${peakTimingGu} રહેશે.`;
      }

      // 8. Garmi / Temperature Focus
      if (isGarmiQuery) {
        let garmiLevel = maxTemp >= 38
          ? `ભારે ગરમી અને બફારો અનુભવાશે (તાપમાન ${maxTemp}°C સુધી પહોંચશે)`
          : maxTemp >= 32
          ? `મધ્યમ ગરમી રહેશે (તાપમાન ${minTemp}°C થી ${maxTemp}°C ની વચ્ચે)`
          : `ગરમીનું પ્રમાણ સામાન્ય અને ગુલગુલાબી રહેશે (તાપમાન ${minTemp}°C થી ${maxTemp}°C)`;

        return `${locPrefixGu}${stats.timePeriodGu} ${garmiLevel} ☀️. મહત્તમ તાપમાન ${maxTemp}°C અને ન્યૂનતમ તાપમાન ${minTemp}°C રહેશે 🌡️. પવન ${windSpeed} km/h (ભેજ: ${weatherData.current.humidity}%) રહેશે.\n\n💡 *સલાહ: દિવસ દરમિયાન પુષ્કળ પાણી પીવું અને સુતરાઉ કપડાં પહેરવા.*`;
      }

      // 9. Rain Focus
      if (isRainQuery) {
        if (rainProb >= 50) {
          return `હા, ${locPrefixGu}${stats.timePeriodGu} વરસાદી માહોલ રહેશે 🌧️. આશરે ${rainProb}% સંભાવના સાથે મધ્યમ વરસાદ (~${rainAmount} mm) પડવાની શક્યતા છે${peakTimingGu}. સાથે છત્રી રાખવી ☂️.`;
        } else if (rainProb >= 25) {
          return `હા, ${locPrefixGu}${stats.timePeriodGu} વાદળછાયું વાતાવરણ રહેશે અને હળવા ઝાપટાં (${rainProb}% સંભાવના${peakTimingGu}) પડી શકે છે 🌤️. તાપમાન ${minTemp}°C થી ${maxTemp}°C વચ્ચે રહેશે.`;
        } else {
          return `${locPrefixGu}${stats.timePeriodGu} વાતાવરણ ખુલ્લું અને સાફ રહેશે 🌤️. વરસાદની શક્યતા ખૂબ જ ઓછી (${rainProb}%) છે. તાપમાન ${minTemp}°C થી ${maxTemp}°C વચ્ચે રહેશે 🌡️.`;
        }
      }

      // 10. General Weather Query
      let generalSummary = `${locPrefixGu}${stats.timePeriodGu} હવામાન મુખ્યત્વે ${gujCond} રહેશે 🌤️. તાપમાન ${minTemp}°C થી ${maxTemp}°C વચ્ચે અને પવનની ઝડપ ${windSpeed} km/h (ભેજ: ${weatherData.current.humidity}%) રહેશે.`;
      if (rainProb >= 40) generalSummary += ` છૂટાછવાયા વરસાદની ${rainProb}% સંભાવના છે 🌧️.`;
      else generalSummary += ` વરસાદની સંભાવના ઓછી (${rainProb}%) છે.`;

      return generalSummary;
    }

    // Hindi Response Handling
    if (isHindi) {
      const hiCond = translateConditionToHindi(stats.condition);
      if (isLaundryQuery) {
        return rainProb >= 40
          ? `${loc} में ${stats.timePeriodHi} बारिश की ${rainProb}% संभावना के कारण कपड़े बाहर सुखाना सही नहीं होगा 🧺।`
          : `${loc} में ${stats.timePeriodHi} मौसम साफ (${hiCond}) रहेगा। कपड़े सुखाने के लिए अच्छा दिन है 🧺!`;
      }
      if (isTravelQuery) {
        return rainProb >= 50
          ? `${loc} में ${stats.timePeriodHi} ${rainProb}% बारिश की संभावना के कारण यात्रा करते समय सावधानी बरतें 🚗।`
          : `${loc} में ${stats.timePeriodHi} मौसम यात्रा के लिए बहुत सुहावना और अनुकूल रहेगा 🚗।`;
      }
      if (isGarmiQuery) {
        return `${loc} में ${stats.timePeriodHi} तापमान ${minTemp}°C से ${maxTemp}°C के बीच रहेगा ☀️। मौसम मुख्यतः अनुकूल और मध्यम गर्मी वाला रहेगा 🌡️।`;
      }
      if (isRainQuery) {
        return rainProb >= 50
          ? `हां, ${loc} में ${stats.timePeriodHi} बारिश का मौसम रहेगा 🌧️। लगभग ${rainProb}% संभावना के साथ बारिश (~${rainAmount} mm) हो सकती है। छाता साथ रखें ☂️।`
          : `${loc} में ${stats.timePeriodHi} बारिश की संभावना कम (${rainProb}%) है 🌤️। मौसम साफ रहेगा।`;
      }
      return `${loc} में ${stats.timePeriodHi} मौसम मुख्यतः ${hiCond} रहेगा 🌤️। तापमान ${minTemp}°C से ${maxTemp}°C के बीच और हवा ~${windSpeed} km/h रहेगी 💨।`;
    }

    // Marathi Response Handling
    if (isMarathi) {
      if (isTravelQuery) {
        return `${loc} मध्ये ${stats.timePeriodHi || 'आज'} प्रवासासाठी हवामान छान राहील 🚗. तापमान ${minTemp}°C ते ${maxTemp}°C दरम्यान राहील.`;
      }
      if (isRainQuery) {
        return rainProb >= 50
          ? `होय, ${loc} मध्ये पावसाचे वातावरण राहील 🌧️ (शक्यत: ${rainProb}%). छत्री सोबत ठेवा ☂️.`
          : `${loc} मध्ये पावसाची शक्यता कमी (${rainProb}%) आहे 🌤️.`;
      }
      return `${loc} मध्ये हवामान प्रामुख्याने स्वच्छ राहील 🌤️. तापमान ${minTemp}°C ते ${maxTemp}°C राहील 🌡️.`;
    }

    // Punjabi Response Handling
    const isPunjabi = nlu.language === 'pa' || /[\u0A00-\u0A7F]/.test(question);
    if (isPunjabi) {
      if (isRainQuery) {
        return rainProb >= 50
          ? `ਹਾਂ, ${loc} ਵਿੱਚ ਮੀਂਹ ਪੈਣ ਦੀ ${rainProb}% ਸੰਭਾਵਨਾ ਹੈ 🌧️। ਨਾਲ ਛਤਰੀ ਰੱਖੋ ☂️।`
          : `${loc} ਵਿੱਚ ਮੀਂਹ ਦੀ ਸੰਭਾਵਨਾ ਘੱਟ (${rainProb}%) ਹੈ 🌤️। ਤਾਪਮਾਨ ${minTemp}°C ਤੋਂ ${maxTemp}°C ਰਹੇਗਾ।`;
      }
      return `${loc} ਵਿੱਚ ਮੌਸਮ ਮੁੱਖ ਤੌਰ 'ਤੇ ਸਾਫ਼ ਰਹੇਗਾ 🌤️। ਤਾਪਮਾਨ ${minTemp}°C ਤੋਂ ${maxTemp}°C ਦੇ ਵਿਚਕਾਰ ਰਹੇਗਾ 🌡️।`;
    }

    // English Response Handling
    if (isLaundryQuery) {
      return rainProb >= 40
        ? `In ${loc}, drying clothes outdoors is not recommended today due to a ${rainProb}% rain probability 🧺. Consider drying indoors.`
        : `Weather in ${loc} will be mostly ${stats.condition} with low rain risk (${rainProb}%). It is a great day for drying clothes outdoors 🧺!`;
    }
    if (isTravelQuery) {
      return rainProb >= 50
        ? `Driving conditions in ${loc} might require caution today due to ${rainProb}% rain probability and ${windSpeed} km/h winds 🚗.`
        : `Travel conditions in ${loc} will be pleasant and smooth today 🚗. Winds around ${windSpeed} km/h and temperatures between ${minTemp}°C and ${maxTemp}°C.`;
    }
    if (isGarmiQuery) {
      return `In ${loc}, ${stats.timePeriodEn} temperatures will range between ${minTemp}°C and ${maxTemp}°C ☀️ with comfortable heat levels. Humidity is around ${weatherData.current.humidity}% 🌡️.`;
    }
    if (isRainQuery) {
      return rainProb >= 50
        ? `Yes, there is a ${rainProb}% chance of rain (~${rainAmount} mm) in ${loc} ${stats.timePeriodEn} 🌧️. Carrying an umbrella is recommended ☂️.`
        : `Rain is unlikely in ${loc} ${stats.timePeriodEn} (only ${rainProb}% chance) 🌤️. Expect clear skies with temperatures between ${minTemp}°C and ${maxTemp}°C 🌡️.`;
    }
    return `Weather in ${loc} ${stats.timePeriodEn} will be mostly ${stats.condition} 🌤️. Temperature will range from ${minTemp}°C to ${maxTemp}°C with wind speeds around ${windSpeed} km/h 💨.`;
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

    if (openAIClient.isConfigured()) {
      try {
        const prompt = `User sent an off-topic/non-weather question: "${question}". Synthesize a polite, friendly response in ${fullLangName} (${language}) stating that you are WeatherGPT, an AI Weather Assistant created to help with weather, forecast, rain, temperature, and climate queries. Politely inform the user that you can only answer weather-related questions, and invite them to ask about the weather in any city or village. Keep it 1-2 natural sentences with friendly emojis.`;
        const res = await openAIClient.generateChatCompletion(
          'You are WeatherGPT, a friendly AI weather assistant for India.',
          prompt
        );
        if (res && res.trim()) return res.trim();
      } catch (err) {
        logger.warn('LLM off-topic response generation failed, using fallback:', err);
      }
    }

    const isPa = language === 'pa' || /[\u0A00-\u0A7F]/.test(question);
    const isGu = language === 'gu' || /[\u0A80-\u0AFF]/.test(question);
    const isHi = language === 'hi' || /[\u0900-\u097F]/.test(question);
    const isHinglish = language === 'hinglish';
    const isMr = language === 'mr';

    if (isPa) {
      return `ਮੈਂ WeatherGPT ਇੱਕ ਏਆਈ ਵੈਦਰ ਅਸਿਸਟੈਂਟ ਹਾਂ। 🌤️ ਮੈਂ ਸਿਰਫ਼ ਮੌਸਮ, ਤਾਪਮਾਨ, ਮੀਂਹ ਅਤੇ ਜਲਵਾਯੂ ਨਾਲ ਸਬੰਧਤ ਸਵਾਲਾਂ ਦੇ ਜਵਾਬ ਦੇ ਸਕਦਾ ਹਾਂ। ਕਿਰਪਾ ਕਰਕੇ ਮੈਨੂੰ ਕਿਸੇ ਵੀ ਸ਼ਹਿਰ ਜਾਂ ਪਿੰਡ ਦੇ ਮੌਸਮ ਬਾਰੇ ਪੁੱਛੋ! 🙏`;
    }

    if (isGu) {
      return `હું WeatherGPT એક એઆઈ વેધર આસિસ્ટન્ટ છું. 🌤️ હું ફક્ત હવામાન, તાપમાન, વરસાદ અને વાતાવરણ સંબંધિત પ્રશ્નોના જવાબ આપી શકું છું. કૃપા કરીને મને ભારતના કોઈપણ શહેર કે ગામના હવામાન વિશે પૂછો! 🙏`;
    }

    if (isHi) {
      return `मैं WeatherGPT एक एआई वेदर असिस्टेंट हूँ। 🌤️ मैं केवल मौसम, तापमान, बारिश और जलवायु से जुड़े सवालों के जवाब दे सकता हूँ। कृपया मुझसे किसी भी स्थान के मौसम के बारे में पूछें! 🙏`;
    }

    if (isHinglish) {
      return `Main WeatherGPT ek AI Weather Assistant hoon. 🌤️ Main sirf weather, temperature, rain aur mausam se jude sawalon ke answer de sakta hoon. Kripya kisi bhi city ya village ka weather puchhein! 🙏`;
    }

    if (isMr) {
      return `मी WeatherGPT एक AI हवामान सहाय्यक आहे. 🌤️ मी फक्त हवामान, तापमान, पाऊस आणि वातावरणाशी संबंधित प्रश्नांची उत्तरे देऊ शकतो. कृपया मला कोणत्याही शहराच्या किंवा गावाच्या हवामानाबद्दल विचारा! 🙏`;
    }

    return `I am WeatherGPT, an AI Weather Assistant. 🌤️ I can only assist with weather, temperature, rain forecast, and climate-related queries. Please ask me about the weather in any city or village! 🙏`;
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
