import dotenv from 'dotenv';
import path from 'path';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  PORT: z.coerce.number().default(3000),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  FRONTEND_URL: z.string().default('*'),

  // LLM Config
  OPENAI_API_KEY: z.string().optional().default(''),
  OPENAI_BASE_URL: z.string().default('https://api.openai.com/v1'),
  LLM_MODEL: z.string().default('gpt-4o-mini'),
  GROQ_API_KEY: z.string().optional().default(''),
  OPENROUTER_API_KEY: z.string().optional().default(''),
  GEMINI_API_KEY: z.string().optional().default('').transform(val => val || process.env.GOOGLE_API_KEY || ''),

  // Weather Provider Config
  WEATHER_API_KEY: z.string().optional().default(''),
  WEATHER_API_BASE_URL: z.string().default('https://api.open-meteo.com/v1'),

  // Geocoding Config
  GEOCODING_API_KEY: z.string().optional().default(''),
  GEOCODING_API_BASE_URL: z.string().default('https://geocoding-api.open-meteo.com/v1'),

  // Make Webhook
  MAKE_WEBHOOK_URL: z.string().optional().default(''),

  // Cache Config (seconds)
  CACHE_TTL_CURRENT: z.coerce.number().default(300),
  CACHE_TTL_FORECAST: z.coerce.number().default(900),
  CACHE_TTL_GEOCODING: z.coerce.number().default(86400),

  // Rate Limiting
  RATE_LIMIT_WINDOW_MS: z.coerce.number().default(900000), // 15 mins
  RATE_LIMIT_MAX_REQUESTS: z.coerce.number().default(100),

  // Conversation Memory
  CONVERSATION_TTL_MINUTES: z.coerce.number().default(30),

  // Voice / TTS
  OPENAI_VOICE_API_KEY: z.string().optional(),
  TTS_MODEL: z.string().default('tts-1'),
  TTS_VOICE: z.string().default('alloy'),
  WHISPER_MODEL: z.string().default('whisper-1')
});

const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
  console.error('Invalid environment variables schema:', parsedEnv.error.format());
  throw new Error('Environment configuration error');
}

export const env = parsedEnv.data;
