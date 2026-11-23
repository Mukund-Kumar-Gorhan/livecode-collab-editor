import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { config } from './config/index.js';
import { errorHandler } from './middleware/errorHandler.js';
import { authRouter } from './routes/auth.routes.js';
import { roomRouter } from './routes/room.routes.js';
import { userRouter } from './routes/user.routes.js';
import { adminRouter } from './routes/admin.routes.js';
import path from 'path';

export const app = express();

// Trust reverse proxy (Vite dev server proxy, Cloudflare tunnel, etc.)
app.set('trust proxy', 1);

// Security and utility middleware
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}));
app.use(
  cors({
    origin: config.clientOrigin,
    credentials: true,
  })
);
app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static uploaded files (avatars, etc.)
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

// Health Check Route
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    service: 'collab-editor-server',
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.floor(process.uptime()),
    environment: config.env,
  });
});

// Runner Health Proxy (Runner is never directly exposed to the public internet)
const runnerHealthHandler = async (_req: express.Request, res: express.Response) => {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3500);
    const runnerRes = await fetch(`${config.runnerUrl}/health`, {
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!runnerRes.ok) {
      return res.status(runnerRes.status).json({
        status: 'error',
        message: 'Runner returned non-ok status',
      });
    }

    const data = await runnerRes.json();
    return res.status(200).json(data);
  } catch (error: any) {
    return res.status(503).json({
      status: 'unavailable',
      message: error?.message || 'Runner service unreachable',
    });
  }
};

app.get('/api/runner/health', runnerHealthHandler);
app.get('/health/runner', runnerHealthHandler);

// API Routes
app.use('/api/auth', authRouter);
app.use('/api/rooms', roomRouter);
app.use('/api/users', userRouter);
app.use('/api/admin', adminRouter);

// Centralized error handling
app.use(errorHandler);

