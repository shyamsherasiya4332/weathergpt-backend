import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { geocodingService } from '../services/geocoding/geocodingService.js';
import { logger } from '../utils/logger.js';

export const reverseGeocodeSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180)
});

export class LocationController {
  async handleReverseGeocode(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { latitude, longitude } = req.body;
      logger.info(`Reverse geocode request for (${latitude}, ${longitude})`);

      const resolved = await geocodingService.reverseGeocode(latitude, longitude);

      res.json({
        success: true,
        location: resolved,
        formattedAddress: `${resolved.name}${resolved.state ? `, ${resolved.state}` : ''}${resolved.country ? `, ${resolved.country}` : ''}`,
        generated_at: new Date().toISOString()
      });
    } catch (error) {
      next(error);
    }
  }
}

export const locationController = new LocationController();
