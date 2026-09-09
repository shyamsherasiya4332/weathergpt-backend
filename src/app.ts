import cors from 'cors';
import express, { Express } from 'express';
import helmet from 'helmet';
import { env } from './config/env.js';
import { errorHandler } from './middleware/errorHandler.js';
import { apiRateLimiter } from './middleware/rateLimiter.js';
import { apiRouter, healthRoutes } from './routes/index.js';

export function createApp(): Express {
  const app = express();

  // Security headers
  app.use(helmet());

  // CORS configuration
  app.use(
    cors({
      origin: env.FRONTEND_URL || '*',
      methods: ['GET', 'POST', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization']
    })
  );

  // Body Parsing
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true }));

  // Rate Limiting
  app.use('/api', apiRateLimiter);

  // Health check endpoint (Unrated or light rate)
  app.use('/', healthRoutes);

  // API Router
  app.use('/api', apiRouter);

  // 404 Not Found Handler
  app.use((req, res) => {
    res.status(404).json({
      success: false,
      error: {
        code: 'NOT_FOUND',
        message: `Resource '${req.originalUrl}' not found.`
      }
    });
  });

  // Centralized Error Handler
  app.use(errorHandler);

  return app;
}
