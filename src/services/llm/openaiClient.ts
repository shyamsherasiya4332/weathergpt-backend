import OpenAI from 'openai';
import axios from 'axios';
import { env } from '../../config/env.js';
import { logger } from '../../utils/logger.js';

export class OpenAIClientWrapper {
  private client: OpenAI | null = null;
  private modelName: string = env.LLM_MODEL;
  private geminiDirectKey: string | null = null;
  private providerName: string = 'none';

  constructor() {
    this.initClient();
  }

  private initClient(): void {
    const rawOpenAI = (env.OPENAI_API_KEY || '').trim();
    const rawGroq = (env.GROQ_API_KEY || '').trim();
    const rawOpenRouter = (env.OPENROUTER_API_KEY || '').trim();
    const rawGemini = (env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || '').trim();

    // Google Gemini keys start with 'AQ.' (modern 2024-2026 format) or 'AIza' (classic format)
    const isGeminiFormat = (k: string) =>
      k.startsWith('AQ.') ||
      k.startsWith('AIza') ||
      (!k.startsWith('sk-') && !k.startsWith('gsk_') && k.length >= 25);

    // 1. Check if ANY key is a Google Gemini API Key
    let effectiveGeminiKey = rawGemini;
    if (!effectiveGeminiKey && isGeminiFormat(rawOpenAI) && rawOpenAI !== 'your_openai_api_key_here') {
      effectiveGeminiKey = rawOpenAI;
      logger.info('Detected Google Gemini API key (AQ./AIza format) in OPENAI_API_KEY. Routing to Gemini.');
    } else if (!effectiveGeminiKey && isGeminiFormat(rawGroq)) {
      effectiveGeminiKey = rawGroq;
    }

    if (effectiveGeminiKey) {
      this.geminiDirectKey = effectiveGeminiKey;
      this.providerName = 'gemini';
      this.modelName = env.LLM_MODEL && !env.LLM_MODEL.startsWith('gpt') ? env.LLM_MODEL : 'gemini-2.5-flash';
      
      try {
        this.client = new OpenAI({
          apiKey: effectiveGeminiKey,
          baseURL: 'https://generativelanguage.googleapis.com/v1beta/openai'
        });
        logger.info(`Google Gemini Client initialized with model: ${this.modelName}`);
      } catch (err) {
        logger.warn('Failed to initialize Gemini OpenAI adapter, direct REST will be used:', err);
      }
      return;
    }

    // 2. Real OpenAI key (does not start with AIza)
    if (rawOpenAI && !rawOpenAI.startsWith('AIza') && rawOpenAI !== 'your_openai_api_key_here') {
      this.client = new OpenAI({
        apiKey: rawOpenAI,
        baseURL: env.OPENAI_BASE_URL
      });
      this.modelName = env.LLM_MODEL || 'gpt-4o-mini';
      this.providerName = 'openai';
      logger.info(`OpenAI Client initialized with base URL: ${env.OPENAI_BASE_URL}`);
      return;
    }

    // 3. Groq
    if (rawGroq) {
      this.client = new OpenAI({
        apiKey: rawGroq,
        baseURL: 'https://api.groq.com/openai/v1'
      });
      this.modelName = env.LLM_MODEL !== 'gpt-4o-mini' ? env.LLM_MODEL : 'llama-3.3-70b-versatile';
      this.providerName = 'groq';
      logger.info('Groq Client initialized successfully');
      return;
    }

    // 4. OpenRouter
    if (rawOpenRouter) {
      this.client = new OpenAI({
        apiKey: rawOpenRouter,
        baseURL: 'https://openrouter.ai/api/v1'
      });
      this.modelName = env.LLM_MODEL !== 'gpt-4o-mini' ? env.LLM_MODEL : 'meta-llama/llama-3.3-70b-instruct';
      this.providerName = 'openrouter';
      logger.info('OpenRouter Client initialized successfully');
      return;
    }

    logger.warn('No valid LLM API Key set. LLM service will operate with rule-based fallback generator.');
  }

  isConfigured(): boolean {
    return this.client !== null || this.geminiDirectKey !== null;
  }

  getProviderInfo() {
    return {
      provider: this.providerName,
      model: this.modelName,
      isConfigured: this.isConfigured()
    };
  }

  async listGeminiModels(): Promise<unknown> {
    if (!this.geminiDirectKey) {
      throw new Error('No Gemini key configured');
    }
    const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(this.geminiDirectKey.trim())}`;
    const res = await axios.get(url, {
      headers: {
        'x-goog-api-key': this.geminiDirectKey.trim()
      }
    });
    return res.data;
  }

  async generateChatCompletion(
    systemPrompt: string,
    userPrompt: string,
    jsonMode = false
  ): Promise<string> {
    if (!this.isConfigured()) {
      throw new Error('OPENAI_CLIENT_NOT_CONFIGURED');
    }

    let geminiNativeError: string | null = null;
    let openAiError: string | null = null;

    // 1. If Gemini direct key is available, try native Google Gemini REST API first!
    if (this.geminiDirectKey) {
      try {
        const text = await this.callGeminiNative(this.geminiDirectKey, systemPrompt, userPrompt, jsonMode);
        if (text && text.trim().length > 0) {
          return text.trim();
        }
      } catch (geminiErr: unknown) {
        const msg = geminiErr instanceof Error ? geminiErr.message : 'Gemini native REST error';
        logger.warn(`Gemini native REST failed, trying OpenAI adapter fallback: ${msg}`);
        geminiNativeError = msg;
      }
    }

    // 2. Try OpenAI SDK (for OpenAI, Groq, OpenRouter, or Gemini OpenAI adapter)
    if (this.client) {
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

        const content = response.choices[0]?.message?.content || '';
        if (content.trim().length > 0) {
          return content.trim();
        }
      } catch (openAiErr: unknown) {
        const msg = openAiErr instanceof Error ? openAiErr.message : 'LLM API error';
        logger.error(`LLM SDK completion failed (${this.providerName}/${this.modelName}): ${msg}`);
        openAiError = msg;
      }
    }

    const fullErr = [
      geminiNativeError ? `Native Gemini error: ${geminiNativeError}` : null,
      openAiError ? `OpenAI SDK error: ${openAiError}` : null
    ].filter(Boolean).join(' | ');

    throw new Error(fullErr || 'LLM completion failed across all providers.');
  }

  private async callGeminiNative(
    apiKey: string,
    systemPrompt: string,
    userPrompt: string,
    jsonMode: boolean
  ): Promise<string> {
    const modelsToTry = [
      this.modelName,
      'gemini-2.5-flash',
      'gemini-2.5-flash-lite',
      'gemini-flash-latest',
      'gemini-2.5-pro',
      'gemini-pro-latest'
    ].filter((v, idx, arr) => arr.indexOf(v) === idx && v.startsWith('gemini'));

    let lastErr: Error | null = null;
    const cleanKey = apiKey.trim();

    for (const model of modelsToTry) {
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(cleanKey)}`;
        const fullPrompt = systemPrompt ? `${systemPrompt}\n\n${userPrompt}` : userPrompt;
        
        const payload: Record<string, unknown> = {
          contents: [
            {
              role: 'user',
              parts: [{ text: fullPrompt }]
            }
          ],
          generationConfig: {
            temperature: 0.3,
            ...(jsonMode ? { responseMimeType: 'application/json' } : {})
          }
        };

        const res = await axios.post<{
          candidates?: Array<{
            content?: {
              parts?: Array<{ text?: string }>;
            };
          }>;
        }>(url, payload, {
          headers: {
            'Content-Type': 'application/json',
            'x-goog-api-key': cleanKey
          },
          timeout: 15000
        });

        const answer = res.data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (answer) {
          return answer;
        }
      } catch (err: unknown) {
        let msg = 'Gemini error';
        if (axios.isAxiosError(err)) {
          const status = err.response?.status;
          const data = JSON.stringify(err.response?.data || {});
          msg = `HTTP ${status}: ${data}`;
        } else if (err instanceof Error) {
          msg = err.message;
        }
        lastErr = new Error(`Gemini ${model} failed: ${msg}`);
        logger.warn(`Gemini model ${model} failed, trying next: ${msg}`);
      }
    }

    throw lastErr || new Error('All Gemini native models failed.');
  }
}

export const openAIClient = new OpenAIClientWrapper();
