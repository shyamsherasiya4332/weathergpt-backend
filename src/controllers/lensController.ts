import { Request, Response, NextFunction } from 'express';
import { weatherLensService } from '../services/lens/weatherLensService.js';

export class LensController {
  public async analyzeLens(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { image, question, location, latitude, longitude, language } = req.body;

      const result = await weatherLensService.analyzeSkyImage({
        image,
        question,
        location,
        latitude: latitude ? Number(latitude) : undefined,
        longitude: longitude ? Number(longitude) : undefined,
        language
      });

      res.status(200).json({
        success: true,
        weatherLens: result
      });
    } catch (error) {
      next(error);
    }
  }
}

export const lensController = new LensController();
