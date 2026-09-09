import { Router } from 'express';
import { alertRoutes } from './alertRoutes.js';
import { healthRoutes } from './healthRoutes.js';
import { makeRoutes } from './makeRoutes.js';
import { voiceRoutes } from './voiceRoutes.js';
import { weatherRoutes } from './weatherRoutes.js';

const apiRouter = Router();

// Mount API sub-routes
apiRouter.use('/', weatherRoutes);
apiRouter.use('/', alertRoutes);
apiRouter.use('/voice', voiceRoutes);
apiRouter.use('/make', makeRoutes);

export { apiRouter, healthRoutes };
