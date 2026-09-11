import { Router } from 'express';
import { healthController } from '../controllers/healthController.js';

const router = Router();

router.get('/health', (req, res) => {
  healthController.checkHealth(req, res);
});

router.get('/test-llm', (req, res) => {
  healthController.testLLM(req, res);
});

router.get('/test-models', (req, res) => {
  healthController.testModels(req, res);
});

router.get('/test-single-model', (req, res) => {
  healthController.testSingleModel(req, res);
});

export const healthRoutes = router;
