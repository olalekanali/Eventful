import { Schema, model, HydratedDocument, Types } from 'mongoose';
import { ReminderType } from '../utils/enums';

export interface IReminder {
  user: Types.ObjectId;
  event: Types.ObjectId;
  type: ReminderType;
  fireAt: Date;
  sent: boolean;
  sentAt?: Date | null;
  fromCreator: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

export type ReminderDocument = HydratedDocument<IReminder>;

const reminderSchema = new Schema<IReminder>(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    event: {
      type: Schema.Types.ObjectId,
      ref: 'Event',
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: Object.values(ReminderType),
      required: true,
    },
    fireAt: { type: Date, required: true, index: true },
    sent: { type: Boolean, default: false, index: true },
    sentAt: { type: Date, default: null },
    fromCreator: { type: Boolean, default: false },
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

reminderSchema.index({ user: 1, event: 1, type: 1 }, { unique: true });
reminderSchema.index({ sent: 1, fireAt: 1 });

export const Reminder = model<IReminder>('Reminder', reminderSchema);
