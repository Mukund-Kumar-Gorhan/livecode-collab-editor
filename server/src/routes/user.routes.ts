import { Router } from 'express';
import express from 'express';
import {
  getMe,
  updateMe,
  uploadAvatar,
  deleteAvatar,
  changePassword,
} from '../controllers/user.controller.js';
import { authenticate } from '../middleware/auth.js';
import { profileRateLimiter } from '../middleware/rateLimiter.js';

export const userRouter = Router();

// Body parser for raw image binary upload up to 250KB
const rawImageParser = express.raw({
  type: ['image/png', 'image/jpeg', 'image/webp', 'application/octet-stream'],
  limit: '250kb',
});

userRouter.get('/me', authenticate, getMe);
userRouter.patch('/me', authenticate, profileRateLimiter, updateMe);
userRouter.post('/me/avatar', authenticate, profileRateLimiter, rawImageParser, uploadAvatar);
userRouter.delete('/me/avatar', authenticate, profileRateLimiter, deleteAvatar);
userRouter.patch('/me/password', authenticate, profileRateLimiter, changePassword);
