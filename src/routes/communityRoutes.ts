import { Router } from 'express';
import { communityController } from '../controllers/communityController.js';

const router = Router();

router.post('/report', (req, res, next) => communityController.submitReport(req, res, next));
router.get('/reports', (req, res, next) => communityController.getReports(req, res, next));

export default router;
