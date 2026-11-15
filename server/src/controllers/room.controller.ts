import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../config/prisma.js';
import { ApiError } from '../utils/errors.js';
import { generateShortId } from '../utils/nanoid.js';

const createRoomSchema = z.object({
  name: z.string().min(1, 'Room name is required').max(100),
  language: z.enum(['python', 'javascript', 'java', 'cpp']).optional().default('python'),
  description: z.string().max(500).optional(),
});

const updateRoleSchema = z.object({
  role: z.enum(['EDITOR', 'VIEWER']),
});

export const createRoom = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!req.user) {
      throw new ApiError('Unauthorized', 401, 'UNAUTHORIZED');
    }

    const validatedData = createRoomSchema.parse(req.body);
    const shortId = generateShortId();

    const room = await prisma.room.create({
      data: {
        shortId,
        name: validatedData.name,
        language: validatedData.language,
        description: validatedData.description,
        ownerId: req.user.id,
        members: {
          create: {
            userId: req.user.id,
            role: 'OWNER',
          },
        },
      },
      include: {
        owner: {
          select: { id: true, name: true, email: true },
        },
        members: {
          include: {
            user: {
              select: { id: true, name: true, email: true },
            },
          },
        },
      },
    });

    res.status(201).json({
      success: true,
      message: 'Room created successfully',
      data: {
        room,
        role: 'OWNER',
      },
    });
  } catch (error) {
    next(error);
  }
};

export const listUserRooms = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!req.user) {
      throw new ApiError('Unauthorized', 401, 'UNAUTHORIZED');
    }

    const memberships = await prisma.roomMember.findMany({
      where: { userId: req.user.id },
      include: {
        room: {
          include: {
            owner: {
              select: { id: true, name: true, email: true },
            },
            _count: {
              select: { members: true },
            },
          },
        },
      },
      orderBy: {
        joinedAt: 'desc',
      },
    });

    const rooms = memberships.map((m) => ({
      ...m.room,
      role: m.role,
    }));

    res.status(200).json({
      success: true,
      data: { rooms },
    });
  } catch (error) {
    next(error);
  }
};

export const getRoomByShortId = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!req.user) {
      throw new ApiError('Unauthorized', 401, 'UNAUTHORIZED');
    }

    const { shortId } = req.params;

    const room = await prisma.room.findUnique({
      where: { shortId },
      include: {
        owner: {
          select: { id: true, name: true, email: true },
        },
        members: {
          include: {
            user: {
              select: { id: true, name: true, email: true, avatarUrl: true },
            },
          },
        },
      },
    });

    if (!room) {
      throw new ApiError('Room not found', 404, 'ROOM_NOT_FOUND');
    }

    const currentMember = room.members.find((m) => m.userId === req.user?.id);
    const myRole = currentMember ? currentMember.role : (room.ownerId === req.user.id ? 'OWNER' : null);

    res.status(200).json({
      success: true,
      data: {
        room,
        role: myRole,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const joinRoom = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!req.user) {
      throw new ApiError('Unauthorized', 401, 'UNAUTHORIZED');
    }

    const { shortId } = req.params;

    const room = await prisma.room.findUnique({
      where: { shortId },
      include: {
        members: true,
      },
    });

    if (!room) {
      throw new ApiError('Room not found', 404, 'ROOM_NOT_FOUND');
    }

    const existingMember = room.members.find((m) => m.userId === req.user?.id);

    if (existingMember) {
      res.status(200).json({
        success: true,
        message: 'Already a member of this room',
        data: {
          room,
          role: existingMember.role,
        },
      });
      return;
    }

    const newMember = await prisma.roomMember.create({
      data: {
        roomId: room.id,
        userId: req.user.id,
        role: 'EDITOR',
      },
      include: {
        user: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    res.status(200).json({
      success: true,
      message: 'Joined room successfully',
      data: {
        room,
        role: 'EDITOR',
        member: newMember,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const updateMemberRole = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!req.user) {
      throw new ApiError('Unauthorized', 401, 'UNAUTHORIZED');
    }

    const { shortId, userId } = req.params;
    const validated = updateRoleSchema.parse(req.body);

    const room = await prisma.room.findUnique({
      where: { shortId },
    });

    if (!room) {
      throw new ApiError('Room not found', 404, 'ROOM_NOT_FOUND');
    }

    if (room.ownerId !== req.user.id) {
      throw new ApiError('Only room owner can change member roles', 403, 'FORBIDDEN');
    }

    const targetMember = await prisma.roomMember.findUnique({
      where: {
        roomId_userId: {
          roomId: room.id,
          userId,
        },
      },
    });

    if (!targetMember) {
      throw new ApiError('Member not found in room', 404, 'MEMBER_NOT_FOUND');
    }

    if (userId === room.ownerId) {
      throw new ApiError('Cannot change the role of the room owner', 400, 'CANNOT_CHANGE_OWNER_ROLE');
    }

    const updatedMember = await prisma.roomMember.update({
      where: {
        roomId_userId: {
          roomId: room.id,
          userId,
        },
      },
      data: {
        role: validated.role,
      },
      include: {
        user: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    res.status(200).json({
      success: true,
      message: 'Member role updated successfully',
      data: {
        member: updatedMember,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const deleteRoom = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!req.user) {
      throw new ApiError('Unauthorized', 401, 'UNAUTHORIZED');
    }

    const { shortId } = req.params;

    const room = await prisma.room.findUnique({
      where: { shortId },
    });

    if (!room) {
      throw new ApiError('Room not found', 404, 'ROOM_NOT_FOUND');
    }

    if (room.ownerId !== req.user.id) {
      throw new ApiError('Only room owner can delete the room', 403, 'FORBIDDEN');
    }

    await prisma.room.delete({
      where: { id: room.id },
    });

    res.status(200).json({
      success: true,
      message: 'Room deleted successfully',
    });
  } catch (error) {
    next(error);
  }
};
