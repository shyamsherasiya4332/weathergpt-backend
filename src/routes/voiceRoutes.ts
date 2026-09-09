import express, { Router } from 'express';
import { voiceController, voiceSpeakSchema } from '../controllers/voiceController.js';
import { validateRequest } from '../middleware/validateRequest.js';

const router = Router();

// Raw binary audio parser for transcribe endpoint
router.post('/transcribe', express.raw({ type: ['audio/*', 'application/octet-stream'], limit: '10mb' }), (req, res, next) => {
  voiceController.handleTranscribe(req, res, next);
});

router.post('/ask', (req, res, next) => {
  voiceController.handleVoiceAsk(req, res, next);
});

router.post('/speak', validateRequest(voiceSpeakSchema), (req, res, next) => {
  voiceController.handleSpeak(req, res, next);
});

export const voiceRoutes = router;
