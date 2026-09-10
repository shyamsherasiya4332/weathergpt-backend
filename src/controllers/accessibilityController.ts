import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { accessibilityService } from '../services/accessibility/accessibilityService.js';

export const accessibilityFormatSchema = z.object({
  text: z.string().optional(),
  location: z.string().optional(),
  language: z.string().optional(),
  voiceFirst: z.boolean().optional(),
  highContrast: z.boolean().optional(),
  largeText: z.boolean().optional(),
  weatherData: z
    .object({
      temperature: z.number().optional(),
      condition: z.string().optional(),
      rainProbability: z.number().optional(),
      windSpeed: z.number().optional()
    })
    .optional()
});

export class AccessibilityController {
  handleFormat(req: Request, res: Response, next: NextFunction): void {
    try {
      const result = accessibilityService.formatAccessibility(req.body);
      res.json({
        success: true,
        accessibility: result,
        generated_at: new Date().toISOString()
      });
    } catch (err) {
      next(err);
    }
  }

  handleGetOfflinePhrases(req: Request, res: Response, next: NextFunction): void {
    try {
      const category = req.query.category as string | undefined;
      const phrases = accessibilityService.getOfflineEmergencyPhrases(category);

      res.json({
        success: true,
        count: phrases.length,
        supportedLanguages: ['gu', 'hi', 'en'],
        phrases,
        generated_at: new Date().toISOString()
      });
    } catch (err) {
      next(err);
    }
  }
}

export const accessibilityController = new AccessibilityController();
