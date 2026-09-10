import { Request, Response, NextFunction } from 'express';
import { routeService } from '../services/route/routeService.js';

export class RouteController {
  public async getRouteWeather(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { origin, destination } = req.body;

      if (!origin || !destination) {
        res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_INPUT',
            message: 'Both origin and destination parameters are required.'
          }
        });
        return;
      }

      const result = await routeService.analyzeRoute(origin, destination);

      res.status(200).json({
        success: true,
        routeWeather: result
      });
    } catch (error) {
      next(error);
    }
  }
}

export const routeController = new RouteController();
