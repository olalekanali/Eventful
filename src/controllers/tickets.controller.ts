import { Request, Response } from 'express';
import { asyncHandler } from '../utils/async-handler';
import { ticketsService } from '../services/tickets.service';
import { pdfService } from '../services/pdf.service';
import { User } from '../models/user.model';
import { remindersService } from '../services/reminders.service';
import { ReminderType, ReminderLabels } from '../utils/enums';
import { BadRequestError, NotFoundError } from '../utils/errors';
import { Ticket } from '../models/ticket.model';

/**
 * Public lookup page: enter your email + ticket number to see your ticket.
 * Works for guests AND registered users.
 */
export const showLookup = (_req: Request, res: Response) => {
  res.render('pages/tickets/lookup', {
    title: 'Find my ticket',
    error: null,
  });
};

export const doLookup = asyncHandler(async (req: Request, res: Response) => {
  const email = (req.body.email || '').toString().trim().toLowerCase();
  const ticketNumber = (req.body.ticketNumber || '').toString().trim().toUpperCase();

  if (!email || !ticketNumber) {
    return res.render('pages/tickets/lookup', {
      title: 'Find my ticket',
      error: 'Both email and ticket number are required.',
    });
  }

  const ticket = await ticketsService.findByNumber(ticketNumber);
  if (!ticket) {
    return res.render('pages/tickets/lookup', {
      title: 'Find my ticket',
      error: 'No ticket found with those details.',
    });
  }

  // Match email: either the guest email or the registered user's email
  const ticketEmail = ticket.user
    ? (ticket.user as any).email
    : ticket.guestEmail;

  if (!ticketEmail || ticketEmail.toLowerCase() !== email) {
    return res.render('pages/tickets/lookup', {
      title: 'Find my ticket',
      error: 'No ticket found with those details.',
    });
  }

  // Redirect to a unique URL for this ticket using its number
  res.redirect(`/tickets/lookup/${ticketNumber}?email=${encodeURIComponent(email)}`);
});

/**
 * Public ticket view by ticket number + email (no login required).
 */
export const showByNumber = asyncHandler(
  async (req: Request, res: Response) => {
    const email = (req.query.email || '').toString().trim().toLowerCase();
    const ticket = await ticketsService.findByNumber(req.params.ticketNumber);

    if (!ticket) throw new NotFoundError('Ticket not found');

    const ticketEmail = ticket.user
      ? (ticket.user as any).email
      : ticket.guestEmail;

    if (!email || !ticketEmail || ticketEmail.toLowerCase() !== email) {
      throw new NotFoundError('Ticket not found');
    }

    res.render('pages/tickets/show', {
      title: `Ticket ${ticket.ticketNumber}`,
      ticket,
      email,
    });
  },
);

/**
 * Public PDF download — same email-protected access.
 */
export const downloadPdf = asyncHandler(
  async (req: Request, res: Response) => {
    const email = (req.query.email || '').toString().trim().toLowerCase();
    const ticket = await ticketsService.findByNumber(req.params.ticketNumber);
    if (!ticket) throw new NotFoundError('Ticket not found');

    const ticketEmail = ticket.user
      ? (ticket.user as any).email
      : ticket.guestEmail;

    if (!email || !ticketEmail || ticketEmail.toLowerCase() !== email) {
      throw new NotFoundError('Ticket not found');
    }
    if (!ticket.qrImage) {
      throw new BadRequestError(
        'This ticket has not been confirmed yet. Please complete payment.',
      );
    }

    const recipientName = ticket.user
      ? `${(ticket.user as any).firstName} ${(ticket.user as any).lastName}`
      : ticket.guestName || 'Guest';

    const pdf = await pdfService.generateTicketPdf({
      ticket,
      event: ticket.event as any,
      recipientName,
      qrImageDataUrl: ticket.qrImage,
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="eventful-${ticket.ticketNumber}.pdf"`,
    );
    res.send(pdf);
  },
);

/**
 * Resend the ticket email — re-attaches the PDF.
 */
export const resendEmail = asyncHandler(
  async (req: Request, res: Response) => {
    const email = (req.query.email || req.body.email || '')
      .toString()
      .trim()
      .toLowerCase();
    const ticket = await ticketsService.findByNumber(req.params.ticketNumber);
    if (!ticket) throw new NotFoundError('Ticket not found');

    const ticketEmail = ticket.user
      ? (ticket.user as any).email
      : ticket.guestEmail;

    if (!email || !ticketEmail || ticketEmail.toLowerCase() !== email) {
      throw new NotFoundError('Ticket not found');
    }

    if (!ticket.qrImage) {
      (req as any).flash(
        'error',
        'Ticket not yet confirmed — wait for payment to complete.',
      );
      return res.redirect(`/tickets/lookup/${ticket.ticketNumber}?email=${encodeURIComponent(email)}`);
    }

    await ticketsService.sendConfirmationEmail(ticket);
    (req as any).flash('success', `Ticket re-sent to ${ticketEmail}`);
    res.redirect(`/tickets/lookup/${ticket.ticketNumber}?email=${encodeURIComponent(email)}`);
  },
);

/* ----- Registered-user only ----- */

export const myTickets = asyncHandler(async (req: Request, res: Response) => {
  const page = parseInt((req.query.page as string) || '1', 10);
  const result = await ticketsService.findMine(req.user!.id, page, 20);
  res.render('pages/tickets/list', {
    title: 'My tickets',
    result,
  });
});

export const showMine = asyncHandler(async (req: Request, res: Response) => {
  const ticket = await ticketsService.findById(req.params.id);
  if (!ticket.user || (ticket.user as any)._id?.toString() !== req.user!.id) {
    (req as any).flash('error', 'This ticket is not yours');
    return res.redirect('/tickets/my');
  }

  const reminders = await remindersService.findMine(
    req.user!.id,
    (ticket.event as any)._id.toString(),
  );

  res.render('pages/tickets/show', {
    title: `Ticket ${ticket.ticketNumber}`,
    ticket,
    email: req.user!.email,
    reminders,
    reminderTypes: Object.values(ReminderType),
    reminderLabels: ReminderLabels,
  });
});

export const setReminders = asyncHandler(
  async (req: Request, res: Response) => {
    const user = await User.findById(req.user!.id);
    if (!user) throw new Error('User not found');

    const reminders = req.body.reminders
      ? Array.isArray(req.body.reminders)
        ? req.body.reminders
        : [req.body.reminders]
      : [];

    await remindersService.setForEvent(user, req.body.eventId, reminders);
    (req as any).flash('success', 'Reminders saved');
    res.redirect(`/tickets/${req.body.ticketId}`);
  },
);

/* ----- Creator-only ----- */

export const showScanner = (_req: Request, res: Response) => {
  res.render('pages/creator/scanner', { title: 'Scan tickets' });
};

export const scan = asyncHandler(async (req: Request, res: Response) => {
  const user = await User.findById(req.user!.id);
  if (!user) throw new Error('User not found');

  const result = await ticketsService.scan(req.body.qrPayload, user);
  const recipient = result.ticket.user
    ? `${(result.ticket.user as any).firstName} ${(result.ticket.user as any).lastName}`
    : result.ticket.guestName || 'Guest';
  res.json({
    success: result.valid,
    message: result.message,
    ticket: {
      id: result.ticket._id.toString(),
      ticketNumber: result.ticket.ticketNumber,
      recipient,
      status: result.ticket.status,
    },
  });
});
