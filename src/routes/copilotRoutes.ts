import { Router } from 'express';
import { copilotController, copilotPlanSchema } from '../controllers/copilotController.js';
import { validateRequest } from '../middleware/validateRequest.js';

const router = Router();

router.post('/plan', validateRequest(copilotPlanSchema), (req, res, next) => {
  copilotController.handlePlan(req, res, next);
});

export default router;
