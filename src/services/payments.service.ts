import { Types } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';
import { Payment, PaymentDocument } from '../models/payment.model';
import { UserDocument } from '../models/user.model';
import { paystackService } from './paystack.service';
import { ticketsService, GuestInfo } from './tickets.service';
import { logger } from '../utils/logger';
import { PaymentStatus } from '../utils/enums';
import {
  BadRequestError,
  ForbiddenError,
  NotFoundError,
} from '../utils/errors';

class PaymentsService {
  async initiate(
    eventId: string,
    quantity: number,
    purchaser: { user?: UserDocument; guest?: GuestInfo },
  ): Promise<PaymentDocument> {
    const { ticket, event } = await ticketsService.reserve(
      eventId,
      quantity,
      purchaser,
    );

    const reference = `EVT_PAY_${uuidv4().replace(/-/g, '').slice(0, 20)}`;
    const recipientEmail = purchaser.user
      ? purchaser.user.email
      : purchaser.guest!.email;

    const paymentData: any = {
      reference,
      amount: ticket.totalAmount,
      currency: ticket.currency,
      status: PaymentStatus.PENDING,
      ticket: ticket._id,
      event: event._id,
      metadata: {
        ticketNumber: ticket.ticketNumber,
        eventTitle: event.title,
        quantity: ticket.quantity,
        purchaserName: purchaser.user
          ? `${purchaser.user.firstName} ${purchaser.user.lastName}`
          : purchaser.guest!.name,
      },
    };

    if (purchaser.user) {
      paymentData.user = purchaser.user._id;
    } else {
      paymentData.guestEmail = recipientEmail;
    }

    const payment = await Payment.create(paymentData);

    try {
      const ps = await paystackService.initialize({
        email: recipientEmail,
        amount: Number(ticket.totalAmount),
        currency: ticket.currency,
        reference,
        metadata: {
          ticketId: ticket._id.toString(),
          eventId: event._id.toString(),
          userId: purchaser.user?._id.toString(),
          guestEmail: purchaser.guest?.email,
          paymentId: payment._id.toString(),
        },
      });

      payment.authorizationUrl = ps.authorization_url;
      payment.accessCode = ps.access_code;
      payment.paystackReference = ps.reference;
      await payment.save();

      return payment;
    } catch (err) {
      await ticketsService.cancelReservation(ticket._id.toString());
      payment.status = PaymentStatus.FAILED;
      await payment.save();
      throw err;
    }
  }

  async verify(reference: string): Promise<PaymentDocument> {
    const payment = await Payment.findOne({ reference })
      .populate('ticket')
      .populate('user');
    if (!payment) throw new NotFoundError('Payment not found');

    if (payment.status === PaymentStatus.SUCCESS) return payment;

    const ps = await paystackService.verify(reference);
    if (ps.status === 'success') {
      payment.status = PaymentStatus.SUCCESS;
      payment.paidAt = new Date(ps.paid_at);
      payment.channel = ps.channel;
      await payment.save();
      if (payment.ticket) {
        await ticketsService.confirmPayment(payment.ticket.toString());
      }
    } else {
      payment.status = PaymentStatus.FAILED;
      await payment.save();
      if (payment.ticket) {
        await ticketsService.cancelReservation(payment.ticket.toString());
      }
    }
    return payment;
  }

  async handleWebhook(rawBody: string, signature: string): Promise<void> {
    if (!paystackService.verifyWebhookSignature(rawBody, signature)) {
      throw new ForbiddenError('Invalid webhook signature');
    }

    let event: any;
    try {
      event = JSON.parse(rawBody);
    } catch {
      throw new BadRequestError('Invalid JSON payload');
    }

    logger.info(`Paystack webhook event: ${event.event}`);

    if (event.event === 'charge.success') {
      const reference = event.data?.reference;
      if (reference) {
        try {
          await this.verify(reference);
        } catch (err: any) {
          logger.error(`Webhook verify failed for ${reference}`, {
            error: err.message,
          });
        }
      }
    }
  }

  async findMine(userId: string, page = 1, limit = 20) {
    const filter = { user: new Types.ObjectId(userId) };
    const [items, total] = await Promise.all([
      Payment.find(filter)
        .populate('ticket')
        .populate('event')
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
      Payment.countDocuments(filter),
    ]);
    return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
  }
}

export const paymentsService = new PaymentsService();
