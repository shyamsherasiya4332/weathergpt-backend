import { Router } from 'express';
import { healthController } from '../controllers/healthController.js';

const router = Router();

router.get('/health', (req, res) => {
  healthController.checkHealth(req, res);
});

export const healthRoutes = router;
