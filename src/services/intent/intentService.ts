import { LANGUAGE_NAME_TOKENS, NON_LOCATION_TOKENS, findGazetteerInText, lookupGazetteer } from '../../config/locationGazetteer.js';
import { LocationInput } from '../../types/api.js';
import { LocationEntity, ParsedNLU, StructuredIntent, StructuredLocation, WeatherIntent } from '../../types/nlu.js';
import { languageService } from '../language/languageService.js';
import { openAIClient } from '../llm/openaiClient.js';
import { logger } from '../../utils/logger.js';

const LANGUAGE_REQUEST_MAP: Array<{ pattern: RegExp; code: string }> = [
  { pattern: /ગુજરાતી|gujarati|gujlish/i, code: 'gu' },
  { pattern: /हिन्दी|हिंदी|hindi|hinglish/i, code: 'hi' },
  { pattern: /english|અંગ્રેજી|अंग्रेजी/i, code: 'en' },
  { pattern: /मराठी|marathi/i, code: 'mr' },
  { pattern: /ਪੰਜਾਬੀ|punjabi/i, code: 'pa' }
];

function detectRequestedLanguage(question: string): string | undefined {
  for (const item of LANGUAGE_REQUEST_MAP) {
    if (item.pattern.test(question)) return item.code;
  }
  return undefined;
}

function isTranslationOrLanguageFollowup(question: string): boolean {
  const q = question.trim();
  if (
    /(?:explain|translate|tell|say|repeat|rewrite|convert)\s+(?:this|that|it|the\s+answer|the\s+previous)?\s*(?:in|to|into)\b/i.test(q)
  ) {
    return true;
  }
  if (/\b(?:in|to|into)\s+(?:gujarati|hindi|english|marathi|punjabi|bengali|tamil|telugu)\b/i.test(q)) {
    return true;
  }
  if (/gujarati\s+ma\s+samjavo|hindi\s+me(?:in)?\s+(?:samjhao|batao)|english\s+me(?:in)?\s+batao/i.test(q)) {
    return true;
  }
  if (/ગુજરાતી\s*માં\s*સમજાવો|આ\s*ગુજરાતી|हिंदी\s*में\s*समझाओ|हिन्दी\s*में/i.test(q)) {
    return true;
  }
  if (/^(?:in\s+)?(?:gujarati|hindi|english)(?:\s+please)?[?.!]*$/i.test(q)) {
    return true;
  }
  return false;
}

function isExplanationFollowup(question: string): boolean {
  const q = question.trim();
  return (
    /make\s+(?:it|this)\s+simple|explain\s+this|explain\s+that|simplify|simpler|in\s+simple\s+words|why\s+this\s+prediction/i.test(q) &&
    !/\bin\s+(?:rajkot|ahmedabad|mumbai|delhi|surat|florida|london|rajasthan|gujarat)\b/i.test(q)
  );
}

function extractLocation(question: string): StructuredLocation | null {
  const gazetteerHit = findGazetteerInText(question);
  if (gazetteerHit) {
    return {
      name: gazetteerHit.name,
      type: gazetteerHit.type,
      state: gazetteerHit.state,
      country: gazetteerHit.country
    };
  }

  const followupPlace = question.match(/\b(?:what\s+about|how\s+about|and)\s+([A-Za-z\u0A80-\u0AFF\u0900-\u097F]{2,40})\??$/i);
  if (followupPlace) {
    const cand = followupPlace[1].trim().replace(/[.,?!]+$/g, '');
    if (!NON_LOCATION_TOKENS.has(cand.toLowerCase()) && !LANGUAGE_NAME_TOKENS.has(cand.toLowerCase())) {
      const known = lookupGazetteer(cand);
      if (known) {
        return { name: known.name, type: known.type, state: known.state, country: known.country };
      }
      return { name: cand, type: 'unknown', country: undefined };
    }
  }

  const inMatch = question.match(/\b(?:in|at|for|near|of|around)\s+([A-Za-z\u0A80-\u0AFF\u0900-\u097F][A-Za-z\u0A80-\u0AFF\u0900-\u097F\s]{1,40})/i);
  if (inMatch) {
    let candidate = inMatch[1].trim();
    candidate = candidate.split(/\s+(?:today|tomorrow|tonight|rain|varsad|weather|condition|forecast|please)\b/i)[0].trim();
    candidate = candidate.replace(/[.,?!]+$/g, '').trim();
    const lower = candidate.toLowerCase();
    if (candidate && !NON_LOCATION_TOKENS.has(lower) && !LANGUAGE_NAME_TOKENS.has(lower)) {
      const known = lookupGazetteer(candidate);
      if (known) {
        return { name: known.name, type: known.type, state: known.state, country: known.country };
      }
      return { name: candidate, type: 'unknown' };
    }
  }

  const suffixMatch = question.match(/([A-Za-z\u0A80-\u0AFF\u0900-\u097F]{2,30})\s*(?:માં|मां|में|मध्ये)(?:\s|[.,?!]|$)/i);
  if (suffixMatch) {
    const candidate = suffixMatch[1].trim();
    if (!NON_LOCATION_TOKENS.has(candidate.toLowerCase()) && !LANGUAGE_NAME_TOKENS.has(candidate.toLowerCase())) {
      const known = lookupGazetteer(candidate);
      if (known) return { name: known.name, type: known.type, state: known.state, country: known.country };
    }
  }

  return null;
}

function detectIntent(question: string, hasLocation: boolean): WeatherIntent {
  const q = question.trim();
  if (/^(?:hello|hi|hey|helo|kem\s*cho|namaste|namaskar|halo|ram\s*ram|good\s*morning|good\s*evening|good\s*afternoon|નમસ્તે|નમસ્કાર|કેમ\s*છો|હલો|હાય|હેલો)\b/i.test(q)) {
    return 'GREETING';
  }
  if (isTranslationOrLanguageFollowup(q)) return 'TRANSLATION';
  if (isExplanationFollowup(q)) return 'EXPLANATION';
  if (/aqi|air\s*quality|pm2|pradushan|प्रदूषण/i.test(q)) return 'AIR_QUALITY';
  if (/\buv\b|ultraviolet|sunburn/i.test(q)) return 'UV';
  if (/humidity|bafaro|ભેજ|नमी/i.test(q)) return 'HUMIDITY';
  if (/\bwind\b|pavan|પવન|आंधी|andhi/i.test(q)) return 'WIND';
  if (/alert|warning|cyclone|flood|toofan/i.test(q)) return 'WEATHER_ALERT';
  if (/compar(e|ison)|vs\.?|versus/i.test(q)) return 'WEATHER_COMPARISON';
  if (/travel|trip|flight|driving|મુસાફરી/i.test(q)) return 'WEATHER_TRAVEL';
  if (/farm|crop|kheti|agriculture|irrigation|કૃષિ/i.test(q)) return 'AGRICULTURE';
  if (/garmi|thandi|તાપમાન|तापमान|temp|temperature|heat|hot|cold|degree|ડિગ્રી/i.test(q)) return 'TEMPERATURE';
  if (/rain|varsad|varsat|barish|baarish|बारिश|વરસાદ|umbrella|when\s+will\s+rain/i.test(q)) return 'RAIN_FORECAST';
  if (/right\s+now|currently|current\s+weather|હાલ|અત્યારે|अभी/i.test(q)) return 'WEATHER_CURRENT';
  if (/tomorrow|forecast|next\s+day|કાલે|कल/i.test(q)) return 'WEATHER_FORECAST';
  if (/weather|havaman|vatavaran|mausam|હવામાન|मौसम/i.test(q) || hasLocation) return 'GENERAL_WEATHER';

  const isExplicitOffTopic = /what\s*is\s*my\s*name|who\s*am\s*i|who\s*are\s*you|tell\s*me\s*a?\s*joke|recipe|prime\s*minister|calculate|programming|movie/i.test(q);
  if (isExplicitOffTopic) return 'UNKNOWN';
  return 'UNKNOWN';
}

function detectTime(question: string): Pick<ParsedNLU, 'targetDate' | 'timeRange' | 'specificTimeRange' | 'timeReference'> {
  let targetDate: ParsedNLU['targetDate'] = 'today';
  if (/tarparamdivas|tar\s*param\s*divas|તરપરમદિવસે|narson/i.test(question)) {
    targetDate = 'day_after_next';
  } else if (/paramdivas|paramdivase|પરમદિવસે|parso|parson|day after tomorrow/i.test(question)) {
    targetDate = 'day_after_tomorrow';
  } else if (/tomorrow|kale|કાલે|કાલ|कल|\bkal\b|kalnu/i.test(question)) {
    targetDate = 'tomorrow';
  } else if (/today|aje|aaje|આજે|આજ|आज|\baaj\b|aajnu/i.test(question)) {
    targetDate = 'today';
  }

  let timeRange: ParsedNLU['timeRange'] = 'all_day';
  let specificTimeRange: ParsedNLU['specificTimeRange'];
  if (/evening|shyam|સાંજે|शाम/i.test(question)) {
    timeRange = 'evening';
    specificTimeRange = { startHour: 17, endHour: 21 };
  } else if (/morning|savare|સવારે|सुबह/i.test(question)) {
    timeRange = 'morning';
    specificTimeRange = { startHour: 6, endHour: 12 };
  } else if (/afternoon|bapore|બપોરે|दोपहर/i.test(question)) {
    timeRange = 'afternoon';
    specificTimeRange = { startHour: 12, endHour: 17 };
  } else if (/night|ratre|રાત્રે|रात/i.test(question)) {
    timeRange = 'night';
    specificTimeRange = { startHour: 21, endHour: 23 };
  } else if (/right\s+now|currently|current/i.test(question)) {
    timeRange = 'current';
  }

  const timeReference =
    targetDate === 'tomorrow'
      ? 'tomorrow'
      : targetDate === 'day_after_tomorrow'
        ? 'day_after_tomorrow'
        : timeRange && timeRange !== 'all_day'
          ? String(timeRange)
          : /today|aje|aaje|આજે|आज/i.test(question)
            ? 'today'
            : null;

  return { targetDate, timeRange, specificTimeRange, timeReference };
}

export function toStructuredIntent(nlu: ParsedNLU): StructuredIntent {
  return {
    intent: nlu.intent,
    location: nlu.location || (nlu.locationName
      ? { name: nlu.locationName, type: 'unknown' }
      : null),
    language: nlu.language,
    time_reference: nlu.timeReference || nlu.targetDate || null,
    needs_previous_context: nlu.needsPreviousContext
  };
}

export class IntentService {
  detectHeuristic(question: string, locationContext?: LocationEntity | LocationInput): ParsedNLU {
    const detectedLang = languageService.detect(question);
    const requestedLanguage = detectRequestedLanguage(question);
    const translation = isTranslationOrLanguageFollowup(question);
    const explanation = isExplanationFollowup(question);
    const location = translation || explanation ? null : extractLocation(question);
    const intent = detectIntent(question, !!location);
    const times = detectTime(question);

    const needsPreviousContext =
      translation ||
      explanation ||
      /what\s+about\s+tomorrow|will\s+it\s+rain\s+there|there\??$|કાલે\s+વરસાદ|आज\s+बारिश/i.test(question) ||
      (!location && /will\s+it\s+rain|what\s+about|and\s+[A-Za-z]+/i.test(question));

    let locationName = location?.name;
    if (!locationName && locationContext && 'name' in locationContext && locationContext.name && !translation && !explanation) {
      locationName = locationContext.name;
    }

    const language = requestedLanguage || detectedLang.code;
    const isLocationNeeded = !['TRANSLATION', 'EXPLANATION', 'GREETING', 'UNKNOWN'].includes(intent);

    return {
      intent,
      locationName,
      location,
      isLocationNeeded,
      needsPreviousContext,
      targetDate: times.targetDate,
      timeRange: times.timeRange,
      specificTimeRange: times.specificTimeRange,
      timeReference: times.timeReference,
      language,
      requestedLanguage,
      confidence: location || translation || explanation ? 0.95 : 0.8
    };
  }

  async detect(question: string, locationContext?: LocationEntity | LocationInput): Promise<ParsedNLU> {
    const heuristic = this.detectHeuristic(question, locationContext);
    if (
      heuristic.intent !== 'UNKNOWN' ||
      heuristic.location ||
      heuristic.needsPreviousContext ||
      !openAIClient.isConfigured()
    ) {
      return heuristic;
    }

    try {
      const json = await openAIClient.generateChatCompletion(
        'You extract weather intent. Output JSON only. Language names are never locations. Follow-ups like "in Gujarati" are TRANSLATION with needs_previous_context true.',
        `Query: ${question}\nReturn: {"intent":"WEATHER_CURRENT|WEATHER_FORECAST|RAIN_FORECAST|TEMPERATURE|WIND|HUMIDITY|AIR_QUALITY|UV|WEATHER_ALERT|WEATHER_COMPARISON|WEATHER_TRAVEL|AGRICULTURE|TRANSLATION|EXPLANATION|GENERAL_WEATHER|UNKNOWN","location":{"name":string,"type":"city|state|country|region|village|landmark|unknown","country":string}|null,"language":"en|gu|hi","time_reference":"today|tomorrow"|null,"needs_previous_context":boolean}`,
        true
      );
      const parsed = JSON.parse(json.replace(/```json/g, '').replace(/```/g, '').trim());
      return {
        ...heuristic,
        intent: parsed.intent || heuristic.intent,
        location: parsed.location || heuristic.location,
        locationName: parsed.location?.name || heuristic.locationName,
        language: parsed.language || heuristic.language,
        timeReference: parsed.time_reference ?? heuristic.timeReference,
        needsPreviousContext: parsed.needs_previous_context ?? heuristic.needsPreviousContext,
        confidence: 0.9
      };
    } catch (err) {
      logger.warn('Structured intent LLM refine failed, using heuristic:', err);
      return heuristic;
    }
  }
}

export const intentService = new IntentService();
