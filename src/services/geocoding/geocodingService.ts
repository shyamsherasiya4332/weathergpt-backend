import axios from 'axios';
import { env } from '../../config/env.js';
import { ResolvedLocation } from '../../types/weather.js';
import { cache } from '../../utils/cache.js';
import { logger } from '../../utils/logger.js';
import { GeocodingResult, IGeocodingProvider } from './types.js';

function normalizePlace(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9\u0900-\u0d7f]+/gi, ' ').trim();
}

function pickStrongestMatch(query: string, locations: ResolvedLocation[]): ResolvedLocation | undefined {
  const q = normalizePlace(query);
  const exact = locations.filter((l) => normalizePlace(l.name) === q);
  if (exact.length > 0) {
    return (
      exact.find((l) => l.country?.toLowerCase() === 'india' || l.country?.toLowerCase() === 'in') ||
      exact[0]
    );
  }

  const strong = locations.filter((l) => {
    const n = normalizePlace(l.name);
    return n === q || n.startsWith(`${q} `) || q.startsWith(`${n} `);
  });
  if (strong.length > 0) {
    return (
      strong.find((l) => l.country?.toLowerCase() === 'india' || l.country?.toLowerCase() === 'in') ||
      strong[0]
    );
  }

  // Reject weak prefix matches such as Florida -> Floridablanca
  return undefined;
}

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
  admin2?: string;
  admin3?: string;
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
            count: 20,
            language: 'en',
            format: 'json'
          },
          timeout: 6000
        }
      );

      let results = response.data.results;

      // Fallback 1: Strip state/country names and retry
      if (!results || results.length === 0) {
        let cleanedName = trimmed
          .replace(/\b(?:gujarat|maharashtra|rajasthan|punjab|haryana|delhi|karnataka|kerala|tamilnadu|tamil nadu|andhra|telangana|west bengal|bengal|odisha|orissa|assam|bihar|jharkhand|chhattisgarh|madhya pradesh|uttar pradesh|uttarakhand|himachal|jammu|kashmir|ladakh|goa|tripura|meghalaya|manipur|nagaland|mizoram|sikkim|arunachal|puducherry|chandigarh|andaman|nicobar|lakshadweep|india|bharat)\b/gi, '')
          .trim();

        if (cleanedName && cleanedName.toLowerCase() !== trimmed.toLowerCase()) {
          logger.info(`Geocoding fallback retry: '${trimmed}' -> '${cleanedName}'`);
          const retryResponse = await axios.get<{ results?: OpenMeteoGeocodingItem[] }>(
            `${env.GEOCODING_API_BASE_URL}/search`,
            { params: { name: cleanedName, count: 20, language: 'en', format: 'json' }, timeout: 6000 }
          );
          results = retryResponse.data.results;
        }
        
        // Fallback 2: If STILL no results, and it's a multi-word query like "Rapar Morbi", search just the first word ("Rapar")
        if ((!results || results.length === 0) && trimmed.includes(' ')) {
           const firstWord = trimmed.split(' ')[0].trim();
           if (firstWord.length >= 3) {
             logger.info(`Geocoding fallback retry (first word): '${trimmed}' -> '${firstWord}'`);
             const retryWordResp = await axios.get<{ results?: OpenMeteoGeocodingItem[] }>(
               `${env.GEOCODING_API_BASE_URL}/search`,
               { params: { name: firstWord, count: 20, language: 'en', format: 'json' }, timeout: 6000 }
             );
             
             // If we found results for the first word, try to find one that matches the rest of the string (e.g. Morbi) in its admin fields
             if (retryWordResp.data.results && retryWordResp.data.results.length > 0) {
               const restOfStr = trimmed.substring(firstWord.length).trim().toLowerCase();
               const refinedMatch = retryWordResp.data.results.find(r => 
                 (r.admin1 && restOfStr.includes(r.admin1.toLowerCase())) || 
                 (r.admin2 && restOfStr.includes(r.admin2.toLowerCase())) || 
                 (r.admin3 && restOfStr.includes(r.admin3.toLowerCase())) ||
                 restOfStr.includes('gujarat')
               );
               
               if (refinedMatch) {
                 results = [refinedMatch];
               } else {
                 results = retryWordResp.data.results;
               }
             }
           }
        }
      }

      if (!results || results.length === 0) {
        // Fallback 2: Query OpenStreetMap Nominatim for native Indic script places (Hindi, Gujarati, Marathi, etc.)
        try {
          logger.info(`Geocoding fallback 2 (Nominatim) for: '${trimmed}'`);
          const nominatimResp = await axios.get<Array<{
            name?: string;
            lat: string;
            lon: string;
            display_name?: string;
            address?: {
              city?: string;
              town?: string;
              village?: string;
              state?: string;
              country?: string;
            };
          }>>('https://nominatim.openstreetmap.org/search', {
            params: {
              q: trimmed,
              format: 'json',
              countrycodes: 'in',
              addressdetails: 1,
              limit: 5
            },
            headers: {
              'User-Agent': 'WeatherGPT/1.0'
            },
            timeout: 5000
          });

          if (nominatimResp.data && nominatimResp.data.length > 0) {
            const first = nominatimResp.data[0];
            const locName = first.name || first.address?.city || first.address?.town || first.address?.village || trimmed;
            const nominatimLocation: ResolvedLocation = {
              name: locName,
              latitude: parseFloat(first.lat),
              longitude: parseFloat(first.lon),
              country: first.address?.country || 'India',
              state: first.address?.state,
              timezone: 'Asia/Kolkata'
            };
            const geocodeResult: GeocodingResult = {
              success: true,
              location: nominatimLocation,
              isAmbiguous: false,
              matches: [nominatimLocation]
            };
            cache.set(cacheKey, geocodeResult, env.CACHE_TTL_GEOCODING);
            return geocodeResult;
          }
        } catch (nomErr) {
          logger.warn(`Nominatim geocoding fallback failed for '${trimmed}':`, nomErr);
        }

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
        timezone: item.timezone || 'Asia/Kolkata',
        elevation: item.elevation,
        locationType: item.feature_code?.startsWith('ADM') ? 'state' : 'city'
      }));

      const selectedLocation = pickStrongestMatch(trimmed, locations);
      const isAmbiguous = !selectedLocation && locations.length > 0;

      const geocodeResult: GeocodingResult = {
        success: Boolean(selectedLocation),
        location: selectedLocation,
        isAmbiguous,
        matches: locations,
        errorMessage: selectedLocation
          ? undefined
          : `I found similar names for '${locationName}' but none were a strong match.`
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
