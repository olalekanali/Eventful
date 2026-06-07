import { NextFunction, Request, Response } from 'express';

export interface FlashMessages {
  success: string[];
  error: string[];
  info: string[];
}

/**
 * Adds `req.flash(type, message)` and exposes `res.locals.flash` on each request.
 */
export function flashMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  // Pull flash from session, then clear it
  const flash: FlashMessages = {
    success: req.session.flash?.success || [],
    error: req.session.flash?.error || [],
    info: req.session.flash?.info || [],
  };
  req.session.flash = undefined;
  res.locals.flash = flash;

  // Expose `req.flash(type, message)` for setting new flashes
  (req as any).flash = (
    type: 'success' | 'error' | 'info',
    message: string,
  ) => {
    if (!req.session.flash) req.session.flash = {};
    if (!req.session.flash[type]) req.session.flash[type] = [];
    req.session.flash[type]!.push(message);
  };

  next();
}
