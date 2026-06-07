import { Schema, model, HydratedDocument, Types } from 'mongoose';
import {
  EventCategory,
  EventStatus,
  ReminderType,
} from '../utils/enums';

export interface IEvent {
  title: string;
  description: string;
  category: EventCategory;
  startDate: Date;
  endDate: Date;
  venue: string;
  address?: string;
  city?: string;
  country?: string;
  bannerImage?: string;
  totalTickets: number;
  ticketsSold: number;
  ticketPrice: number;
  currency: string;
  status: EventStatus;
  defaultReminders: ReminderType[];
  creator: Types.ObjectId;
  deletedAt?: Date | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export type EventDocument = HydratedDocument<IEvent>;

const eventSchema = new Schema<IEvent>(
  {
    title: { type: String, required: true, trim: true, index: 'text' },
    description: { type: String, required: true },
    category: {
      type: String,
      enum: Object.values(EventCategory),
      default: EventCategory.OTHER,
      index: true,
    },
    startDate: { type: Date, required: true, index: true },
    endDate: { type: Date, required: true },
    venue: { type: String, required: true },
    address: String,
    city: { type: String, index: true },
    country: String,
    bannerImage: String,
    totalTickets: { type: Number, required: true, min: 1 },
    ticketsSold: { type: Number, default: 0, min: 0 },
    ticketPrice: { type: Number, required: true, min: 0 },
    currency: { type: String, default: 'NGN' },
    status: {
      type: String,
      enum: Object.values(EventStatus),
      default: EventStatus.DRAFT,
      index: true,
    },
    defaultReminders: {
      type: [String],
      enum: Object.values(ReminderType),
      default: [],
    },
    creator: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    deletedAt: { type: Date, default: null, index: true },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: (_doc, ret: any) => {
        ret.id = ret._id.toString();
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
  },
);

eventSchema.virtual('availableTickets').get(function (this: IEvent) {
  return this.totalTickets - this.ticketsSold;
});

eventSchema.virtual('isSoldOut').get(function (this: IEvent) {
  return this.ticketsSold >= this.totalTickets;
});

eventSchema.index({ status: 1, startDate: 1 });
eventSchema.index({ creator: 1, createdAt: -1 });

export const Event = model<IEvent>('Event', eventSchema);
