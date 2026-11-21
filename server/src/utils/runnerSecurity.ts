import path from 'path';

export const RUNNER_SECRET_HEADER = 'x-runner-secret';

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

/**
 * Verifies if incoming secret matches configured runner secret.
 */
export function verifyRunnerSecret(
  providedSecret: string | string[] | undefined,
  expectedSecret: string = process.env.RUNNER_SECRET || 'dev_runner_secret_key_change_me_in_production'
): boolean {
  if (!providedSecret || typeof providedSecret !== 'string') {
    return false;
  }
  return providedSecret === expectedSecret;
}
