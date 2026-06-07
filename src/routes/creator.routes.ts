import { Router } from 'express';
import * as creatorController from '../controllers/creator.controller';
import { requireAuth, requireRoles } from '../middlewares/auth.middleware';
import { UserRole } from '../utils/enums';

const router = Router();

router.use(requireAuth, requireRoles(UserRole.CREATOR, UserRole.ADMIN));

router.get('/events', creatorController.myEvents);
router.get('/events/:id/analytics', creatorController.eventAnalytics);

export default router;
