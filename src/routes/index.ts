import { Router } from 'express';
import { asyncHandler } from '../utils/async-handler';
import { eventsService } from '../services/events.service';
import authRoutes from './auth.routes';
import eventsRoutes from './events.routes';
import ticketsRoutes from './tickets.routes';
import paymentsRoutes from './payments.routes';
import creatorRoutes from './creator.routes';
import adminRoutes from './admin.routes';
import * as dashboardController from '../controllers/dashboard.controller';
import { requireAuth } from '../middlewares/auth.middleware';

const router = Router();

// Home: landing page with featured upcoming events
router.get(
  '/',
  asyncHandler(async (_req, res) => {
    const result = await eventsService.findPublished({ page: 1, limit: 6 });
    res.render('pages/home', {
      title: 'Eventful — discover unforgettable moments',
      events: result.items,
    });
  }),
);

router.get('/dashboard', requireAuth, dashboardController.home);

router.use('/auth', authRoutes);
router.use('/events', eventsRoutes);
router.use('/tickets', ticketsRoutes);
router.use('/payments', paymentsRoutes);
router.use('/creator', creatorRoutes);
router.use('/admin', adminRoutes);

export default router;
