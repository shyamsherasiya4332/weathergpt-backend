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

      let results = response.data.results;

      // Fallback: If 0 results for multi-word queries like "Rajkot Gujarat", strip state/country names and retry
      if (!results || results.length === 0) {
        const cleanedName = trimmed
          .replace(/\b(?:gujarat|maharashtra|rajasthan|punjab|haryana|delhi|karnataka|kerala|tamilnadu|tamil nadu|andhra|telangana|west bengal|bengal|odisha|orissa|assam|bihar|jharkhand|chhattisgarh|madhya pradesh|uttar pradesh|uttarakhand|himachal|jammu|kashmir|ladakh|goa|tripura|meghalaya|manipur|nagaland|mizoram|sikkim|arunachal|puducherry|chandigarh|andaman|nicobar|lakshadweep|india|bharat)\b/gi, '')
          .trim();

        if (cleanedName && cleanedName.toLowerCase() !== trimmed.toLowerCase()) {
          logger.info(`Geocoding fallback retry: '${trimmed}' -> '${cleanedName}'`);
          const retryResponse = await axios.get<{ results?: OpenMeteoGeocodingItem[] }>(
            `${env.GEOCODING_API_BASE_URL}/search`,
            {
              params: {
                name: cleanedName,
                count: 5,
                language: 'en',
                format: 'json'
              },
              timeout: 6000
            }
          );
          results = retryResponse.data.results;
        }
      }

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

      // Open-Meteo sorts results by importance / population descending, so locations[0] is the primary match.
      // We prioritize an Indian match if available, otherwise the top global match.
      const isAmbiguous = false;

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
      // Use BigDataCloud reverse geocoding client API (free, reliable, high accuracy for India)
      const response = await axios.get<{
        city?: string;
        locality?: string;
        principalSubdivision?: string;
        countryName?: string;
      }>('https://api.bigdatacloud.net/data/reverse-geocode-client', {
        params: {
          latitude: lat,
          longitude: lon,
          localityLanguage: 'en'
        },
        timeout: 5000
      });

      const data = response.data;
      const placeName = data.city || data.locality || data.principalSubdivision;

      if (placeName && placeName.trim() !== '') {
        const resolved: ResolvedLocation = {
          name: placeName,
          latitude: lat,
          longitude: lon,
          country: data.countryName || 'India',
          state: data.principalSubdivision,
          timezone: 'Asia/Kolkata'
        };

        cache.set(cacheKey, resolved, env.CACHE_TTL_GEOCODING);
        return resolved;
      }
    } catch (err) {
      logger.warn(`Reverse geocode via BigDataCloud failed for ${lat},${lon}: ${err}`);
    }

    // Direct fallback if API unavailable
    return {
      name: `Location near (${lat.toFixed(2)}, ${lon.toFixed(2)})`,
      latitude: lat,
      longitude: lon,
      country: 'India',
      timezone: 'Asia/Kolkata'
    };
  }
}

export const geocodingService = new OpenMeteoGeocodingProvider();
