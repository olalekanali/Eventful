import { Router } from 'express';
import * as paymentsController from '../controllers/payments.controller';
import { requireAuth } from '../middlewares/auth.middleware';

const router = Router();

// Public: works for both logged-in eventees and guests
router.post('/initiate', paymentsController.initiate);

// Public: Paystack callback
router.get('/verify/:reference', paymentsController.verify);
router.get('/verify', paymentsController.verify);

// Authed: payment history for registered users
router.get('/my', requireAuth, paymentsController.myPayments);

export default router;
