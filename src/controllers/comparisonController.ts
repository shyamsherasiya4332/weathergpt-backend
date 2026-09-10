import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { comparisonService } from '../services/comparison/comparisonService.js';

export const compareRequestSchema = z.object({
  locations: z.array(z.string()).min(1, 'At least one location required').max(5, 'Maximum 5 locations supported'),
  language: z.string().optional()
});

export class ComparisonController {
  async handleCompare(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { locations, language } = req.body;
      const result = await comparisonService.compareLocations(locations, language || 'en');

      res.json({
        success: true,
        comparison: result,
        generated_at: new Date().toISOString()
      });
    } catch (err) {
      next(err);
    }
  }
}

export const comparisonController = new ComparisonController();
