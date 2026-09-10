import { Router } from 'express';
import {
  notificationController,
  scheduleNotificationSchema,
  evaluateNotificationSchema
} from '../controllers/notificationController.js';
import { validateRequest } from '../middleware/validateRequest.js';

const router = Router();

router.post('/schedule', validateRequest(scheduleNotificationSchema), (req, res, next) => {
  notificationController.handleSchedule(req, res, next);
});

router.get('/rules', (req, res, next) => {
  notificationController.handleGetRules(req, res, next);
});

router.post('/evaluate', validateRequest(evaluateNotificationSchema), (req, res, next) => {
  notificationController.handleEvaluate(req, res, next);
});

export default router;
