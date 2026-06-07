import jwt, { SignOptions } from 'jsonwebtoken';
import { User, UserDocument } from '../models/user.model';
import { config } from '../config';
import {
  ConflictError,
  UnauthorizedError,
  NotFoundError,
} from '../utils/errors';
import { UserRole } from '../utils/enums';

export interface RegisterInput {
  email: string;
  firstName: string;
  lastName: string;
  password: string;
  phoneNumber?: string;
  role?: UserRole;
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface JwtPayload {
  sub: string;
  email: string;
  role: UserRole;
}

class AuthService {
  async register(input: RegisterInput): Promise<UserDocument> {
    const existing = await User.findOne({
      email: input.email.toLowerCase(),
      deletedAt: null,
    });
    if (existing) {
      throw new ConflictError('A user with this email already exists');
    }

    const user = await User.create({
      email: input.email.toLowerCase(),
      firstName: input.firstName.trim(),
      lastName: input.lastName.trim(),
      password: input.password,
      phoneNumber: input.phoneNumber?.trim(),
      role: input.role || UserRole.EVENTEE,
    });

    return user;
  }

  async login(input: LoginInput): Promise<UserDocument> {
    const user = await User.findOne({
      email: input.email.toLowerCase(),
      deletedAt: null,
    }).select('+password');

    if (!user) {
      throw new UnauthorizedError('Invalid email or password');
    }

    const ok = await user.comparePassword(input.password);
    if (!ok) {
      throw new UnauthorizedError('Invalid email or password');
    }

    if (!user.isActive) {
      throw new UnauthorizedError('Account is deactivated');
    }

    return user;
  }

  async findById(id: string): Promise<UserDocument | null> {
    return User.findOne({ _id: id, deletedAt: null });
  }

  signToken(user: UserDocument): string {
    const payload: JwtPayload = {
      sub: user._id.toString(),
      email: user.email,
      role: user.role,
    };
    return jwt.sign(payload, config.jwt.secret, {
      expiresIn: config.jwt.expiresIn,
    } as SignOptions);
  }

  verifyToken(token: string): JwtPayload {
    return jwt.verify(token, config.jwt.secret) as JwtPayload;
  }
}

export const authService = new AuthService();
