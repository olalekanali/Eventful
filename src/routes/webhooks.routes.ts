import { Router, raw } from 'express';
import * as paymentsController from '../controllers/payments.controller';

const router = Router();

/**
 * Paystack webhook needs the raw request body so we can verify its HMAC signature.
 * This must be mounted BEFORE the JSON/url-encoded body parsers in server.ts.
 */
router.post(
  '/paystack',
  raw({ type: 'application/json' }),
  (req, _res, next) => {
    (req as any).rawBody = req.body; // Buffer at this point
    try {
      req.body = JSON.parse(req.body.toString());
    } catch {
      // leave it as buffer; controller will handle invalid JSON
    }
    next();
  },
  paymentsController.webhook,
);

export default router;
