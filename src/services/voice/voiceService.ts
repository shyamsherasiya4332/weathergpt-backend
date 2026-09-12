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
  private openai: OpenAI | null = null;

  constructor() {
    if (this.isConfigured()) {
      this.openai = new OpenAI({
        apiKey: env.OPENAI_VOICE_API_KEY || env.OPENAI_API_KEY,
        baseURL: env.OPENAI_BASE_URL,
      });
    } else {
      logger.warn('OpenAI API key is not configured. VoiceService will be disabled.');
    }
  }

  isConfigured(): boolean {
    if (env.OPENAI_VOICE_API_KEY) return true;
    if (!env.OPENAI_API_KEY) return false;
    const isGemini = env.OPENAI_API_KEY.startsWith('AIza') || env.OPENAI_API_KEY.startsWith('AQ.');
    if (isGemini) {
      logger.warn('Voice features are disabled because a Gemini API key is being used. Whisper and TTS require an OpenAI API key (use OPENAI_VOICE_API_KEY).');
      return false;
    }
    return true;
  }

  async transcribe(audioBuffer: Buffer, mimeType: string): Promise<TranscriptionResult> {
    if (!this.openai) {
      throw new Error('OpenAI API key is not configured for transcription.');
    }

    try {
      let ext = 'mp3';
      if (mimeType.includes('wav')) ext = 'wav';
      else if (mimeType.includes('webm')) ext = 'webm';
      else if (mimeType.includes('mp4')) ext = 'mp4';
      else if (mimeType.includes('mpeg')) ext = 'mpeg';
      
      const file = await toFile(audioBuffer, `audio.${ext}`, { type: mimeType });

      const response = await this.openai.audio.transcriptions.create({
        file,
        model: 'whisper-1',
        response_format: 'verbose_json'
      });

      return {
        text: response.text,
        language: response.language || 'unknown',
        confidence: 1
      };
    } catch (error) {
      logger.error('Transcription failed:', error);
      throw error;
    }
  }

  async synthesize(text: string, language?: string): Promise<SpeechResult> {
    if (!this.openai) {
      throw new Error('OpenAI API key is not configured for speech synthesis.');
    }

    try {
      const response = await this.openai.audio.speech.create({
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
    } catch (error) {
      logger.error('Speech synthesis failed:', error);
      throw error;
    }
  }
}

export const voiceService = new VoiceService();
