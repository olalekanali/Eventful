import { Types } from 'mongoose';
import { Event } from '../models/event.model';
import { Ticket } from '../models/ticket.model';
import { Payment } from '../models/payment.model';
import { User } from '../models/user.model';
import { UserDocument } from '../models/user.model';
import { TicketStatus, PaymentStatus, UserRole } from '../utils/enums';
import { ForbiddenError, NotFoundError } from '../utils/errors';

export interface OverallAnalytics {
  totalEvents: number;
  totalAttendees: number;
  totalTicketsSold: number;
  totalRevenue: number;
  totalScannedTickets: number;
  currency: string;
}

class AnalyticsService {
  async getCreatorOverall(creator: UserDocument): Promise<OverallAnalytics> {
    const totalEvents = await Event.countDocuments({
      creator: creator._id,
      deletedAt: null,
    });

    const ticketStats = await Ticket.aggregate([
      { $match: { status: { $in: [TicketStatus.PAID, TicketStatus.USED] } } },
      {
        $lookup: {
          from: 'events',
          localField: 'event',
          foreignField: '_id',
          as: 'eventDoc',
        },
      },
      { $unwind: '$eventDoc' },
      { $match: { 'eventDoc.creator': creator._id } },
      {
        $group: {
          _id: null,
          attendees: { $addToSet: '$user' },
          totalTicketsSold: { $sum: '$quantity' },
          totalScanned: { $sum: { $cond: ['$scanned', 1, 0] } },
        },
      },
      {
        $project: {
          totalAttendees: { $size: '$attendees' },
          totalTicketsSold: 1,
          totalScanned: 1,
        },
      },
    ]);

    const revenue = await Payment.aggregate([
      { $match: { status: PaymentStatus.SUCCESS } },
      {
        $lookup: {
          from: 'events',
          localField: 'event',
          foreignField: '_id',
          as: 'eventDoc',
        },
      },
      { $unwind: '$eventDoc' },
      { $match: { 'eventDoc.creator': creator._id } },
      { $group: { _id: '$currency', totalRevenue: { $sum: '$amount' } } },
    ]);

    const s = ticketStats[0] || {
      totalAttendees: 0,
      totalTicketsSold: 0,
      totalScanned: 0,
    };
    const r = revenue[0] || { totalRevenue: 0, _id: 'NGN' };

    return {
      totalEvents,
      totalAttendees: s.totalAttendees,
      totalTicketsSold: s.totalTicketsSold,
      totalRevenue: r.totalRevenue,
      totalScannedTickets: s.totalScanned,
      currency: r._id || 'NGN',
    };
  }

  async getEventAnalytics(eventId: string, user: UserDocument) {
    if (!Types.ObjectId.isValid(eventId)) {
      throw new NotFoundError('Event not found');
    }
    const event = await Event.findById(eventId);
    if (!event) throw new NotFoundError('Event not found');
    if (
      event.creator.toString() !== user._id.toString() &&
      user.role !== UserRole.ADMIN
    ) {
      throw new ForbiddenError('You do not own this event');
    }

    const ticketStats = await Ticket.aggregate([
      {
        $match: {
          event: new Types.ObjectId(eventId),
          status: { $in: [TicketStatus.PAID, TicketStatus.USED] },
        },
      },
      {
        $group: {
          _id: null,
          attendees: { $addToSet: '$user' },
          ticketsSold: { $sum: '$quantity' },
          totalScanned: { $sum: { $cond: ['$scanned', 1, 0] } },
        },
      },
      {
        $project: {
          totalAttendees: { $size: '$attendees' },
          ticketsSold: 1,
          totalScanned: 1,
        },
      },
    ]);

    const revenue = await Payment.aggregate([
      {
        $match: {
          event: new Types.ObjectId(eventId),
          status: PaymentStatus.SUCCESS,
        },
      },
      { $group: { _id: null, totalRevenue: { $sum: '$amount' } } },
    ]);

    const s = ticketStats[0] || {
      totalAttendees: 0,
      ticketsSold: 0,
      totalScanned: 0,
    };
    const totalRevenue = revenue[0]?.totalRevenue || 0;
    const scanRate =
      s.ticketsSold > 0
        ? Math.round((s.totalScanned / s.ticketsSold) * 100)
        : 0;

    return {
      eventId: event._id.toString(),
      eventTitle: event.title,
      totalTickets: event.totalTickets,
      ticketsSold: s.ticketsSold,
      ticketsAvailable: event.totalTickets - event.ticketsSold,
      totalAttendees: s.totalAttendees,
      totalRevenue,
      totalScanned: s.totalScanned,
      scanRate,
      currency: event.currency,
    };
  }

  async getCreatorEventBreakdown(creator: UserDocument) {
    return Event.aggregate([
      { $match: { creator: creator._id, deletedAt: null } },
      {
        $lookup: {
          from: 'tickets',
          let: { eventId: '$_id' },
          pipeline: [
            {
              $match: {
                $expr: { $eq: ['$event', '$$eventId'] },
                status: { $in: [TicketStatus.PAID, TicketStatus.USED] },
              },
            },
          ],
          as: 'paidTickets',
        },
      },
      {
        $lookup: {
          from: 'payments',
          let: { eventId: '$_id' },
          pipeline: [
            {
              $match: {
                $expr: { $eq: ['$event', '$$eventId'] },
                status: PaymentStatus.SUCCESS,
              },
            },
          ],
          as: 'pays',
        },
      },
      {
        $project: {
          eventId: { $toString: '$_id' },
          eventTitle: '$title',
          totalTickets: 1,
          ticketsSold: 1,
          currency: 1,
          status: 1,
          startDate: 1,
          attendees: { $size: { $setUnion: ['$paidTickets.user', []] } },
          scanned: {
            $size: {
              $filter: {
                input: '$paidTickets',
                cond: { $eq: ['$$this.scanned', true] },
              },
            },
          },
          revenue: { $sum: '$pays.amount' },
        },
      },
      { $sort: { startDate: -1 } },
    ]);
  }

  /**
   * Admin: global stats across the whole platform.
   */
  async getPlatformStats() {
    const [totalUsers, totalCreators, totalEvents, totalPaidTickets] =
      await Promise.all([
        User.countDocuments({ deletedAt: null }),
        User.countDocuments({ role: UserRole.CREATOR, deletedAt: null }),
        Event.countDocuments({ deletedAt: null }),
        Ticket.countDocuments({
          status: { $in: [TicketStatus.PAID, TicketStatus.USED] },
        }),
      ]);

    const revenue = await Payment.aggregate([
      { $match: { status: PaymentStatus.SUCCESS } },
      { $group: { _id: '$currency', total: { $sum: '$amount' } } },
    ]);

    return {
      totalUsers,
      totalCreators,
      totalEvents,
      totalPaidTickets,
      totalRevenue: revenue[0]?.total || 0,
      currency: revenue[0]?._id || 'NGN',
    };
  }
}

export const analyticsService = new AnalyticsService();
