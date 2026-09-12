export type WeatherIntent =
  | 'WEATHER_CURRENT'
  | 'WEATHER_FORECAST'
  | 'RAIN_FORECAST'
  | 'TEMPERATURE'
  | 'WIND'
  | 'HUMIDITY'
  | 'AIR_QUALITY'
  | 'UV'
  | 'WEATHER_ALERT'
  | 'WEATHER_COMPARISON'
  | 'WEATHER_TRAVEL'
  | 'AGRICULTURE'
  | 'TRANSLATION'
  | 'EXPLANATION'
  | 'GENERAL_WEATHER'
  | 'UNKNOWN'
  | 'GREETING'
  | 'FOLLOW_UP_TIME_BREAKDOWN'
  // Legacy aliases kept so older call sites / tests keep compiling
  | 'current_weather'
  | 'rain_forecast'
  | 'temperature'
  | 'general_forecast'
  | 'advisory'
  | 'hourly_forecast'
  | 'follow_up_time_breakdown'
  | 'greeting'
  | 'unknown';

export type LocationType = 'city' | 'state' | 'country' | 'region' | 'village' | 'landmark' | 'unknown';

export interface StructuredLocation {
  name: string;
  type: LocationType;
  state?: string;
  country?: string;
}

export interface LocationEntity {
  name?: string;
  latitude?: number;
  longitude?: number;
  state?: string;
  country?: string;
  type?: LocationType;
}

export interface ParsedNLU {
  intent: WeatherIntent;
  locationName?: string;
  secondaryLocationName?: string;
  location?: StructuredLocation | null;
  isLocationNeeded: boolean;
  needsPreviousContext: boolean;
  targetDate?: 'yesterday' | 'today' | 'tomorrow' | 'day_after_tomorrow' | 'day_after_next' | 'specific_date' | 'next_3_days';
  specificDateStr?: string;
  timeRange?: 'current' | 'morning' | 'afternoon' | 'evening' | 'night' | 'specific_hours' | 'all_day' | 'full_day';
  specificTimeRange?: {
    startHour: number;
    endHour: number;
  };
  timeReference?: string | null;
  language: 'en' | 'gu' | 'hi' | 'hinglish' | string;
  requestedLanguage?: string;
  confidence: number;
}

export interface StructuredIntent {
  intent: WeatherIntent;
  location: StructuredLocation | null;
  language: string;
  time_reference: string | null;
  needs_previous_context: boolean;
}
