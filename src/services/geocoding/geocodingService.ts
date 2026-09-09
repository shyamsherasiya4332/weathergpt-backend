import axios from 'axios';
import { env } from '../../config/env.js';
import { ResolvedLocation } from '../../types/weather.js';
import { cache } from '../../utils/cache.js';
import { logger } from '../../utils/logger.js';
import { GeocodingResult, IGeocodingProvider } from './types.js';

interface OpenMeteoGeocodingItem {
  id: number;
  name: string;
  latitude: number;
  longitude: number;
  elevation?: number;
  feature_code?: string;
  country_code?: string;
  timezone?: string;
  country?: string;
  admin1?: string; // State / Region
}

export class OpenMeteoGeocodingProvider implements IGeocodingProvider {
  async geocode(locationName: string): Promise<GeocodingResult> {
    const trimmed = locationName.trim();
    if (!trimmed) {
      return { success: false, errorMessage: 'Empty location name' };
    }

    const cacheKey = `geocode:${trimmed.toLowerCase()}`;
    const cached = cache.get<GeocodingResult>(cacheKey);
    if (cached) return cached;

    try {
      const response = await axios.get<{ results?: OpenMeteoGeocodingItem[] }>(
        `${env.GEOCODING_API_BASE_URL}/search`,
        {
          params: {
            name: trimmed,
            count: 5,
            language: 'en',
            format: 'json'
          },
          timeout: 6000
        }
      );

      const results = response.data.results;
      if (!results || results.length === 0) {
        const notFoundResult: GeocodingResult = {
          success: false,
          errorMessage: `Location '${locationName}' not found.`
        };
        return notFoundResult;
      }

      const locations: ResolvedLocation[] = results.map((item) => ({
        name: item.name,
        latitude: item.latitude,
        longitude: item.longitude,
        country: item.country,
        state: item.admin1,
        timezone: item.timezone || 'Asia/Kolkata', // fallback if missing
        elevation: item.elevation
      }));

      // Prioritize Indian locations if searching from India / Indic queries
      const indiaMatch = locations.find(
        (l) => l.country?.toLowerCase() === 'india' || l.country?.toLowerCase() === 'in'
      );
      const selectedLocation = indiaMatch || locations[0];

      // Mark ambiguous ONLY if no clear Indian match exists AND multiple distinct countries are found
      const distinctCountries = new Set(locations.map(l => `${l.name}, ${l.state || ''}, ${l.country || ''}`));
      const isAmbiguous = !indiaMatch && distinctCountries.size > 1 && locations.length > 1;

      const geocodeResult: GeocodingResult = {
        success: true,
        location: selectedLocation,
        isAmbiguous,
        matches: locations
      };

      cache.set(cacheKey, geocodeResult, env.CACHE_TTL_GEOCODING);
      return geocodeResult;
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Unknown geocoding error';
      logger.error(`Geocoding error for ${locationName}: ${msg}`);
      return {
        success: false,
        errorMessage: `Failed to geocode location '${locationName}'.`
      };
    }
  }

  async reverseGeocode(lat: number, lon: number): Promise<ResolvedLocation> {
    const cacheKey = `reverse_geocode:${lat.toFixed(4)}:${lon.toFixed(4)}`;
    const cached = cache.get<ResolvedLocation>(cacheKey);
    if (cached) return cached;

    try {
      // Try fetching place details near coordinates
      const response = await axios.get<{ results?: OpenMeteoGeocodingItem[] }>(
        `${env.GEOCODING_API_BASE_URL}/search`,
        {
          params: {
            latitude: lat,
            longitude: lon,
            count: 1,
            language: 'en',
            format: 'json'
          },
          timeout: 6000
        }
      );

      const item = response.data.results?.[0];
      const resolved: ResolvedLocation = {
        name: item?.name || `Location (${lat.toFixed(2)}, ${lon.toFixed(2)})`,
        latitude: lat,
        longitude: lon,
        country: item?.country,
        state: item?.admin1,
        timezone: item?.timezone || 'Asia/Kolkata'
      };

      cache.set(cacheKey, resolved, env.CACHE_TTL_GEOCODING);
      return resolved;
    } catch {
      // Direct fallback
      return {
        name: `Coordinates (${lat.toFixed(2)}, ${lon.toFixed(2)})`,
        latitude: lat,
        longitude: lon,
        timezone: 'Asia/Kolkata'
      };
    }
  }
}

export const geocodingService = new OpenMeteoGeocodingProvider();
