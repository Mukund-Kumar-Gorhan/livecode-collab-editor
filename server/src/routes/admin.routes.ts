import { Router } from 'express';
import { authenticate, requireAdmin } from '../middleware/auth.js';
import {
  getAdminStats,
  getAdminUsers,
  updateUserStatus,
  updateUserRole,
  deleteUser,
  getAdminRooms,
  deleteAdminRoom,
  getAdminRuns,
  getAdminAuditLogs,
} from '../controllers/admin.controller.js';

export const adminRouter = Router();

// Protect all admin routes with authentication and requireAdmin middleware
adminRouter.use(authenticate, requireAdmin);

// Overview Stats
adminRouter.get('/stats', getAdminStats);

// Users management
adminRouter.get('/users', getAdminUsers);
adminRouter.patch('/users/:id/status', updateUserStatus);
adminRouter.patch('/users/:id/role', updateUserRole);
adminRouter.delete('/users/:id', deleteUser);

// Rooms management
adminRouter.get('/rooms', getAdminRooms);
adminRouter.delete('/rooms/:shortId', deleteAdminRoom);

// Run Logs
adminRouter.get('/runs', getAdminRuns);

// Audit Logs
adminRouter.get('/audit-logs', getAdminAuditLogs);
