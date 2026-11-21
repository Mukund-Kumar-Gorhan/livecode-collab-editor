import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../config/prisma.js';
import { ApiError } from '../utils/errors.js';
import { generateShortId } from '../utils/nanoid.js';
import { config } from '../config/index.js';
import { getOrCreateDoc, getDefaultFileName } from '../sockets/collab.js';

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

export const detectLanguageFromFilename = (filename: string): 'python' | 'javascript' | 'java' | 'cpp' | null => {
  const ext = filename.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'py':
      return 'python';
    case 'js':
    case 'mjs':
    case 'cjs':
      return 'javascript';
    case 'java':
      return 'java';
    case 'cpp':
    case 'cc':
    case 'cxx':
    case 'c':
    case 'h':
    case 'hpp':
      return 'cpp';
    default:
      return null;
  }
};

/**
 * POST /api/rooms/:shortId/run
 * JWT protected. Executes the room's current active file code from Y.Doc in the Docker sandbox runner.
 * Allowed roles: OWNER, EDITOR. Role VIEWER returns 403 Forbidden.
 */
export const runRoomCode = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!req.user) {
      throw new ApiError('Unauthorized', 401, 'UNAUTHORIZED');
    }

    const { shortId } = req.params;

    const runSchema = z.object({
      activeFile: z.string().optional(),
      stdin: z.string().max(10 * 1024, 'Stdin input exceeds 10KB limit').optional(),
    });

    const parsedBody = runSchema.safeParse(req.body || {});
    if (!parsedBody.success) {
      const errorMsg = parsedBody.error.issues?.[0]?.message || 'Invalid run parameters';
      throw new ApiError(errorMsg, 400, 'VALIDATION_ERROR');
    }
    const { activeFile } = parsedBody.data;

    const room = await prisma.room.findUnique({
      where: { shortId },
      include: {
        members: true,
      },
    });

    if (!room) {
      throw new ApiError('Room not found', 404, 'ROOM_NOT_FOUND');
    }

    // Role check: OWNER or EDITOR allowed. VIEWER rejected with 403.
    let userRole: 'OWNER' | 'EDITOR' | 'VIEWER' | null = null;
    if (room.ownerId === req.user.id) {
      userRole = 'OWNER';
    } else {
      const member = room.members.find((m) => m.userId === req.user?.id);
      if (member) {
        userRole = member.role;
      }
    }

    if (!userRole) {
      throw new ApiError('You are not a member of this room', 403, 'FORBIDDEN');
    }

    if (userRole === 'VIEWER') {
      throw new ApiError('Viewers are not permitted to run code', 403, 'FORBIDDEN');
    }

    // Read files and metadata from server Y.Doc
    const doc = await getOrCreateDoc(shortId, room);
    const filesMap = doc.getMap('files');
    const metadataMap = doc.getMap('metadata');

    let language: string = (metadataMap.get('language') as string) || room.language || 'python';
    let entry: string = (metadataMap.get('entryFile') as string) || '';

    // Determine stdin (from request body or fallback to metadataMap.get('stdin'))
    let stdin = parsedBody.data.stdin;
    if (typeof stdin !== 'string') {
      const metaStdin = metadataMap.get('stdin');
      stdin = typeof metaStdin === 'string' ? metaStdin : '';
    }
    if (Buffer.byteLength(stdin, 'utf-8') > 10 * 1024) {
      throw new ApiError('Stdin input exceeds 10KB limit', 400, 'VALIDATION_ERROR');
    }

    // Prepare files array
    let files: Array<{ path: string; content: string }> = [];
    if (filesMap.size > 0) {
      files = Array.from(filesMap.entries()).map(([filePath, ytext]) => ({
        path: filePath,
        content: ytext && typeof (ytext as any).toString === 'function' ? (ytext as any).toString() : '',
      }));
    } else {
      // Fallback: legacy single-file
      const legacyCode = doc.getText('monaco').toString();
      const defaultFilename = getDefaultFileName(room.language);
      files = [{ path: defaultFilename, content: legacyCode }];
      entry = defaultFilename;
    }

    // If activeFile is explicitly provided, validate it exists and is supported
    if (activeFile && typeof activeFile === 'string') {
      const fileYText = filesMap.get(activeFile) as any;
      if (!fileYText || typeof fileYText.toString !== 'function') {
        throw new ApiError(`Active file "${activeFile}" not found in workspace`, 404, 'FILE_NOT_FOUND');
      }

      const activeLang = detectLanguageFromFilename(activeFile);
      if (!activeLang) {
        throw new ApiError(
          `File "${activeFile}" cannot be executed. Supported execution languages: Python, JavaScript, Java, C++`,
          400,
          'UNSUPPORTED_LANGUAGE'
        );
      }

      const entryLang = entry && filesMap.has(entry) ? detectLanguageFromFilename(entry) : null;

      // If no valid entryFile, or entryFile language doesn't match activeFile language, use language-appropriate entry
      if (!entry || !filesMap.has(entry) || entryLang !== activeLang) {
        const defaultNamesByLang: Record<string, string[]> = {
          python: ['main.py'],
          javascript: ['index.js', 'main.js'],
          java: ['Main.java'],
          cpp: ['main.cpp', 'main.c'],
        };
        const langDefaults = defaultNamesByLang[activeLang] || [];
        const langEntryMatched = files.find((f) => langDefaults.includes(f.path.split('/').pop() || ''));
        entry = langEntryMatched ? langEntryMatched.path : activeFile;
        language = activeLang;
      } else {
        language = entryLang;
      }
    }

    // Auto-detect entry file if still not selected or if configured entry file was deleted
    if (!entry || !files.some((f) => f.path === entry)) {
      const defaultEntryNames = ['Main.java', 'main.cpp', 'main.c', 'main.py', 'index.js'];
      const matched = files.find((f) => defaultEntryNames.includes(f.path.split('/').pop() || ''));
      if (matched) {
        entry = matched.path;
      } else if (activeFile && files.some((f) => f.path === activeFile)) {
        entry = activeFile;
      } else {
        // Find first executable file
        const firstExec = files.find((f) => detectLanguageFromFilename(f.path) !== null);
        entry = firstExec ? firstExec.path : files[0].path;
      }
    }

    // Detect language from entry file
    const detectedEntryLang = detectLanguageFromFilename(entry);
    if (detectedEntryLang) {
      language = detectedEntryLang;
    }

    if (!['python', 'javascript', 'java', 'cpp'].includes(language)) {
      throw new ApiError(
        `Language for file "${entry || 'file'}" is not supported for execution. Supported languages: Python, JavaScript, Java, C++`,
        400,
        'UNSUPPORTED_LANGUAGE'
      );
    }

    // Primary entry code for backwards compatibility
    const entryFileObj = files.find((f) => f.path === entry);
    const code = entryFileObj ? entryFileObj.content : '';

    // Dispatch execution to Runner service
    let runnerResult: {
      stdout: string;
      stderr: string;
      exitCode: number | null;
      durationMs: number;
      timedOut: boolean;
    };

    try {
      const runnerRes = await fetch(`${config.runnerUrl}/execute`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-runner-secret': config.runnerSecret,
        },
        body: JSON.stringify({ language, files, entry, code, stdin }),
      });

      if (!runnerRes.ok) {
        const errorBody = (await runnerRes.json().catch(() => ({}))) as { error?: string };
        throw new ApiError(errorBody.error || 'Runner execution failed', runnerRes.status, 'RUNNER_ERROR');
      }

      runnerResult = (await runnerRes.json()) as typeof runnerResult;
    } catch (fetchErr: unknown) {
      if (fetchErr instanceof ApiError) throw fetchErr;
      const msg = fetchErr instanceof Error ? fetchErr.message : 'Failed to reach Runner service';
      throw new ApiError(`Runner service error: ${msg}`, 502, 'RUNNER_UNAVAILABLE');
    }

    // Determine execution log status
    let status: 'SUCCESS' | 'ERROR' | 'TIMEOUT' = 'SUCCESS';
    if (runnerResult.timedOut) {
      status = 'TIMEOUT';
    } else if (runnerResult.exitCode !== 0) {
      status = 'ERROR';
    }

    const combinedOutput = [
      runnerResult.stdout ? runnerResult.stdout.trimEnd() : '',
      runnerResult.stderr ? runnerResult.stderr.trimEnd() : '',
    ]
      .filter(Boolean)
      .join('\n');

    // Save in ExecutionLog table
    await prisma.executionLog.create({
      data: {
        roomId: room.id,
        userId: req.user.id,
        language,
        status,
        output: combinedOutput,
      },
    });

    // Write result to Y.Doc Y.Map("run") so all connected clients observe it in real time
    const runBy = req.user.email.split('@')[0] || 'User';
    const runPayload = {
      stdout: runnerResult.stdout,
      stderr: runnerResult.stderr,
      exitCode: runnerResult.exitCode,
      durationMs: runnerResult.durationMs,
      timedOut: runnerResult.timedOut,
      stdin: stdin || undefined,
      runBy,
      runById: req.user.id,
      timestamp: Date.now(),
    };

    doc.getMap('run').set('latest', runPayload);

    res.status(200).json({
      success: true,
      message: 'Code executed successfully',
      data: runPayload,
    });
  } catch (error) {
    next(error);
  }
};
