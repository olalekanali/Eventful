import { Schema, model, HydratedDocument, Types } from 'mongoose';
import { TicketStatus } from '../utils/enums';

export interface ITicket {
  ticketNumber: string;
  /** Registered user (eventee). Optional - guest checkout uses guestEmail. */
  user?: Types.ObjectId | null;
  guestEmail?: string | null;
  guestName?: string | null;
  guestPhone?: string | null;
  event: Types.ObjectId;
  quantity: number;
  totalAmount: number;
  currency: string;
  status: TicketStatus;
  qrPayload?: string | null;
  qrImage?: string | null;
  scanned: boolean;
  scannedAt?: Date | null;
  scannedBy?: Types.ObjectId | null;
  deletedAt?: Date | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export type TicketDocument = HydratedDocument<ITicket>;

const ticketSchema = new Schema<ITicket>(
  {
    ticketNumber: { type: String, required: true, unique: true, index: true },
    user: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true,
    },
    guestEmail: {
      type: String,
      lowercase: true,
      trim: true,
      default: null,
      index: true,
    },
    guestName: { type: String, trim: true, default: null },
    guestPhone: { type: String, trim: true, default: null },
    event: {
      type: Schema.Types.ObjectId,
      ref: 'Event',
      required: true,
      index: true,
    },
    quantity: { type: Number, default: 1, min: 1 },
    totalAmount: { type: Number, required: true, min: 0 },
    currency: { type: String, default: 'NGN' },
    status: {
      type: String,
      enum: Object.values(TicketStatus),
      default: TicketStatus.PENDING,
      index: true,
    },
    qrPayload: { type: String, default: null },
    qrImage: { type: String, default: null },
    scanned: { type: Boolean, default: false, index: true },
    scannedAt: { type: Date, default: null },
    scannedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    deletedAt: { type: Date, default: null },
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

// Either user OR guestEmail must be set
ticketSchema.pre('validate', function (next) {
  if (!this.user && !this.guestEmail) {
    return next(new Error('Ticket must have either a user or a guest email'));
  }
  next();
});

ticketSchema.index({ event: 1, user: 1 });
ticketSchema.index({ event: 1, guestEmail: 1 });
ticketSchema.index({ event: 1, status: 1 });

export const Ticket = model<ITicket>('Ticket', ticketSchema);
