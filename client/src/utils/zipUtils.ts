import JSZip from 'jszip';
import * as Y from 'yjs';

export interface ZipOptions {
  folderPrefix?: string;
  projectName?: string;
}

/**
 * Packs all files (or files within a specific folder) from the Y.Doc workspace into a ZIP
 * maintaining complete folder hierarchy and triggers browser download.
 */
export async function downloadWorkspaceAsZip(
  ydoc: Y.Doc,
  options: ZipOptions = {}
): Promise<{ success: boolean; fileCount: number; zipName: string }> {
  const { folderPrefix, projectName = 'livecode-project' } = options;
  const zip = new JSZip();

  const filesMap = ydoc.getMap('files');
  const foldersMap = ydoc.getMap('folders');

  const prefix = folderPrefix
    ? folderPrefix.endsWith('/')
      ? folderPrefix
      : `${folderPrefix}/`
    : '';

  let fileCount = 0;

  // 1. Add all files
  filesMap.forEach((ytext, rawPath) => {
    if (prefix && !rawPath.startsWith(prefix)) {
      return;
    }
    const relativePath = prefix ? rawPath.slice(prefix.length) : rawPath;
    if (!relativePath) return;

    const content = ytext && typeof (ytext as any).toString === 'function' ? (ytext as any).toString() : '';
    zip.file(relativePath, content);
    fileCount++;
  });

  // 2. Add empty folders if applicable
  foldersMap.forEach((_, rawPath) => {
    if (prefix && !rawPath.startsWith(prefix)) {
      return;
    }
    const relativePath = prefix ? rawPath.slice(prefix.length) : rawPath;
    if (relativePath) {
      zip.folder(relativePath);
    }
  });

  const baseName = folderPrefix
    ? folderPrefix.split('/').filter(Boolean).pop() || 'folder'
    : projectName;
  const zipName = `${baseName}.zip`;

  const blob = await zip.generateAsync({
    type: 'blob',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  });

  // Trigger download in browser
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = zipName;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);

  return { success: true, fileCount, zipName };
}
