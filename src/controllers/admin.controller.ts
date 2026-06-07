import { Request, Response } from 'express';
import { asyncHandler } from '../utils/async-handler';
import { User } from '../models/user.model';
import { Event } from '../models/event.model';
import { UserRole } from '../utils/enums';

export const listUsers = asyncHandler(async (req: Request, res: Response) => {
  const page = parseInt((req.query.page as string) || '1', 10);
  const limit = 30;
  const filter: any = { deletedAt: null };
  if (req.query.role) filter.role = req.query.role;
  if (req.query.search) {
    const re = new RegExp(req.query.search as string, 'i');
    filter.$or = [{ email: re }, { firstName: re }, { lastName: re }];
  }

  const [users, total] = await Promise.all([
    User.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit),
    User.countDocuments(filter),
  ]);

  res.render('pages/admin/users', {
    title: 'Users',
    users,
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit),
    filters: {
      role: req.query.role || '',
      search: req.query.search || '',
    },
    roles: Object.values(UserRole),
  });
});

export const toggleUser = asyncHandler(async (req: Request, res: Response) => {
  const user = await User.findById(req.params.id);
  if (!user) {
    (req as any).flash('error', 'User not found');
    return res.redirect('/admin/users');
  }
  if (user._id.toString() === req.user!.id) {
    (req as any).flash('error', 'You cannot deactivate yourself');
    return res.redirect('/admin/users');
  }
  user.isActive = !user.isActive;
  await user.save();
  (req as any).flash(
    'success',
    `${user.email} ${user.isActive ? 'activated' : 'deactivated'}`,
  );
  res.redirect('/admin/users');
});

export const changeUserRole = asyncHandler(
  async (req: Request, res: Response) => {
    const user = await User.findById(req.params.id);
    if (!user) {
      (req as any).flash('error', 'User not found');
      return res.redirect('/admin/users');
    }
    const role = req.body.role as UserRole;
    if (!Object.values(UserRole).includes(role)) {
      (req as any).flash('error', 'Invalid role');
      return res.redirect('/admin/users');
    }
    user.role = role;
    await user.save();
    (req as any).flash('success', `Role updated to ${role}`);
    res.redirect('/admin/users');
  },
);

export const listEvents = asyncHandler(async (req: Request, res: Response) => {
  const page = parseInt((req.query.page as string) || '1', 10);
  const limit = 30;
  const filter: any = { deletedAt: null };
  if (req.query.status) filter.status = req.query.status;
  if (req.query.search) {
    filter.title = new RegExp(req.query.search as string, 'i');
  }

  const [events, total] = await Promise.all([
    Event.find(filter)
      .populate('creator', 'firstName lastName email')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit),
    Event.countDocuments(filter),
  ]);

  res.render('pages/admin/events', {
    title: 'All events',
    events,
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit),
    filters: {
      status: req.query.status || '',
      search: req.query.search || '',
    },
  });
});
