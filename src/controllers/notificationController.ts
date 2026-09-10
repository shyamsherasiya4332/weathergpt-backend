import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { notificationService } from '../services/notification/notificationService.js';

export const scheduleNotificationSchema = z.object({
  location: z.string().min(1, 'Location name is required'),
  triggerType: z.enum(['rain', 'heat', 'flood', 'wind']),
  threshold: z.number().min(0, 'Threshold must be non-negative'),
  frequency: z.enum(['daily', 'hourly', 'realtime']).optional(),
  channel: z.enum(['make', 'webhook']).optional(),
  webhookUrl: z.string().url().optional()
});

export const evaluateNotificationSchema = z.object({
  location: z.string().min(1, 'Location name is required')
});

export class NotificationController {
  handleSchedule(req: Request, res: Response, next: NextFunction): void {
    try {
      const rule = notificationService.scheduleNotificationRule(req.body);
      res.json({
        success: true,
        message: 'Notification rule scheduled successfully',
        rule,
        generated_at: new Date().toISOString()
      });
    } catch (err) {
      next(err);
    }
  }

  handleGetRules(req: Request, res: Response, next: NextFunction): void {
    try {
      const location = req.query.location as string | undefined;
      const rules = notificationService.getNotificationRules(location);
      res.json({
        success: true,
        count: rules.length,
        rules,
        generated_at: new Date().toISOString()
      });
    } catch (err) {
      next(err);
    }
  }

  async handleEvaluate(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { location } = req.body;
      const evaluation = await notificationService.evaluateRulesForLocation(location);

      res.json({
        success: true,
        location,
        evaluations: evaluation,
        generated_at: new Date().toISOString()
      });
    } catch (err) {
      next(err);
    }
  }
}

export const notificationController = new NotificationController();
