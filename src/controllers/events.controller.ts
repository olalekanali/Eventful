import { Request, Response } from 'express';
import { asyncHandler } from '../utils/async-handler';
import { eventsService } from '../services/events.service';
import { ticketsService } from '../services/tickets.service';
import { User } from '../models/user.model';
import {
  EventCategory,
  EventStatus,
  ReminderType,
  ReminderLabels,
} from '../utils/enums';
import { config } from '../config';
import { bannerUrl, deleteBannerIfLocal } from '../middlewares/upload.middleware';

export const listPublic = asyncHandler(async (req: Request, res: Response) => {
  const page = parseInt((req.query.page as string) || '1', 10);
  const result = await eventsService.findPublished({
    page,
    limit: 12,
    category: req.query.category as string,
    city: req.query.city as string,
    search: req.query.search as string,
  });

  res.render('pages/events/list', {
    title: 'Browse events',
    result,
    categories: Object.values(EventCategory),
    filters: {
      category: req.query.category || '',
      city: req.query.city || '',
      search: req.query.search || '',
    },
  });
});

export const showOne = asyncHandler(async (req: Request, res: Response) => {
  const event = await eventsService.findById(req.params.id);

  const eventUrl = `${config.appUrl}/events/${event._id}`;
  const text = `Check out "${event.title}" on Eventful - ${event.venue} on ${event.startDate.toDateString()}`;
  const encUrl = encodeURIComponent(eventUrl);
  const encText = encodeURIComponent(text);
  const shareLinks = {
    twitter: `https://twitter.com/intent/tweet?text=${encText}&url=${encUrl}`,
    facebook: `https://www.facebook.com/sharer/sharer.php?u=${encUrl}`,
    whatsapp: `https://wa.me/?text=${encText}%20${encUrl}`,
    linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${encUrl}`,
    telegram: `https://t.me/share/url?url=${encUrl}&text=${encText}`,
    email: `mailto:?subject=${encodeURIComponent(event.title)}&body=${encText}%20${encUrl}`,
  };

  res.render('pages/events/show', {
    title: event.title,
    event,
    eventUrl,
    shareLinks,
  });
});

export const showCreateForm = (_req: Request, res: Response) => {
  res.render('pages/events/form', {
    title: 'Create event',
    event: null,
    categories: Object.values(EventCategory),
    reminderTypes: Object.values(ReminderType),
    reminderLabels: ReminderLabels,
    action: '/events',
    method: 'POST',
  });
};

/**
 * Reads form fields shared between create + update.
 * Banner file (if any) is on req.file from multer.
 */
function readEventBody(req: Request): any {
  const remindersInput = req.body.defaultReminders;
  const reminders = remindersInput
    ? Array.isArray(remindersInput)
      ? remindersInput
      : [remindersInput]
    : [];

  // submit button value tells us draft vs publish
  let status: EventStatus | undefined;
  if (req.body.submitAction === 'publish') status = EventStatus.PUBLISHED;
  else if (req.body.submitAction === 'draft') status = EventStatus.DRAFT;

  const body: any = {
    title: req.body.title,
    description: req.body.description,
    category: req.body.category,
    startDate: req.body.startDate,
    endDate: req.body.endDate,
    venue: req.body.venue,
    address: req.body.address,
    city: req.body.city,
    country: req.body.country,
    totalTickets: parseInt(req.body.totalTickets, 10),
    ticketPrice: parseFloat(req.body.ticketPrice),
    currency: req.body.currency || 'NGN',
    defaultReminders: reminders,
  };
  if (status) body.status = status;
  if (req.file) {
    body.bannerImage = bannerUrl(req.file.filename);
  }
  return body;
}

export const create = asyncHandler(async (req: Request, res: Response) => {
  const user = await User.findById(req.user!.id);
  if (!user) throw new Error('User not found');

  const body = readEventBody(req);
  const event = await eventsService.create(body, user);

  (req as any).flash(
    'success',
    event.status === EventStatus.PUBLISHED
      ? 'Event created and published'
      : 'Event saved as draft',
  );
  res.redirect(`/events/${event._id}`);
});

export const showEditForm = asyncHandler(
  async (req: Request, res: Response) => {
    const event = await eventsService.findById(req.params.id);
    if (
      (event.creator as any)._id?.toString() !== req.user!.id &&
      req.user!.role !== 'admin'
    ) {
      (req as any).flash('error', 'You do not own this event');
      return res.redirect('/dashboard');
    }

    res.render('pages/events/form', {
      title: `Edit ${event.title}`,
      event,
      categories: Object.values(EventCategory),
      reminderTypes: Object.values(ReminderType),
      reminderLabels: ReminderLabels,
      action: `/events/${event._id}?_method=PATCH`,
      method: 'POST',
    });
  },
);

export const update = asyncHandler(async (req: Request, res: Response) => {
  const user = await User.findById(req.user!.id);
  if (!user) throw new Error('User not found');

  const existing = await eventsService.findById(req.params.id);
  const body = readEventBody(req);

  // If a new banner was uploaded, clean up the old local file
  if (body.bannerImage && existing.bannerImage) {
    deleteBannerIfLocal(existing.bannerImage);
  }

  await eventsService.update(req.params.id, body, user);
  (req as any).flash(
    'success',
    body.status === EventStatus.PUBLISHED
      ? 'Event published'
      : body.status === EventStatus.DRAFT
        ? 'Event saved as draft'
        : 'Event updated',
  );
  res.redirect(`/events/${req.params.id}`);
});

export const remove = asyncHandler(async (req: Request, res: Response) => {
  const user = await User.findById(req.user!.id);
  if (!user) throw new Error('User not found');
  const existing = await eventsService.findById(req.params.id);
  deleteBannerIfLocal(existing.bannerImage);
  await eventsService.remove(req.params.id, user);
  (req as any).flash('success', 'Event deleted');
  res.redirect('/creator/events');
});

export const showAttendees = asyncHandler(
  async (req: Request, res: Response) => {
    const user = await User.findById(req.user!.id);
    if (!user) throw new Error('User not found');

    const event = await eventsService.findById(req.params.id);
    const page = parseInt((req.query.page as string) || '1', 10);
    const result = await ticketsService.findForEvent(
      req.params.id,
      user,
      page,
      30,
    );

    res.render('pages/creator/attendees', {
      title: `Attendees - ${event.title}`,
      event,
      result,
    });
  },
);
