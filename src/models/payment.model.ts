import { Schema, model, HydratedDocument, Types } from 'mongoose';
import { PaymentStatus } from '../utils/enums';

export interface IPayment {
  reference: string;
  paystackReference?: string | null;
  authorizationUrl?: string | null;
  accessCode?: string | null;
  amount: number;
  currency: string;
  status: PaymentStatus;
  channel?: string | null;
  metadata?: Record<string, any>;
  paidAt?: Date | null;
  user?: Types.ObjectId | null;
  guestEmail?: string | null;
  ticket?: Types.ObjectId;
  event?: Types.ObjectId;
  createdAt?: Date;
  updatedAt?: Date;
}

export type PaymentDocument = HydratedDocument<IPayment>;

const paymentSchema = new Schema<IPayment>(
  {
    reference: { type: String, required: true, unique: true, index: true },
    paystackReference: { type: String, default: null },
    authorizationUrl: { type: String, default: null },
    accessCode: { type: String, default: null },
    amount: { type: Number, required: true, min: 0 },
    currency: { type: String, default: 'NGN' },
    status: {
      type: String,
      enum: Object.values(PaymentStatus),
      default: PaymentStatus.PENDING,
      index: true,
    },
    channel: { type: String, default: null },
    metadata: { type: Schema.Types.Mixed, default: {} },
    paidAt: { type: Date, default: null },
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
    ticket: { type: Schema.Types.ObjectId, ref: 'Ticket', index: true },
    event: { type: Schema.Types.ObjectId, ref: 'Event', index: true },
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

export const Payment = model<IPayment>('Payment', paymentSchema);
