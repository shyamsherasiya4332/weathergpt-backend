import { Router } from 'express';
import { ragController, ragSearchSchema, ragAskSchema } from '../controllers/ragController.js';
import { validateRequest } from '../middleware/validateRequest.js';

const ragRoutes = Router();

// POST /api/rag/search — Search the knowledge base
ragRoutes.post('/search', validateRequest(ragSearchSchema), (req, res, next) => {
  ragController.handleSearch(req, res, next);
});

// POST /api/rag/ask — Get a knowledge-augmented answer
ragRoutes.post('/ask', validateRequest(ragAskSchema), (req, res, next) => {
  ragController.handleAsk(req, res, next);
});

export default ragRoutes;
