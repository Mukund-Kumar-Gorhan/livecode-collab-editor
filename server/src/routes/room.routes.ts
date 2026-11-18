import { Router } from 'express';
import {
  createRoom,
  listUserRooms,
  getRoomByShortId,
  joinRoom,
  updateMemberRole,
  deleteRoom,
  runRoomCode,
} from '../controllers/room.controller.js';
import { authenticate } from '../middleware/auth.js';
import { runRateLimiter } from '../middleware/rateLimiter.js';

export const roomRouter = Router();

// All room routes are protected
roomRouter.use(authenticate);

roomRouter.post('/', createRoom);
roomRouter.get('/', listUserRooms);
roomRouter.get('/:shortId', getRoomByShortId);
roomRouter.post('/:shortId/join', joinRoom);
roomRouter.patch('/:shortId/members/:userId', updateMemberRole);
roomRouter.delete('/:shortId', deleteRoom);
roomRouter.post('/:shortId/run', runRateLimiter, runRoomCode);
