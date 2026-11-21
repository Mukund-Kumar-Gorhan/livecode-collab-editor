import * as Y from 'yjs';
import { validateWorkspacePath, normalizeWorkspacePath } from './pathValidation';

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

const BINARY_EXTENSIONS = new Set([
  'png', 'jpg', 'jpeg', 'gif', 'bmp', 'ico', 'webp', 'tiff', 'svgz',
  'exe', 'dll', 'so', 'dylib', 'bin', 'iso', 'img', 'dmg',
  'zip', 'tar', 'gz', 'bz2', '7z', 'rar', 'xz',
  'pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx',
  'mp3', 'wav', 'ogg', 'flac', 'aac', 'm4a',
  'mp4', 'mov', 'avi', 'mkv', 'webm', 'wmv',
  'woff', 'woff2', 'ttf', 'eot', 'otf',
  'class', 'pyc', 'pyo', 'o', 'obj', 'lib', 'a',
]);

export interface ScannedFile {
  path: string;
  file: File;
}

export interface PreparedUploadFile {
  path: string;
  content: string;
  size: number;
}

export interface SkippedFile {
  path: string;
  reason: string;
}

export interface UploadBatchResult {
  accepted: PreparedUploadFile[];
  conflicts: PreparedUploadFile[];
  skipped: SkippedFile[];
}

/**
 * Checks if a path segment matches any ignored folders/files.
 */
export function isIgnoredPath(rawPath: string): boolean {
  const norm = normalizeWorkspacePath(rawPath);
  const segments = norm.toLowerCase().split('/');
  return segments.some((segment) => IGNORED_DIRECTORY_NAMES.has(segment));
}

/**
 * Detects if a file is binary based on extension or presence of null bytes (0x00).
 */
export async function isBinaryFile(file: File, relativePath: string): Promise<boolean> {
  // 1. Extension check
  const ext = relativePath.split('.').pop()?.toLowerCase();
  if (ext && BINARY_EXTENSIONS.has(ext)) {
    return true;
  }

  // 2. Null byte check in first 8KB
  try {
    const slice = file.slice(0, 8192);
    const buffer = await slice.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    for (let i = 0; i < bytes.length; i++) {
      if (bytes[i] === 0) {
        return true;
      }
    }
  } catch {
    return true;
  }

  return false;
}

/**
 * Recursively scans FileSystemEntry from webkitGetAsEntry.
 */
async function scanEntry(entry: any, basePath = ''): Promise<ScannedFile[]> {
  if (!entry) return [];

  if (entry.isFile) {
    return new Promise((resolve) => {
      entry.file(
        (file: File) => {
          const relativePath = basePath ? `${basePath}/${entry.name}` : entry.name;
          resolve([{ path: relativePath, file }]);
        },
        () => resolve([])
      );
    });
  }

  if (entry.isDirectory) {
    // If the directory name itself is ignored (e.g. node_modules, .git), skip traversing it entirely
    if (IGNORED_DIRECTORY_NAMES.has(entry.name.toLowerCase())) {
      return [];
    }

    const dirReader = entry.createReader();
    const entries: any[] = [];

    const readBatch = (): Promise<any[]> => {
      return new Promise((resolve) => {
        dirReader.readEntries(
          (batch: any[]) => resolve(batch || []),
          () => resolve([])
        );
      });
    };

    let batch: any[];
    do {
      batch = await readBatch();
      if (batch.length > 0) {
        entries.push(...batch);
      }
    } while (batch.length > 0);

    const currentDir = basePath ? `${basePath}/${entry.name}` : entry.name;
    const results: ScannedFile[] = [];

    for (const child of entries) {
      const children = await scanEntry(child, currentDir);
      results.push(...children);
    }

    return results;
  }

  return [];
}

/**
 * Extracts all files from a drop event using DataTransferItems (supporting directory recursion).
 */
export async function extractFilesFromDataTransfer(
  dataTransfer: DataTransfer
): Promise<ScannedFile[]> {
  const items = dataTransfer.items;
  const results: ScannedFile[] = [];

  if (items && items.length > 0) {
    const entryPromises: Promise<ScannedFile[]>[] = [];
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.kind === 'file') {
        const entry = item.webkitGetAsEntry ? item.webkitGetAsEntry() : null;
        if (entry) {
          entryPromises.push(scanEntry(entry, ''));
        } else {
          const file = item.getAsFile();
          if (file) {
            results.push({ path: file.name, file });
          }
        }
      }
    }
    const scannedLists = await Promise.all(entryPromises);
    scannedLists.forEach((list) => results.push(...list));
  } else if (dataTransfer.files && dataTransfer.files.length > 0) {
    for (let i = 0; i < dataTransfer.files.length; i++) {
      const file = dataTransfer.files[i];
      results.push({
        path: (file as any).webkitRelativePath || file.name,
        file,
      });
    }
  }

  return results;
}

/**
 * Validates, filters and prepares a list of scanned files for workspace upload.
 */
export async function prepareUploadBatch(
  scannedFiles: ScannedFile[],
  existingPaths: Set<string>,
  onProgress?: (current: number, total: number) => void
): Promise<UploadBatchResult> {
  const accepted: PreparedUploadFile[] = [];
  const conflicts: PreparedUploadFile[] = [];
  const skipped: SkippedFile[] = [];

  let totalSizeAccumulator = 0;
  let fileCount = 0;

  for (let i = 0; i < scannedFiles.length; i++) {
    const { path: rawPath, file } = scannedFiles[i];
    if (onProgress) {
      onProgress(i + 1, scannedFiles.length);
    }

    const normPath = normalizeWorkspacePath(rawPath);

    // 1. Ignore rule
    if (isIgnoredPath(normPath)) {
      skipped.push({ path: normPath, reason: 'Ignored file/directory pattern' });
      continue;
    }

    // 2. Path validation
    const pathValidation = validateWorkspacePath(normPath, []);
    if (!pathValidation.valid || !pathValidation.normalizedPath) {
      skipped.push({ path: normPath, reason: pathValidation.error || 'Invalid path structure' });
      continue;
    }
    const validPath = pathValidation.normalizedPath;

    // 3. Max files limit
    if (fileCount >= MAX_UPLOAD_FILES) {
      skipped.push({ path: validPath, reason: `Exceeded max limit of ${MAX_UPLOAD_FILES} files` });
      continue;
    }

    // 4. File size limit (200 KB)
    if (file.size > MAX_FILE_SIZE_BYTES) {
      skipped.push({
        path: validPath,
        reason: `Exceeds single file limit of 200KB (${(file.size / 1024).toFixed(1)}KB)`,
      });
      continue;
    }

    // 5. Total size limit (2 MB)
    if (totalSizeAccumulator + file.size > MAX_TOTAL_SIZE_BYTES) {
      skipped.push({
        path: validPath,
        reason: `Exceeds total batch limit of 2MB (${((totalSizeAccumulator + file.size) / (1024 * 1024)).toFixed(2)}MB)`,
      });
      continue;
    }

    // 6. Binary check (extension + null byte)
    const binary = await isBinaryFile(file, validPath);
    if (binary) {
      skipped.push({ path: validPath, reason: 'Binary file detected' });
      continue;
    }

    // 7. Read file content as UTF-8 text
    try {
      const content = await file.text();
      // Double check null byte inside decoded string
      if (content.includes('\0')) {
        skipped.push({ path: validPath, reason: 'Binary content (null byte) detected' });
        continue;
      }

      const fileObj: PreparedUploadFile = {
        path: validPath,
        content,
        size: file.size,
      };

      totalSizeAccumulator += file.size;
      fileCount++;

      // Check if duplicate path exists in workspace
      if (existingPaths.has(validPath)) {
        conflicts.push(fileObj);
      } else {
        accepted.push(fileObj);
      }
    } catch {
      skipped.push({ path: validPath, reason: 'Failed to read file as UTF-8 text' });
    }
  }

  return { accepted, conflicts, skipped };
}

/**
 * Commits multiple files into the Y.Doc in a single transaction.
 */
export function commitFilesToYDoc(
  ydoc: Y.Doc,
  filesToCommit: Array<{ path: string; content: string }>
): void {
  if (!ydoc || filesToCommit.length === 0) return;

  const filesMap = ydoc.getMap('files');
  const foldersMap = ydoc.getMap('folders');

  ydoc.transact(() => {
    for (const { path: filePath, content } of filesToCommit) {
      // 1. Ensure all parent folder paths exist in foldersMap
      const segments = filePath.split('/');
      let currentFolder = '';
      for (let s = 0; s < segments.length - 1; s++) {
        currentFolder = currentFolder ? `${currentFolder}/${segments[s]}` : segments[s];
        if (!foldersMap.has(currentFolder)) {
          foldersMap.set(currentFolder, { createdAt: Date.now() });
        }
      }

      // 2. Set file in filesMap
      let ytext = filesMap.get(filePath) as Y.Text | undefined;
      if (!ytext) {
        ytext = new Y.Text();
        ytext.insert(0, content);
        filesMap.set(filePath, ytext);
      } else {
        // Replace existing text content
        ytext.delete(0, ytext.length);
        ytext.insert(0, content);
      }
    }
  });
}
