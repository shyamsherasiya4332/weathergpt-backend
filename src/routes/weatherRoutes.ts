import { Router } from 'express';
import { askRequestSchema, weatherController, weatherQuerySchema } from '../controllers/weatherController.js';
import { validateRequest } from '../middleware/validateRequest.js';

const router = Router();

router.post('/ask', validateRequest(askRequestSchema), (req, res, next) => {
  weatherController.handleAsk(req, res, next);
});

router.post('/weather', validateRequest(weatherQuerySchema), (req, res, next) => {
  weatherController.handleDirectWeather(req, res, next);
});

router.get('/meta', (req, res) => {
  weatherController.handleGetMeta(req, res);
});

router.all('/moes/bulletin', (req, res, next) => {
  weatherController.handleMoesBulletin(req, res, next);
});

export const weatherRoutes = router;
