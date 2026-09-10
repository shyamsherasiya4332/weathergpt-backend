import { Request, Response, NextFunction } from 'express';
import { shareService } from '../services/share/shareService.js';
import { openMeteoProvider } from '../services/weather/weatherService.js';
import { geocodingService } from '../services/geocoding/geocodingService.js';

export class ShareController {
  public async getShareCard(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { location, question } = req.body;
      const targetLoc = location || 'Rajkot';

      let weatherData;
      try {
        const geoRes = await geocodingService.geocode(targetLoc);
        if (geoRes.success && geoRes.location) {
          weatherData = await openMeteoProvider.getWeatherData(geoRes.location);
        } else {
          weatherData = null;
        }
      } catch {
        weatherData = null;
      }

      const card = shareService.generateShareCard(targetLoc, weatherData, question);

      res.status(200).json({
        success: true,
        shareCard: card
      });
    } catch (error) {
      next(error);
    }
  }
}

export const shareController = new ShareController();
