import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { logger } from '../utils/logger.js';
import { ApiError } from '../utils/errors.js';

export const errorHandler = (
  err: Error | ApiError | ZodError,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  next: NextFunction
): void => {
  let statusCode = 500;
  let message = 'Internal Server Error';
  let code = 'INTERNAL_SERVER_ERROR';

  if (err instanceof ApiError) {
    statusCode = err.statusCode;
    message = err.message;
    code = err.code;
  } else if (err instanceof ZodError) {
    statusCode = 400;
    const issues = (err as unknown as { issues?: Array<{ message: string }> }).issues;
    message = issues && issues.length > 0 ? issues.map((e) => e.message).join(', ') : err.message;
    code = 'VALIDATION_ERROR';
  } else if ('statusCode' in err && typeof (err as { statusCode: unknown }).statusCode === 'number') {
    statusCode = (err as { statusCode: number }).statusCode;
    message = err.message || 'Error occurred';
    code = 'ERROR';
  } else if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
    statusCode = 401;
    message = err.name === 'TokenExpiredError' ? 'Token expired' : 'Invalid token';
    code = 'UNAUTHORIZED';
  }

  if (statusCode >= 500) {
    logger.error(`Error handling ${req.method} ${req.url}:`, {
      statusCode,
      message,
      stack: err.stack,
    });
  }

  res.status(statusCode).json({
    success: false,
    message,
    code,
  });
};
