import { NextFunction, Request, Response } from 'express';
import { z } from 'zod';
import { llmService } from '../services/llm/llmService.js';
import { voiceService } from '../services/voice/voiceService.js';
import { weatherController } from './weatherController.js';
import { logger } from '../utils/logger.js';

export const voiceAskSchema = z.object({
  question: z.string().min(1).max(500).optional(),
  location: z
    .object({
      name: z.string().optional(),
      latitude: z.number().min(-90).max(90).optional(),
      longitude: z.number().min(-180).max(180).optional()
    })
    .optional(),
  language: z.string().optional(),
  conversationId: z.string().optional()
});

export const voiceSpeakSchema = z.object({
  text: z.string().min(1).max(2000),
  language: z.string().optional()
});

export class VoiceController {
  /**
   * POST /api/voice/transcribe
   * Accepts audio file upload and returns transcribed text.
   */
  async handleTranscribe(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!voiceService.isConfigured()) {
        res.status(503).json({
          success: false,
          error: {
            code: 'VOICE_NOT_CONFIGURED',
            message: 'Voice AI requires an OpenAI API key. Please configure OPENAI_API_KEY.'
          }
        });
        return;
      }

      let audioBuffer: Buffer;
      let mimeType = req.headers['content-type'] || 'audio/webm';

      if (Buffer.isBuffer(req.body)) {
        audioBuffer = req.body;
      } else if (req.body && typeof req.body === 'object' && req.body.audio) {
        // They sent JSON with base64 audio
        const audioStr = req.body.audio as string;
        const b64Data = audioStr.replace(/^data:audio\/\w+;base64,/, '');
        audioBuffer = Buffer.from(b64Data, 'base64');
        if (audioStr.startsWith('data:audio/')) {
          mimeType = audioStr.split(';')[0].substring(5);
        }
      } else if ((req as any).file || (req as any).files) {
        // Just in case multer gets added later
        const file = (req as any).file || (req as any).files?.audio || (req as any).files?.[0];
        if (file) {
          audioBuffer = file.buffer;
          mimeType = file.mimetype;
        } else {
          audioBuffer = Buffer.from([]);
        }
      } else {
        logger.error(`Invalid audio data type received: ${typeof req.body}. Body keys: ${Object.keys(req.body || {}).join(',')}`);
        res.status(400).json({
          success: false,
          error: { code: 'INVALID_AUDIO_FORMAT', message: 'Audio data must be sent as raw binary (Blob) or JSON { "audio": "base64..." }. FormData is not supported without multer.' }
        });
        return;
      }

      if (!audioBuffer || audioBuffer.length === 0) {
        res.status(400).json({
          success: false,
          error: { code: 'NO_AUDIO_DATA', message: 'No audio data received.' }
        });
        return;
      }

      logger.info(`Voice transcription request received (${audioBuffer.length} bytes, ${mimeType})`);
      const result = await voiceService.transcribe(audioBuffer, mimeType);

      res.json({
        success: true,
        transcription: result.text,
        detectedLanguage: result.language,
        confidence: result.confidence
      });
    } catch (error) {
      logger.error('Whisper Transcription Error:', error);
      res.status(502).json({
        success: false,
        error: {
          code: 'OPENAI_WHISPER_FAILED',
          message: error instanceof Error ? error.message : 'Unknown OpenAI error'
        }
      });
    }
  }

  /**
   * POST /api/voice/ask
   * Accepts JSON with question (or transcribed text) and returns weather answer + audio.
   * Combines transcribe → ask → speak in one call when audio is posted.
   */
  async handleVoiceAsk(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      // This endpoint delegates to the regular weatherController.handleAsk
      // and if voice service is configured, also generates audio response
      await weatherController.handleAsk(req, res, next);
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/voice/speak
   * Accepts text and returns synthesized speech audio.
   */
  async handleSpeak(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!voiceService.isConfigured()) {
        res.status(503).json({
          success: false,
          error: {
            code: 'VOICE_NOT_CONFIGURED',
            message: 'Voice AI requires an OpenAI API key. Please configure OPENAI_API_KEY.'
          }
        });
        return;
      }

      const { text, language } = req.body;
      logger.info(`Voice speak request received (${text.length} chars, lang: ${language || 'auto'})`);

      const result = await voiceService.synthesize(text, language);

      res.set({
        'Content-Type': `audio/${result.format}`,
        'Content-Length': result.audioBuffer.length.toString(),
        'X-Audio-Format': result.format
      });
      res.send(result.audioBuffer);
    } catch (error) {
      logger.error('TTS Generation Error:', error);
      res.status(502).json({
        success: false,
        error: {
          code: 'OPENAI_TTS_FAILED',
          message: error instanceof Error ? error.message : 'Unknown OpenAI error'
        }
      });
    }
  }
}

export const voiceController = new VoiceController();
