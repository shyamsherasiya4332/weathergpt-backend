import axios from 'axios';
import { env } from '../../config/env.js';
import { MakeWebhookPayload } from '../../types/api.js';
import { logger } from '../../utils/logger.js';

export class MakeService {
  async triggerWebhook(payload: MakeWebhookPayload): Promise<{ success: boolean; message: string }> {
    const webhookUrl = env.MAKE_WEBHOOK_URL;
    if (!webhookUrl || webhookUrl.trim() === '') {
      logger.debug('MAKE_WEBHOOK_URL is not configured. Webhook dispatch skipped.');
      return { success: false, message: 'MAKE_WEBHOOK_URL not configured' };
    }

    try {
      logger.info(`Dispatching Make Webhook event '${payload.event}' for ${payload.location}`);
      await axios.post(webhookUrl, payload, {
        headers: { 'Content-Type': 'application/json' },
        timeout: 5000
      });
      return { success: true, message: 'Webhook triggered successfully' };
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Unknown error';
      logger.warn(`Failed to dispatch Make Webhook (non-blocking): ${msg}`);
      return { success: false, message: `Webhook failure: ${msg}` };
    }
  }

  triggerRainAlertAsync(location: string, rainProbability: number, rainAmountMm: number, forecastTime?: string): void {
    // Non-blocking background dispatch
    const payload: MakeWebhookPayload = {
      event: 'weather_alert',
      location,
      rain_probability: rainProbability,
      rain_amount_mm: rainAmountMm,
      forecast_time: forecastTime || 'upcoming',
      message: `Alert: High rain probability (${rainProbability}%) detected for ${location}.`,
      timestamp: new Date().toISOString()
    };

    setImmediate(() => {
      this.triggerWebhook(payload).catch(() => {
        /* Ignore error to prevent unhandled rejection */
      });
    });
  }
}

export const makeService = new MakeService();
