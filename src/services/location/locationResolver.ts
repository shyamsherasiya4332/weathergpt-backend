import { LOCATION_GAZETTEER, lookupGazetteer, type GazetteerEntry } from '../../config/locationGazetteer.js';
import { matchLandmark } from '../../config/landmarks.js';
import { LocationType, StructuredLocation } from '../../types/nlu.js';
import { ResolvedLocation } from '../../types/weather.js';
import { geocodingService } from '../geocoding/geocodingService.js';
import { logger } from '../../utils/logger.js';

export interface LocationResolution {
  success: boolean;
  location?: ResolvedLocation;
  structured?: StructuredLocation;
  confidence: 'exact' | 'strong' | 'low' | 'none';
  needsClarification: boolean;
  clarificationMessage?: string;
  needsCityClarification: boolean;
  cityClarificationMessage?: string;
  representativeCity?: string;
  matches?: ResolvedLocation[];
  errorMessage?: string;
}

const INDIA_PREFERRED_NAMES = new Set(
  LOCATION_GAZETTEER.filter((e) => e.country === 'India').flatMap((e) => e.aliases)
);

function normalizeName(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

function isIndia(country?: string): boolean {
  const c = (country || '').toLowerCase();
  return c === 'india' || c === 'in' || c === 'bharat';
}

function isUnitedStates(country?: string): boolean {
  const c = (country || '').toLowerCase();
  return c === 'united states' || c === 'united states of america' || c === 'usa' || c === 'us' || c === 'america';
}

export function scoreLocationMatch(query: string, candidateName: string, country?: string, state?: string): number {
  const q = normalizeName(query);
  const n = normalizeName(candidateName);
  if (!q || !n) return 0;

  let score = 0;
  if (n === q) score = 100;
  else if (n.startsWith(`${q} `) || q.startsWith(`${n} `)) score = 82;
  else if (n.startsWith(q) && n.length - q.length <= 2) score = 70;
  else if (n.startsWith(q) && n.length > q.length + 2) score = 12; // Florida -> Floridablanca
  else if (q.startsWith(n) && q.length > n.length + 2) score = 18;
  else if (n.includes(q) || q.includes(n)) score = 20;
  else return 0;

  if (isIndia(country) && INDIA_PREFERRED_NAMES.has(q)) score += 25;
  if (state && normalizeName(state).includes(q)) score += 5;
  return score;
}

function gazetteerToResolved(entry: GazetteerEntry): ResolvedLocation {
  return {
    name: entry.name,
    latitude: entry.latitude,
    longitude: entry.longitude,
    country: entry.country,
    state: entry.state || (entry.type === 'state' ? entry.name : undefined),
    timezone: entry.timezone,
    locationType: entry.type
  };
}

function cityPromptForState(entry: GazetteerEntry): string {
  const examples = (entry.exampleCities || []).slice(0, 4).join(', ');
  const exampleBit = examples ? `, such as ${examples}` : '';
  return `${entry.name} is a large ${entry.type === 'state' ? 'state' : 'region'}, so weather can vary by city. Which city would you like me to check${exampleBit}?`;
}

export class LocationResolver {
  resolveFromGazetteer(name: string): LocationResolution | undefined {
    const entry = lookupGazetteer(name);
    if (!entry) return undefined;
    const location = gazetteerToResolved(entry);
    const structured: StructuredLocation = {
      name: entry.name,
      type: entry.type,
      state: entry.state,
      country: entry.country
    };
    const isBroad = entry.type === 'state' || entry.type === 'region' || entry.type === 'country';
    return {
      success: true,
      location,
      structured,
      confidence: 'exact',
      needsClarification: false,
      needsCityClarification: isBroad,
      cityClarificationMessage: isBroad ? cityPromptForState(entry) : undefined,
      representativeCity: entry.representativeCity,
      matches: [location]
    };
  }

  async resolve(
    extracted: StructuredLocation | string | undefined,
    opts?: { preferIndia?: boolean }
  ): Promise<LocationResolution> {
    const preferIndia = opts?.preferIndia !== false;
    const name = typeof extracted === 'string' ? extracted : extracted?.name;
    if (!name || !name.trim()) {
      return {
        success: false,
        confidence: 'none',
        needsClarification: false,
        needsCityClarification: false,
        errorMessage: 'LOCATION_MISSING'
      };
    }

    const trimmed = name.trim();

    const gazetteerHit = this.resolveFromGazetteer(trimmed);
    if (gazetteerHit) {
      logger.info(`Gazetteer resolved '${trimmed}' -> ${gazetteerHit.location?.name}, ${gazetteerHit.location?.country}`);
      return gazetteerHit;
    }

    const landmark = matchLandmark(trimmed);
    if (landmark) {
      return {
        success: true,
        location: { ...landmark, locationType: 'landmark' },
        structured: {
          name: landmark.name,
          type: 'landmark',
          state: landmark.state,
          country: landmark.country || 'India'
        },
        confidence: 'exact',
        needsClarification: false,
        needsCityClarification: false,
        matches: [landmark]
      };
    }

    const geo = await geocodingService.geocode(trimmed);
    if (!geo.success || !geo.matches?.length && !geo.location) {
      return {
        success: false,
        confidence: 'none',
        needsClarification: false,
        needsCityClarification: false,
        errorMessage: geo.errorMessage || `Could not resolve location '${trimmed}'.`
      };
    }

    const candidates = geo.matches?.length ? geo.matches : geo.location ? [geo.location] : [];
    const scored = candidates
      .map((c) => ({
        loc: c,
        score: scoreLocationMatch(trimmed, c.name, c.country, c.state)
      }))
      .sort((a, b) => b.score - a.score);

    const exact = scored.filter((s) => normalizeName(s.loc.name) === normalizeName(trimmed));
    let chosen = scored[0];

    if (exact.length > 0) {
      if (preferIndia) {
        const indiaExact = exact.find((s) => isIndia(s.loc.country));
        if (indiaExact) chosen = indiaExact;
        else chosen = exact[0];
      } else {
        chosen = exact[0];
      }
    } else if (preferIndia) {
      const strongIndia = scored.find((s) => s.score >= 70 && isIndia(s.loc.country));
      if (strongIndia && (!chosen || chosen.score < 90)) {
        chosen = strongIndia;
      }
    }

    if (!chosen || chosen.score < 50) {
      const suggestion = scored[0]?.loc;
      const label = suggestion
        ? `${suggestion.name}${suggestion.state ? `, ${suggestion.state}` : ''}${suggestion.country ? `, ${suggestion.country}` : ''}`
        : trimmed;
      return {
        success: false,
        confidence: 'low',
        needsClarification: true,
        needsCityClarification: false,
        matches: candidates,
        clarificationMessage: suggestion
          ? `I found multiple locations matching ${trimmed}. Did you mean ${label}?`
          : `I could not confidently match "${trimmed}". Could you share a city and country?`,
        errorMessage: 'AMBIGUOUS_LOCATION'
      };
    }

    const confidence: LocationResolution['confidence'] = chosen.score >= 100 ? 'exact' : chosen.score >= 70 ? 'strong' : 'low';
    const type: LocationType = typeof extracted === 'object' && extracted?.type ? extracted.type : 'city';

    return {
      success: true,
      location: chosen.loc,
      structured: {
        name: chosen.loc.name,
        type,
        state: chosen.loc.state,
        country: chosen.loc.country
      },
      confidence,
      needsClarification: false,
      needsCityClarification: false,
      matches: candidates
    };
  }
}

export const locationResolver = new LocationResolver();

export { isIndia, isUnitedStates, normalizeName };
