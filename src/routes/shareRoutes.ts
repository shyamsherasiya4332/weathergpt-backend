import { Router } from 'express';
import { shareController } from '../controllers/shareController.js';

const router = Router();

router.post('/card', (req, res, next) => shareController.getShareCard(req, res, next));

export default router;
