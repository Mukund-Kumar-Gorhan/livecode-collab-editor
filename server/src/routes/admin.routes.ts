import { Router } from 'express';
import { authenticate, requireAdmin } from '../middleware/auth.js';
import { adminLoginRateLimiter } from '../middleware/rateLimiter.js';
import { adminLogin } from '../controllers/auth.controller.js';
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
  getAdminLoginLogs,
} from '../controllers/admin.controller.js';

export const adminRouter = Router();

// Dedicated Admin Portal Login with Rate Limiting (public endpoint)
adminRouter.post('/login', adminLoginRateLimiter, adminLogin);

// Protect all following administration endpoints
adminRouter.use(authenticate, requireAdmin);

// Overview Telemetry & Metrics
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

// Audit Trail
adminRouter.get('/audit-logs', getAdminAuditLogs);

// Login History
adminRouter.get('/login-logs', getAdminLoginLogs);
