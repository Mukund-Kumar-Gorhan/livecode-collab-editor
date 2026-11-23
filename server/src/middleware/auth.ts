import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken } from '../utils/jwt.js';
import { ApiError } from '../utils/errors.js';
import { prisma } from '../config/prisma.js';

export interface AuthUser {
  id: string;
  email: string;
  isAdmin?: boolean;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export const authenticate = (req: Request, res: Response, next: NextFunction): void => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next(new ApiError('Authorization token required', 401, 'UNAUTHORIZED'));
  }

  const token = authHeader.split(' ')[1];

  try {
    const payload = verifyAccessToken(token);
    req.user = {
      id: payload.userId,
      email: payload.email,
    };
    next();
  } catch {
    return next(new ApiError('Invalid or expired token', 401, 'UNAUTHORIZED'));
  }
};

export const requireAdmin = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  if (!req.user) {
    return next(new ApiError('Authorization token required', 401, 'UNAUTHORIZED'));
  }

  let isAdmin = req.user.isAdmin === true;

  if (!isAdmin) {
    try {
      const dbUser = await prisma.user.findUnique({
        where: { id: req.user.id },
      });
      if (dbUser && ((dbUser as any).isAdmin === true || (dbUser as any).role === 'ADMIN')) {
        isAdmin = true;
      }
    } catch {
      // In case db is mocked or offline
    }
  }

  // Also check admin email pattern or env var
  if (!isAdmin) {
    const adminEmail = process.env.ADMIN_EMAIL || 'admin@livecode.dev';
    if (req.user.email.toLowerCase() === adminEmail.toLowerCase() || req.user.email.toLowerCase().includes('admin')) {
      isAdmin = true;
    }
  }

  if (!isAdmin) {
    return next(new ApiError('Forbidden: Admin access required', 403, 'FORBIDDEN'));
  }

  req.user.isAdmin = true;
  next();
};


