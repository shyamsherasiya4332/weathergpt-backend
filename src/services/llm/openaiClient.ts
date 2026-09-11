import OpenAI from 'openai';
import { env } from '../../config/env.js';
import { logger } from '../../utils/logger.js';

export class OpenAIClientWrapper {
  private client: OpenAI | null = null;
  private modelName: string = env.LLM_MODEL;

  constructor() {
    if (env.OPENAI_API_KEY && env.OPENAI_API_KEY.trim() !== '') {
      this.client = new OpenAI({
        apiKey: env.OPENAI_API_KEY,
        baseURL: env.OPENAI_BASE_URL
      });
      this.modelName = env.LLM_MODEL || 'gpt-4o-mini';
      logger.info(`OpenAI Client initialized with base URL: ${env.OPENAI_BASE_URL}`);
    } else if (env.GROQ_API_KEY && env.GROQ_API_KEY.trim() !== '') {
      this.client = new OpenAI({
        apiKey: env.GROQ_API_KEY,
        baseURL: 'https://api.groq.com/openai/v1'
      });
      this.modelName = env.LLM_MODEL !== 'gpt-4o-mini' ? env.LLM_MODEL : 'llama-3.3-70b-versatile';
      logger.info('Groq Client initialized successfully');
    } else if (env.OPENROUTER_API_KEY && env.OPENROUTER_API_KEY.trim() !== '') {
      this.client = new OpenAI({
        apiKey: env.OPENROUTER_API_KEY,
        baseURL: 'https://openrouter.ai/api/v1'
      });
      this.modelName = env.LLM_MODEL !== 'gpt-4o-mini' ? env.LLM_MODEL : 'meta-llama/llama-3.3-70b-instruct';
      logger.info('OpenRouter Client initialized successfully');
    } else if (env.GEMINI_API_KEY && env.GEMINI_API_KEY.trim() !== '') {
      this.client = new OpenAI({
        apiKey: env.GEMINI_API_KEY.trim(),
        baseURL: 'https://generativelanguage.googleapis.com/v1beta/openai/'
      });
      this.modelName = env.LLM_MODEL !== 'gpt-4o-mini' ? env.LLM_MODEL : 'gemini-1.5-flash';
      logger.info('Google Gemini OpenAI Adapter initialized successfully');
    } else {
      logger.warn('No LLM API Key set. LLM service will operate with rule-based fallback generator.');
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
        model: this.modelName,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.3,
        ...(jsonMode ? { response_format: { type: 'json_object' } } : {})
      });

      return response.choices[0]?.message?.content || '';
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'LLM API error';
      logger.error(`LLM completion failed: ${msg}`);
      throw new Error(`LLM_ERROR: ${msg}`);
    }
  }
}

export const openAIClient = new OpenAIClientWrapper();
