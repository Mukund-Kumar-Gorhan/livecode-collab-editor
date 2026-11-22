import { Router } from 'express';
import {
  register,
  login,
  refreshToken,
  logout,
  getMe,
  getAuthConfig,
} from '../controllers/auth.controller.js';
import { authenticate } from '../middleware/auth.js';
import { authRateLimiter } from '../middleware/rateLimiter.js';

export const authRouter = Router();

authRouter.get('/config', getAuthConfig);
authRouter.post('/register', authRateLimiter, register);
authRouter.post('/login', authRateLimiter, login);
authRouter.post('/refresh', refreshToken);
authRouter.post('/logout', logout);
authRouter.get('/me', authenticate, getMe);
