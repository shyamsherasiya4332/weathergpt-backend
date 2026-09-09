import { NextFunction, Request, Response } from 'express';
import { z } from 'zod';
import { makeService } from '../services/make/makeService.js';
import { weatherService } from '../services/weather/weatherService.js';
import { logger } from '../utils/logger.js';

export const alertRequestSchema = z.object({
  location: z.union([
    z.string().min(1),
    z.object({
      name: z.string().optional(),
      latitude: z.number(),
      longitude: z.number()
    })
  ]),
  condition: z.enum(['rain', 'temperature_high', 'temperature_low', 'wind']).default('rain'),
  threshold: z.number().min(0).max(100),
  notification: z.boolean().default(true)
});

export class AlertController {
  async handleCreateAlertCheck(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { location, condition, threshold, notification } = req.body;
      logger.info(`Alert check requested for ${typeof location === 'string' ? location : location.name} (Threshold: ${threshold}%)`);

      const locationInput = typeof location === 'string' ? undefined : location;
      const locationName = typeof location === 'string' ? location : location.name;

      const weatherResult = await weatherService.resolveAndFetchWeather(locationInput, locationName);

      if (weatherResult.error || !weatherResult.weatherData) {
        res.status(400).json({
          success: false,
          error: {
            code: 'ALERT_CHECK_FAILED',
            message: weatherResult.error || 'Unable to resolve location for alert check.'
          }
        });
        return;
      }

      const weatherData = weatherResult.weatherData;
      const maxRainProb = weatherData.daily[0]?.precipitationProbabilityMax || weatherData.current.rainProbability || 0;
      const isThresholdCrossed = maxRainProb >= threshold;

      let makeTriggered = false;
      let makeResultMsg = 'Threshold not reached';

      if (isThresholdCrossed && notification) {
        const trigger = await makeService.triggerWebhook({
          event: 'weather_alert',
          location: weatherData.location.name,
          rain_probability: maxRainProb,
          rain_amount_mm: weatherData.daily[0]?.precipitationSum || 0,
          forecast_time: 'Today',
          message: `Alert triggered: ${condition} probability is ${maxRainProb}% (threshold: ${threshold}%).`,
          timestamp: new Date().toISOString()
        });
        makeTriggered = trigger.success;
        makeResultMsg = trigger.message;
      }

      res.json({
        success: true,
        alertConfigured: {
          location: weatherData.location.name,
          condition,
          threshold,
          notification
        },
        currentStatus: {
          maxRainProbability: maxRainProb,
          thresholdCrossed: isThresholdCrossed,
          temperature: weatherData.current.temperature,
          condition: weatherData.current.condition
        },
        makeWebhookResult: {
          triggered: makeTriggered,
          message: makeResultMsg
        },
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      next(error);
    }
  }
}

export const alertController = new AlertController();
