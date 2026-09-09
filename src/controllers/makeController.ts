import { NextFunction, Request, Response } from 'express';
import { z } from 'zod';
import { makeService } from '../services/make/makeService.js';

export const makeWebhookSchema = z.object({
  event: z.string().default('manual_test'),
  location: z.string().default('Morbi'),
  rain_probability: z.number().optional(),
  rain_amount_mm: z.number().optional(),
  forecast_time: z.string().optional(),
  message: z.string().default('Manual test webhook payload')
});

export class MakeController {
  async handleTriggerWebhook(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const payload = req.body;
      const result = await makeService.triggerWebhook({
        ...payload,
        timestamp: new Date().toISOString()
      });

      res.json({
        success: result.success,
        message: result.message,
        dispatchedPayload: payload
      });
    } catch (error) {
      next(error);
    }
  }
}

export const makeController = new MakeController();
