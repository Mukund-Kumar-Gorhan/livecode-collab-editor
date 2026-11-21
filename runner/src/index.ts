import express, { Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import path from 'path';
import { z } from 'zod';
import { executionQueue } from './queue/executionQueue.js';
import { SUPPORTED_LANGUAGES } from './languages/config.js';
import { MAX_FILES, MAX_FILE_SIZE_BYTES, MAX_TOTAL_SIZE_BYTES } from './executor/dockerExecutor.js';

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env') });
dotenv.config();

const app = express();
const PORT = parseInt(process.env.RUNNER_PORT || '4000', 10);
const HOST = process.env.RUNNER_HOST || '0.0.0.0';
const RUNNER_SECRET = process.env.RUNNER_SECRET || 'dev_runner_secret_key_change_me_in_production';

app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '10mb' }));

const fileEntrySchema = z.object({
  path: z.string().min(1, 'Path is required').max(255),
  content: z.string(),
});

const executeSchema = z
  .object({
    language: z.enum(['python', 'javascript', 'java', 'cpp']),
    files: z.array(fileEntrySchema).max(MAX_FILES).optional(),
    entry: z.string().min(1).max(255).optional(),
    code: z.string().optional(),
    stdin: z.string().max(10 * 1024, 'Stdin input exceeds 10KB limit').optional(),
  })
  .refine(
    (data) => (data.files && data.files.length > 0) || (typeof data.code === 'string' && data.code.length > 0),
    {
      message: 'Either files (array) or code (string) is required for execution',
    }
  );

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
 * Security: Shared secret header x-runner-secret is strictly required.
 */
app.post('/execute', async (req: Request, res: Response): Promise<void> => {
  // Runner security check: x-runner-secret header
  const secretHeader = req.headers['x-runner-secret'];
  if (!secretHeader || secretHeader !== RUNNER_SECRET) {
    res.status(401).json({
      error: 'Unauthorized: Invalid or missing runner secret',
    });
    return;
  }

  const parseResult = executeSchema.safeParse(req.body);

  if (!parseResult.success) {
    const errorMsg =
      parseResult.error.issues?.[0]?.message || parseResult.error.message || 'Invalid execution request';
    res.status(400).json({
      error: errorMsg,
      details: parseResult.error.format ? parseResult.error.format() : parseResult.error.issues,
    });
    return;
  }

  const { language, files, entry, code, stdin } = parseResult.data;

  // File size and count validations
  if (files && files.length > 0) {
    if (files.length > MAX_FILES) {
      res.status(400).json({
        error: `Exceeded maximum file count limit of ${MAX_FILES} (received ${files.length})`,
      });
      return;
    }

    let totalBytes = 0;
    for (const f of files) {
      const size = Buffer.byteLength(f.content || '', 'utf-8');
      if (size > MAX_FILE_SIZE_BYTES) {
        res.status(400).json({
          error: `File "${f.path}" size exceeds 200KB limit (${Math.round(size / 1024)}KB)`,
        });
        return;
      }
      totalBytes += size;
    }

    if (totalBytes > MAX_TOTAL_SIZE_BYTES) {
      res.status(400).json({
        error: `Total project files size (${(totalBytes / (1024 * 1024)).toFixed(2)}MB) exceeds 2MB limit`,
      });
      return;
    }
  }

  try {
    const result = await executionQueue.enqueue({
      language,
      files,
      entry,
      code,
      stdin,
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

if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, HOST, () => {
    console.log(`[Runner] Sandboxed execution service running on http://${HOST}:${PORT}`);
    console.log(`[Runner] Health check: http://${HOST}:${PORT}/health`);
    console.log(`[Runner] Execute endpoint: POST http://${HOST}:${PORT}/execute`);
  });
}

export { app };
