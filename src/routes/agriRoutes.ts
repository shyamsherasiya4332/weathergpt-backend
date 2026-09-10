import { Router } from 'express';
import { agriController } from '../controllers/agriController.js';

const router = Router();

router.get('/advisory', (req, res, next) => agriController.getAdvisory(req, res, next));

export default router;
