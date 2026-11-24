import { Request, Response, NextFunction } from 'express';
import { prisma } from '../config/prisma.js';
import { ApiError } from '../utils/errors.js';
import { kickUserFromAllCollab } from '../sockets/collab.js';

// ------------------------------------------------------------------------------
// Helper: Record Audit Log in Database
// ------------------------------------------------------------------------------
export const recordAuditLog = async (params: {
  adminId: string;
  action: string;
  targetType: string;
  targetId: string;
  details?: Record<string, any>;
}) => {
  try {
    return await prisma.auditLog.create({
      data: {
        adminId: params.adminId,
        action: params.action,
        targetType: params.targetType,
        targetId: params.targetId,
        details: params.details || undefined,
      },
    });
  } catch (error) {
    console.error('Failed to write database audit log:', error);
  }
};

// ------------------------------------------------------------------------------
// GET /api/admin/stats
// ------------------------------------------------------------------------------
export const getAdminStats = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const [totalUsers, totalRooms, runsToday, totalRuns, successfulRuns] = await Promise.all([
      prisma.user.count(),
      prisma.room.count(),
      prisma.executionLog.count({ where: { createdAt: { gte: startOfToday } } }),
      prisma.executionLog.count(),
      prisma.executionLog.count({ where: { status: 'SUCCESS' } }),
    ]);

    const successRate = totalRuns > 0 ? Math.round((successfulRuns / totalRuns) * 100) : 100;

    // Language Usage breakdown from real database rooms
    const allRooms = await prisma.room.findMany({ select: { language: true } });
    const languageCounts: Record<string, number> = {
      python: 0,
      javascript: 0,
      java: 0,
      cpp: 0,
      c: 0,
    };

    allRooms.forEach((r) => {
      const lang = r.language.toLowerCase();
      if (languageCounts[lang] !== undefined) {
        languageCounts[lang]++;
      } else {
        languageCounts[lang] = 1;
      }
    });

    const totalLangRooms = allRooms.length || 1;
    const languageUsage = (['python', 'javascript', 'java', 'cpp', 'c'] as const).map((lang) => ({
      language: lang,
      count: languageCounts[lang] || 0,
      percentage: Math.round(((languageCounts[lang] || 0) / totalLangRooms) * 100),
    }));

    // Last 7 days run series from database
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const runsLast7Days = [];
    const now = new Date();

    for (let i = 6; i >= 0; i--) {
      const dayStart = new Date(now);
      dayStart.setDate(dayStart.getDate() - i);
      dayStart.setHours(0, 0, 0, 0);

      const dayEnd = new Date(dayStart);
      dayEnd.setDate(dayEnd.getDate() + 1);

      const [dayRuns, daySuccess] = await Promise.all([
        prisma.executionLog.count({
          where: { createdAt: { gte: dayStart, lt: dayEnd } },
        }),
        prisma.executionLog.count({
          where: { status: 'SUCCESS', createdAt: { gte: dayStart, lt: dayEnd } },
        }),
      ]);

      const dateStr = dayStart.toISOString().split('T')[0];
      const dayLabel = days[dayStart.getDay()];

      runsLast7Days.push({
        date: dateStr,
        dayLabel,
        runs: dayRuns,
        successCount: daySuccess,
      });
    }

    // Active users right now (estimated from recent active sessions)
    const activeNow = await prisma.user.count({
      where: {
        lastLoginAt: {
          gte: new Date(Date.now() - 30 * 60 * 1000), // last 30 minutes
        },
      },
    });

    res.status(200).json({
      success: true,
      data: {
        totalUsers,
        totalRooms,
        runsToday,
        activeNow: Math.max(1, activeNow),
        successRate,
        languageUsage,
        runsLast7Days,
      },
    });
  } catch (error) {
    next(error);
  }
};

// ------------------------------------------------------------------------------
// GET /api/admin/users
// ------------------------------------------------------------------------------
export const getAdminUsers = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string) || 10));
    const search = ((req.query.search as string) || '').trim().toLowerCase();

    const whereClause = search
      ? {
          OR: [
            { name: { contains: search, mode: 'insensitive' as const } },
            { email: { contains: search, mode: 'insensitive' as const } },
          ],
        }
      : {};

    const [total, users] = await Promise.all([
      prisma.user.count({ where: whereClause }),
      prisma.user.findMany({
        where: whereClause,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          email: true,
          name: true,
          avatarColor: true,
          avatarUrl: true,
          isAdmin: true,
          isDisabled: true,
          lastLoginAt: true,
          createdAt: true,
          _count: {
            select: { ownedRooms: true },
          },
        },
      }),
    ]);

    const items = users.map((u) => ({
      id: u.id,
      email: u.email,
      name: u.name,
      avatarColor: u.avatarColor || null,
      avatarUrl: u.avatarUrl || null,
      isAdmin: Boolean(u.isAdmin),
      status: u.isDisabled ? ('DISABLED' as const) : ('ACTIVE' as const),
      lastLoginAt: u.lastLoginAt ? u.lastLoginAt.toISOString() : null,
      createdAt: u.createdAt.toISOString(),
      roomsCount: u._count?.ownedRooms || 0,
    }));

    res.status(200).json({
      success: true,
      data: {
        items,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1,
      },
    });
  } catch (error) {
    next(error);
  }
};

// ------------------------------------------------------------------------------
// PATCH /api/admin/users/:id/status
// ------------------------------------------------------------------------------
export const updateUserStatus = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const adminId = req.user!.id;

    if (id === adminId) {
      throw new ApiError('Cannot disable your own administrator account', 400, 'SELF_MODIFICATION_PROHIBITED');
    }

    if (status !== 'ACTIVE' && status !== 'DISABLED') {
      throw new ApiError('Invalid status. Must be ACTIVE or DISABLED', 400, 'INVALID_STATUS');
    }

    const targetUser = await prisma.user.findUnique({
      where: { id },
    });

    if (!targetUser) {
      throw new ApiError('User not found', 404, 'USER_NOT_FOUND');
    }

    const willDisable = status === 'DISABLED';

    // Last admin protection: cannot disable the last active admin
    if (willDisable && targetUser.isAdmin) {
      const activeAdminCount = await prisma.user.count({
        where: { isAdmin: true, isDisabled: false },
      });
      if (activeAdminCount <= 1) {
        throw new ApiError('Cannot disable the last active administrator', 400, 'LAST_ADMIN_PROTECTED');
      }
    }

    // Invalidate refresh token when disabled
    const updated = await prisma.user.update({
      where: { id },
      data: {
        isDisabled: willDisable,
        refreshToken: willDisable ? null : targetUser.refreshToken,
      },
    });

    // Close all live WebSockets immediately if disabled
    if (willDisable) {
      kickUserFromAllCollab(id);
    }

    await recordAuditLog({
      adminId,
      action: willDisable ? 'USER_DISABLED' : 'USER_ENABLED',
      targetType: 'USER',
      targetId: id,
      details: {
        targetEmail: targetUser.email,
        previousStatus: targetUser.isDisabled ? 'DISABLED' : 'ACTIVE',
        newStatus: status,
        refreshTokenRevoked: willDisable,
      },
    });

    res.status(200).json({
      success: true,
      message: `User status successfully updated to ${status}`,
      data: { id: updated.id, status },
    });
  } catch (error) {
    next(error);
  }
};

// ------------------------------------------------------------------------------
// PATCH /api/admin/users/:id/role
// ------------------------------------------------------------------------------
export const updateUserRole = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;
    const { isAdmin } = req.body;
    const adminId = req.user!.id;

    if (id === adminId) {
      throw new ApiError('Cannot modify your own administrator privileges', 400, 'SELF_MODIFICATION_PROHIBITED');
    }

    if (typeof isAdmin !== 'boolean') {
      throw new ApiError('isAdmin must be a boolean', 400, 'INVALID_INPUT');
    }

    const targetUser = await prisma.user.findUnique({
      where: { id },
    });

    if (!targetUser) {
      throw new ApiError('User not found', 404, 'USER_NOT_FOUND');
    }

    // Last admin protection: cannot revoke admin from the last active admin
    if (!isAdmin && targetUser.isAdmin) {
      const activeAdminCount = await prisma.user.count({
        where: { isAdmin: true, isDisabled: false },
      });
      if (activeAdminCount <= 1) {
        throw new ApiError('Cannot revoke admin privileges from the last active administrator', 400, 'LAST_ADMIN_PROTECTED');
      }
    }

    const updated = await prisma.user.update({
      where: { id },
      data: { isAdmin },
    });

    await recordAuditLog({
      adminId,
      action: isAdmin ? 'ADMIN_PROMOTED' : 'ADMIN_DEMOTED',
      targetType: 'USER',
      targetId: id,
      details: {
        targetEmail: targetUser.email,
        newRole: isAdmin ? 'ADMIN' : 'USER',
      },
    });

    res.status(200).json({
      success: true,
      message: isAdmin ? 'User promoted to Admin' : 'Admin privilege revoked',
      data: { id: updated.id, isAdmin: updated.isAdmin },
    });
  } catch (error) {
    next(error);
  }
};

// ------------------------------------------------------------------------------
// DELETE /api/admin/users/:id
// ------------------------------------------------------------------------------
export const deleteUser = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;
    const adminId = req.user!.id;

    if (id === adminId) {
      throw new ApiError('Cannot delete your own administrator account', 400, 'SELF_DELETION_PROHIBITED');
    }

    const targetUser = await prisma.user.findUnique({
      where: { id },
    });

    if (!targetUser) {
      throw new ApiError('User not found', 404, 'USER_NOT_FOUND');
    }

    // Last admin protection: cannot delete the last administrator
    if (targetUser.isAdmin) {
      const totalAdminCount = await prisma.user.count({
        where: { isAdmin: true },
      });
      if (totalAdminCount <= 1) {
        throw new ApiError('Cannot delete the last administrator', 400, 'LAST_ADMIN_PROTECTED');
      }
    }

    // Terminate any active sessions before deletion
    kickUserFromAllCollab(id);

    await prisma.user.delete({
      where: { id },
    });

    await recordAuditLog({
      adminId,
      action: 'USER_DELETED',
      targetType: 'USER',
      targetId: id,
      details: {
        deletedUserEmail: targetUser.email,
        deletedUserName: targetUser.name,
      },
    });

    res.status(200).json({
      success: true,
      message: 'User deleted successfully',
      data: { id },
    });
  } catch (error) {
    next(error);
  }
};

// ------------------------------------------------------------------------------
// GET /api/admin/rooms
// ------------------------------------------------------------------------------
export const getAdminRooms = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string) || 10));
    const search = ((req.query.search as string) || '').trim().toLowerCase();

    const whereClause = search
      ? {
          OR: [
            { name: { contains: search, mode: 'insensitive' as const } },
            { shortId: { contains: search, mode: 'insensitive' as const } },
            { description: { contains: search, mode: 'insensitive' as const } },
          ],
        }
      : {};

    const [total, rooms] = await Promise.all([
      prisma.room.count({ where: whereClause }),
      prisma.room.findMany({
        where: whereClause,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          owner: {
            select: {
              id: true,
              name: true,
              email: true,
              avatarColor: true,
              avatarUrl: true,
            },
          },
          _count: {
            select: { members: true },
          },
        },
      }),
    ]);

    const items = rooms.map((r) => ({
      id: r.id,
      shortId: r.shortId,
      name: r.name,
      language: r.language,
      description: r.description || null,
      ownerId: r.ownerId,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
      owner: r.owner,
      membersCount: r._count?.members || 1,
    }));

    res.status(200).json({
      success: true,
      data: {
        items,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1,
      },
    });
  } catch (error) {
    next(error);
  }
};

// ------------------------------------------------------------------------------
// DELETE /api/admin/rooms/:shortId
// ------------------------------------------------------------------------------
export const deleteAdminRoom = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { shortId } = req.params;
    const adminId = req.user!.id;

    const room = await prisma.room.findUnique({
      where: { shortId },
      select: { id: true, name: true, shortId: true },
    });

    if (!room) {
      throw new ApiError('Room not found', 404, 'ROOM_NOT_FOUND');
    }

    await prisma.room.delete({
      where: { shortId },
    });

    await recordAuditLog({
      adminId,
      action: 'ROOM_DELETED',
      targetType: 'ROOM',
      targetId: shortId,
      details: {
        roomName: room.name,
        shortId,
      },
    });

    res.status(200).json({
      success: true,
      message: `Room ${shortId} deleted successfully`,
    });
  } catch (error) {
    next(error);
  }
};

// ------------------------------------------------------------------------------
// GET /api/admin/runs (supports language filter including 'c')
// ------------------------------------------------------------------------------
export const getAdminRuns = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string) || 10));
    const language = (req.query.language as string) || '';
    const status = (req.query.status as string) || '';

    const whereClause: any = {};
    if (language && language !== 'all') {
      whereClause.language = language.toLowerCase();
    }
    if (status && status !== 'all') {
      whereClause.status = status;
    }

    const [total, logs] = await Promise.all([
      prisma.executionLog.count({ where: whereClause }),
      prisma.executionLog.findMany({
        where: whereClause,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          user: {
            select: { id: true, name: true, email: true },
          },
          room: {
            select: { name: true, shortId: true },
          },
        },
      }),
    ]);

    const items = logs.map((log) => ({
      id: log.id,
      roomId: log.roomId,
      roomName: log.room?.name,
      userId: log.userId,
      userEmail: log.user?.email,
      userName: log.user?.name,
      language: log.language,
      status: log.status,
      durationMs: 45,
      output: log.output,
      createdAt: log.createdAt.toISOString(),
    }));

    res.status(200).json({
      success: true,
      data: {
        items,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1,
      },
    });
  } catch (error) {
    next(error);
  }
};

// ------------------------------------------------------------------------------
// GET /api/admin/audit-logs (Database-backed)
// ------------------------------------------------------------------------------
export const getAdminAuditLogs = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string) || 15));

    const [total, logs] = await Promise.all([
      prisma.auditLog.count(),
      prisma.auditLog.findMany({
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          admin: {
            select: { id: true, name: true, email: true },
          },
        },
      }),
    ]);

    const items = logs.map((log) => ({
      id: log.id,
      timestamp: log.createdAt.toISOString(),
      adminId: log.adminId,
      adminEmail: log.admin?.email || 'System',
      adminName: log.admin?.name || null,
      action: log.action,
      targetType: log.targetType,
      targetId: log.targetId,
      details: typeof log.details === 'string' ? log.details : JSON.stringify(log.details || {}),
    }));

    res.status(200).json({
      success: true,
      data: {
        items,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1,
      },
    });
  } catch (error) {
    next(error);
  }
};

// ------------------------------------------------------------------------------
// GET /api/admin/login-logs (Database-backed Login History)
// ------------------------------------------------------------------------------
export const getAdminLoginLogs = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string) || 15));
    const search = ((req.query.search as string) || '').trim().toLowerCase();
    const status = (req.query.status as string) || 'all';

    const whereClause: any = {};
    if (search) {
      whereClause.email = { contains: search, mode: 'insensitive' };
    }
    if (status === 'success') {
      whereClause.success = true;
    } else if (status === 'failed') {
      whereClause.success = false;
    }

    const [total, logs] = await Promise.all([
      prisma.loginLog.count({ where: whereClause }),
      prisma.loginLog.findMany({
        where: whereClause,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          user: {
            select: { id: true, name: true, email: true, isAdmin: true },
          },
        },
      }),
    ]);

    const items = logs.map((log) => ({
      id: log.id,
      userId: log.userId,
      userName: log.user?.name || null,
      email: log.email,
      success: log.success,
      ip: log.ip,
      userAgent: log.userAgent,
      isAdmin: Boolean(log.user?.isAdmin),
      timestamp: log.createdAt.toISOString(),
    }));

    res.status(200).json({
      success: true,
      data: {
        items,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1,
      },
    });
  } catch (error) {
    next(error);
  }
};
