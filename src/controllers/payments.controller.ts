import { Request, Response } from 'express';
import { asyncHandler } from '../utils/async-handler';
import { paymentsService } from '../services/payments.service';
import { User } from '../models/user.model';
import { BadRequestError } from '../utils/errors';

export const initiate = asyncHandler(async (req: Request, res: Response) => {
  const eventId = req.body.eventId;
  const quantity = parseInt(req.body.quantity || '1', 10);

  let purchaser: { user?: any; guest?: any };

  if (req.user) {
    const user = await User.findById(req.user.id);
    if (!user) throw new Error('User not found');
    purchaser = { user };
  } else {
    const guestEmail = (req.body.guestEmail || '').toString().trim().toLowerCase();
    const guestName = (req.body.guestName || '').toString().trim();
    const guestPhone = (req.body.guestPhone || '').toString().trim();

    if (!guestEmail || !guestName) {
      throw new BadRequestError('Name and email are required');
    }
    // Basic email shape check (express-validator does the heavy lifting in routes)
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(guestEmail)) {
      throw new BadRequestError('Please enter a valid email address');
    }
    purchaser = {
      guest: { email: guestEmail, name: guestName, phone: guestPhone || undefined },
    };
  }

  const payment = await paymentsService.initiate(eventId, quantity, purchaser);
  if (!payment.authorizationUrl) {
    (req as any).flash('error', 'Failed to initiate payment');
    if (req.headers.accept?.includes('application/json') || (req as any).xhr) {
      return res.status(502).json({ message: 'Failed to initiate payment' });
    }
    return res.redirect(`/events/${eventId}`);
  }

  if (req.headers.accept?.includes('application/json') || (req as any).xhr) {
    return res.json({ authorizationUrl: payment.authorizationUrl });
  }

  res.redirect(payment.authorizationUrl);
});

export const verify = asyncHandler(async (req: Request, res: Response) => {
  const reference = req.params.reference || req.query.reference;
  if (!reference || typeof reference !== 'string') {
    (req as any).flash('error', 'No payment reference provided');
    return res.redirect('/');
  }

  const payment = await paymentsService.verify(reference);
  res.render('pages/payments/verify', {
    title: 'Payment status',
    payment,
  });
});

export const myPayments = asyncHandler(async (req: Request, res: Response) => {
  const page = parseInt((req.query.page as string) || '1', 10);
  const result = await paymentsService.findMine(req.user!.id, page, 20);
  res.render('pages/payments/list', {
    title: 'Payment history',
    result,
  });
});

export const webhook = asyncHandler(async (req: Request, res: Response) => {
  const signature = req.headers['x-paystack-signature'] as string;
  const rawBody = (req as any).rawBody?.toString() || JSON.stringify(req.body);
  await paymentsService.handleWebhook(rawBody, signature);
  res.status(200).json({ received: true });
});
