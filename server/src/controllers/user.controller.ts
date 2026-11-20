import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import fs from 'fs';
import path from 'path';
import { prisma } from '../config/prisma.js';
import { ApiError } from '../utils/errors.js';

export const SAFE_USER_SELECT = {
  id: true,
  email: true,
  name: true,
  bio: true,
  avatarColor: true,
  avatarUrl: true,
  theme: true,
  editorFontSize: true,
  defaultLanguage: true,
  tabSize: true,
  createdAt: true,
  updatedAt: true,
} as const;

export const sanitizeUser = (user: any) => {
  if (!user) return null;
  const { passwordHash, refreshToken, ...safeUser } = user;
  return safeUser;
};

export const updateProfileSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, 'Name must be at least 2 characters')
    .max(50, 'Name must be at most 50 characters')
    .optional(),
  bio: z
    .string()
    .max(160, 'Bio must be at most 160 characters')
    .nullable()
    .optional(),
  avatarColor: z
    .string()
    .regex(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/, 'avatarColor must be a valid hex color (e.g. #0ea5e9)')
    .nullable()
    .optional(),
  theme: z
    .enum(['midnight', 'light', 'dracula', 'one-dark', 'cyberpunk'] as const)
    .optional(),
  editorFontSize: z
    .number()
    .int()
    .min(10, 'Font size must be at least 10')
    .max(24, 'Font size must be at most 24')
    .optional(),
  defaultLanguage: z
    .enum(['python', 'javascript', 'java', 'cpp'] as const)
    .optional(),
  tabSize: z
    .union([z.literal(2), z.literal(4), z.literal(8)])
    .optional(),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z.string().min(8, 'New password must be at least 8 characters long'),
});

const MAX_AVATAR_BYTES = 200 * 1024; // 200KB

const detectImageType = (buffer: Buffer): 'png' | 'jpg' | 'webp' | null => {
  if (buffer.length < 12) return null;

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47
  ) {
    return 'png';
  }

  // JPEG: FF D8 FF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return 'jpg';
  }

  // WebP: RIFF....WEBP
  if (
    buffer[0] === 0x52 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x46 &&
    buffer[8] === 0x57 &&
    buffer[9] === 0x45 &&
    buffer[10] === 0x42 &&
    buffer[11] === 0x50
  ) {
    return 'webp';
  }

  return null;
};

export const getMe = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!req.user) {
      throw new ApiError('Unauthorized', 401, 'UNAUTHORIZED');
    }

    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: SAFE_USER_SELECT,
    });

    if (!user) {
      throw new ApiError('User not found', 404, 'USER_NOT_FOUND');
    }

    res.status(200).json({
      success: true,
      data: { user: sanitizeUser(user) },
    });
  } catch (error) {
    next(error);
  }
};

export const updateMe = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!req.user) {
      throw new ApiError('Unauthorized', 401, 'UNAUTHORIZED');
    }

    const validatedData = updateProfileSchema.parse(req.body);

    const user = await prisma.user.update({
      where: { id: req.user.id },
      data: validatedData,
      select: SAFE_USER_SELECT,
    });

    res.status(200).json({
      success: true,
      message: 'Profile updated successfully',
      data: { user: sanitizeUser(user) },
    });
  } catch (error) {
    next(error);
  }
};

export const uploadAvatar = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!req.user) {
      throw new ApiError('Unauthorized', 401, 'UNAUTHORIZED');
    }

    let buffer: Buffer | null = null;

    if (Buffer.isBuffer(req.body)) {
      buffer = req.body;
    } else if (req.body?.avatar && typeof req.body.avatar === 'string') {
      const base64Data = req.body.avatar.replace(/^data:image\/\w+;base64,/, '');
      buffer = Buffer.from(base64Data, 'base64');
    }

    if (!buffer || buffer.length === 0) {
      throw new ApiError('No avatar image data provided', 400, 'AVATAR_REQUIRED');
    }

    if (buffer.length > MAX_AVATAR_BYTES) {
      throw new ApiError('Avatar size exceeds maximum limit of 200KB', 400, 'AVATAR_TOO_LARGE');
    }

    const ext = detectImageType(buffer);
    if (!ext) {
      throw new ApiError(
        'Invalid image format. Only PNG, JPEG, and WebP are allowed.',
        400,
        'INVALID_IMAGE_TYPE'
      );
    }

    const uploadsDir = path.join(process.cwd(), 'uploads', 'avatars');
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }

    const filename = `${req.user.id}-${Date.now()}.${ext}`;
    const filePath = path.join(uploadsDir, filename);

    // Remove old avatar file if present
    const existingUser = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { avatarUrl: true },
    });
    if (existingUser?.avatarUrl && existingUser.avatarUrl.startsWith('/uploads/avatars/')) {
      const oldFilename = path.basename(existingUser.avatarUrl);
      const oldFilePath = path.join(uploadsDir, oldFilename);
      if (fs.existsSync(oldFilePath)) {
        try {
          fs.unlinkSync(oldFilePath);
        } catch {
          // Ignore unlink errors
        }
      }
    }

    fs.writeFileSync(filePath, buffer);
    const avatarUrl = `/uploads/avatars/${filename}`;

    const user = await prisma.user.update({
      where: { id: req.user.id },
      data: { avatarUrl },
      select: SAFE_USER_SELECT,
    });

    res.status(200).json({
      success: true,
      message: 'Avatar uploaded successfully',
      data: { user: sanitizeUser(user) },
    });
  } catch (error) {
    next(error);
  }
};

export const deleteAvatar = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!req.user) {
      throw new ApiError('Unauthorized', 401, 'UNAUTHORIZED');
    }

    const existingUser = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { avatarUrl: true },
    });

    if (existingUser?.avatarUrl && existingUser.avatarUrl.startsWith('/uploads/avatars/')) {
      const uploadsDir = path.join(process.cwd(), 'uploads', 'avatars');
      const oldFilename = path.basename(existingUser.avatarUrl);
      const oldFilePath = path.join(uploadsDir, oldFilename);
      if (fs.existsSync(oldFilePath)) {
        try {
          fs.unlinkSync(oldFilePath);
        } catch {
          // Ignore unlink errors
        }
      }
    }

    const user = await prisma.user.update({
      where: { id: req.user.id },
      data: { avatarUrl: null },
      select: SAFE_USER_SELECT,
    });

    res.status(200).json({
      success: true,
      message: 'Avatar deleted successfully',
      data: { user: sanitizeUser(user) },
    });
  } catch (error) {
    next(error);
  }
};

export const changePassword = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!req.user) {
      throw new ApiError('Unauthorized', 401, 'UNAUTHORIZED');
    }

    const { currentPassword, newPassword } = changePasswordSchema.parse(req.body);

    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        id: true,
        passwordHash: true,
      },
    });

    if (!user) {
      throw new ApiError('User not found', 404, 'USER_NOT_FOUND');
    }

    const isMatch = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!isMatch) {
      throw new ApiError('Current password is incorrect', 400, 'INVALID_CURRENT_PASSWORD');
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(newPassword, salt);

    // Invalidate other sessions by setting refreshToken to null
    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        refreshToken: null,
      },
    });

    res.status(200).json({
      success: true,
      message: 'Password changed successfully. Active sessions have been invalidated.',
    });
  } catch (error) {
    next(error);
  }
};
