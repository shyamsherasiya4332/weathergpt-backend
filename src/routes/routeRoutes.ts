import { Router } from 'express';
import { routeController } from '../controllers/routeController.js';

const router = Router();

router.post('/weather', (req, res, next) => routeController.getRouteWeather(req, res, next));

export default router;
