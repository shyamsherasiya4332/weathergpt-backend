import { Router } from 'express';
import { alertController, alertRequestSchema } from '../controllers/alertController.js';
import { validateRequest } from '../middleware/validateRequest.js';

const router = Router();

router.post('/alerts', validateRequest(alertRequestSchema), (req, res, next) => {
  alertController.handleCreateAlertCheck(req, res, next);
});

export const alertRoutes = router;
