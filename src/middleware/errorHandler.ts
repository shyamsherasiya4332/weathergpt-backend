import { NextFunction, Request, Response } from 'express';
import { ApiErrorResponse } from '../types/api.js';
import { logger } from '../utils/logger.js';

export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  next: NextFunction
): void {
  logger.error(`Unhandled error on ${req.method} ${req.url}:`, {
    message: err.message,
    name: err.name
  });

  let statusCode = 500;
  let errorCode = 'INTERNAL_SERVER_ERROR';
  let message = 'An unexpected server error occurred. Please try again later.';

  if (err.message.startsWith('WEATHER_API_ERROR')) {
    statusCode = 502;
    errorCode = 'WEATHER_API_ERROR';
    message = 'Unable to retrieve live weather data right now.';
  } else if (err.message.startsWith('GEOCODING_ERROR')) {
    statusCode = 404;
    errorCode = 'LOCATION_NOT_FOUND';
    message = 'Could not resolve the specified location.';
  } else if (err.message.startsWith('LLM_ERROR')) {
    statusCode = 503;
    errorCode = 'LLM_SERVICE_UNAVAILABLE';
    message = 'The AI language model is temporarily unavailable.';
  }

  const response: ApiErrorResponse = {
    success: false,
    error: {
      code: errorCode,
      message: message
    }
  };

  res.status(statusCode).json(response);
}
