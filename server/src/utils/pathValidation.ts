/**
 * Utility for validating and normalizing file and folder paths in the multi-file workspace.
 */

export interface ValidationResult {
  valid: boolean;
  error?: string;
  normalizedPath?: string;
}

const MAX_PATH_LENGTH = 255;
const INVALID_CHARS_REGEX = /[<>:"|?*\x00-\x1F]/;

/**
 * Normalizes a workspace path:
 * - Replaces backslashes with forward slashes
 * - Strips leading and trailing slashes
 * - Collapses redundant slashes (e.g. "a//b" -> "a/b")
 */
export function normalizeWorkspacePath(rawPath: string): string {
  if (!rawPath) return '';
  return rawPath
    .trim()
    .replace(/\\/g, '/')
    .replace(/\/+/g, '/')
    .replace(/^\/+/, '')
    .replace(/\/+$/, '');
}

/**
 * Validates a file or folder path against workspace constraints:
 * - Cannot be empty
 * - Length cannot exceed 255 characters
 * - No directory traversal ("..")
 * - No absolute paths (starting with / or containing drive letters e.g. C:)
 * - No invalid filesystem characters (< > : " | ? * or control characters)
 * - Cannot duplicate an existing file or folder
 */
export function validateWorkspacePath(
  rawPath: string,
  existingPaths: string[] = [],
  originalPath?: string
): ValidationResult {
  if (!rawPath || typeof rawPath !== 'string') {
    return { valid: false, error: 'Path cannot be empty' };
  }

  const trimmed = rawPath.trim();
  if (trimmed.length === 0) {
    return { valid: false, error: 'Path cannot be empty or whitespace' };
  }

  // Check for absolute paths
  if (trimmed.startsWith('/') || trimmed.startsWith('\\') || /^[a-zA-Z]:/.test(trimmed)) {
    return { valid: false, error: 'Absolute paths are not allowed' };
  }

  const normalized = normalizeWorkspacePath(trimmed);
  if (normalized.length === 0) {
    return { valid: false, error: 'Invalid path' };
  }

  if (normalized.length > MAX_PATH_LENGTH) {
    return {
      valid: false,
      error: `Path length cannot exceed ${MAX_PATH_LENGTH} characters (current: ${normalized.length})`,
    };
  }

  // Check segments for directory traversal and empty components
  const segments = normalized.split('/');
  for (const segment of segments) {
    if (segment === '..') {
      return { valid: false, error: 'Path traversal ("..") is not allowed' };
    }
    if (segment === '.') {
      return { valid: false, error: 'Relative dot paths (".") are not allowed' };
    }
    if (segment.length === 0) {
      return { valid: false, error: 'Path cannot contain empty segments' };
    }
    if (segment.length > MAX_PATH_LENGTH) {
      return { valid: false, error: `Segment "${segment}" exceeds 255 characters` };
    }
    if (INVALID_CHARS_REGEX.test(segment)) {
      return { valid: false, error: `Segment "${segment}" contains invalid characters` };
    }
  }

  // Check for duplicate name (excluding original path if renaming)
  const isDuplicate = existingPaths.some((p) => {
    const normExisting = normalizeWorkspacePath(p);
    if (originalPath && normExisting === normalizeWorkspacePath(originalPath)) {
      return false;
    }
    return normExisting.toLowerCase() === normalized.toLowerCase();
  });

  if (isDuplicate) {
    return { valid: false, error: `A file or folder with the path "${normalized}" already exists` };
  }

  return {
    valid: true,
    normalizedPath: normalized,
  };
}
