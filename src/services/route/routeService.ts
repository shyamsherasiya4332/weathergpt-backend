import { geocodingService } from '../geocoding/geocodingService.js';
import { openMeteoProvider } from '../weather/weatherService.js';
import { RouteWeatherResult, RouteRainZone } from '../../types/api.js';
import { logger } from '../../utils/logger.js';

class RouteService {
  /**
   * Analyze weather along a driving route between origin and destination
   */
  public async analyzeRoute(originName: string, destinationName: string): Promise<RouteWeatherResult> {
    logger.info(`Analyzing route weather from ${originName} to ${destinationName}`);

    // Resolve geocoding for origin & destination
    const originRes = await geocodingService.geocode(originName);
    const originLoc = (originRes.success && originRes.location) ? originRes.location : { name: originName, latitude: 22.30, longitude: 70.79, timezone: 'Asia/Kolkata' };

    const destRes = await geocodingService.geocode(destinationName);
    const destLoc = (destRes.success && destRes.location) ? destRes.location : { name: destinationName, latitude: 23.02, longitude: 72.57, timezone: 'Asia/Kolkata' };

    // Midpoint coordinates
    const midLat = (originLoc.latitude + destLoc.latitude) / 2;
    const midLon = (originLoc.longitude + destLoc.longitude) / 2;
    const midName = `Mid-route (${originLoc.name} - ${destLoc.name})`;

    // Calculate straight-line / estimated road distance in km
    const distanceKm = Math.round(this.calculateDistance(
      originLoc.latitude, originLoc.longitude,
      destLoc.latitude, destLoc.longitude
    ) * 1.25); // 1.25 factor for road winding

    const estimatedHours = Number((distanceKm / 65).toFixed(1)); // Avg speed 65 km/h

    // Fetch weather data for origin, mid-route, destination
    const midLoc = { name: midName, latitude: midLat, longitude: midLon, timezone: originLoc.timezone || 'Asia/Kolkata' };
    const [originData, midData, destData] = await Promise.all([
      openMeteoProvider.getWeatherData(originLoc),
      openMeteoProvider.getWeatherData(midLoc),
      openMeteoProvider.getWeatherData(destLoc)
    ]);

    const originWeather = {
      locationName: originLoc.name,
      temperature: Math.round(originData.current.temperature),
      condition: originData.current.condition,
      rainProbability: originData.current.rainProbability ?? 10
    };

    const midRouteWeather = {
      locationName: midName,
      temperature: Math.round(midData.current.temperature),
      condition: midData.current.condition,
      rainProbability: midData.current.rainProbability ?? 15
    };

    const destinationWeather = {
      locationName: destLoc.name,
      temperature: Math.round(destData.current.temperature),
      condition: destData.current.condition,
      rainProbability: destData.current.rainProbability ?? 10
    };

    // Identify rain zones along the route
    const rainZones: RouteRainZone[] = [];
    if ((originWeather.rainProbability) >= 40) {
      rainZones.push({
        locationName: originLoc.name,
        latitude: originLoc.latitude,
        longitude: originLoc.longitude,
        rainProbability: originWeather.rainProbability,
        severity: originWeather.rainProbability >= 70 ? 'heavy' : 'moderate'
      });
    }
    if ((midRouteWeather.rainProbability) >= 40) {
      rainZones.push({
        locationName: midName,
        latitude: midLat,
        longitude: midLon,
        rainProbability: midRouteWeather.rainProbability,
        severity: midRouteWeather.rainProbability >= 70 ? 'heavy' : 'moderate'
      });
    }
    if ((destinationWeather.rainProbability) >= 40) {
      rainZones.push({
        locationName: destLoc.name,
        latitude: destLoc.latitude,
        longitude: destLoc.longitude,
        rainProbability: destinationWeather.rainProbability,
        severity: destinationWeather.rainProbability >= 70 ? 'heavy' : 'moderate'
      });
    }

    // Determine safe travel window
    const maxRainProb = Math.max(
      originWeather.rainProbability,
      midRouteWeather.rainProbability,
      destinationWeather.rainProbability
    );

    let safetyScore = 90;
    let safeReason = 'Favorable travel conditions with low precipitation risk along the route.';
    let departureTime = 'Immediate (Within next 1 hour)';

    if (maxRainProb > 70) {
      safetyScore = 55;
      safeReason = 'Heavy rain detected on route segments. Consider departing after 2-3 hours for clearer roads.';
      departureTime = 'Delay by 2 hours';
    } else if (maxRainProb > 40) {
      safetyScore = 75;
      safeReason = 'Moderate rain risk present along mid-route. Carry rain gear and drive carefully.';
      departureTime = 'Safe to leave now, drive with headlights ON';
    }

    // ETA Weather summary
    const etaWeatherSummary = `Driving route from ${originLoc.name} to ${destLoc.name} is ~${distanceKm} km (approx ${estimatedHours} hrs). ` +
      `Origin (${originLoc.name}): ${originWeather.temperature}°C, ${originWeather.condition}. ` +
      `Destination (${destLoc.name}): ${destinationWeather.temperature}°C, ${destinationWeather.condition}. ` +
      (rainZones.length > 0 ? `Alert: ${rainZones.length} rain zone(s) detected.` : 'No critical rain zones detected along the highway.');

    return {
      origin: originLoc.name,
      destination: destLoc.name,
      totalDistanceKm: distanceKm,
      estimatedDurationHours: estimatedHours,
      originWeather,
      midRouteWeather,
      destinationWeather,
      rainZones,
      safeTravelWindow: {
        recommendedDeparture: departureTime,
        reason: safeReason,
        safetyScore
      },
      etaWeatherSummary
    };
  }

  private calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371;
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLon = (lon2 - lon1) * (Math.PI / 180);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }
}

export const routeService = new RouteService();
