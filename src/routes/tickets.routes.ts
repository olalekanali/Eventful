import { Router } from 'express';
import * as ticketsController from '../controllers/tickets.controller';
import { requireAuth, requireRoles } from '../middlewares/auth.middleware';
import { UserRole } from '../utils/enums';

const router = Router();

// Public lookup (works for guests + registered users)
router.get('/lookup', ticketsController.showLookup);
router.post('/lookup', ticketsController.doLookup);
router.get('/lookup/:ticketNumber', ticketsController.showByNumber);
router.get('/lookup/:ticketNumber/pdf', ticketsController.downloadPdf);
router.post('/lookup/:ticketNumber/resend', ticketsController.resendEmail);

// Registered user: my tickets
router.get('/my', requireAuth, ticketsController.myTickets);

// Creator: scanner
router.get(
  '/scanner',
  requireAuth,
  requireRoles(UserRole.CREATOR, UserRole.ADMIN),
  ticketsController.showScanner,
);
router.post(
  '/scan',
  requireAuth,
  requireRoles(UserRole.CREATOR, UserRole.ADMIN),
  ticketsController.scan,
);

// Registered user: reminders + view own ticket
router.post('/reminders', requireAuth, ticketsController.setReminders);
router.get('/:id', requireAuth, ticketsController.showMine);

export default router;
