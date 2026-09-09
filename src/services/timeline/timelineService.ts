import { WeatherData } from '../../types/weather.js';
import { weatherCodeToCondition } from '../../utils/dateUtils.js';

export interface TimelineHour {
  time: string;           // ISO string
  hour: number;           // 0-23
  hourLabel: string;      // '6 AM', '2 PM' etc
  temperature: number;
  feelsLike: number;
  condition: string;
  conditionEmoji: string; // ☀️🌧️⛈️ etc
  rainProbability: number;
  rainAmount: number;
  windSpeed: number;
  humidity: number;
  uvIndex: number;
  isGoodToGoOut: boolean; // true if safe/comfortable
  riskLevel: 'safe' | 'caution' | 'risky';
}

export interface WeatherTimeline {
  date: string;
  timezone: string;
  hours: TimelineHour[];
  summary: {
    bestHours: string;      // '9 AM - 11 AM'
    worstHours: string;     // '4 PM - 7 PM'
    peakTemperature: { value: number; time: string };
    peakRain: { probability: number; time: string };
  };
}

function getConditionEmoji(code: number): string {
  if (code === 0) return '☀️';
  if (code >= 1 && code <= 3) return '⛅';
  if (code >= 45 && code <= 48) return '🌫️';
  if (code >= 51 && code <= 67) return '🌧️';
  if (code >= 71 && code <= 77) return '❄️';
  if (code >= 80 && code <= 82) return '🌧️';
  if (code >= 95 && code <= 99) return '⛈️';
  return '🌤️';
}

function formatHourLabel(hour: number): string {
  if (hour === 0) return '12 AM';
  if (hour === 12) return '12 PM';
  if (hour < 12) return `${hour} AM`;
  return `${hour - 12} PM`;
}

function findWindows(hours: TimelineHour[]) {
  if (hours.length < 3) return { best: 'N/A', worst: 'N/A' };

  let bestScore = -Infinity;
  let worstScore = Infinity;
  let bestWindow = '';
  let worstWindow = '';

  for (let i = 0; i <= hours.length - 3; i++) {
    let score = 0;
    for (let j = 0; j < 3; j++) {
      const h = hours[i + j];
      let hs = 0;
      if (h.isGoodToGoOut) hs += 10;
      if (h.riskLevel === 'risky') hs -= 20;
      if (h.riskLevel === 'caution') hs -= 5;
      hs -= h.rainProbability * 0.1;
      hs -= Math.abs(25 - h.temperature) * 0.5;
      score += hs;
    }

    const windowLabel = `${hours[i].hourLabel} - ${hours[i + 2].hourLabel}`;
    if (score > bestScore) {
      bestScore = score;
      bestWindow = windowLabel;
    }
    if (score < worstScore) {
      worstScore = score;
      worstWindow = windowLabel;
    }
  }

  return { best: bestWindow, worst: worstWindow };
}

export class TimelineService {
  generateTimeline(weatherData: WeatherData, targetDate: string): WeatherTimeline {
    const hours: TimelineHour[] = [];
    const targetPrefix = targetDate.split('T')[0];

    let peakTemp = { value: -Infinity, time: '' };
    let peakRain = { probability: 0, time: '' };

    if (weatherData.hourly && Array.isArray(weatherData.hourly)) {
      for (const item of weatherData.hourly) {
        if (item.time.startsWith(targetPrefix)) {
          const dateObj = new Date(item.time);
          const hour = dateObj.getHours();

          const temp = item.temperature ?? 0;
          const feelsLike = item.temperature ?? 0;
          const rainProb = item.precipitationProbability ?? 0;
          const rainAmt = item.precipitationAmount ?? 0;
          const windSpeed = item.windSpeed ?? 0;
          const humidity = item.humidity ?? 0;
          const uvIndex = item.uvIndex ?? 0;
          const weatherCode = item.weatherCode ?? 0;

          const isGood = rainProb < 30 && temp >= 20 && temp <= 35 && windSpeed < 30;
          let riskLevel: 'safe' | 'caution' | 'risky' = 'safe';
          if (rainProb > 70 || windSpeed > 50 || temp > 40 || temp < 0 || uvIndex > 8) {
            riskLevel = 'risky';
          } else if (rainProb >= 30 || windSpeed >= 30 || temp > 35 || temp < 20 || uvIndex >= 6) {
            riskLevel = 'caution';
          }

          if (temp > peakTemp.value) {
            peakTemp = { value: temp, time: formatHourLabel(hour) };
          }
          if (rainProb > peakRain.probability) {
            peakRain = { probability: rainProb, time: formatHourLabel(hour) };
          }

          hours.push({
            time: item.time,
            hour,
            hourLabel: formatHourLabel(hour),
            temperature: temp,
            feelsLike,
            condition: item.condition || weatherCodeToCondition(weatherCode),
            conditionEmoji: getConditionEmoji(weatherCode),
            rainProbability: rainProb,
            rainAmount: rainAmt,
            windSpeed,
            humidity,
            uvIndex,
            isGoodToGoOut: isGood,
            riskLevel
          });
        }
      }
    }

    const { best, worst } = findWindows(hours);

    return {
      date: targetDate,
      timezone: weatherData.location?.timezone || 'UTC',
      hours,
      summary: {
        bestHours: best,
        worstHours: worst,
        peakTemperature: peakTemp.value === -Infinity ? { value: 0, time: 'N/A' } : peakTemp,
        peakRain
      }
    };
  }
}

export const timelineService = new TimelineService();
