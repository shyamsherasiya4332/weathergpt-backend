import OpenAI from 'openai';
import { env } from '../../config/env.js';
import { logger } from '../../utils/logger.js';

export class OpenAIClientWrapper {
  private client: OpenAI | null = null;

  constructor() {
    if (env.OPENAI_API_KEY && env.OPENAI_API_KEY.trim() !== '') {
      this.client = new OpenAI({
        apiKey: env.OPENAI_API_KEY,
        baseURL: env.OPENAI_BASE_URL
      });
      logger.info(`OpenAI Client initialized with base URL: ${env.OPENAI_BASE_URL}`);
    } else {
      logger.warn('OPENAI_API_KEY is not set. LLM service will operate with rule-based fallback generator.');
    }
  }

  isConfigured(): boolean {
    return this.client !== null;
  }

  async generateChatCompletion(
    systemPrompt: string,
    userPrompt: string,
    jsonMode = false
  ): Promise<string> {
    if (!this.client) {
      throw new Error('OPENAI_CLIENT_NOT_CONFIGURED');
    }

    try {
      const response = await this.client.chat.completions.create({
        model: env.LLM_MODEL,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.2,
        ...(jsonMode ? { response_format: { type: 'json_object' } } : {})
      });

      return response.choices[0]?.message?.content || '';
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'OpenAI API error';
      logger.error(`LLM completion failed: ${msg}`);
      throw new Error(`LLM_ERROR: ${msg}`);
    }
  }
}

export const openAIClient = new OpenAIClientWrapper();
