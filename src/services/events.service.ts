import { FilterQuery, Types } from 'mongoose';
import { Event, EventDocument, IEvent } from '../models/event.model';
import { UserDocument } from '../models/user.model';
import { EventStatus } from '../utils/enums';
import {
  BadRequestError,
  ForbiddenError,
  NotFoundError,
} from '../utils/errors';
import { UserRole } from '../utils/enums';

export interface EventQuery {
  page?: number;
  limit?: number;
  category?: string;
  status?: EventStatus;
  city?: string;
  search?: string;
}

export interface CreateEventInput {
  title: string;
  description: string;
  category: string;
  startDate: string | Date;
  endDate: string | Date;
  venue: string;
  address?: string;
  city?: string;
  country?: string;
  bannerImage?: string;
  totalTickets: number;
  ticketPrice: number;
  currency?: string;
  status?: EventStatus;
  defaultReminders?: string[];
}

class EventsService {
  async create(
    input: CreateEventInput,
    creator: UserDocument,
  ): Promise<EventDocument> {
    const start = new Date(input.startDate);
    const end = new Date(input.endDate);

    if (end <= start) {
      throw new BadRequestError('End date must be after start date');
    }
    if (start <= new Date()) {
      throw new BadRequestError('Start date must be in the future');
    }

    return Event.create({
      ...input,
      startDate: start,
      endDate: end,
      currency: input.currency || 'NGN',
      creator: creator._id,
    } as IEvent);
  }

  async findAll(query: EventQuery) {
    const { page = 1, limit = 12, category, status, city, search } = query;
    const filter: FilterQuery<EventDocument> = { deletedAt: null };

    if (category) filter.category = category;
    if (status) filter.status = status;
    if (city) filter.city = new RegExp(city, 'i');
    if (search) {
      filter.$or = [
        { title: new RegExp(search, 'i') },
        { description: new RegExp(search, 'i') },
        { venue: new RegExp(search, 'i') },
      ];
    }

    const [items, total] = await Promise.all([
      Event.find(filter)
        .populate('creator', 'firstName lastName email')
        .sort({ startDate: 1 })
        .skip((page - 1) * limit)
        .limit(limit),
      Event.countDocuments(filter),
    ]);

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findPublished(query: EventQuery) {
    return this.findAll({ ...query, status: EventStatus.PUBLISHED });
  }

  async findByCreator(creatorId: string, query: EventQuery) {
    const { page = 1, limit = 12, status, search } = query;
    const filter: FilterQuery<EventDocument> = {
      creator: new Types.ObjectId(creatorId),
      deletedAt: null,
    };
    if (status) filter.status = status;
    if (search) {
      filter.$or = [
        { title: new RegExp(search, 'i') },
        { description: new RegExp(search, 'i') },
      ];
    }

    const [items, total] = await Promise.all([
      Event.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
      Event.countDocuments(filter),
    ]);

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findById(id: string): Promise<EventDocument> {
    if (!Types.ObjectId.isValid(id)) {
      throw new NotFoundError('Event not found');
    }
    const event = await Event.findOne({ _id: id, deletedAt: null }).populate(
      'creator',
      'firstName lastName email',
    );
    if (!event) throw new NotFoundError('Event not found');
    return event;
  }

  async update(
    id: string,
    input: Partial<CreateEventInput>,
    user: UserDocument,
  ): Promise<EventDocument> {
    const event = await this.findById(id);
    this.assertOwnership(event, user);

    if (input.totalTickets !== undefined && input.totalTickets < event.ticketsSold) {
      throw new BadRequestError(
        `Cannot reduce total tickets below already-sold (${event.ticketsSold})`,
      );
    }

    const update: any = { ...input };
    if (input.startDate) update.startDate = new Date(input.startDate);
    if (input.endDate) update.endDate = new Date(input.endDate);

    Object.assign(event, update);
    return event.save();
  }

  async remove(id: string, user: UserDocument): Promise<void> {
    const event = await this.findById(id);
    this.assertOwnership(event, user);
    event.deletedAt = new Date();
    await event.save();
  }

  /**
   * Atomic reservation: only $inc ticketsSold if capacity remains.
   * Returns the updated event if successful, null if sold out.
   */
  async tryReserveTickets(
    eventId: string,
    quantity: number,
  ): Promise<EventDocument | null> {
    return Event.findOneAndUpdate(
      {
        _id: eventId,
        deletedAt: null,
        $expr: {
          $lte: [{ $add: ['$ticketsSold', quantity] }, '$totalTickets'],
        },
      },
      { $inc: { ticketsSold: quantity } },
      { new: true },
    );
  }

  async releaseTickets(eventId: string, quantity: number): Promise<void> {
    await Event.updateOne(
      { _id: eventId },
      { $inc: { ticketsSold: -quantity } },
    );
  }

  private assertOwnership(event: EventDocument, user: UserDocument): void {
    if (
      event.creator.toString() !== user._id.toString() &&
      user.role !== UserRole.ADMIN
    ) {
      throw new ForbiddenError('You do not own this event');
    }
  }
}

export const eventsService = new EventsService();
