import { Request, Response, NextFunction } from 'express';
import { agriService } from '../services/agri/agriService.js';

export class AgriController {
  public async getAdvisory(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const location = req.query.location as string | undefined;
      const latStr = req.query.lat as string | undefined;
      const lonStr = req.query.lon as string | undefined;
      const cropType = req.query.cropType as string | undefined;
      const language = (req.query.language as string) || 'en';

      const lat = latStr ? parseFloat(latStr) : undefined;
      const lon = lonStr ? parseFloat(lonStr) : undefined;

      const advisory = await agriService.generateAgriAdvisory(location, lat, lon, cropType, language);

      res.status(200).json({
        success: true,
        agri: advisory
      });
    } catch (error) {
      next(error);
    }
  }
}

export const agriController = new AgriController();
