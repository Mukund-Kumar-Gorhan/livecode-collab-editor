import { spawn, spawnSync } from 'child_process';
import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { SUPPORTED_LANGUAGES } from '../languages/config.js';

export interface ExecuteOptions {
  language: 'python' | 'javascript' | 'java' | 'cpp';
  code: string;
  timeoutMs?: number;
}

export interface ExecutionResult {
  stdout: string;
  stderr: string;
  exitCode: number | null;
  durationMs: number;
  timedOut: boolean;
}

const MAX_OUTPUT_BYTES = 64 * 1024; // 64KB limit
const DEFAULT_TIMEOUT_MS = 5000; // 5 seconds

export class DockerExecutor {
  async execute(options: ExecuteOptions): Promise<ExecutionResult> {
    const startTime = Date.now();
    const timeoutMs = options.timeoutMs || DEFAULT_TIMEOUT_MS;
    const langConfig = SUPPORTED_LANGUAGES[options.language];

    if (!langConfig) {
      return {
        stdout: '',
        stderr: `Unsupported language: "${options.language}". Supported: python, javascript, java, cpp`,
        exitCode: 1,
        durationMs: 0,
        timedOut: false,
      };
    }

    // Determine filename & class name for Java
    let filename = `main.${langConfig.fileExtension}`;
    let className = 'Main';

    if (options.language === 'java') {
      const match = options.code.match(/public\s+class\s+([A-Za-z0-9_]+)/);
      if (match && match[1]) {
        className = match[1];
      }
      filename = `${className}.java`;
    }

    // Create unique ephemeral directory on host for this execution
    const runId = `exec_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    const tempDir = path.resolve(process.cwd(), '.temp_sandboxes', runId);
    const containerName = `collab_sandbox_${runId}`;

    await fs.mkdir(tempDir, { recursive: true });
    const filePath = path.join(tempDir, filename);
    await fs.writeFile(filePath, options.code, 'utf-8');

    const runArgs = langConfig.getRunArgs(filename, className);

    // Build docker run command with strict security flags:
    // --network=none --memory=128m --cpus=0.5 --pids-limit=64 --read-only
    // --tmpfs /tmp:exec --cap-drop=ALL --security-opt no-new-privileges --rm
    const dockerArgs = [
      'run',
      '--name', containerName,
      '--rm',
      '--network=none',
      '--memory=128m',
      '--cpus=0.5',
      '--pids-limit=64',
      '--read-only',
      '--tmpfs', '/tmp:exec',
      '--cap-drop=ALL',
      '--security-opt', 'no-new-privileges',
      '-v', `${tempDir}:/sandbox:ro`,
      langConfig.dockerImage,
      ...runArgs,
    ];

    let stdout = '';
    let stderr = '';
    let stdoutTruncated = false;
    let stderrTruncated = false;
    let timedOut = false;
    let timeoutTimer: NodeJS.Timeout | null = null;

    try {
      const result = await new Promise<{ exitCode: number | null }>((resolve) => {
        const child = spawn('docker', dockerArgs, {
          windowsHide: true,
        });

        timeoutTimer = setTimeout(() => {
          timedOut = true;
          // Forcibly kill container via docker kill
          try {
            spawn('docker', ['kill', containerName], {
              stdio: 'ignore',
              windowsHide: true,
            });
          } catch {
            // ignore kill error
          }
          try {
            child.kill('SIGKILL');
          } catch {
            // ignore child kill error
          }
        }, timeoutMs);

        child.stdout.on('data', (chunk: Buffer) => {
          if (stdout.length < MAX_OUTPUT_BYTES) {
            const remaining = MAX_OUTPUT_BYTES - stdout.length;
            stdout += chunk.toString('utf-8', 0, Math.min(chunk.length, remaining));
            if (chunk.length > remaining) {
              stdoutTruncated = true;
            }
          } else {
            stdoutTruncated = true;
          }
        });

        child.stderr.on('data', (chunk: Buffer) => {
          if (stderr.length < MAX_OUTPUT_BYTES) {
            const remaining = MAX_OUTPUT_BYTES - stderr.length;
            stderr += chunk.toString('utf-8', 0, Math.min(chunk.length, remaining));
            if (chunk.length > remaining) {
              stderrTruncated = true;
            }
          } else {
            stderrTruncated = true;
          }
        });

        child.on('error', (err) => {
          if (timeoutTimer) clearTimeout(timeoutTimer);
          stderr += `\nProcess execution error: ${err.message}`;
          resolve({ exitCode: 1 });
        });

        child.on('close', (code) => {
          if (timeoutTimer) clearTimeout(timeoutTimer);
          resolve({ exitCode: code });
        });
      });

      if (stdoutTruncated) {
        stdout += '\n[Output truncated: 64KB limit reached]';
      }
      if (stderrTruncated) {
        stderr += '\n[Error output truncated: 64KB limit reached]';
      }

      if (timedOut) {
        stderr = stderr ? `${stderr}\nTime limit exceeded (${timeoutMs / 1000}s)` : `Time limit exceeded (${timeoutMs / 1000}s)`;
      }

      const durationMs = Date.now() - startTime;

      return {
        stdout,
        stderr,
        exitCode: timedOut ? 124 : result.exitCode,
        durationMs,
        timedOut,
      };
    } finally {
      if (timeoutTimer) {
        clearTimeout(timeoutTimer);
      }

      // Cleanup ephemeral container if still exists
      if (timedOut) {
        try {
          spawnSync('docker', ['rm', '-f', containerName], {
            stdio: 'ignore',
            windowsHide: true,
          });
        } catch {
          // ignore cleanup error
        }
      }

      // Always remove temporary directory and source files
      try {
        await fs.rm(tempDir, { recursive: true, force: true });
      } catch {
        // ignore fs cleanup error
      }
    }
  }
}

export const dockerExecutor = new DockerExecutor();
