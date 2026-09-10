import { Router } from 'express';
import { alertRoutes } from './alertRoutes.js';
import { healthRoutes } from './healthRoutes.js';
import { makeRoutes } from './makeRoutes.js';
import { voiceRoutes } from './voiceRoutes.js';
import { weatherRoutes } from './weatherRoutes.js';
import { locationController, reverseGeocodeSchema } from '../controllers/locationController.js';
import { disasterController, disasterQuerySchema } from '../controllers/disasterController.js';
import { comparisonController, compareRequestSchema } from '../controllers/comparisonController.js';
import { mapController } from '../controllers/mapController.js';
import { validateRequest } from '../middleware/validateRequest.js';

const apiRouter = Router();

// Mount API sub-routes
apiRouter.use('/', weatherRoutes);
apiRouter.use('/', alertRoutes);
apiRouter.use('/voice', voiceRoutes);
apiRouter.use('/make', makeRoutes);

// Reverse Geocoding Endpoint
apiRouter.post('/location/reverse-geocode', validateRequest(reverseGeocodeSchema), (req, res, next) => {
  locationController.handleReverseGeocode(req, res, next);
});

// Disaster Intelligence Endpoints
apiRouter.get('/disaster/alerts', (req, res, next) => {
  disasterController.handleGetAlerts(req, res, next);
});
apiRouter.get('/disaster/emergency-guide', (req, res) => {
  disasterController.handleGetEmergencyGuide(req, res);
});

// Weather Comparison Endpoint
apiRouter.post('/weather/compare', validateRequest(compareRequestSchema), (req, res, next) => {
  comparisonController.handleCompare(req, res, next);
});

// Interactive Weather Map Endpoint
apiRouter.get('/maps/weather', (req, res) => {
  mapController.handleGetMap(req, res);
});

export { apiRouter, healthRoutes };
