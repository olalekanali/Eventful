import { NextFunction, Request, Response } from 'express';
import { authService } from '../services/auth.service';
import { UnauthorizedError, ForbiddenError } from '../utils/errors';
import { UserRole } from '../utils/enums';
import { asyncHandler } from '../utils/async-handler';

/**
 * Attaches `req.user` to every request if a session exists.
 * Does NOT block unauthenticated requests; use `requireAuth` for that.
 */
export const attachUser = asyncHandler(
  async (req: Request, _res: Response, next: NextFunction) => {
    if (req.session.userId) {
      const user = await authService.findById(req.session.userId);
      if (user && user.isActive) {
        req.user = {
          id: user._id.toString(),
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role,
        };
      } else {
        req.session.destroy(() => undefined);
      }
    }
    next();
  },
);

export function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  if (!req.user) {
    if (req.accepts('html')) {
      req.session.flash = {
        ...(req.session.flash || {}),
        error: ['Please log in to continue'],
      };
      return res.redirect(`/auth/login?next=${encodeURIComponent(req.originalUrl)}`);
    }
    return next(new UnauthorizedError());
  }
  next();
}

export function requireRoles(...roles: UserRole[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) return next(new UnauthorizedError());
    if (!roles.includes(req.user.role)) {
      return next(new ForbiddenError('Insufficient permissions'));
    }
    next();
  };
}

export function requireGuest(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  if (req.user) return res.redirect('/dashboard');
  next();
}
