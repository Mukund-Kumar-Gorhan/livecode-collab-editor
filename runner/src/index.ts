import express, { Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import path from 'path';
import { z } from 'zod';
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

const executeSchema = z.object({
  language: z.enum(['python', 'javascript', 'java', 'cpp']),
  code: z
    .string()
    .min(1, 'Field "code" is required')
    .max(50 * 1024, 'Code size exceeds 50KB limit'),
});

/**
 * Health Check Endpoint
 */
app.get('/health', (_req: Request, res: Response) => {
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
 * Executes code inside isolated ephemeral Docker container.
 * Limits: --network=none --memory=128m --cpus=0.5 --pids-limit=64 --read-only --tmpfs /tmp --cap-drop=ALL
 */
app.post('/execute', async (req: Request, res: Response): Promise<void> => {
  const parseResult = executeSchema.safeParse(req.body);

  if (!parseResult.success) {
    const errorMsg = parseResult.error.issues?.[0]?.message || parseResult.error.message || 'Invalid execution request';
    res.status(400).json({
      error: errorMsg,
      details: parseResult.error.format ? parseResult.error.format() : parseResult.error.issues,
    });
    return;
  }

  const { language, code } = parseResult.data;

  try {
    const result = await executionQueue.enqueue({
      language,
      code,
    });

    res.status(200).json({
      stdout: result.stdout,
      stderr: result.stderr,
      exitCode: result.exitCode,
      durationMs: result.durationMs,
      timedOut: result.timedOut,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Execution failed';
    res.status(500).json({
      error: message,
      stdout: '',
      stderr: message,
      exitCode: 1,
      durationMs: 0,
      timedOut: false,
    });
  }
});

app.listen(PORT, HOST, () => {
  console.log(`[Runner] Sandboxed execution service running on http://${HOST}:${PORT}`);
  console.log(`[Runner] Health check: http://${HOST}:${PORT}/health`);
  console.log(`[Runner] Execute endpoint: POST http://${HOST}:${PORT}/execute`);
});
