import { NextFunction, Request, Response } from 'express';
import { AppError } from '../utils/errors';
import { logger } from '../utils/logger';
import { isProduction } from '../config';

export function notFoundHandler(req: Request, res: Response): void {
  if (req.accepts('html')) {
    res.status(404).render('errors/404', {
      title: '404 - Not Found',
      url: req.originalUrl,
    });
    return;
  }
  res.status(404).json({
    success: false,
    error: 'Not found',
    path: req.originalUrl,
  });
}

export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction,
): void {
  const statusCode = err instanceof AppError ? err.statusCode : 500;
  const message =
    err instanceof AppError || !isProduction
      ? err.message
      : 'Internal server error';

  // Log non-operational errors with stack
  if (!(err instanceof AppError) || statusCode >= 500) {
    logger.error(err.message, { stack: err.stack, path: req.originalUrl });
  } else {
    logger.warn(err.message, { path: req.originalUrl, statusCode });
  }

  if (req.accepts('html') && !req.originalUrl.startsWith('/api')) {
    res.status(statusCode).render('errors/error', {
      title: `${statusCode} - Error`,
      statusCode,
      message,
      stack: !isProduction ? err.stack : null,
    });
    return;
  }

  res.status(statusCode).json({
    success: false,
    error: message,
  });
}
