import { NextFunction, Request, Response } from 'express';
import { AnyZodObject, ZodError } from 'zod';
import { ApiErrorResponse } from '../types/api.js';

export const validateRequest = (schema: AnyZodObject) => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      req.body = await schema.parseAsync(req.body);
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const firstIssue = error.issues[0];
        const response: ApiErrorResponse = {
          success: false,
          error: {
            code: 'INVALID_REQUEST',
            message: `${firstIssue?.path.join('.') || 'field'}: ${firstIssue?.message || 'Invalid parameters'}`
          }
        };
        res.status(400).json(response);
        return;
      }
      next(error);
    }
  };
};
