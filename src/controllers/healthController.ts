import { Request, Response } from 'express';
import { env } from '../config/env.js';
import { openAIClient } from '../services/llm/openaiClient.js';

export class HealthController {
  checkHealth(req: Request, res: Response): void {
    const providerInfo = openAIClient.getProviderInfo();
    res.json({
      status: 'healthy',
      service: 'Live Weather AI / WeatherGPT Backend',
      version: '1.0.0',
      uptime: process.uptime(),
      environment: env.NODE_ENV,
      integrations: {
        llm: providerInfo,
        openAI: providerInfo.isConfigured ? 'configured' : 'fallback_mode',
        makeWebhook: env.MAKE_WEBHOOK_URL ? 'configured' : 'disabled'
      },
      timestamp: new Date().toISOString()
    });
  }

  async testLLM(req: Request, res: Response): Promise<void> {
    try {
      const prompt = (req.query.q as string) || 'Give a 1-sentence friendly greeting to WeatherGPT users.';
      const answer = await openAIClient.generateChatCompletion('You are a helpful AI assistant.', prompt);
      res.json({
        success: true,
        provider: openAIClient.getProviderInfo(),
        prompt,
        response: answer
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown LLM test error';
      res.status(500).json({
        success: false,
        provider: openAIClient.getProviderInfo(),
        error: msg
      });
    }
  }
}

export const healthController = new HealthController();
