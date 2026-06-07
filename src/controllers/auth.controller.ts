import { Request, Response } from 'express';
import { authService } from '../services/auth.service';
import { UserRole } from '../utils/enums';
import { asyncHandler } from '../utils/async-handler';

export const showLogin = (req: Request, res: Response) => {
  res.render('pages/auth/login', {
    title: 'Sign in',
    next: req.query.next || '',
  });
};

export const showRegister = (req: Request, res: Response) => {
  res.render('pages/auth/register', { title: 'Become a creator' });
};

export const register = asyncHandler(async (req: Request, res: Response) => {
  const { email, firstName, lastName, password, phoneNumber } = req.body;

  // Public registration is creator-only now. Eventees check out as guests.
  // Admins are created by other admins.
  const user = await authService.register({
    email,
    firstName,
    lastName,
    password,
    phoneNumber,
    role: UserRole.CREATOR,
  });

  req.session.userId = user._id.toString();
  (req as any).flash(
    'success',
    `Welcome to Eventful, ${user.firstName}! Your creator account is ready.`,
  );
  res.redirect('/dashboard');
});

export const login = asyncHandler(async (req: Request, res: Response) => {
  const { email, password, next } = req.body;
  const user = await authService.login({ email, password });

  req.session.userId = user._id.toString();
  (req as any).flash('success', `Welcome back, ${user.firstName}!`);
  res.redirect(
    typeof next === 'string' && next.startsWith('/') ? next : '/dashboard',
  );
});

export const logout = (req: Request, res: Response) => {
  req.session.destroy(() => {
    res.clearCookie('connect.sid');
    res.redirect('/');
  });
};
