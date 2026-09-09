import { ResolvedLocation, WeatherData } from '../../types/weather.js';
import { logger } from '../../utils/logger.js';

export interface ClimateAnomaly {
  locationName: string;
  month: string;
  currentTemperature: number;
  historicalAvgTemperature: number;
  temperatureAnomaly: number; // positive = hotter than normal, negative = cooler
  currentRainProbability: number;
  historicalAvgRainfallMm: number;
  anomalySummary: string;
  climateTrend: 'significantly_warmer' | 'normal' | 'cooler' | 'unusual_rainfall';
}

/**
 * Historical climate baselines for major Indian locations (monthly averages in °C and mm rain)
 */
const HISTORICAL_BASELINES: Record<string, { avgTemp: number; avgRainMm: number }> = {
  morbi: { avgTemp: 28.5, avgRainMm: 95 },
  rajkot: { avgTemp: 29.0, avgRainMm: 110 },
  ahmedabad: { avgTemp: 29.5, avgRainMm: 120 },
  surat: { avgTemp: 28.0, avgRainMm: 180 },
  vadodara: { avgTemp: 28.8, avgRainMm: 135 },
  mumbai: { avgTemp: 27.5, avgRainMm: 340 },
  delhi: { avgTemp: 29.2, avgRainMm: 125 },
  bangalore: { avgTemp: 24.5, avgRainMm: 150 },
  chennai: { avgTemp: 30.0, avgRainMm: 140 },
  kolkata: { avgTemp: 28.5, avgRainMm: 250 },
  'statue of unity': { avgTemp: 28.2, avgRainMm: 140 },
  'somnath temple': { avgTemp: 27.8, avgRainMm: 105 },
  'gir national park': { avgTemp: 28.0, avgRainMm: 115 }
};

export class ClimateService {
  public analyzeClimateAnomaly(weatherData: WeatherData): ClimateAnomaly {
    const locName = weatherData.location.name.toLowerCase();
    const currentTemp = Math.round(weatherData.current.temperature * 10) / 10;
    const currentRainProb = weatherData.current.rainProbability || 0;

    // Find closest baseline or default fallback
    let baseline = HISTORICAL_BASELINES.morbi;
    for (const [key, value] of Object.entries(HISTORICAL_BASELINES)) {
      if (locName.includes(key)) {
        baseline = value;
        break;
      }
    }

    const tempAnomaly = Math.round((currentTemp - baseline.avgTemp) * 10) / 10;
    const currentMonth = new Date().toLocaleString('en-US', { month: 'long' });

    let trend: ClimateAnomaly['climateTrend'] = 'normal';
    let anomalySummary = `${weatherData.location.name}'s current temperature (${currentTemp}°C) is normal for ${currentMonth} (historical avg: ${baseline.avgTemp}°C).`;

    if (tempAnomaly >= 3.0) {
      trend = 'significantly_warmer';
      anomalySummary = `${weatherData.location.name} is significantly warmer than historical averages (+${tempAnomaly}°C above ${currentMonth} norm of ${baseline.avgTemp}°C).`;
    } else if (tempAnomaly <= -3.0) {
      trend = 'cooler';
      anomalySummary = `${weatherData.location.name} is cooler than historical averages (${tempAnomaly}°C below ${currentMonth} norm of ${baseline.avgTemp}°C).`;
    } else if (currentRainProb >= 70) {
      trend = 'unusual_rainfall';
      anomalySummary = `Higher precipitation activity detected for ${weatherData.location.name} compared to historical monthly rainfall trends.`;
    }

    logger.info(`Climate anomaly analyzed for ${weatherData.location.name}: ${anomalySummary}`);

    return {
      locationName: weatherData.location.name,
      month: currentMonth,
      currentTemperature: currentTemp,
      historicalAvgTemperature: baseline.avgTemp,
      temperatureAnomaly: tempAnomaly,
      currentRainProbability: currentRainProb,
      historicalAvgRainfallMm: baseline.avgRainMm,
      anomalySummary,
      climateTrend: trend
    };
  }
}

export const climateService = new ClimateService();
