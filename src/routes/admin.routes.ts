import { Router } from 'express';
import * as adminController from '../controllers/admin.controller';
import { requireAuth, requireRoles } from '../middlewares/auth.middleware';
import { UserRole } from '../utils/enums';

const router = Router();

router.use(requireAuth, requireRoles(UserRole.ADMIN));

router.get('/users', adminController.listUsers);
router.post('/users/:id/toggle', adminController.toggleUser);
router.post('/users/:id/role', adminController.changeUserRole);
router.get('/events', adminController.listEvents);

export default router;
