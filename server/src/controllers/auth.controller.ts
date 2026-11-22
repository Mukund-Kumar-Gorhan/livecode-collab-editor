import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from '../config/prisma.js';
import { config } from '../config/index.js';
import { ApiError } from '../utils/errors.js';
import {
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
} from '../utils/jwt.js';

const registerSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  email: z.string().email('Valid email is required').toLowerCase(),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  inviteCode: z.string().optional(),
});

const loginSchema = z.object({
  email: z.string().email('Valid email is required').toLowerCase(),
  password: z.string().min(1, 'Password is required'),
});

const REFRESH_COOKIE_NAME = 'refreshToken';
const REFRESH_COOKIE_MAX_AGE = 7 * 24 * 60 * 60 * 1000; // 7 days

const isSecureRequest = (req: Request): boolean => {
  return (
    process.env.NODE_ENV === 'production' ||
    req.secure ||
    req.headers['x-forwarded-proto'] === 'https'
  );
};

const getRefreshCookieOptions = (req: Request) => ({
  httpOnly: true,
  secure: isSecureRequest(req),
  sameSite: 'lax' as const,
  maxAge: REFRESH_COOKIE_MAX_AGE,
  path: '/',
});

const SAFE_AUTH_USER_SELECT = {
  id: true,
  name: true,
  email: true,
  bio: true,
  avatarColor: true,
  avatarUrl: true,
  theme: true,
  editorFontSize: true,
  defaultLanguage: true,
  tabSize: true,
  createdAt: true,
} as const;

export const register = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const validatedData = registerSchema.parse(req.body);

    const configuredCode = (config.registrationCode || '').trim();
    if (configuredCode) {
      const providedCode = (validatedData.inviteCode || '').trim();
      if (!providedCode || providedCode !== configuredCode) {
        throw new ApiError('Invalid or missing invite code', 403, 'INVALID_INVITE_CODE');
      }
    }

    const existingUser = await prisma.user.findUnique({
      where: { email: validatedData.email },
    });

    if (existingUser) {
      throw new ApiError('Email is already registered', 409, 'EMAIL_EXISTS');
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(validatedData.password, salt);

    const user = await prisma.user.create({
      data: {
        name: validatedData.name,
        email: validatedData.email,
        passwordHash,
      },
      select: SAFE_AUTH_USER_SELECT,
    });

    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      data: { user },
    });
  } catch (error) {
    next(error);
  }
};

export const login = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const validatedData = loginSchema.parse(req.body);

    const user = await prisma.user.findUnique({
      where: { email: validatedData.email },
    });

    if (!user) {
      throw new ApiError('Invalid email or password', 401, 'INVALID_CREDENTIALS');
    }

    const isMatch = await bcrypt.compare(validatedData.password, user.passwordHash);
    if (!isMatch) {
      throw new ApiError('Invalid email or password', 401, 'INVALID_CREDENTIALS');
    }

    const tokenPayload = { userId: user.id, email: user.email };
    const accessToken = generateAccessToken(tokenPayload);
    const refreshToken = generateRefreshToken(tokenPayload);

    await prisma.user.update({
      where: { id: user.id },
      data: { refreshToken },
    });

    res.cookie(REFRESH_COOKIE_NAME, refreshToken, getRefreshCookieOptions(req));

    res.status(200).json({
      success: true,
      message: 'Logged in successfully',
      data: {
        accessToken,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          bio: user.bio,
          avatarColor: user.avatarColor,
          avatarUrl: user.avatarUrl,
          theme: user.theme,
          editorFontSize: user.editorFontSize,
          defaultLanguage: user.defaultLanguage,
          tabSize: user.tabSize,
          createdAt: user.createdAt,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

export const refreshToken = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const token = req.cookies?.[REFRESH_COOKIE_NAME] || req.body?.refreshToken;

    if (!token) {
      throw new ApiError('Refresh token required', 401, 'UNAUTHORIZED');
    }

    let payload;
    try {
      payload = verifyRefreshToken(token);
    } catch {
      throw new ApiError('Invalid or expired refresh token', 401, 'UNAUTHORIZED');
    }

    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
    });

    if (!user || user.refreshToken !== token) {
      throw new ApiError('Refresh token revoked or invalid', 401, 'UNAUTHORIZED');
    }

    const newAccessToken = generateAccessToken({ userId: user.id, email: user.email });
    const newRefreshToken = generateRefreshToken({ userId: user.id, email: user.email });

    await prisma.user.update({
      where: { id: user.id },
      data: { refreshToken: newRefreshToken },
    });

    res.cookie(REFRESH_COOKIE_NAME, newRefreshToken, getRefreshCookieOptions(req));

    res.status(200).json({
      success: true,
      data: {
        accessToken: newAccessToken,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          bio: user.bio,
          avatarColor: user.avatarColor,
          avatarUrl: user.avatarUrl,
          theme: user.theme,
          editorFontSize: user.editorFontSize,
          defaultLanguage: user.defaultLanguage,
          tabSize: user.tabSize,
          createdAt: user.createdAt,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

export const logout = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const token = req.cookies?.[REFRESH_COOKIE_NAME] || req.body?.refreshToken;

    if (token) {
      try {
        const payload = verifyRefreshToken(token);
        await prisma.user.update({
          where: { id: payload.userId },
          data: { refreshToken: null },
        });
      } catch {
        // Continue even if token is already expired
      }
    }

    res.clearCookie(REFRESH_COOKIE_NAME, {
      httpOnly: true,
      secure: isSecureRequest(req),
      sameSite: 'lax',
      path: '/',
    });

    res.status(200).json({
      success: true,
      message: 'Logged out successfully',
    });
  } catch (error) {
    next(error);
  }
};

export const getAuthConfig = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const configuredCode = (config.registrationCode || '').trim();
    res.status(200).json({
      success: true,
      data: {
        inviteCodeRequired: Boolean(configuredCode),
      },
    });
  } catch (error) {
    next(error);
  }
};

export const getMe = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!req.user) {
      throw new ApiError('Unauthorized', 401, 'UNAUTHORIZED');
    }

    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: SAFE_AUTH_USER_SELECT,
    });

    if (!user) {
      throw new ApiError('User not found', 404, 'USER_NOT_FOUND');
    }

    res.status(200).json({
      success: true,
      data: { user },
    });
  } catch (error) {
    next(error);
  }
};
