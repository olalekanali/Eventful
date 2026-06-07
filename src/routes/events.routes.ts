import { Router } from 'express';
import { body } from 'express-validator';
import * as eventsController from '../controllers/events.controller';
import { validate } from '../middlewares/validate.middleware';
import { requireAuth, requireRoles } from '../middlewares/auth.middleware';
import { uploadBanner } from '../middlewares/upload.middleware';
import { UserRole } from '../utils/enums';

const router = Router();

router.get('/', eventsController.listPublic);

router.get(
  '/new',
  requireAuth,
  requireRoles(UserRole.CREATOR, UserRole.ADMIN),
  eventsController.showCreateForm,
);

const eventValidators = [
  body('title').trim().notEmpty().withMessage('Title required'),
  body('description').trim().notEmpty().withMessage('Description required'),
  body('category').notEmpty().withMessage('Category required'),
  body('startDate').isISO8601().withMessage('Valid start date required'),
  body('endDate').isISO8601().withMessage('Valid end date required'),
  body('venue').trim().notEmpty().withMessage('Venue required'),
  body('totalTickets')
    .isInt({ min: 1 })
    .withMessage('Total tickets must be at least 1'),
  body('ticketPrice')
    .isFloat({ min: 0 })
    .withMessage('Ticket price must be 0 or more'),
];

router.post(
  '/',
  requireAuth,
  requireRoles(UserRole.CREATOR, UserRole.ADMIN),
  uploadBanner,
  validate(eventValidators),
  eventsController.create,
);

router.get('/:id', eventsController.showOne);

router.get(
  '/:id/edit',
  requireAuth,
  requireRoles(UserRole.CREATOR, UserRole.ADMIN),
  eventsController.showEditForm,
);

router.get(
  '/:id/attendees',
  requireAuth,
  requireRoles(UserRole.CREATOR, UserRole.ADMIN),
  eventsController.showAttendees,
);

router.patch(
  '/:id',
  requireAuth,
  requireRoles(UserRole.CREATOR, UserRole.ADMIN),
  uploadBanner,
  eventsController.update,
);

router.delete(
  '/:id',
  requireAuth,
  requireRoles(UserRole.CREATOR, UserRole.ADMIN),
  eventsController.remove,
);

export default router;
