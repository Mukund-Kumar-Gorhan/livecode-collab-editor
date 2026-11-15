import { Router } from 'express';
import {
  createRoom,
  listUserRooms,
  getRoomByShortId,
  joinRoom,
  updateMemberRole,
  deleteRoom,
} from '../controllers/room.controller.js';
import { authenticate } from '../middleware/auth.js';

export const roomRouter = Router();

// All room routes are protected
roomRouter.use(authenticate);

roomRouter.post('/', createRoom);
roomRouter.get('/', listUserRooms);
roomRouter.get('/:shortId', getRoomByShortId);
roomRouter.post('/:shortId/join', joinRoom);
roomRouter.patch('/:shortId/members/:userId', updateMemberRole);
roomRouter.delete('/:shortId', deleteRoom);
