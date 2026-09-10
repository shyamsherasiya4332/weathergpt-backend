import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { copilotService } from '../services/copilot/copilotService.js';

export const copilotPlanSchema = z.object({
  activityType: z.enum(['wedding', 'sports', 'travel', 'farming', 'outdoor_event', 'daily_activity']),
  location: z.string().min(1, 'Location name is required'),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  date: z.string().optional(),
  timeRange: z.string().optional(),
  language: z.string().optional()
});

export class CopilotController {
  async handlePlan(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const planInput = req.body;
      const result = await copilotService.generatePlan(planInput);

      res.json({
        success: true,
        copilot: result,
        generated_at: new Date().toISOString()
      });
    } catch (err) {
      next(err);
    }
  }
}

export const copilotController = new CopilotController();
