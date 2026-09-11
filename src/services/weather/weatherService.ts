import { LocationInput } from '../../types/api.js';
import { ParsedNLU } from '../../types/nlu.js';
import { RainAnalysisResult, ResolvedLocation, WeatherData } from '../../types/weather.js';
import { getRelativeDateString, isHourInTimeRange, parseHourFromIso } from '../../utils/dateUtils.js';
import { geocodingService } from '../geocoding/geocodingService.js';
import { openMeteoProvider, OpenMeteoWeatherProvider } from './openMeteoProvider.js';
import { IWeatherProvider } from './types.js';

import { matchLandmark } from '../../config/landmarks.js';
import { cache } from '../../utils/cache.js';
import { logger } from '../../utils/logger.js';

export class WeatherService {
  private provider: IWeatherProvider;

  constructor(provider?: IWeatherProvider) {
    this.provider = provider || openMeteoProvider;
  }

  async resolveAndFetchWeather(
    locationInput?: LocationInput,
    extractedLocationName?: string
  ): Promise<{ location?: ResolvedLocation; weatherData?: WeatherData; error?: string; isAmbiguous?: boolean; isCached?: boolean }> {
    let resolvedLocation: ResolvedLocation | undefined;

    // 1. If user explicitly asked about a specific location in their question, that takes HIGHEST priority!
    const nameToSearch = extractedLocationName?.trim() || locationInput?.name?.trim();

    if (nameToSearch) {
      // Check if place is a known landmark (e.g. Statue of Unity, Somnath Temple, Gir Forest)
      const landmarkLocation = matchLandmark(nameToSearch);
      if (landmarkLocation) {
        logger.info(`Matched landmark '${nameToSearch}' -> ${landmarkLocation.name}`);
        resolvedLocation = landmarkLocation;
      } else {
        const geoResult = await geocodingService.geocode(nameToSearch);
        if (!geoResult.success || !geoResult.location) {
          return { error: geoResult.errorMessage || `Unknown location '${nameToSearch}'` };
        }

        if (geoResult.isAmbiguous) {
          return { isAmbiguous: true, error: `Location '${nameToSearch}' is ambiguous.` };
        }

        resolvedLocation = geoResult.location;
      }
    } else if (locationInput?.latitude !== undefined && locationInput?.longitude !== undefined) {
      // 2. No specific city name asked, fallback to GPS coordinates (e.g. browser location or relative query)
      if (locationInput.name) {
        resolvedLocation = {
          name: locationInput.name,
          latitude: locationInput.latitude,
          longitude: locationInput.longitude,
          timezone: 'Asia/Kolkata'
        };
      } else {
        resolvedLocation = await geocodingService.reverseGeocode(
          locationInput.latitude,
          locationInput.longitude
        );
      }
    } else {
      return { error: 'LOCATION_MISSING' };
    }

    try {
      const weatherData = await this.provider.getWeatherData(resolvedLocation);
      return { location: weatherData.location, weatherData };
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Weather fetch error';
      logger.warn(`Live weather API failed for ${resolvedLocation?.name || 'requested location'}: ${msg}. Attempting offline cache fallback...`);

      // Attempt offline cache fallback if live API fails
      if (resolvedLocation) {
        const cacheKey = `weather:${resolvedLocation.latitude.toFixed(3)}:${resolvedLocation.longitude.toFixed(3)}`;
        const cachedData = cache.get<WeatherData>(cacheKey);

        if (cachedData) {
          logger.info(`Serving offline cached weather data for ${resolvedLocation.name}`);
          const fallbackData: WeatherData = {
            ...cachedData,
            isCached: true,
            cacheNotice: `Note: Live weather API was temporarily unavailable. Showing cached forecast retrieved at ${cachedData.retrievedAt}.`
          };
          return { location: resolvedLocation, weatherData: fallbackData, isCached: true };
        }
      }

      return { error: msg };
    }
  }

  analyzeRainForecast(weatherData: WeatherData, nlu: ParsedNLU): RainAnalysisResult {
    const targetDateStr = getRelativeDateString(
      nlu.targetDate || 'today',
      weatherData.location.timezone,
      nlu.specificDateStr
    );

    // Filter hourly data matching target date and time range
    const matchingHours = weatherData.hourly.filter((h) => {
      const hDate = h.time.split('T')[0];
      if (hDate !== targetDateStr) return false;
      const hour = parseHourFromIso(h.time);
      return isHourInTimeRange(hour, nlu.timeRange, nlu.specificTimeRange);
    });

    if (matchingHours.length === 0) {
      // Fallback to all hours of target date if range filter yielded nothing
      const dayHours = weatherData.hourly.filter((h) => h.time.startsWith(targetDateStr));
      matchingHours.push(...dayHours);
    }

    let maxProb = 0;
    let totalAmount = 0;
    let peakHourStr = '';

    const hourlyBreakdown = matchingHours.map((h) => {
      if (h.precipitationProbability > maxProb) {
        maxProb = h.precipitationProbability;
        peakHourStr = h.time.includes('T') ? h.time.split('T')[1].substring(0, 5) : h.time;
      }
      totalAmount += h.precipitationAmount;
      return {
        time: h.time,
        probability: h.precipitationProbability,
        amountMm: Math.round(h.precipitationAmount * 10) / 10,
        condition: h.condition
      };
    });

    const hasRainRisk = maxProb >= 30 || totalAmount > 0.5;
    let peakTimeWindow = '';
    if (peakHourStr) {
      peakTimeWindow = `around ${peakHourStr}`;
    }

    let summary = `Max rain probability for ${targetDateStr} is ${maxProb}%. Total estimated rain: ${totalAmount.toFixed(1)}mm.`;
    if (hasRainRisk) {
      summary = `Higher chance of rain expected on ${targetDateStr} ${peakTimeWindow} (up to ${maxProb}% probability).`;
    }

    return {
      hasRainRisk,
      maxRainProbability: maxProb,
      totalRainAmountMm: Math.round(totalAmount * 10) / 10,
      peakRainTimeWindow: peakTimeWindow,
      hourlyRainBreakdown: hourlyBreakdown,
      summary
    };
  }
}

export const weatherService = new WeatherService();
export { openMeteoProvider };
