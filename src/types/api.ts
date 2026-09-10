import { ResolvedLocation } from './weather.js';

// ========== Existing Types (Preserved) ==========
export interface LocationInput {
  name?: string;
  latitude?: number;
  longitude?: number;
}

export interface AskRequest {
  question: string;
  location?: LocationInput;
  language?: string;
  conversationId?: string;
  persona?: AdvisoryPersona;
}

export interface WeatherSnapshot {
  temperature: number;
  apparentTemperature?: number;
  condition: string;
  rain_probability?: number;
  rain_amount_mm?: number;
  humidity?: number;
  windSpeed?: number;
  uvIndex?: number;
}

// ========== New SIH Feature Types ==========

export type AdvisoryPersona = 'farmer' | 'student' | 'traveler' | 'elderly' | 'outdoor_worker' | 'general';

export interface WeatherRiskScores {
  overall: number;
  rain: number;
  heat: number;
  wind: number;
  flood: number;
  uv: number;
  severity: 'low' | 'moderate' | 'high' | 'extreme';
  alerts: string[];
}

export interface PersonalizedAdvisory {
  persona: AdvisoryPersona;
  advice: string[];
  urgency: 'info' | 'caution' | 'warning' | 'danger';
}

export interface BestTimeToGoOut {
  startHour: number;
  endHour: number;
  reason: string;
  safetyScore: number;
}

export interface WeatherMood {
  emoji: string;
  summary: string;
  clothing: string[];
  umbrellaNeeded: boolean;
  hydrationAdvice: string;
  uvProtection: string;
}

export interface TimelineHour {
  time: string;
  hour: number;
  hourLabel: string;
  temperature: number;
  feelsLike: number;
  condition: string;
  conditionEmoji: string;
  rainProbability: number;
  rainAmount: number;
  windSpeed: number;
  humidity: number;
  uvIndex: number;
  isGoodToGoOut: boolean;
  riskLevel: 'safe' | 'caution' | 'risky';
}

export interface WeatherTimeline {
  date: string;
  timezone: string;
  hours: TimelineHour[];
  summary: {
    bestHours: string;
    worstHours: string;
    peakTemperature: { value: number; time: string };
    peakRain: { probability: number; time: string };
  };
}

// ========== Enhanced Ask Response (v2) ==========

export interface AskResponseSuccess {
  success: true;
  answer: string;
  language: string;
  conversationId?: string;
  location?: ResolvedLocation;
  weather?: WeatherSnapshot;
  forecast?: Array<{
    date: string;
    condition: string;
    tempMax: number;
    tempMin: number;
    rainProbability: number;
  }>;
  // New SIH Fields
  riskScores?: WeatherRiskScores;
  advisories?: {
    general: string[];
    personalized: PersonalizedAdvisory[];
  };
  bestTimeToGoOut?: BestTimeToGoOut | null;
  mood?: WeatherMood;
  timeline?: WeatherTimeline;
  climateAnomaly?: import('../services/climate/climateService.js').ClimateAnomaly;
  emergencyNotification?: import('../services/notifications/notificationService.js').PushNotificationPayload | null;
  weatherInfographic?: import('../services/image/imageService.js').WeatherInfographicCard;
  moes_bulletin?: import('../services/moes/moesService.js').MoESBulletin;
  suggested_followups?: string[];
  climate_fact?: string;
  ui_widgets?: Array<{ type: string; title: string; data: any }>;
  generated_at: string;
}

export interface ApiErrorDetail {
  code: string;
  message: string;
  details?: unknown;
}

export interface ApiErrorResponse {
  success: false;
  error: ApiErrorDetail;
}

export type ApiResponse<T> = T | ApiErrorResponse;

export interface WeatherAlertRequest {
  location: string | LocationInput;
  condition: 'rain' | 'temperature_high' | 'temperature_low' | 'wind';
  threshold: number;
  notification?: boolean;
}

export interface MakeWebhookPayload {
  event: string;
  location: string;
  rain_probability?: number;
  rain_amount_mm?: number;
  forecast_time?: string;
  message: string;
  timestamp: string;
}
