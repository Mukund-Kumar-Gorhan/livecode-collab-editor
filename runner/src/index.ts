import express, { Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import path from 'path';
import { executionQueue } from './queue/executionQueue.js';
import { SUPPORTED_LANGUAGES } from './languages/config.js';

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env') });
dotenv.config();

const app = express();
const PORT = parseInt(process.env.RUNNER_PORT || '4000', 10);
const HOST = process.env.RUNNER_HOST || '0.0.0.0';

app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '1mb' }));

/**
 * Health Check Endpoint
 */
app.get('/health', (req: Request, res: Response) => {
  res.status(200).json({
    status: 'ok',
    service: 'collab-editor-runner',
    supportedLanguages: Object.keys(SUPPORTED_LANGUAGES),
    queue: executionQueue.getStats(),
    timestamp: new Date().toISOString(),
  });
});

/**
 * POST /execute
 * Stub execution endpoint simulating Docker sandbox runner.
 * Planned constraints: --network=none --memory=128m --cpus=0.5 --pids-limit=64, 5s timeout, non-root user.
 */
app.post('/execute', async (req: Request, res: Response): Promise<void> => {
  const { language, code, stdin } = req.body;

  if (!language || typeof code !== 'string') {
    res.status(400).json({
      success: false,
      error: 'Invalid request body. Fields "language" and "code" are required.',
    });
    return;
  }

  try {
    const result = await executionQueue.enqueue({
      language,
      code,
      stdin,
    });

    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown execution failure';
    res.status(500).json({
      success: false,
      error: message,
    });
  }
});

app.listen(PORT, HOST, () => {
  console.log(`[Runner] Sandboxed execution service running on http://${HOST}:${PORT}`);
  console.log(`[Runner] Health check: http://${HOST}:${PORT}/health`);
  console.log(`[Runner] Execute endpoint: POST http://${HOST}:${PORT}/execute`);
});

