import { Types } from 'mongoose';
import { Ticket, TicketDocument } from '../models/ticket.model';
import { User, UserDocument } from '../models/user.model';
import { EventDocument } from '../models/event.model';
import { eventsService } from './events.service';
import { qrCodeService } from './qrcode.service';
import { pdfService } from './pdf.service';
import { mailService } from './mail.service';
import { logger } from '../utils/logger';
import { config } from '../config';
import {
  BadRequestError,
  ForbiddenError,
  NotFoundError,
} from '../utils/errors';
import { EventStatus, TicketStatus, UserRole } from '../utils/enums';

export interface GuestInfo {
  email: string;
  name: string;
  phone?: string;
}

class TicketsService {
  /**
   * Reserves a ticket for either a logged-in user OR a guest checkout.
   * Either `user` or `guest` must be provided.
   */
  async reserve(
    eventId: string,
    quantity: number,
    purchaser: { user?: UserDocument; guest?: GuestInfo },
  ): Promise<{ ticket: TicketDocument; event: EventDocument }> {
    if (!Types.ObjectId.isValid(eventId)) {
      throw new NotFoundError('Event not found');
    }
    if (!purchaser.user && !purchaser.guest) {
      throw new BadRequestError('Purchaser information required');
    }

    const event = await eventsService.findById(eventId);
    if (event.status !== EventStatus.PUBLISHED) {
      throw new BadRequestError('Event is not available for purchase');
    }
    if (event.startDate <= new Date()) {
      throw new BadRequestError('Event has already started');
    }
    if (
      purchaser.user &&
      event.creator.toString() === purchaser.user._id.toString()
    ) {
      throw new BadRequestError('You cannot buy tickets to your own event');
    }

    const reserved = await eventsService.tryReserveTickets(eventId, quantity);
    if (!reserved) {
      throw new BadRequestError(
        `Only ${event.totalTickets - event.ticketsSold} tickets remaining`,
      );
    }

    try {
      const totalAmount = Number(reserved.ticketPrice) * quantity;
      const ticketData: any = {
        ticketNumber: this.generateTicketNumber(),
        event: reserved._id,
        quantity,
        totalAmount,
        currency: reserved.currency,
        status: TicketStatus.PENDING,
      };

      if (purchaser.user) {
        ticketData.user = purchaser.user._id;
      } else if (purchaser.guest) {
        ticketData.guestEmail = purchaser.guest.email.toLowerCase().trim();
        ticketData.guestName = purchaser.guest.name.trim();
        ticketData.guestPhone = purchaser.guest.phone?.trim() || null;
      }

      const ticket = await Ticket.create(ticketData);
      return { ticket, event: reserved };
    } catch (err) {
      await eventsService.releaseTickets(eventId, quantity);
      throw err;
    }
  }

  async confirmPayment(ticketId: string): Promise<TicketDocument> {
    const ticket = await Ticket.findById(ticketId)
      .populate('event')
      .populate('user');
    if (!ticket) throw new NotFoundError('Ticket not found');

    if (ticket.status === TicketStatus.PAID) return ticket;
    if (ticket.status !== TicketStatus.PENDING) {
      throw new BadRequestError(
        `Cannot confirm a ticket in ${ticket.status} state`,
      );
    }

    const event = ticket.event as any;
    const userIdForQr = ticket.user
      ? (ticket.user as any)._id.toString()
      : `guest:${ticket.guestEmail}`;

    const { payload, image } = await qrCodeService.generate({
      ticketId: ticket._id.toString(),
      eventId: event._id.toString(),
      userId: userIdForQr,
    });

    ticket.qrPayload = payload;
    ticket.qrImage = image;
    ticket.status = TicketStatus.PAID;
    await ticket.save();

    // Generate PDF + send confirmation email. Failures don't block payment.
    this.sendConfirmationEmail(ticket).catch((err) =>
      logger.error(`Failed to send confirmation email`, {
        ticketId: ticket._id.toString(),
        error: err.message,
      }),
    );

    return ticket;
  }

  /**
   * Builds the PDF, fires off the confirmation email with PDF attached.
   */
  async sendConfirmationEmail(ticket: TicketDocument): Promise<void> {
    const event = ticket.event as any;
    if (!ticket.qrImage || !event) return;

    const recipientEmail = ticket.user
      ? (ticket.user as any).email
      : ticket.guestEmail;
    if (!recipientEmail) return;

    const recipientName = ticket.user
      ? `${(ticket.user as any).firstName} ${(ticket.user as any).lastName}`
      : ticket.guestName || 'Guest';

    const pdfBuffer = await pdfService.generateTicketPdf({
      ticket,
      event,
      recipientName,
      qrImageDataUrl: ticket.qrImage,
    });

    const { subject, html } = mailService.ticketTemplate({
      name: recipientName,
      eventTitle: event.title,
      ticketNumber: ticket.ticketNumber,
      eventDate: event.startDate,
      venue: event.venue,
      eventUrl: `${config.appUrl}/events/${event._id}`,
    });

    await mailService.send({
      to: recipientEmail,
      subject,
      html,
      attachments: [
        {
          filename: `eventful-ticket-${ticket.ticketNumber}.pdf`,
          content: pdfBuffer,
          contentType: 'application/pdf',
        },
      ],
    });
  }

  async cancelReservation(ticketId: string): Promise<void> {
    const ticket = await Ticket.findById(ticketId);
    if (!ticket || ticket.status !== TicketStatus.PENDING) return;

    ticket.status = TicketStatus.CANCELLED;
    await ticket.save();
    await eventsService.releaseTickets(
      ticket.event.toString(),
      ticket.quantity,
    );
  }

  async findById(id: string): Promise<TicketDocument> {
    if (!Types.ObjectId.isValid(id)) {
      throw new NotFoundError('Ticket not found');
    }
    const ticket = await Ticket.findById(id)
      .populate('event')
      .populate('user', 'firstName lastName email');
    if (!ticket) throw new NotFoundError('Ticket not found');
    return ticket;
  }

  /** Find a ticket by its number, returning whatever guest/user data exists. */
  async findByNumber(ticketNumber: string): Promise<TicketDocument | null> {
    return Ticket.findOne({ ticketNumber })
      .populate('event')
      .populate('user', 'firstName lastName email');
  }

  async findMine(userId: string, page = 1, limit = 20) {
    const filter = { user: new Types.ObjectId(userId) };
    const [items, total] = await Promise.all([
      Ticket.find(filter)
        .populate('event')
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
      Ticket.countDocuments(filter),
    ]);
    return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async findForEvent(
    eventId: string,
    creator: UserDocument,
    page = 1,
    limit = 20,
  ) {
    const event = await eventsService.findById(eventId);
    if (
      event.creator.toString() !== creator._id.toString() &&
      creator.role !== UserRole.ADMIN
    ) {
      throw new ForbiddenError('You do not own this event');
    }

    const filter = { event: new Types.ObjectId(eventId) };
    const [items, total] = await Promise.all([
      Ticket.find(filter)
        .populate('user', 'firstName lastName email')
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
      Ticket.countDocuments(filter),
    ]);
    return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async scan(
    qrPayload: string,
    scanner: UserDocument,
  ): Promise<{ valid: boolean; ticket: TicketDocument; message: string }> {
    let payload;
    try {
      payload = qrCodeService.verify(qrPayload);
    } catch (err: any) {
      throw new BadRequestError(`Invalid QR code: ${err.message}`);
    }

    const ticket = await Ticket.findById(payload.ticketId).populate('event');
    if (!ticket) throw new NotFoundError('Ticket not found');

    const event = ticket.event as any;
    if (
      event.creator.toString() !== scanner._id.toString() &&
      scanner.role !== UserRole.ADMIN
    ) {
      throw new ForbiddenError(
        'You are not authorized to scan tickets for this event',
      );
    }

    if (ticket.status === TicketStatus.USED) {
      return {
        valid: false,
        ticket,
        message: `Ticket already used at ${ticket.scannedAt?.toISOString()}`,
      };
    }
    if (ticket.status !== TicketStatus.PAID) {
      return {
        valid: false,
        ticket,
        message: `Ticket is in ${ticket.status} state - cannot be admitted`,
      };
    }

    ticket.status = TicketStatus.USED;
    ticket.scanned = true;
    ticket.scannedAt = new Date();
    ticket.scannedBy = scanner._id;
    await ticket.save();

    return { valid: true, ticket, message: 'Ticket validated successfully' };
  }

  private generateTicketNumber(): string {
    const ts = Date.now().toString(36).toUpperCase();
    const rand = Math.random().toString(36).substring(2, 7).toUpperCase();
    return `EVT-${ts}-${rand}`;
  }
}

export const ticketsService = new TicketsService();
