import { logger } from '../../utils/logger.js';
import { WeatherData, RainAnalysisResult } from '../../types/weather.js';

export interface WeatherRiskScores {
  overall: number;     // 0-100 composite
  rain: number;        // 0-100
  heat: number;        // 0-100
  wind: number;        // 0-100
  flood: number;       // 0-100
  uv: number;          // 0-100
  severity: 'low' | 'moderate' | 'high' | 'extreme';
  alerts: string[];    // Human-readable risk alerts
}

export class RiskService {
  public calculateRiskScores(weatherData: WeatherData, rainAnalysis: RainAnalysisResult): WeatherRiskScores {
    // Basic fallback properties if data is missing
    const temp = weatherData.current?.temperature ?? 20;
    const windSpeed = weatherData.current?.windSpeed ?? 0;
    const uvIndex = weatherData.current?.uvIndex ?? 0;
    
    // Rain Risk
    let rainScore = 0;
    const rainProb = rainAnalysis.maxRainProbability ?? 0;
    const rainAmount = rainAnalysis.totalRainAmountMm ?? 0;
    
    if (rainProb > 80 && rainAmount > 10) {
      rainScore = 90;
    } else if (rainProb > 50) {
      rainScore = 50;
    } else if (rainProb > 20) {
      rainScore = 20;
    }

    // Heat Risk
    let heatScore = 0;
    if (temp > 45) heatScore = 100;
    else if (temp > 40) heatScore = 80;
    else if (temp > 35) heatScore = 60;
    else if (temp < 20) heatScore = 10;
    else heatScore = 30;

    // Wind Risk
    let windScore = 0;
    if (windSpeed > 80) windScore = 100;
    else if (windSpeed > 60) windScore = 80;
    else if (windSpeed > 40) windScore = 60;
    else windScore = 20;

    // Flood Risk
    let floodScore = 0;
    if (rainAmount > 30) floodScore = 90;
    else if (rainAmount > 20) floodScore = 70;
    else if (rainAmount > 10) floodScore = 40;
    else floodScore = 10;

    // Modify flood risk based on probability
    floodScore = Math.min(100, floodScore * (rainProb / 100 + 0.5));

    // UV Risk
    let uvScore = 0;
    if (uvIndex > 11) uvScore = 100;
    else if (uvIndex > 8) uvScore = 75;
    else if (uvIndex > 6) uvScore = 50;
    else if (uvIndex > 3) uvScore = 25;
    else uvScore = 10;

    // Overall Score
    const overallScore = (
      rainScore * 0.30 +
      heatScore * 0.20 +
      windScore * 0.20 +
      floodScore * 0.15 +
      uvScore * 0.15
    );

    // Severity
    let severity: WeatherRiskScores['severity'] = 'low';
    if (overallScore >= 75) severity = 'extreme';
    else if (overallScore >= 50) severity = 'high';
    else if (overallScore >= 25) severity = 'moderate';

    // Alerts
    const alerts: string[] = [];
    if (rainScore > 60) alerts.push('Heavy rainfall expected. Plan accordingly.');
    if (heatScore > 60) alerts.push('High temperatures detected. Stay hydrated and avoid prolonged sun exposure.');
    if (windScore > 60) alerts.push('Strong winds. Secure loose objects and exercise caution.');
    if (floodScore > 60) alerts.push('Potential flood risk due to substantial rain. Avoid waterlogged areas.');
    if (uvScore > 60) alerts.push('High UV Index. Sun protection is strongly advised.');

    return {
      overall: Math.round(overallScore),
      rain: Math.round(rainScore),
      heat: Math.round(heatScore),
      wind: Math.round(windScore),
      flood: Math.round(floodScore),
      uv: Math.round(uvScore),
      severity,
      alerts
    };
  }
}

export const riskService = new RiskService();
