import cron from 'node-cron';
import { Types } from 'mongoose';
import { Reminder, ReminderDocument } from '../models/reminder.model';
import { eventsService } from './events.service';
import { mailService } from './mail.service';
import { UserDocument } from '../models/user.model';
import { EventDocument } from '../models/event.model';
import {
  ReminderDurationMs,
  ReminderLabels,
  ReminderType,
} from '../utils/enums';
import { config } from '../config';
import { logger } from '../utils/logger';
import { BadRequestError, NotFoundError } from '../utils/errors';

class RemindersService {
  async setForEvent(
    user: UserDocument,
    eventId: string,
    reminders: ReminderType[],
  ): Promise<ReminderDocument[]> {
    const event = await eventsService.findById(eventId);
    if (event.startDate <= new Date()) {
      throw new BadRequestError(
        'Cannot set reminders for past or ongoing events',
      );
    }

    // Replace existing eventee-set reminders for this event
    await Reminder.deleteMany({
      user: user._id,
      event: event._id,
      fromCreator: false,
    });

    const now = Date.now();
    const eventTime = event.startDate.getTime();
    const docs = reminders
      .map((type) => {
        const fireAt = new Date(eventTime - ReminderDurationMs[type]);
        if (fireAt.getTime() <= now) return null;
        return {
          user: user._id,
          event: event._id,
          type,
          fireAt,
          fromCreator: false,
        };
      })
      .filter(Boolean) as any[];

    if (!docs.length) return [];
    return Reminder.insertMany(docs) as any;
  }

  async setupDefaultsForUser(
    user: UserDocument,
    event: EventDocument,
  ): Promise<void> {
    if (!event.defaultReminders?.length) return;

    const now = Date.now();
    const eventTime = event.startDate.getTime();
    const docs = event.defaultReminders
      .map((type) => {
        const fireAt = new Date(eventTime - ReminderDurationMs[type]);
        if (fireAt.getTime() <= now) return null;
        return {
          user: user._id,
          event: event._id,
          type,
          fireAt,
          fromCreator: true,
        };
      })
      .filter(Boolean) as any[];

    if (!docs.length) return;

    try {
      await Reminder.insertMany(docs, { ordered: false });
    } catch {
      // duplicates are fine
    }
  }

  async findMine(userId: string, eventId?: string): Promise<ReminderDocument[]> {
    const filter: any = { user: new Types.ObjectId(userId) };
    if (eventId) filter.event = new Types.ObjectId(eventId);
    return Reminder.find(filter).populate('event').sort({ fireAt: 1 });
  }

  async deleteOne(id: string, user: UserDocument): Promise<void> {
    const r = await Reminder.findById(id);
    if (!r) throw new NotFoundError('Reminder not found');
    if (r.user.toString() !== user._id.toString()) {
      throw new BadRequestError('You can only delete your own reminders');
    }
    await r.deleteOne();
  }

  /**
   * Cron job: every minute, send any due reminders.
   */
  startCron(): void {
    cron.schedule('* * * * *', async () => {
      try {
        const due = await Reminder.find({
          sent: false,
          fireAt: { $lte: new Date() },
        })
          .populate('user')
          .populate('event')
          .limit(200);

        if (!due.length) return;
        logger.info(`Processing ${due.length} due reminders`);

        for (const r of due) {
          try {
            const u = r.user as any;
            const e = r.event as any;
            const { subject, html, text } = mailService.reminderTemplate({
              name: u.firstName,
              eventTitle: e.title,
              eventDate: e.startDate,
              venue: e.venue,
              timeUntil: ReminderLabels[r.type].replace(' before', ''),
              eventUrl: `${config.appUrl}/events/${e._id}`,
            });
            await mailService.send({ to: u.email, subject, html, text });
            r.sent = true;
            r.sentAt = new Date();
            await r.save();
          } catch (err: any) {
            logger.error(`Failed reminder ${r._id}`, { error: err.message });
          }
        }
      } catch (err: any) {
        logger.error('Reminder cron error', { error: err.message });
      }
    });
    logger.info('Reminders cron started (runs every minute)');
  }
}

export const remindersService = new RemindersService();
