import { NextFunction, Request, Response } from 'express';
import { validationResult, ValidationChain } from 'express-validator';

/**
 * Wraps express-validator chains and either redirects back with flashed errors
 * (for form submissions) or returns 400 JSON.
 */
export function validate(validations: ValidationChain[]) {
  return async (req: Request, res: Response, next: NextFunction) => {
    for (const v of validations) {
      await v.run(req);
    }
    const errors = validationResult(req);
    if (errors.isEmpty()) return next();

    const messages = errors
      .array()
      .map((e: any) => e.msg as string)
      .filter((v, i, a) => a.indexOf(v) === i);

    if (req.accepts('html')) {
      (req as any).flash('error', messages.join(' • '));
      return res.redirect(req.get('referer') || '/');
    }
    res.status(400).json({ success: false, errors: errors.array() });
  };
}
