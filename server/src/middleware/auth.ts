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

  const dbUser = await prisma.user.findUnique({
    where: { id: req.user.id },
    select: { id: true, isAdmin: true, isDisabled: true },
  });

  if (!dbUser || dbUser.isDisabled || !dbUser.isAdmin) {
    return next(new ApiError('Forbidden: Admin access required', 403, 'FORBIDDEN'));
  }

  req.user.isAdmin = true;
  next();
};


