import { Router } from 'express';
import { makeController, makeWebhookSchema } from '../controllers/makeController.js';
import { validateRequest } from '../middleware/validateRequest.js';

const router = Router();

router.post('/webhook', validateRequest(makeWebhookSchema), (req, res, next) => {
  makeController.handleTriggerWebhook(req, res, next);
});

export const makeRoutes = router;
