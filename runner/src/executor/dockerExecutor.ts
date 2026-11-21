import { spawn, spawnSync } from 'child_process';
import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { SUPPORTED_LANGUAGES } from '../languages/config.js';

export interface FileEntry {
  path: string;
  content: string;
}

export interface ExecuteOptions {
  language: 'python' | 'javascript' | 'java' | 'cpp';
  files?: FileEntry[];
  entry?: string;
  code?: string;
  timeoutMs?: number;
}

export interface ExecutionResult {
  stdout: string;
  stderr: string;
  exitCode: number | null;
  durationMs: number;
  timedOut: boolean;
}

export const MAX_FILES = 200;
export const MAX_FILE_SIZE_BYTES = 200 * 1024; // 200KB per file
export const MAX_TOTAL_SIZE_BYTES = 2 * 1024 * 1024; // 2MB total
const MAX_OUTPUT_BYTES = 64 * 1024; // 64KB limit

/**
 * Validates a file path against path traversal attacks.
 * Throws an Error if invalid.
 */
export function validateRunnerPath(rawPath: string, rootDir: string): string {
  if (!rawPath || typeof rawPath !== 'string') {
    throw new Error('File path cannot be empty');
  }

  const trimmed = rawPath.trim();
  if (trimmed.length === 0) {
    throw new Error('File path cannot be empty or whitespace');
  }

  // Reject null bytes
  if (trimmed.includes('\x00')) {
    throw new Error('File path contains null byte');
  }

  // Reject Windows drive letters and leading slashes
  if (trimmed.startsWith('/') || trimmed.startsWith('\\') || /^[a-zA-Z]:/.test(trimmed)) {
    throw new Error(`Absolute paths are not allowed: "${trimmed}"`);
  }

  // Normalize path
  const normalized = trimmed.replace(/\\/g, '/').replace(/\/+/g, '/').replace(/^\/+/, '');

  // Check segments for traversal
  const segments = normalized.split('/');
  for (const segment of segments) {
    if (segment === '..' || segment === '.') {
      throw new Error(`Path traversal detected in segment "${segment}": "${trimmed}"`);
    }
  }

  const resolved = path.resolve(rootDir, normalized);
  const resolvedRoot = path.resolve(rootDir);

  // Must strictly stay inside root directory
  if (!resolved.startsWith(resolvedRoot + path.sep)) {
    throw new Error(`Path traversal detected outside sandbox root: "${trimmed}"`);
  }

  return resolved;
}

/**
 * Extracts class name and package for Java entrypoint.
 */
export function extractJavaEntryClass(entryFilePath: string, fileContent: string): string {
  let pkg = '';
  const pkgMatch = fileContent.match(/package\s+([a-zA-Z0-9_.]+)\s*;/);
  if (pkgMatch && pkgMatch[1]) {
    pkg = pkgMatch[1].trim();
  }

  let className = '';
  const classMatch =
    fileContent.match(/public\s+class\s+([A-Za-z0-9_]+)/) ||
    fileContent.match(/class\s+([A-Za-z0-9_]+)/);
  if (classMatch && classMatch[1]) {
    className = classMatch[1].trim();
  } else {
    className = path.basename(entryFilePath, '.java');
  }

  return pkg ? `${pkg}.${className}` : className;
}

export class DockerExecutor {
  async execute(options: ExecuteOptions): Promise<ExecutionResult> {
    const startTime = Date.now();
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

    // Standardize files list
    let files: FileEntry[] = options.files || [];
    let entry = options.entry || '';

    if (files.length === 0 && options.code) {
      const defaultFilename = `main.${langConfig.fileExtension}`;
      files = [{ path: defaultFilename, content: options.code }];
      entry = defaultFilename;
    }

    if (files.length === 0) {
      return {
        stdout: '',
        stderr: 'Execution failed: No files provided',
        exitCode: 1,
        durationMs: 0,
        timedOut: false,
      };
    }

    // Runner limits validation
    if (files.length > MAX_FILES) {
      return {
        stdout: '',
        stderr: `File count limit exceeded: maximum ${MAX_FILES} files allowed (got ${files.length})`,
        exitCode: 1,
        durationMs: 0,
        timedOut: false,
      };
    }

    let totalSizeBytes = 0;
    for (const f of files) {
      const fileBytes = Buffer.byteLength(f.content || '', 'utf-8');
      if (fileBytes > MAX_FILE_SIZE_BYTES) {
        return {
          stdout: '',
          stderr: `File "${f.path}" size (${Math.round(fileBytes / 1024)}KB) exceeds limit of 200KB`,
          exitCode: 1,
          durationMs: 0,
          timedOut: false,
        };
      }
      totalSizeBytes += fileBytes;
    }

    if (totalSizeBytes > MAX_TOTAL_SIZE_BYTES) {
      return {
        stdout: '',
        stderr: `Total project size (${(totalSizeBytes / (1024 * 1024)).toFixed(2)}MB) exceeds limit of 2MB`,
        exitCode: 1,
        durationMs: 0,
        timedOut: false,
      };
    }

    // Determine entry file
    if (!entry) {
      const defaultNames = ['Main.java', 'main.cpp', 'main.py', 'index.js'];
      const matched = files.find((f) => defaultNames.includes(path.basename(f.path)));
      entry = matched ? matched.path : files[0].path;
    }

    // Set execution timeout: Java/C++ get compile (15s) + run (5s) = 23s buffer; Python/JS get 5s (+ 3s buffer)
    const timeoutMs = options.timeoutMs || (langConfig.isCompiled ? 23000 : 8000);

    // Create unique ephemeral directory on host for this execution
    const runId = `exec_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    const tempDir = path.resolve(process.cwd(), '.temp_sandboxes', runId);
    const containerName = `collab_sandbox_${runId}`;

    let javaEntryClassName = 'Main';

    try {
      await fs.mkdir(tempDir, { recursive: true });

      // Write all files safely to temp directory
      for (const f of files) {
        const destPath = validateRunnerPath(f.path, tempDir);
        await fs.mkdir(path.dirname(destPath), { recursive: true });
        await fs.writeFile(destPath, f.content, 'utf-8');

        if (options.language === 'java' && f.path === entry) {
          javaEntryClassName = extractJavaEntryClass(f.path, f.content);
        }
      }

      // If entry is not set or not matched for java yet
      if (options.language === 'java' && javaEntryClassName === 'Main') {
        const entryFileObj = files.find((f) => f.path === entry);
        if (entryFileObj) {
          javaEntryClassName = extractJavaEntryClass(entryFileObj.path, entryFileObj.content);
        }
      }

      const runArgs = langConfig.getRunArgs(entry, javaEntryClassName);

      // Build docker run command with strict security flags:
      // --network=none --read-only --tmpfs /tmp:exec --cap-drop=ALL --security-opt no-new-privileges --rm
      // Java gets --memory=384m --pids-limit=128
      // Others get --memory=128m --pids-limit=64
      const dockerArgs = [
        'run',
        '--name', containerName,
        '--rm',
        '--network=none',
        `--memory=${langConfig.memoryLimit}`,
        '--cpus=0.5',
        `--pids-limit=${langConfig.pidsLimit}`,
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

      const result = await new Promise<{ exitCode: number | null }>((resolve) => {
        const child = spawn('docker', dockerArgs, {
          windowsHide: true,
        });

        timeoutTimer = setTimeout(() => {
          timedOut = true;
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
        stderr = stderr ? `${stderr}\nTime limit exceeded` : 'Time limit exceeded';
      }

      const durationMs = Date.now() - startTime;

      return {
        stdout,
        stderr,
        exitCode: timedOut ? 124 : result.exitCode,
        durationMs,
        timedOut,
      };
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : 'Execution failed';
      return {
        stdout: '',
        stderr: errMsg,
        exitCode: 1,
        durationMs: Date.now() - startTime,
        timedOut: false,
      };
    } finally {
      // Cleanup ephemeral container if still exists
      try {
        spawnSync('docker', ['rm', '-f', containerName], {
          stdio: 'ignore',
          windowsHide: true,
        });
      } catch {
        // ignore cleanup error
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
