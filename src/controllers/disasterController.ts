import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { disasterService } from '../services/disaster/disasterService.js';
import { weatherService } from '../services/weather/weatherService.js';
import { riskService } from '../services/risk/riskService.js';

export const disasterQuerySchema = z.object({
  location: z.string().optional(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  lang: z.string().optional()
});

export const emergencyGuideSchema = z.object({
  disasterType: z.enum(['cyclone', 'lightning', 'flood', 'heatwave', 'general']).optional(),
  language: z.string().optional()
});

export class DisasterController {
  async handleGetAlerts(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const locationName = (req.query.location || req.body.location || 'Ahmedabad') as string;
      const lat = req.query.latitude ? parseFloat(req.query.latitude as string) : undefined;
      const lon = req.query.longitude ? parseFloat(req.query.longitude as string) : undefined;

      const locInput = lat !== undefined && lon !== undefined ? { latitude: lat, longitude: lon } : undefined;

      const weatherResult = await weatherService.resolveAndFetchWeather(locInput, locationName);
      if (weatherResult.error || !weatherResult.weatherData) {
        res.status(404).json({
          success: false,
          error: { code: 'WEATHER_FETCH_FAILED', message: 'Could not fetch weather data for disaster assessment.' }
        });
        return;
      }

      const weatherData = weatherResult.weatherData;
      const rainAnalysis = weatherService.analyzeRainForecast(weatherData, { intent: 'general_forecast', isLocationNeeded: true, language: 'en', confidence: 1 });
      const riskScores = riskService.calculateRiskScores(weatherData, rainAnalysis);

      const alerts = disasterService.generateDisasterAlerts(weatherData, rainAnalysis, riskScores);

      res.json({
        success: true,
        location: weatherData.location,
        activeAlertsCount: alerts.length,
        hasCriticalAlert: alerts.some((a) => a.severity === 'CRITICAL'),
        alerts,
        generated_at: new Date().toISOString()
      });
    } catch (err) {
      next(err);
    }
  }

  handleGetEmergencyGuide(req: Request, res: Response): void {
    const type = (req.query.disasterType || req.body.disasterType || 'general') as any;
    const lang = (req.query.language || req.body.language || 'en') as string;

    const guidance = disasterService.getEmergencyGuidance(type, lang);

    res.json({
      success: true,
      guidance,
      generated_at: new Date().toISOString()
    });
  }
}

export const disasterController = new DisasterController();
