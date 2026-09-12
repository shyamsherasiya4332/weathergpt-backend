export interface CurrentWeather {
  temperature: number; // °C
  apparentTemperature: number; // °C feels-like
  condition: string;
  weatherCode: number;
  precipitation: number; // mm
  rainProbability?: number; // %
  humidity: number; // %
  windSpeed: number; // km/h
  windDirection: number; // degrees
  cloudCover: number; // %
  visibility: number; // meters or km
  uvIndex: number;
  isDay: boolean;
  time: string; // ISO timestamp
}

export interface HourlyForecastItem {
  time: string; // ISO string in local timezone
  temperature: number; // °C
  precipitationProbability: number; // %
  precipitationAmount: number; // mm
  weatherCode: number;
  condition: string;
  humidity: number;
  windSpeed: number;
  uvIndex: number;
}

export interface DailyForecastItem {
  date: string; // YYYY-MM-DD
  temperatureMax: number;
  temperatureMin: number;
  precipitationProbabilityMax: number;
  precipitationSum: number; // mm
  condition: string;
  sunrise: string;
  sunset: string;
  uvIndexMax: number;
}

export interface ResolvedLocation {
  name: string;
  latitude: number;
  longitude: number;
  country?: string;
  state?: string;
  timezone: string;
  elevation?: number;
  locationType?: 'city' | 'state' | 'country' | 'region' | 'village' | 'landmark' | 'unknown';
}

export interface WeatherData {
  location: ResolvedLocation;
  current: CurrentWeather;
  hourly: HourlyForecastItem[];
  daily: DailyForecastItem[];
  retrievedAt: string;
  isCached?: boolean;
  cacheNotice?: string;
}

export interface RainAnalysisResult {
  hasRainRisk: boolean;
  maxRainProbability: number;
  totalRainAmountMm: number;
  peakRainTimeWindow?: string;
  firstRainTime?: string;
  rainWindowStart?: string;
  rainWindowEnd?: string;
  hourlyRainBreakdown: {
    time: string;
    probability: number;
    amountMm: number;
    condition: string;
  }[];
  summary: string;
}
