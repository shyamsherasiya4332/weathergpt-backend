import { Request, Response } from 'express';
import { env } from '../config/env.js';
import { openAIClient } from '../services/llm/openaiClient.js';

export class HealthController {
  checkHealth(req: Request, res: Response): void {
    res.json({
      status: 'healthy',
      service: 'Live Weather AI / WeatherGPT Backend',
      version: '1.0.0',
      uptime: process.uptime(),
      environment: env.NODE_ENV,
      integrations: {
        openAI: openAIClient.isConfigured() ? 'configured' : 'fallback_mode',
        makeWebhook: env.MAKE_WEBHOOK_URL ? 'configured' : 'disabled'
      },
      timestamp: new Date().toISOString()
    });
  }
}

export const healthController = new HealthController();
