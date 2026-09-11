import { Router } from 'express';
import { healthController } from '../controllers/healthController.js';

const router = Router();

router.get('/health', (req, res) => {
  healthController.checkHealth(req, res);
});

router.get('/test-llm', (req, res) => {
  healthController.testLLM(req, res);
});

export const healthRoutes = router;
