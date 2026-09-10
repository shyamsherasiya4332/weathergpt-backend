import { Router } from 'express';
import { lensController } from '../controllers/lensController.js';

const router = Router();

router.post('/lens', (req, res, next) => lensController.analyzeLens(req, res, next));

export default router;
