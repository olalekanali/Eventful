import { Request, Response } from 'express';
import { asyncHandler } from '../utils/async-handler';
import { eventsService } from '../services/events.service';
import { analyticsService } from '../services/analytics.service';
import { User } from '../models/user.model';

export const myEvents = asyncHandler(async (req: Request, res: Response) => {
  const page = parseInt((req.query.page as string) || '1', 10);
  const result = await eventsService.findByCreator(req.user!.id, {
    page,
    limit: 20,
    status: req.query.status as any,
    search: req.query.search as string,
  });
  res.render('pages/creator/events', {
    title: 'My events',
    result,
    filters: {
      status: req.query.status || '',
      search: req.query.search || '',
    },
  });
});

export const eventAnalytics = asyncHandler(
  async (req: Request, res: Response) => {
    const user = await User.findById(req.user!.id);
    if (!user) throw new Error('User not found');

    const event = await eventsService.findById(req.params.id);
    const stats = await analyticsService.getEventAnalytics(req.params.id, user);

    res.render('pages/creator/analytics', {
      title: `Analytics - ${event.title}`,
      event,
      stats,
    });
  },
);
