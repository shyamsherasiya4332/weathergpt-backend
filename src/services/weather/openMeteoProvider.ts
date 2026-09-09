import axios from 'axios';
import { env } from '../../config/env.js';
import { DailyForecastItem, HourlyForecastItem, ResolvedLocation, WeatherData } from '../../types/weather.js';
import { cache } from '../../utils/cache.js';
import { weatherCodeToCondition } from '../../utils/dateUtils.js';
import { logger } from '../../utils/logger.js';
import { IWeatherProvider } from './types.js';

interface OpenMeteoApiResponse {
  timezone: string;
  current?: {
    time: string;
    temperature_2m: number;
    relative_humidity_2m: number;
    apparent_temperature: number;
    is_day: number;
    precipitation: number;
    weather_code: number;
    cloud_cover: number;
    wind_speed_10m: number;
    wind_direction_10m: number;
    uv_index: number;
  };
  hourly?: {
    time: string[];
    temperature_2m: number[];
    relative_humidity_2m: number[];
    precipitation_probability: number[];
    precipitation: number[];
    weather_code: number[];
    wind_speed_10m: number[];
    uv_index: number[];
  };
  daily?: {
    time: string[];
    weather_code: number[];
    temperature_2m_max: number[];
    temperature_2m_min: number[];
    sunrise: string[];
    sunset: string[];
    precipitation_sum: number[];
    precipitation_probability_max: number[];
    uv_index_max: number[];
  };
}

export class OpenMeteoWeatherProvider implements IWeatherProvider {
  async getWeatherData(location: ResolvedLocation): Promise<WeatherData> {
    const cacheKey = `weather:${location.latitude.toFixed(3)}:${location.longitude.toFixed(3)}`;
    const cached = cache.get<WeatherData>(cacheKey);
    if (cached) return cached;

    try {
      const response = await axios.get<OpenMeteoApiResponse>(
        `${env.WEATHER_API_BASE_URL}/forecast`,
        {
          params: {
            latitude: location.latitude,
            longitude: location.longitude,
            current: [
              'temperature_2m',
              'relative_humidity_2m',
              'apparent_temperature',
              'is_day',
              'precipitation',
              'weather_code',
              'cloud_cover',
              'wind_speed_10m',
              'wind_direction_10m',
              'uv_index'
            ].join(','),
            hourly: [
              'temperature_2m',
              'relative_humidity_2m',
              'precipitation_probability',
              'precipitation',
              'weather_code',
              'wind_speed_10m',
              'uv_index'
            ].join(','),
            daily: [
              'weather_code',
              'temperature_2m_max',
              'temperature_2m_min',
              'sunrise',
              'sunset',
              'precipitation_sum',
              'precipitation_probability_max',
              'uv_index_max'
            ].join(','),
            timezone: location.timezone || 'auto',
            forecast_days: 7
          },
          timeout: 8000
        }
      );

      const data = response.data;
      const updatedLocation: ResolvedLocation = {
        ...location,
        timezone: data.timezone || location.timezone || 'Asia/Kolkata'
      };

      const current = data.current;
      const hourlyData = data.hourly;
      const dailyData = data.daily;

      const hourlyItems: HourlyForecastItem[] = [];
      if (hourlyData && hourlyData.time) {
        for (let i = 0; i < hourlyData.time.length; i++) {
          hourlyItems.push({
            time: hourlyData.time[i],
            temperature: hourlyData.temperature_2m[i] ?? 0,
            precipitationProbability: hourlyData.precipitation_probability[i] ?? 0,
            precipitationAmount: hourlyData.precipitation[i] ?? 0,
            weatherCode: hourlyData.weather_code[i] ?? 0,
            condition: weatherCodeToCondition(hourlyData.weather_code[i] ?? 0),
            humidity: hourlyData.relative_humidity_2m[i] ?? 0,
            windSpeed: hourlyData.wind_speed_10m[i] ?? 0,
            uvIndex: hourlyData.uv_index[i] ?? 0
          });
        }
      }

      const dailyItems: DailyForecastItem[] = [];
      if (dailyData && dailyData.time) {
        for (let i = 0; i < dailyData.time.length; i++) {
          dailyItems.push({
            date: dailyData.time[i],
            temperatureMax: dailyData.temperature_2m_max[i] ?? 0,
            temperatureMin: dailyData.temperature_2m_min[i] ?? 0,
            precipitationProbabilityMax: dailyData.precipitation_probability_max[i] ?? 0,
            precipitationSum: dailyData.precipitation_sum[i] ?? 0,
            condition: weatherCodeToCondition(dailyData.weather_code[i] ?? 0),
            sunrise: dailyData.sunrise[i] ?? '',
            sunset: dailyData.sunset[i] ?? '',
            uvIndexMax: dailyData.uv_index_max[i] ?? 0
          });
        }
      }

      // Compute current rain probability based on current hour's hourly probability if available
      let currentRainProb = 0;
      if (hourlyItems.length > 0) {
        currentRainProb = hourlyItems[0].precipitationProbability;
      }

      const weatherData: WeatherData = {
        location: updatedLocation,
        current: {
          temperature: current?.temperature_2m ?? 0,
          apparentTemperature: current?.apparent_temperature ?? current?.temperature_2m ?? 0,
          condition: weatherCodeToCondition(current?.weather_code ?? 0),
          weatherCode: current?.weather_code ?? 0,
          precipitation: current?.precipitation ?? 0,
          rainProbability: currentRainProb,
          humidity: current?.relative_humidity_2m ?? 0,
          windSpeed: current?.wind_speed_10m ?? 0,
          windDirection: current?.wind_direction_10m ?? 0,
          cloudCover: current?.cloud_cover ?? 0,
          visibility: 10000,
          uvIndex: current?.uv_index ?? 0,
          isDay: Boolean(current?.is_day ?? 1),
          time: current?.time || new Date().toISOString()
        },
        hourly: hourlyItems,
        daily: dailyItems,
        retrievedAt: new Date().toISOString()
      };

      cache.set(cacheKey, weatherData, env.CACHE_TTL_CURRENT);
      return weatherData;
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Unknown weather provider error';
      logger.error(`Weather API error for (${location.latitude}, ${location.longitude}): ${msg}`);
      throw new Error(`WEATHER_API_ERROR: ${msg}`);
    }
  }
}

export const openMeteoProvider = new OpenMeteoWeatherProvider();
