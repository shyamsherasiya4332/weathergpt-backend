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

// ========== Production-Ready Upgrade Module Types ==========

export interface AirQualityData {
  aqi: number;                    // US AQI (0-500)
  category: 'Good' | 'Moderate' | 'Unhealthy for Sensitive Groups' | 'Unhealthy' | 'Very Unhealthy' | 'Hazardous';
  pm2_5: number;                  // ug/m3
  pm10: number;                   // ug/m3
  co?: number;
  no2?: number;
  o3?: number;
  healthAdvice: string;
  badgeColor: string;
}

export interface DisasterAlert {
  id: string;
  type: 'flood' | 'lightning' | 'cyclone' | 'heavy_rain' | 'extreme_heat';
  severity: 'CRITICAL' | 'WARNING' | 'ADVISORY';
  title: string;
  description: string;
  advice: string[];
  affectedZone: string;
  issuedAt: string;
}

export interface WeatherComparisonItem {
  locationName: string;
  temperature: number;
  condition: string;
  rainProbability: number;
  humidity: number;
  windSpeed: number;
  overallRisk: number;
  rank: number;
}

export interface WeatherComparisonResult {
  locations: WeatherComparisonItem[];
  rankings: {
    warmest: string;
    rainiest: string;
    windiest: string;
    bestWeather: string;
  };
  summary: string;
}

export interface MapLayerConfig {
  layer: 'rain' | 'temp' | 'wind' | 'clouds';
  tileUrlTemplate: string;
  attribution: string;
  legend: Array<{ value: string; color: string; label: string }>;
  center: { latitude: number; longitude: number };
  zoom: number;
}

export interface ForecastConfidence {
  overallScore: number;          // 0-100%
  horizonDays: number;
  stabilityScore: number;
  dataQualityScore: number;
  rating: 'HIGH' | 'MODERATE' | 'LOW';
  description: string;
}

export interface ConversationContextObject {
  id: string;
  resolvedLocation?: ResolvedLocation;
  targetDate: string;
  intent: string;
  language: string;
  turnCount: number;
  lastUpdated: string;
}

export interface EmergencyGuidance {
  disasterType: 'cyclone' | 'lightning' | 'flood' | 'heatwave' | 'general';
  title: string;
  summary: string;
  dos: string[];
  donts: string[];
  helplines: Array<{ name: string; number: string }>;
}

// ========== V3 Upgrade Module Types ==========

export interface CommunityReport {
  id?: string;
  location: string;
  latitude: number;
  longitude: number;
  condition: 'heavy_rain' | 'light_rain' | 'sunny' | 'clear' | 'thunderstorm' | 'flooding' | 'fog' | 'extreme_heat' | string;
  intensity?: 'low' | 'moderate' | 'high' | string;
  photo?: string;
  language?: string;
  notes?: string;
  timestamp?: string;
}

export interface CommunityConfidence {
  totalReports: number;
  confidenceScore: number;       // 0-100%
  clusterSummary: string;
  recentReports: CommunityReport[];
}

export interface RouteWeatherInput {
  origin: string;
  destination: string;
}

export interface RouteRainZone {
  locationName: string;
  latitude: number;
  longitude: number;
  rainProbability: number;
  severity: 'moderate' | 'heavy' | 'extreme';
}

export interface RouteWeatherResult {
  origin: string;
  destination: string;
  totalDistanceKm: number;
  estimatedDurationHours: number;
  originWeather: {
    locationName: string;
    temperature: number;
    condition: string;
    rainProbability: number;
  };
  midRouteWeather: {
    locationName: string;
    temperature: number;
    condition: string;
    rainProbability: number;
  };
  destinationWeather: {
    locationName: string;
    temperature: number;
    condition: string;
    rainProbability: number;
  };
  rainZones: RouteRainZone[];
  safeTravelWindow: {
    recommendedDeparture: string;
    reason: string;
    safetyScore: number;
  };
  etaWeatherSummary: string;
}

export interface ExplainWhyObject {
  title: string;
  summary: string;
  factors: string[];
}

export interface ShareCardInput {
  location: string;
  question?: string;
}

export interface ShareCardResponse {
  city: string;
  temperature: number;
  rainProbability: number;
  weatherIcon: string;
  riskColor: string;
  branding: string;
  title: string;
  text: string;
  formattedMessage: string;
  shareUrl: string;
  tags: string[];
}

export interface WeatherLensInput {
  image?: string;                 // Base64 or image URL
  question?: string;              // User camera query, e.g. "આ વાદળો જોઈને કહો કાલે વરસાદ પડશે?"
  location?: LocationInput | string;
  latitude?: number;
  longitude?: number;
  language?: string;
}

export interface WeatherLensResult {
  detectedCloudType: 'Cumulonimbus' | 'Stratus' | 'Cirrus' | 'Cumulus' | 'Nimbostratus' | 'Clear Sky' | string;
  skyCondition: string;
  estimatedCloudCoverPercentage: number;
  liveRainProbability: number;
  aiConfidence: number;           // 0-100%
  apiVerificationStatus: 'VERIFIED_WITH_OPEN_METEO';
  answer: string;
  advisory: string;
}

export interface AgriAdvisoryResult {
  locationName: string;
  krishiIndex: number;            // 0-100 farming score
  cropRiskLevel: 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL';
  irrigationAdvice: string;
  pesticideSuitability: 'SUITABLE' | 'UNSUITABLE' | 'CAUTION';
  pesticideReason: string;
  soilMoistureEstimate: string;
  nextRainWindow: string;
  language: string;
  cropAdviceList: string[];
}

// ========== Enhanced Ask Response (v3.1) ==========

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
  // SIH Fields
  riskScores?: WeatherRiskScores;
  advisories?: {
    general: string[];
    personalized: PersonalizedAdvisory[];
  };
  bestTimeToGoOut?: BestTimeToGoOut | null;
  mood?: WeatherMood;
  timeline?: WeatherTimeline;
  climateAnomaly?: import('../services/climate/climateService.js').ClimateAnomaly;
  emergencyNotification?: import('../services/notification/notificationService.js').PushNotificationPayload | null;
  weatherInfographic?: import('../services/image/imageService.js').WeatherInfographicCard;
  moes_bulletin?: import('../services/moes/moesService.js').MoESBulletin;
  suggested_followups?: string[];
  climate_fact?: string;
  ui_widgets?: Array<{ type: string; title: string; data: any }>;
  // Production Upgrades (V2 + V3 + V3.1)
  airQuality?: AirQualityData;
  forecastConfidence?: ForecastConfidence;
  confidence?: {
    forecast: number;
    reason: string;
  };
  conversationContext?: ConversationContextObject;
  disasterAlerts?: DisasterAlert[];
  disaster?: DisasterAlert[];
  explainWhy?: ExplainWhyObject;
  communityReports?: CommunityConfidence;
  routeSuggestion?: RouteWeatherResult;
  shareCard?: ShareCardResponse;
  agri?: AgriAdvisoryResult;
  weatherLens?: WeatherLensResult;
  rag?: import('../services/rag/ragService.js').RAGContext;
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
