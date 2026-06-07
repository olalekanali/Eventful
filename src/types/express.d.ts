import { UserRole } from '../utils/enums';

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
        firstName: string;
        lastName: string;
        role: UserRole;
      };
      csrfToken?: () => string;
    }
  }
}

declare module 'express-session' {
  interface SessionData {
    userId?: string;
    flash?: {
      success?: string[];
      error?: string[];
      info?: string[];
    };
  }
}

export {};
