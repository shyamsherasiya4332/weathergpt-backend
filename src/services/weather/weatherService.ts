import { LocationInput } from '../../types/api.js';
import { ParsedNLU } from '../../types/nlu.js';
import { RainAnalysisResult, ResolvedLocation, WeatherData } from '../../types/weather.js';
import { getRelativeDateString, isHourInTimeRange, parseHourFromIso } from '../../utils/dateUtils.js';
import { geocodingService } from '../geocoding/geocodingService.js';
import { openMeteoProvider, OpenMeteoWeatherProvider } from './openMeteoProvider.js';
import { IWeatherProvider } from './types.js';

import { cache } from '../../utils/cache.js';
import { logger } from '../../utils/logger.js';
import { locationResolver } from '../location/locationResolver.js';

export class WeatherService {
  private provider: IWeatherProvider;

  constructor(provider?: IWeatherProvider) {
    this.provider = provider || openMeteoProvider;
  }

  async resolveAndFetchWeather(
    locationInput?: LocationInput,
    extractedLocationName?: string
  ): Promise<{
    location?: ResolvedLocation;
    weatherData?: WeatherData;
    error?: string;
    isAmbiguous?: boolean;
    isCached?: boolean;
    needsCityClarification?: boolean;
    cityClarificationMessage?: string;
    clarificationMessage?: string;
  }> {
    let resolvedLocation: ResolvedLocation | undefined;
    let needsCityClarification = false;
    let cityClarificationMessage: string | undefined;

    const nameToSearch = extractedLocationName?.trim() || locationInput?.name?.trim();

    if (nameToSearch) {
      const resolved = await locationResolver.resolve(nameToSearch, { preferIndia: true });
      if (resolved.needsClarification) {
        return {
          isAmbiguous: true,
          error: resolved.errorMessage || 'AMBIGUOUS_LOCATION',
          clarificationMessage: resolved.clarificationMessage
        };
      }
      if (!resolved.success || !resolved.location) {
        return { error: resolved.errorMessage || `Unknown location '${nameToSearch}'` };
      }
      resolvedLocation = resolved.location;
      needsCityClarification = resolved.needsCityClarification;
      cityClarificationMessage = resolved.cityClarificationMessage;
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
      weatherData.location = { ...weatherData.location, ...resolvedLocation, timezone: weatherData.location.timezone || resolvedLocation.timezone };
      return {
        location: weatherData.location,
        weatherData,
        needsCityClarification,
        cityClarificationMessage
      };
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
      return isHourInTimeRange(hour, nlu.timeRange as any, nlu.specificTimeRange);
    });

    if (matchingHours.length === 0) {
      // Fallback to all hours of target date if range filter yielded nothing
      const dayHours = weatherData.hourly.filter((h) => h.time.startsWith(targetDateStr));
      matchingHours.push(...dayHours);
    }

    let maxProb = 0;
    let totalAmount = 0;
    let peakHourStr = '';
    let firstRainIso = '';
    let windowStart = '';
    let windowEnd = '';

    const hourlyBreakdown = matchingHours.map((h) => {
      if (h.precipitationProbability > maxProb) {
        maxProb = h.precipitationProbability;
        peakHourStr = h.time.includes('T') ? h.time.split('T')[1].substring(0, 5) : h.time;
      }
      if (!firstRainIso && (h.precipitationProbability >= 40 || h.precipitationAmount >= 0.2)) {
        firstRainIso = h.time;
      }
      totalAmount += h.precipitationAmount;
      return {
        time: h.time,
        probability: h.precipitationProbability,
        amountMm: Math.round(h.precipitationAmount * 10) / 10,
        condition: h.condition
      };
    });

    const significant = matchingHours.filter((h) => h.precipitationProbability >= 40 || h.precipitationAmount >= 0.2);
    if (significant.length > 0) {
      windowStart = significant[0].time;
      windowEnd = significant[significant.length - 1].time;
    }

    const hasRainRisk = maxProb >= 30 || totalAmount > 0.5;

    const formatClock = (isoOrHm: string): string => {
      const hm = isoOrHm.includes('T') ? isoOrHm.split('T')[1].substring(0, 5) : isoOrHm;
      const hour = parseInt(hm.split(':')[0], 10);
      if (Number.isNaN(hour)) return hm;
      const suffix = hour >= 12 ? 'PM' : 'AM';
      const h12 = hour % 12 || 12;
      return `${h12} ${suffix}`;
    };

    let peakTimeWindow = '';
    if (hasRainRisk && windowStart && windowEnd && windowStart !== windowEnd) {
      peakTimeWindow = `between ${formatClock(windowStart)} and ${formatClock(windowEnd)}`;
    } else if (hasRainRisk && (firstRainIso || peakHourStr)) {
      peakTimeWindow = `around ${formatClock(firstRainIso || peakHourStr)}`;
    }

    let summary = `Max rain probability for ${targetDateStr} is ${maxProb}%. Total estimated rain: ${totalAmount.toFixed(1)}mm.`;
    if (hasRainRisk) {
      summary = `Higher chance of rain expected on ${targetDateStr} ${peakTimeWindow} (up to ${maxProb}% probability).`;
    } else {
      summary = `No significant rain is expected on ${targetDateStr}.`;
    }

    return {
      hasRainRisk,
      maxRainProbability: maxProb,
      totalRainAmountMm: Math.round(totalAmount * 10) / 10,
      peakRainTimeWindow: peakTimeWindow,
      firstRainTime: firstRainIso ? formatClock(firstRainIso) : undefined,
      rainWindowStart: windowStart ? formatClock(windowStart) : undefined,
      rainWindowEnd: windowEnd ? formatClock(windowEnd) : undefined,
      hourlyRainBreakdown: hourlyBreakdown,
      summary
    };
  }
}

export const weatherService = new WeatherService();
export { openMeteoProvider };
