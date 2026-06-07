import { Request, Response } from 'express';
import { asyncHandler } from '../utils/async-handler';
import { User } from '../models/user.model';
import { analyticsService } from '../services/analytics.service';
import { UserRole } from '../utils/enums';

/**
 * Dashboard is now creator/admin-only. Eventees don't have accounts.
 */
export const home = asyncHandler(async (req: Request, res: Response) => {
  const user = await User.findById(req.user!.id);
  if (!user) throw new Error('User not found');

  if (user.role === UserRole.ADMIN) {
    const platform = await analyticsService.getPlatformStats();
    return res.render('pages/dashboard/admin', {
      title: 'Admin dashboard',
      platform,
    });
  }

  if (user.role === UserRole.CREATOR) {
    const [overall, breakdown] = await Promise.all([
      analyticsService.getCreatorOverall(user),
      analyticsService.getCreatorEventBreakdown(user),
    ]);
    return res.render('pages/dashboard/creator', {
      title: 'Creator dashboard',
      overall,
      breakdown,
    });
  }

  // Shouldn't happen — but if an eventee account exists, redirect them home
  return res.redirect('/');
});
