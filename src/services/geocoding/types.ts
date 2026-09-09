import { ResolvedLocation } from '../../types/weather.js';

export interface GeocodingResult {
  success: boolean;
  location?: ResolvedLocation;
  isAmbiguous?: boolean;
  matches?: ResolvedLocation[];
  errorMessage?: string;
}

export interface IGeocodingProvider {
  geocode(locationName: string): Promise<GeocodingResult>;
  reverseGeocode(lat: number, lon: number): Promise<ResolvedLocation>;
}
