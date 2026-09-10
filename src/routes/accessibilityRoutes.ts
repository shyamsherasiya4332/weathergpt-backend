import { Router } from 'express';
import { accessibilityController, accessibilityFormatSchema } from '../controllers/accessibilityController.js';
import { validateRequest } from '../middleware/validateRequest.js';

const router = Router();

router.post('/format', validateRequest(accessibilityFormatSchema), (req, res, next) => {
  accessibilityController.handleFormat(req, res, next);
});

router.get('/offline-phrases', (req, res, next) => {
  accessibilityController.handleGetOfflinePhrases(req, res, next);
});

export default router;
