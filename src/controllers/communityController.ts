import { Request, Response, NextFunction } from 'express';
import { communityService } from '../services/community/communityService.js';
import { geocodingService } from '../services/geocoding/geocodingService.js';
import { logger } from '../utils/logger.js';

export class CommunityController {
  public async submitReport(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { location, latitude, longitude, condition, intensity, photo, language, notes } = req.body;

      if (!location && (latitude === undefined || longitude === undefined)) {
        res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_INPUT',
            message: 'Location name or latitude/longitude coordinates are required.'
          }
        });
        return;
      }

      let lat = latitude;
      let lon = longitude;
      let locName = location;

      if ((lat === undefined || lon === undefined) && locName) {
        try {
          const geoRes = await geocodingService.geocode(locName);
          if (geoRes.success && geoRes.location) {
            lat = geoRes.location.latitude;
            lon = geoRes.location.longitude;
            locName = geoRes.location.name;
          }
        } catch {
          lat = 22.30;
          lon = 70.79;
        }
      }

      const report = communityService.addReport({
        location: locName || 'Unknown Location',
        latitude: Number(lat),
        longitude: Number(lon),
        condition: condition || 'heavy_rain',
        intensity: intensity || 'moderate',
        photo,
        language: language || 'en',
        notes
      });

      const communityConfidence = communityService.calculateCommunityConfidence(locName, Number(lat), Number(lon));

      res.status(201).json({
        success: true,
        report,
        communityConfidence
      });
    } catch (error) {
      next(error);
    }
  }

  public async getReports(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const location = req.query.location as string | undefined;
      const latStr = req.query.lat as string | undefined;
      const lonStr = req.query.lon as string | undefined;

      const lat = latStr ? parseFloat(latStr) : undefined;
      const lon = lonStr ? parseFloat(lonStr) : undefined;

      const reports = communityService.getReports(location, lat, lon);
      const communityConfidence = communityService.calculateCommunityConfidence(location, lat, lon);

      res.status(200).json({
        success: true,
        location: location || (lat && lon ? `${lat}, ${lon}` : 'All Locations'),
        reports,
        communityConfidence
      });
    } catch (error) {
      next(error);
    }
  }
}

export const communityController = new CommunityController();
