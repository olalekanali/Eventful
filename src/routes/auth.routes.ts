import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { body } from 'express-validator';
import * as authController from '../controllers/auth.controller';
import { validate } from '../middlewares/validate.middleware';
import { requireGuest, requireAuth } from '../middlewares/auth.middleware';

const router = Router();

const authLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  message: 'Too many attempts. Try again in a minute.',
});

router.get('/login', requireGuest, authController.showLogin);
router.get('/register', requireGuest, authController.showRegister);

router.post(
  '/login',
  authLimiter,
  requireGuest,
  validate([
    body('email').isEmail().withMessage('Please enter a valid email'),
    body('password').notEmpty().withMessage('Password is required'),
  ]),
  authController.login,
);

router.post(
  '/register',
  authLimiter,
  requireGuest,
  validate([
    body('email').isEmail().withMessage('Please enter a valid email'),
    body('firstName').trim().notEmpty().withMessage('First name is required'),
    body('lastName').trim().notEmpty().withMessage('Last name is required'),
    body('password')
      .isLength({ min: 8 })
      .withMessage('Password must be at least 8 characters'),
  ]),
  authController.register,
);

router.post('/logout', requireAuth, authController.logout);

export default router;
