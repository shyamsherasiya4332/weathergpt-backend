import OpenAI, { toFile } from 'openai';
import { env } from '../../config/env.js';
import { logger } from '../../utils/logger.js';

export interface TranscriptionResult {
  text: string;
  language: string;
  confidence: number;
}

export interface SpeechResult {
  audioBuffer: Buffer;
  format: string;
  duration?: number;
}

export class VoiceService {
  private openaiClients: OpenAI[] = [];
  private currentClientIndex: number = 0;

  constructor() {
    this.initClients();
  }

  private initClients() {
    const keys = [
      env.OPENAI_VOICE_API_KEY,
      env.OPENAI_VOICE_API_KEY_2,
      env.OPENAI_VOICE_API_KEY_3,
      env.OPENAI_API_KEY
    ].filter(Boolean) as string[];

    // Filter out Gemini keys
    const validKeys = keys.filter(k => !k.startsWith('AIza') && !k.startsWith('AQ.'));
    // Remove duplicates
    const uniqueKeys = Array.from(new Set(validKeys));

    if (uniqueKeys.length > 0) {
      this.openaiClients = uniqueKeys.map(key => new OpenAI({
        apiKey: key,
        baseURL: env.OPENAI_BASE_URL,
      }));
    } else {
      logger.warn('No valid OpenAI API keys found. VoiceService will be disabled.');
    }
  }

  private getClient(): OpenAI | null {
    if (this.openaiClients.length === 0) return null;
    return this.openaiClients[this.currentClientIndex];
  }

  private shiftClient(): boolean {
    if (this.openaiClients.length <= 1) return false;
    this.currentClientIndex = (this.currentClientIndex + 1) % this.openaiClients.length;
    logger.warn(`Shifted to OpenAI API key #${this.currentClientIndex + 1} due to error (e.g. 429 quota limit)`);
    return true;
  }

  isConfigured(): boolean {
    return this.openaiClients.length > 0;
  }

  async transcribe(audioBuffer: Buffer, mimeType: string): Promise<TranscriptionResult> {
    let client = this.getClient();
    if (!client) {
      throw new Error('OpenAI API key is not configured for transcription.');
    }

    let ext = 'mp3';
    if (mimeType.includes('wav')) ext = 'wav';
    else if (mimeType.includes('webm')) ext = 'webm';
    else if (mimeType.includes('mp4')) ext = 'mp4';
    else if (mimeType.includes('mpeg')) ext = 'mpeg';
    
    const file = await toFile(audioBuffer, `audio.${ext}`, { type: mimeType });

    let attempts = 0;
    const maxAttempts = this.openaiClients.length;

    while (attempts < maxAttempts) {
      try {
        const response = await client.audio.transcriptions.create({
          file,
          model: 'whisper-1',
          response_format: 'verbose_json'
        });

        return {
          text: response.text,
          language: response.language || 'unknown',
          confidence: 1
        };
      } catch (error: any) {
        if (error?.status === 429 || error?.message?.includes('429')) {
          logger.error(`Transcription failed with 429 using key #${this.currentClientIndex + 1}`);
          if (this.shiftClient()) {
            client = this.getClient()!;
            attempts++;
            continue; // Retry with next key
          }
        }
        logger.error('Transcription failed:', error);
        throw error;
      }
    }
    throw new Error('All OpenAI keys failed with 429 Insufficient Quota.');
  }

  async synthesize(text: string, language?: string): Promise<SpeechResult> {
    let client = this.getClient();
    if (!client) {
      throw new Error('OpenAI API key is not configured for speech synthesis.');
    }

    let attempts = 0;
    const maxAttempts = this.openaiClients.length;

    while (attempts < maxAttempts) {
      try {
        const response = await client.audio.speech.create({
          model: 'tts-1',
          voice: 'alloy',
          input: text,
          response_format: 'mp3',
          speed: 0.85
        });

        const arrayBuffer = await response.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        return {
          audioBuffer: buffer,
          format: 'mp3'
        };
      } catch (error: any) {
        if (error?.status === 429 || error?.message?.includes('429')) {
          logger.error(`Speech synthesis failed with 429 using key #${this.currentClientIndex + 1}`);
          if (this.shiftClient()) {
            client = this.getClient()!;
            attempts++;
            continue; // Retry with next key
          }
        }
        logger.error('Speech synthesis failed:', error);
        throw error;
      }
    }
    throw new Error('All OpenAI keys failed with 429 Insufficient Quota.');
  }
}

export const voiceService = new VoiceService();
