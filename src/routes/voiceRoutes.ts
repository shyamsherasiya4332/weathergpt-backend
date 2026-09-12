import express, { Router } from 'express';
import { voiceController, voiceSpeakSchema } from '../controllers/voiceController.js';
import { validateRequest } from '../middleware/validateRequest.js';

const router = Router();

import multer from 'multer';
const upload = multer({ limits: { fileSize: 10 * 1024 * 1024 } }); // 10MB limit

// Support BOTH raw binary and multipart/form-data
router.post('/transcribe', upload.any(), express.raw({ type: ['audio/*', 'application/octet-stream'], limit: '10mb' }), (req, res, next) => {
  voiceController.handleTranscribe(req, res, next);
});

router.post('/ask', (req, res, next) => {
  voiceController.handleVoiceAsk(req, res, next);
});

router.post('/speak', validateRequest(voiceSpeakSchema), (req, res, next) => {
  voiceController.handleSpeak(req, res, next);
});

export const voiceRoutes = router;
