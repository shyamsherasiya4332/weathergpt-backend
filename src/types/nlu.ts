export type WeatherIntent =
  | 'current_weather'
  | 'rain_forecast'
  | 'temperature'
  | 'general_forecast'
  | 'advisory'
  | 'hourly_forecast'
  | 'follow_up_time_breakdown'
  | 'unknown';

export interface LocationEntity {
  name?: string;
  latitude?: number;
  longitude?: number;
  state?: string;
  country?: string;
}

export interface ParsedNLU {
  intent: WeatherIntent;
  locationName?: string;
  isLocationNeeded: boolean;
  targetDate?: 'today' | 'tomorrow' | 'day_after_tomorrow' | 'day_after_next' | 'specific_date' | 'next_3_days';
  specificDateStr?: string; // YYYY-MM-DD
  timeRange?: 'current' | 'morning' | 'afternoon' | 'evening' | 'night' | 'specific_hours' | 'all_day';
  specificTimeRange?: {
    startHour: number; // 0-23
    endHour: number;   // 0-23
  };
  language: 'en' | 'gu' | 'hi' | 'hinglish' | string;
  confidence: number;
}
