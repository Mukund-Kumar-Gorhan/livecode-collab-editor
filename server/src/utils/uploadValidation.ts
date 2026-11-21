import * as Y from 'yjs';
import { validateWorkspacePath, normalizeWorkspacePath } from './pathValidation.js';

export const MAX_UPLOAD_FILES = 200;
export const MAX_FILE_SIZE_BYTES = 200 * 1024; // 200 KB
export const MAX_TOTAL_SIZE_BYTES = 2 * 1024 * 1024; // 2 MB

export const IGNORED_DIRECTORY_NAMES = new Set([
  'node_modules',
  '.git',
  'dist',
  'build',
  '__pycache__',
  '.ds_store',
]);

export const BINARY_EXTENSIONS = new Set([
  'png', 'jpg', 'jpeg', 'gif', 'bmp', 'ico', 'webp', 'tiff', 'svgz',
  'exe', 'dll', 'so', 'dylib', 'bin', 'iso', 'img', 'dmg',
  'zip', 'tar', 'gz', 'bz2', '7z', 'rar', 'xz',
  'pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx',
  'mp3', 'wav', 'ogg', 'flac', 'aac', 'm4a',
  'mp4', 'mov', 'avi', 'mkv', 'webm', 'wmv',
  'woff', 'woff2', 'ttf', 'eot', 'otf',
  'class', 'pyc', 'pyo', 'o', 'obj', 'lib', 'a',
]);

export interface UploadItem {
  path: string;
  size: number;
  content: string;
}

export interface SkippedUploadItem {
  path: string;
  reason: string;
}

export interface BatchValidationResult {
  accepted: UploadItem[];
  conflicts: UploadItem[];
  skipped: SkippedUploadItem[];
}

export function isIgnoredPath(rawPath: string): boolean {
  if (!rawPath) return false;
  const norm = normalizeWorkspacePath(rawPath);
  const segments = norm.toLowerCase().split('/');
  return segments.some((segment) => IGNORED_DIRECTORY_NAMES.has(segment));
}

export function isBinaryExtension(rawPath: string): boolean {
  if (!rawPath) return false;
  const ext = rawPath.split('.').pop()?.toLowerCase();
  return ext ? BINARY_EXTENSIONS.has(ext) : false;
}

export function hasNullByte(content: Uint8Array | string): boolean {
  if (typeof content === 'string') {
    return content.includes('\0');
  }
  for (let i = 0; i < content.length; i++) {
    if (content[i] === 0) return true;
  }
  return false;
}

export function validateUploadBatch(
  items: UploadItem[],
  existingPaths: Set<string>
): BatchValidationResult {
  const accepted: UploadItem[] = [];
  const conflicts: UploadItem[] = [];
  const skipped: SkippedUploadItem[] = [];

  let totalSize = 0;
  let count = 0;

  for (const item of items) {
    const norm = normalizeWorkspacePath(item.path);

    // 1. Ignored paths
    if (isIgnoredPath(norm)) {
      skipped.push({ path: norm, reason: 'Ignored file/directory pattern' });
      continue;
    }

    // 2. Path validation
    const pathValidation = validateWorkspacePath(norm, []);
    if (!pathValidation.valid || !pathValidation.normalizedPath) {
      skipped.push({ path: norm, reason: pathValidation.error || 'Invalid path structure' });
      continue;
    }
    const validPath = pathValidation.normalizedPath;

    // 3. Max files limit
    if (count >= MAX_UPLOAD_FILES) {
      skipped.push({ path: validPath, reason: `Exceeded max limit of ${MAX_UPLOAD_FILES} files` });
      continue;
    }

    // 4. File size limit
    if (item.size > MAX_FILE_SIZE_BYTES) {
      skipped.push({
        path: validPath,
        reason: `Exceeds single file limit of 200KB (${(item.size / 1024).toFixed(1)}KB)`,
      });
      continue;
    }

    // 5. Total size limit
    if (totalSize + item.size > MAX_TOTAL_SIZE_BYTES) {
      skipped.push({
        path: validPath,
        reason: `Exceeds total batch limit of 2MB (${((totalSize + item.size) / (1024 * 1024)).toFixed(2)}MB)`,
      });
      continue;
    }

    // 6. Binary check
    if (isBinaryExtension(validPath)) {
      skipped.push({ path: validPath, reason: 'Binary file detected (extension)' });
      continue;
    }

    if (hasNullByte(item.content)) {
      skipped.push({ path: validPath, reason: 'Binary content (null byte) detected' });
      continue;
    }

    totalSize += item.size;
    count++;

    const preparedItem: UploadItem = {
      path: validPath,
      size: item.size,
      content: item.content,
    };

    if (existingPaths.has(validPath)) {
      conflicts.push(preparedItem);
    } else {
      accepted.push(preparedItem);
    }
  }

  return { accepted, conflicts, skipped };
}

export function commitFilesToYDoc(
  ydoc: Y.Doc,
  filesToCommit: Array<{ path: string; content: string }>
): void {
  if (!ydoc || filesToCommit.length === 0) return;

  const filesMap = ydoc.getMap('files');
  const foldersMap = ydoc.getMap('folders');

  ydoc.transact(() => {
    for (const { path: filePath, content } of filesToCommit) {
      const segments = filePath.split('/');
      let currentFolder = '';
      for (let s = 0; s < segments.length - 1; s++) {
        currentFolder = currentFolder ? `${currentFolder}/${segments[s]}` : segments[s];
        if (!foldersMap.has(currentFolder)) {
          foldersMap.set(currentFolder, { createdAt: Date.now() });
        }
      }

      let ytext = filesMap.get(filePath) as Y.Text | undefined;
      if (!ytext) {
        ytext = new Y.Text();
        ytext.insert(0, content);
        filesMap.set(filePath, ytext);
      } else {
        ytext.delete(0, ytext.length);
        ytext.insert(0, content);
      }
    }
  });
}
