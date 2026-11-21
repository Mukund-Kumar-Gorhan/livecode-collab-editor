import React, { useState, useEffect, useRef, useMemo } from 'react';
import * as Y from 'yjs';
import {
  FilePlus,
  FolderPlus,
  ChevronRight,
  ChevronDown,
  Trash2,
  Edit2,
  X,
  AlertTriangle,
  FolderTree,
  ChevronsLeft,
  ChevronsRight,
  FolderUp,
  FileUp,
  Download,
  PlayCircle,
  UploadCloud,
} from 'lucide-react';
import { FileIcon } from './FileIcon';
import { validateWorkspacePath } from '../../utils/pathValidation';
import { toast } from '../../store/toastStore';
import { downloadWorkspaceAsZip } from '../../utils/zipUtils';
import {
  extractFilesFromDataTransfer,
  prepareUploadBatch,
  commitFilesToYDoc,
  PreparedUploadFile,
  SkippedFile,
  ScannedFile,
} from '../../utils/uploadUtils';

export interface FileExplorerProps {
  ydoc: Y.Doc | null;
  isViewer?: boolean;
  activeFile: string | null;
  onSelectFile: (path: string) => void;
  onFileDeleted?: (path: string) => void;
  onFileRenamed?: (oldPath: string, newPath: string) => void;
  isOpen?: boolean;
  onToggleOpen?: () => void;
}

interface TreeNode {
  id: string; // full path
  name: string; // segment name
  isFolder: boolean;
  children: TreeNode[];
}

export const FileExplorer: React.FC<FileExplorerProps> = ({
  ydoc,
  isViewer = false,
  activeFile,
  onSelectFile,
  onFileDeleted,
  onFileRenamed,
  isOpen = true,
  onToggleOpen,
}) => {
  const [filePaths, setFilePaths] = useState<string[]>([]);
  const [folderPaths, setFolderPaths] = useState<string[]>([]);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [width, setWidth] = useState<number>(240);
  const [isResizing, setIsResizing] = useState(false);
  const [entryFile, setEntryFile] = useState<string | null>(null);

  // Drag and drop state
  const [isDragging, setIsDragging] = useState(false);
  const dragCounterRef = useRef(0);

  // Upload inputs refs
  const folderInputRef = useRef<HTMLInputElement>(null);
  const filesInputRef = useRef<HTMLInputElement>(null);

  // Upload progress state
  const [uploadProgress, setUploadProgress] = useState<{ current: number; total: number } | null>(null);

  // Conflict Resolution Modal state
  const [conflictState, setConflictState] = useState<{
    conflicts: PreparedUploadFile[];
    accepted: PreparedUploadFile[];
    skipped: SkippedFile[];
    currentIndex: number;
    resolved: Array<{ path: string; content: string }>;
    applyToAll: boolean;
  } | null>(null);

  // Context Menu State
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    targetPath?: string;
    isFolder?: boolean;
  } | null>(null);

  // Modal State for New / Rename / Delete
  const [modalType, setModalType] = useState<'new-file' | 'new-folder' | 'rename' | 'delete' | null>(null);
  const [modalTarget, setModalTarget] = useState<string>('');
  const [modalInputValue, setModalInputValue] = useState<string>('');
  const [modalError, setModalError] = useState<string | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);

  // 1. Observe Y.Doc files, folders and metadata maps
  useEffect(() => {
    if (!ydoc) return;

    const filesMap = ydoc.getMap('files');
    const foldersMap = ydoc.getMap('folders');
    const metadataMap = ydoc.getMap('metadata');

    const updateLists = () => {
      const currentFiles = Array.from(filesMap.keys()).sort();
      const currentFolders = Array.from(foldersMap.keys()).sort();
      setFilePaths(currentFiles);
      setFolderPaths(currentFolders);
    };

    const updateMetadata = () => {
      const entry = (metadataMap.get('entryFile') as string) || null;
      setEntryFile(entry);
    };

    updateLists();
    updateMetadata();

    filesMap.observe(updateLists);
    foldersMap.observe(updateLists);
    metadataMap.observe(updateMetadata);

    return () => {
      filesMap.unobserve(updateLists);
      foldersMap.unobserve(updateLists);
      metadataMap.unobserve(updateMetadata);
    };
  }, [ydoc]);

  // Determine effective entry file (either explicitly saved in metadata or auto-detected)
  const effectiveEntryFile = useMemo(() => {
    if (entryFile && filePaths.includes(entryFile)) {
      return entryFile;
    }
    const defaultEntryNames = ['Main.java', 'main.cpp', 'main.py', 'index.js'];
    const matched = filePaths.find((f) => defaultEntryNames.includes(f.split('/').pop() || ''));
    if (matched) return matched;
    if (activeFile && filePaths.includes(activeFile)) return activeFile;
    return filePaths[0] || null;
  }, [entryFile, filePaths, activeFile]);

  // Auto-expand parent folders of active file
  useEffect(() => {
    if (!activeFile) return;
    const parts = activeFile.split('/');
    if (parts.length > 1) {
      setExpandedFolders((prev) => {
        const next = new Set(prev);
        let acc = '';
        for (let i = 0; i < parts.length - 1; i++) {
          acc = acc ? `${acc}/${parts[i]}` : parts[i];
          next.add(acc);
        }
        return next;
      });
    }
  }, [activeFile]);

  // 2. Build hierarchical file tree
  const tree = useMemo(() => {
    const root: TreeNode = { id: '', name: '', isFolder: true, children: [] };

    const addPathToTree = (fullPath: string, isFolder: boolean) => {
      const segments = fullPath.split('/');
      let currentNode = root;
      let pathAcc = '';

      segments.forEach((segment, index) => {
        pathAcc = pathAcc ? `${pathAcc}/${segment}` : segment;
        const isLast = index === segments.length - 1;
        const nodeIsFolder = !isLast || isFolder;

        let child = currentNode.children.find((c) => c.name === segment);
        if (!child) {
          child = {
            id: pathAcc,
            name: segment,
            isFolder: nodeIsFolder,
            children: [],
          };
          currentNode.children.push(child);
        }
        currentNode = child;
      });
    };

    folderPaths.forEach((f) => addPathToTree(f, true));
    filePaths.forEach((f) => addPathToTree(f, false));

    const sortTree = (node: TreeNode) => {
      node.children.sort((a, b) => {
        if (a.isFolder === b.isFolder) {
          return a.name.localeCompare(b.name);
        }
        return a.isFolder ? -1 : 1;
      });
      node.children.forEach(sortTree);
    };

    sortTree(root);
    return root.children;
  }, [filePaths, folderPaths]);

  // 3. Resizable sidebar mouse event handlers
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;
      const newWidth = Math.max(160, Math.min(480, e.clientX));
      setWidth(newWidth);
    };

    const handleMouseUp = () => {
      if (isResizing) setIsResizing(false);
    };

    if (isResizing) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing]);

  // Close context menu on external click
  useEffect(() => {
    const handleClick = () => setContextMenu(null);
    window.addEventListener('click', handleClick);
    return () => window.removeEventListener('click', handleClick);
  }, []);

  const toggleFolder = (folderId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setExpandedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(folderId)) {
        next.delete(folderId);
      } else {
        next.add(folderId);
      }
      return next;
    });
  };

  // Set file as main execution entry
  const handleSetAsEntry = (filePath: string) => {
    if (!ydoc || isViewer) return;
    ydoc.getMap('metadata').set('entryFile', filePath);
    toast.success(`Set "${filePath}" as main entry file`);
  };

  // Download ZIP (full project or folder)
  const handleDownloadZip = async (folderPrefix?: string) => {
    if (!ydoc) return;
    try {
      const res = await downloadWorkspaceAsZip(ydoc, { folderPrefix });
      toast.success(`Downloaded ${res.fileCount} files (${res.zipName})`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'ZIP generation failed';
      toast.error(`ZIP error: ${msg}`);
    }
  };

  // Format summarize skipped reasons
  const summarizeSkipped = (skipped: SkippedFile[]) => {
    const distinctReasons = Array.from(new Set(skipped.map((s) => s.reason)));
    return distinctReasons.join(', ');
  };

  // Process incoming scanned files batch
  const processIncomingFiles = async (scannedFiles: ScannedFile[]) => {
    if (!ydoc) return;
    if (isViewer) {
      toast.error('Viewers cannot upload files or folders');
      return;
    }

    if (scannedFiles.length === 0) {
      toast.info('No valid files found to upload');
      return;
    }

    setUploadProgress({ current: 0, total: scannedFiles.length });

    try {
      const filesMap = ydoc.getMap('files');
      const existingPaths = new Set(Array.from(filesMap.keys()));

      const batchResult = await prepareUploadBatch(
        scannedFiles,
        existingPaths,
        (current, total) => setUploadProgress({ current, total })
      );

      const { accepted, conflicts, skipped } = batchResult;

      if (conflicts.length > 0) {
        // Open conflict resolution modal
        setConflictState({
          conflicts,
          accepted,
          skipped,
          currentIndex: 0,
          resolved: [...accepted],
          applyToAll: false,
        });
      } else {
        // No conflicts: commit immediately in a single transaction
        commitFilesToYDoc(ydoc, accepted);
        const reasonSummary = summarizeSkipped(skipped);
        const summaryMsg = `${accepted.length} files added${
          skipped.length > 0 ? `, ${skipped.length} skipped: ${reasonSummary}` : ''
        }`;
        toast.success(summaryMsg);

        // Auto select first accepted file if active file is not set
        if (!activeFile && accepted.length > 0) {
          onSelectFile(accepted[0].path);
        }
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Upload processing error';
      toast.error(msg);
    } finally {
      setUploadProgress(null);
    }
  };

  // Conflict Action Handlers: Replace, Skip, Rename
  const handleResolveConflict = (action: 'replace' | 'skip' | 'rename') => {
    if (!conflictState || !ydoc) return;

    const { conflicts, skipped, currentIndex, resolved, applyToAll } = conflictState;
    const currentItem = conflicts[currentIndex];
    const newResolved = [...resolved];
    const newSkipped = [...skipped];

    const filesMap = ydoc.getMap('files');
    const existing = new Set([
      ...Array.from(filesMap.keys()),
      ...newResolved.map((r) => r.path),
    ]);

    const resolveItem = (item: PreparedUploadFile, act: 'replace' | 'skip' | 'rename') => {
      if (act === 'replace') {
        newResolved.push({ path: item.path, content: item.content });
      } else if (act === 'skip') {
        newSkipped.push({ path: item.path, reason: 'Skipped by user' });
      } else if (act === 'rename') {
        // Generate automatic rename e.g. "dir/file (1).ext"
        const lastSlash = item.path.lastIndexOf('/');
        const dir = lastSlash >= 0 ? item.path.slice(0, lastSlash) : '';
        const base = lastSlash >= 0 ? item.path.slice(lastSlash + 1) : item.path;
        const dotIdx = base.lastIndexOf('.');
        const namePart = dotIdx > 0 ? base.slice(0, dotIdx) : base;
        const extPart = dotIdx > 0 ? base.slice(dotIdx) : '';

        let counter = 1;
        let candidate = dir ? `${dir}/${namePart} (${counter})${extPart}` : `${namePart} (${counter})${extPart}`;
        while (existing.has(candidate)) {
          counter++;
          candidate = dir ? `${dir}/${namePart} (${counter})${extPart}` : `${namePart} (${counter})${extPart}`;
        }
        existing.add(candidate);
        newResolved.push({ path: candidate, content: item.content });
      }
    };

    if (applyToAll) {
      // Apply action to current and all remaining conflicts
      for (let i = currentIndex; i < conflicts.length; i++) {
        resolveItem(conflicts[i], action);
      }
      // Commit everything
      commitFilesToYDoc(ydoc, newResolved);
      const reasonSummary = summarizeSkipped(newSkipped);
      toast.success(
        `${newResolved.length} files added${
          newSkipped.length > 0 ? `, ${newSkipped.length} skipped: ${reasonSummary}` : ''
        }`
      );
      setConflictState(null);
    } else {
      resolveItem(currentItem, action);
      if (currentIndex + 1 < conflicts.length) {
        setConflictState({
          ...conflictState,
          currentIndex: currentIndex + 1,
          resolved: newResolved,
          skipped: newSkipped,
        });
      } else {
        // Finished all conflicts: commit everything in a single transaction
        commitFilesToYDoc(ydoc, newResolved);
        const reasonSummary = summarizeSkipped(newSkipped);
        toast.success(
          `${newResolved.length} files added${
            newSkipped.length > 0 ? `, ${newSkipped.length} skipped: ${reasonSummary}` : ''
          }`
        );
        setConflictState(null);
      }
    }
  };

  // Drag and Drop Event Handlers
  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current += 1;
    if (e.dataTransfer?.items && e.dataTransfer.items.length > 0) {
      setIsDragging(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current -= 1;
    if (dragCounterRef.current <= 0) {
      dragCounterRef.current = 0;
      setIsDragging(false);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current = 0;
    setIsDragging(false);

    if (isViewer) {
      toast.error('Viewers cannot upload files or folders');
      return;
    }

    if (!e.dataTransfer) return;
    const scanned = await extractFilesFromDataTransfer(e.dataTransfer);
    await processIncomingFiles(scanned);
  };

  // Folder Upload Button Input Handler
  const handleFolderInputChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;
    if (!fileList || fileList.length === 0) return;

    const scanned: ScannedFile[] = [];
    for (let i = 0; i < fileList.length; i++) {
      const f = fileList[i];
      const relPath = (f as any).webkitRelativePath || f.name;
      scanned.push({ path: relPath, file: f });
    }

    e.target.value = '';
    await processIncomingFiles(scanned);
  };

  // Files Upload Button Input Handler
  const handleFilesInputChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;
    if (!fileList || fileList.length === 0) return;

    const scanned: ScannedFile[] = [];
    for (let i = 0; i < fileList.length; i++) {
      const f = fileList[i];
      scanned.push({ path: f.name, file: f });
    }

    e.target.value = '';
    await processIncomingFiles(scanned);
  };

  // Modal Actions: New File / Folder / Rename / Delete
  const handleOpenCreateModal = (type: 'new-file' | 'new-folder', targetFolder: string = '') => {
    if (isViewer) {
      toast.error('Viewers cannot create files or folders');
      return;
    }
    setModalType(type);
    setModalTarget(targetFolder);
    setModalInputValue(targetFolder ? `${targetFolder}/` : '');
    setModalError(null);
  };

  const handleOpenRenameModal = (targetPath: string) => {
    if (isViewer) {
      toast.error('Viewers cannot rename files or folders');
      return;
    }
    setModalType('rename');
    setModalTarget(targetPath);
    setModalInputValue(targetPath);
    setModalError(null);
  };

  const handleOpenDeleteModal = (targetPath: string) => {
    if (isViewer) {
      toast.error('Viewers cannot delete files or folders');
      return;
    }
    setModalType('delete');
    setModalTarget(targetPath);
    setModalError(null);
  };

  const handleConfirmModal = () => {
    if (!ydoc || isViewer) return;
    const filesMap = ydoc.getMap('files');
    const foldersMap = ydoc.getMap('folders');
    const existing = [...Array.from(filesMap.keys()), ...Array.from(foldersMap.keys())];

    if (modalType === 'new-file') {
      const validation = validateWorkspacePath(modalInputValue, existing);
      if (!validation.valid || !validation.normalizedPath) {
        setModalError(validation.error || 'Invalid file path');
        return;
      }
      const newPath = validation.normalizedPath;
      const fileText = new Y.Text();
      filesMap.set(newPath, fileText);
      toast.success(`Created file: ${newPath}`);
      onSelectFile(newPath);
      setModalType(null);
    } else if (modalType === 'new-folder') {
      const validation = validateWorkspacePath(modalInputValue, existing);
      if (!validation.valid || !validation.normalizedPath) {
        setModalError(validation.error || 'Invalid folder path');
        return;
      }
      const newPath = validation.normalizedPath;
      foldersMap.set(newPath, { createdAt: Date.now() });
      setExpandedFolders((prev) => new Set([...prev, newPath]));
      toast.success(`Created folder: ${newPath}`);
      setModalType(null);
    } else if (modalType === 'rename') {
      const validation = validateWorkspacePath(modalInputValue, existing, modalTarget);
      if (!validation.valid || !validation.normalizedPath) {
        setModalError(validation.error || 'Invalid path');
        return;
      }
      const newPath = validation.normalizedPath;
      if (newPath === modalTarget) {
        setModalType(null);
        return;
      }

      ydoc.transact(() => {
        if (filesMap.has(modalTarget)) {
          const fileContent = filesMap.get(modalTarget) as Y.Text;
          const newText = new Y.Text();
          newText.insert(0, fileContent.toString());
          filesMap.delete(modalTarget);
          filesMap.set(newPath, newText);

          // Update entry file if it was renamed
          const currentEntry = ydoc.getMap('metadata').get('entryFile') as string;
          if (currentEntry === modalTarget) {
            ydoc.getMap('metadata').set('entryFile', newPath);
          }

          if (onFileRenamed) onFileRenamed(modalTarget, newPath);
          toast.success(`Renamed to ${newPath}`);
        } else {
          // Folder rename: migrate all files & subfolders with this prefix
          const oldPrefix = `${modalTarget}/`;
          const newPrefix = `${newPath}/`;

          Array.from(filesMap.keys()).forEach((filePath) => {
            if (filePath.startsWith(oldPrefix)) {
              const fileContent = filesMap.get(filePath) as Y.Text;
              const updatedFilePath = `${newPrefix}${filePath.slice(oldPrefix.length)}`;
              const newText = new Y.Text();
              newText.insert(0, fileContent.toString());
              filesMap.delete(filePath);
              filesMap.set(updatedFilePath, newText);
              if (onFileRenamed) onFileRenamed(filePath, updatedFilePath);
            }
          });

          Array.from(foldersMap.keys()).forEach((folderPath) => {
            if (folderPath === modalTarget) {
              foldersMap.delete(folderPath);
              foldersMap.set(newPath, { createdAt: Date.now() });
            } else if (folderPath.startsWith(oldPrefix)) {
              const updatedFolderPath = `${newPrefix}${folderPath.slice(oldPrefix.length)}`;
              foldersMap.delete(folderPath);
              foldersMap.set(updatedFolderPath, { createdAt: Date.now() });
            }
          });

          toast.success(`Renamed folder to ${newPath}`);
        }
      });
      setModalType(null);
    } else if (modalType === 'delete') {
      const target = modalTarget;
      ydoc.transact(() => {
        if (filesMap.has(target)) {
          filesMap.delete(target);
          if (onFileDeleted) onFileDeleted(target);
          toast.info(`Deleted ${target}`);
        } else {
          const prefix = `${target}/`;
          Array.from(filesMap.keys()).forEach((f) => {
            if (f === target || f.startsWith(prefix)) {
              filesMap.delete(f);
              if (onFileDeleted) onFileDeleted(f);
            }
          });
          Array.from(foldersMap.keys()).forEach((f) => {
            if (f === target || f.startsWith(prefix)) {
              foldersMap.delete(f);
            }
          });
          toast.info(`Deleted folder ${target}`);
        }
      });
      setModalType(null);
    }
  };

  const handleContextMenu = (e: React.MouseEvent, node?: TreeNode) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      targetPath: node ? node.id : undefined,
      isFolder: node ? node.isFolder : undefined,
    });
  };

  // Render tree node recursively
  const renderNode = (node: TreeNode, depth: number = 0) => {
    const isExpanded = expandedFolders.has(node.id);
    const isActive = activeFile === node.id;
    const isEntry = effectiveEntryFile === node.id;

    if (node.isFolder) {
      return (
        <div key={node.id} className="select-none">
          <div
            onClick={(e) => toggleFolder(node.id, e)}
            onContextMenu={(e) => handleContextMenu(e, node)}
            style={{ paddingLeft: `${depth * 12 + 8}px` }}
            className="flex items-center space-x-1.5 py-1 pr-2 hover:bg-app-surface-2/60 cursor-pointer text-xs text-app-text-muted hover:text-app-text transition-colors group"
          >
            <span className="w-3.5 h-3.5 flex items-center justify-center shrink-0">
              {isExpanded ? (
                <ChevronDown className="w-3.5 h-3.5 text-app-text-muted" />
              ) : (
                <ChevronRight className="w-3.5 h-3.5 text-app-text-muted" />
              )}
            </span>
            <FileIcon filename={node.name} isFolder isOpen={isExpanded} />
            <span className="truncate flex-1 font-mono text-[11.5px] font-medium">{node.name}</span>

            {/* Hover Actions (Owner/Editor only) */}
            {!isViewer && (
              <div className="opacity-0 group-hover:opacity-100 flex items-center space-x-1 transition-opacity">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleOpenCreateModal('new-file', node.id);
                  }}
                  title="New File in folder"
                  className="p-0.5 hover:text-app-accent rounded"
                >
                  <FilePlus className="w-3 h-3" />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDownloadZip(node.id);
                  }}
                  title="Download folder as ZIP"
                  className="p-0.5 hover:text-app-accent rounded"
                >
                  <Download className="w-3 h-3" />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleOpenRenameModal(node.id);
                  }}
                  title="Rename folder"
                  className="p-0.5 hover:text-app-accent rounded"
                >
                  <Edit2 className="w-3 h-3" />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleOpenDeleteModal(node.id);
                  }}
                  title="Delete folder"
                  className="p-0.5 hover:text-app-danger rounded"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            )}
          </div>

          {/* Children nodes */}
          {isExpanded && (
            <div>
              {node.children.length === 0 ? (
                <div
                  style={{ paddingLeft: `${(depth + 1) * 12 + 16}px` }}
                  className="py-1 text-[10.5px] italic text-app-text-muted/60 font-mono"
                >
                  (empty folder)
                </div>
              ) : (
                node.children.map((child) => renderNode(child, depth + 1))
              )}
            </div>
          )}
        </div>
      );
    }

    // File Node
    return (
      <div
        key={node.id}
        onClick={() => onSelectFile(node.id)}
        onContextMenu={(e) => handleContextMenu(e, node)}
        style={{ paddingLeft: `${depth * 12 + 20}px` }}
        className={`flex items-center space-x-1.5 py-1 pr-2 cursor-pointer text-xs font-mono transition-colors group ${
          isActive
            ? 'bg-app-accent/15 text-app-accent border-l-2 border-app-accent font-semibold'
            : 'hover:bg-app-surface-2/60 text-app-text-muted hover:text-app-text'
        }`}
      >
        <FileIcon filename={node.name} />
        <span className="truncate flex-1 text-[11.5px]">{node.name}</span>

        {/* Entry File Badge */}
        {isEntry && (
          <span
            title="Main Entry File"
            className="px-1 py-0.5 text-[8.5px] font-bold bg-app-accent/20 text-app-accent border border-app-accent/30 rounded shrink-0 tracking-wider"
          >
            ENTRY
          </span>
        )}

        {/* Hover Actions (Owner/Editor only) */}
        {!isViewer && (
          <div className="opacity-0 group-hover:opacity-100 flex items-center space-x-1 transition-opacity">
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleSetAsEntry(node.id);
              }}
              title="Set as entry file"
              className="p-0.5 hover:text-app-accent rounded"
            >
              <PlayCircle className="w-3 h-3" />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleOpenRenameModal(node.id);
              }}
              title="Rename file"
              className="p-0.5 hover:text-app-accent rounded"
            >
              <Edit2 className="w-3 h-3" />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleOpenDeleteModal(node.id);
              }}
              title="Delete file"
              className="p-0.5 hover:text-app-danger rounded"
            >
              <Trash2 className="w-3 h-3" />
            </button>
          </div>
        )}
      </div>
    );
  };

  if (!isOpen) {
    return (
      <div className="h-full bg-app-surface border-r border-app-border flex flex-col items-center py-2 px-1">
        <button
          onClick={onToggleOpen}
          className="p-1 text-app-text-muted hover:text-app-text hover:bg-app-surface-2 rounded transition"
          title="Open Explorer (Cmd/Ctrl+B)"
        >
          <ChevronsRight className="w-4 h-4" />
        </button>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      style={{ width: `${width}px` }}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      className="h-full bg-app-surface border-r border-app-border flex flex-col relative select-none shrink-0"
    >
      {/* Hidden File / Folder Upload Inputs */}
      <input
        type="file"
        ref={folderInputRef}
        onChange={handleFolderInputChange}
        {...({ webkitdirectory: '', directory: '', multiple: true } as any)}
        className="hidden"
      />
      <input
        type="file"
        ref={filesInputRef}
        onChange={handleFilesInputChange}
        multiple
        className="hidden"
      />

      {/* Explorer Header */}
      <div className="h-8 px-2 border-b border-app-border flex items-center justify-between text-xs font-semibold text-app-text-muted bg-app-surface tracking-wider uppercase">
        <div className="flex items-center space-x-1.5 truncate">
          <FolderTree className="w-3.5 h-3.5 text-app-accent shrink-0" />
          <span className="text-[11px] truncate">Explorer</span>
        </div>

        <div className="flex items-center space-x-0.5 shrink-0">
          {!isViewer && (
            <>
              <button
                onClick={() => handleOpenCreateModal('new-file')}
                title="New File"
                className="p-1 hover:text-app-text hover:bg-app-surface-2 rounded transition"
              >
                <FilePlus className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => handleOpenCreateModal('new-folder')}
                title="New Folder"
                className="p-1 hover:text-app-text hover:bg-app-surface-2 rounded transition"
              >
                <FolderPlus className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => folderInputRef.current?.click()}
                title="Upload Folder"
                className="p-1 hover:text-app-text hover:bg-app-surface-2 rounded transition"
              >
                <FolderUp className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => filesInputRef.current?.click()}
                title="Upload Files"
                className="p-1 hover:text-app-text hover:bg-app-surface-2 rounded transition"
              >
                <FileUp className="w-3.5 h-3.5" />
              </button>
            </>
          )}

          {/* Download as ZIP button */}
          <button
            onClick={() => handleDownloadZip()}
            title="Download Project as ZIP"
            className="p-1 hover:text-app-text hover:bg-app-surface-2 rounded transition"
          >
            <Download className="w-3.5 h-3.5" />
          </button>

          {onToggleOpen && (
            <button
              onClick={onToggleOpen}
              title="Collapse Explorer"
              className="p-1 hover:text-app-text hover:bg-app-surface-2 rounded transition"
            >
              <ChevronsLeft className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Explorer Tree Body */}
      <div
        className="flex-1 overflow-y-auto overflow-x-hidden py-1.5 font-mono relative"
        onContextMenu={(e) => handleContextMenu(e)}
      >
        {tree.length === 0 ? (
          <div className="px-4 py-8 text-center text-app-text-muted text-xs flex flex-col items-center">
            <UploadCloud className="w-8 h-8 text-app-text-muted/40 mb-2" />
            <p className="font-sans font-medium">Workspace is empty</p>
            <p className="text-[10px] text-app-text-muted/60 mt-1">
              Drag & drop files or folder here
            </p>
            {!isViewer && (
              <div className="flex flex-col space-y-1 mt-3">
                <button
                  onClick={() => handleOpenCreateModal('new-file')}
                  className="text-app-accent hover:underline text-[11px] font-medium"
                >
                  + Create new file
                </button>
                <button
                  onClick={() => folderInputRef.current?.click()}
                  className="text-app-accent hover:underline text-[11px] font-medium"
                >
                  Upload folder
                </button>
              </div>
            )}
          </div>
        ) : (
          tree.map((node) => renderNode(node, 0))
        )}

        {/* Drag & Drop Visual Overlay */}
        {isDragging && (
          <div className="absolute inset-0 bg-app-accent/20 backdrop-blur-xs border-2 border-dashed border-app-accent flex flex-col items-center justify-center z-30 p-4 pointer-events-none">
            <UploadCloud className="w-10 h-10 text-app-accent animate-bounce mb-2" />
            <p className="text-xs font-bold text-app-accent">Drop files or folder here</p>
            <p className="text-[10.5px] text-app-text-muted mt-1 text-center">
              Max 200 files, 200KB per file, 2MB total
            </p>
          </div>
        )}

        {/* Upload Scanning Progress Overlay */}
        {uploadProgress && (
          <div className="absolute inset-0 bg-app-surface/90 backdrop-blur-xs flex flex-col items-center justify-center z-40 p-4">
            <div className="w-6 h-6 border-2 border-app-accent border-t-transparent rounded-full animate-spin mb-2" />
            <p className="text-xs font-semibold text-app-text">Processing upload...</p>
            <p className="text-[10px] font-mono text-app-text-muted mt-1">
              {uploadProgress.current} / {uploadProgress.total} files inspected
            </p>
          </div>
        )}
      </div>

      {/* Resizer Handle */}
      <div
        onMouseDown={() => setIsResizing(true)}
        className="absolute top-0 right-0 w-1.5 h-full cursor-col-resize hover:bg-app-accent/40 active:bg-app-accent transition-colors z-20"
      />

      {/* Right-click Context Menu */}
      {contextMenu && (
        <div
          style={{ top: `${contextMenu.y}px`, left: `${contextMenu.x}px` }}
          className="fixed z-50 min-w-[160px] bg-app-surface-2 border border-app-border rounded-lg shadow-xl py-1 text-xs text-app-text"
          onClick={(e) => e.stopPropagation()}
        >
          {isViewer ? (
            <div className="px-3 py-1.5 text-app-text-muted italic text-[11px]">
              View Only mode (read-only)
            </div>
          ) : (
            <>
              <button
                onClick={() => {
                  const targetFolder = contextMenu.isFolder
                    ? contextMenu.targetPath
                    : contextMenu.targetPath
                    ? contextMenu.targetPath.split('/').slice(0, -1).join('/')
                    : '';
                  handleOpenCreateModal('new-file', targetFolder);
                  setContextMenu(null);
                }}
                className="w-full text-left px-3 py-1.5 hover:bg-app-accent/20 hover:text-app-accent flex items-center space-x-2"
              >
                <FilePlus className="w-3.5 h-3.5" />
                <span>New File</span>
              </button>
              <button
                onClick={() => {
                  const targetFolder = contextMenu.isFolder
                    ? contextMenu.targetPath
                    : contextMenu.targetPath
                    ? contextMenu.targetPath.split('/').slice(0, -1).join('/')
                    : '';
                  handleOpenCreateModal('new-folder', targetFolder);
                  setContextMenu(null);
                }}
                className="w-full text-left px-3 py-1.5 hover:bg-app-accent/20 hover:text-app-accent flex items-center space-x-2"
              >
                <FolderPlus className="w-3.5 h-3.5" />
                <span>New Folder</span>
              </button>

              {/* Folder specific: Download as ZIP */}
              {contextMenu.isFolder && contextMenu.targetPath && (
                <>
                  <div className="h-[1px] bg-app-border my-1" />
                  <button
                    onClick={() => {
                      handleDownloadZip(contextMenu.targetPath);
                      setContextMenu(null);
                    }}
                    className="w-full text-left px-3 py-1.5 hover:bg-app-accent/20 hover:text-app-accent flex items-center space-x-2"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download as ZIP</span>
                  </button>
                </>
              )}

              {/* File specific: Set as Entry */}
              {!contextMenu.isFolder && contextMenu.targetPath && (
                <>
                  <div className="h-[1px] bg-app-border my-1" />
                  <button
                    onClick={() => {
                      handleSetAsEntry(contextMenu.targetPath!);
                      setContextMenu(null);
                    }}
                    className="w-full text-left px-3 py-1.5 hover:bg-app-accent/20 hover:text-app-accent flex items-center space-x-2"
                  >
                    <PlayCircle className="w-3.5 h-3.5" />
                    <span>Set as Entry</span>
                  </button>
                </>
              )}

              {contextMenu.targetPath && (
                <>
                  <div className="h-[1px] bg-app-border my-1" />
                  <button
                    onClick={() => {
                      handleOpenRenameModal(contextMenu.targetPath!);
                      setContextMenu(null);
                    }}
                    className="w-full text-left px-3 py-1.5 hover:bg-app-accent/20 hover:text-app-accent flex items-center space-x-2"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                    <span>Rename</span>
                  </button>
                  <button
                    onClick={() => {
                      handleOpenDeleteModal(contextMenu.targetPath!);
                      setContextMenu(null);
                    }}
                    className="w-full text-left px-3 py-1.5 hover:bg-app-danger/20 hover:text-app-danger flex items-center space-x-2"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Delete</span>
                  </button>
                </>
              )}
            </>
          )}
        </div>
      )}

      {/* Creation / Rename / Delete Modal */}
      {modalType && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-app-surface border border-app-border rounded-xl shadow-2xl max-w-sm w-full p-4 flex flex-col space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-app-border">
              <h3 className="text-sm font-semibold text-app-text">
                {modalType === 'new-file' && 'Create New File'}
                {modalType === 'new-folder' && 'Create New Folder'}
                {modalType === 'rename' && 'Rename'}
                {modalType === 'delete' && 'Confirm Deletion'}
              </h3>
              <button
                onClick={() => setModalType(null)}
                className="text-app-text-muted hover:text-app-text p-1 rounded"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {modalType === 'delete' ? (
              <div className="flex flex-col space-y-3">
                <div className="flex items-start space-x-2 text-app-danger text-xs">
                  <AlertTriangle className="w-5 h-5 shrink-0" />
                  <p>
                    Are you sure you want to permanently delete{' '}
                    <span className="font-mono font-semibold text-app-text">"{modalTarget}"</span>?
                    This action cannot be undone.
                  </p>
                </div>
                <div className="flex justify-end space-x-2 pt-2">
                  <button
                    onClick={() => setModalType(null)}
                    className="px-3 py-1.5 text-xs text-app-text-muted hover:text-app-text bg-app-surface-2 rounded-lg"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleConfirmModal}
                    className="px-3 py-1.5 text-xs font-semibold text-white bg-app-danger hover:opacity-90 rounded-lg shadow-sm"
                  >
                    Delete Permanently
                  </button>
                </div>
              </div>
            ) : (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleConfirmModal();
                }}
                className="flex flex-col space-y-3"
              >
                <div className="flex flex-col space-y-1">
                  <label className="text-[11px] text-app-text-muted font-medium">
                    {modalType === 'rename' ? 'New path / filename' : 'Path (e.g. src/app.js)'}
                  </label>
                  <input
                    type="text"
                    autoFocus
                    value={modalInputValue}
                    onChange={(e) => {
                      setModalInputValue(e.target.value);
                      if (modalError) setModalError(null);
                    }}
                    placeholder={modalType === 'new-folder' ? 'folder-name' : 'filename.ext'}
                    className="bg-app-surface-2 border border-app-border text-app-text text-xs font-mono rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-app-accent focus:ring-1 focus:ring-app-accent"
                  />
                  {modalError && (
                    <span className="text-[11px] text-app-danger mt-1">{modalError}</span>
                  )}
                </div>

                <div className="flex justify-end space-x-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setModalType(null)}
                    className="px-3 py-1.5 text-xs text-app-text-muted hover:text-app-text bg-app-surface-2 rounded-lg"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-3 py-1.5 text-xs font-semibold text-white bg-app-accent hover:opacity-90 rounded-lg shadow-sm"
                  >
                    Confirm
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Duplicate Paths Conflict Resolution Modal */}
      {conflictState && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-app-surface border border-app-border rounded-xl shadow-2xl max-w-md w-full p-5 flex flex-col space-y-4">
            <div className="flex items-center space-x-2 pb-2 border-b border-app-border text-app-warning">
              <AlertTriangle className="w-5 h-5 shrink-0" />
              <h3 className="text-sm font-semibold text-app-text">File Conflict Detected</h3>
            </div>

            <p className="text-xs text-app-text-muted">
              A file with the path{' '}
              <span className="font-mono font-semibold text-app-text">
                "{conflictState.conflicts[conflictState.currentIndex].path}"
              </span>{' '}
              already exists in the workspace.
            </p>

            <div className="text-[11px] text-app-text-muted bg-app-surface-2 px-3 py-2 rounded-lg border border-app-border">
              Conflict {conflictState.currentIndex + 1} of {conflictState.conflicts.length}
            </div>

            <label className="flex items-center space-x-2 text-xs text-app-text-muted cursor-pointer select-none">
              <input
                type="checkbox"
                checked={conflictState.applyToAll}
                onChange={(e) =>
                  setConflictState({ ...conflictState, applyToAll: e.target.checked })
                }
                className="rounded border-app-border text-app-accent focus:ring-0"
              />
              <span>Apply to all remaining conflicts ({conflictState.conflicts.length - conflictState.currentIndex})</span>
            </label>

            <div className="flex justify-end space-x-2 pt-2">
              <button
                type="button"
                onClick={() => handleResolveConflict('skip')}
                className="px-3 py-1.5 text-xs font-medium text-app-text-muted hover:text-app-text bg-app-surface-2 rounded-lg border border-app-border hover:bg-app-surface-2/80 transition"
              >
                Skip
              </button>
              <button
                type="button"
                onClick={() => handleResolveConflict('rename')}
                className="px-3 py-1.5 text-xs font-medium text-app-accent hover:opacity-90 bg-app-accent/15 border border-app-accent/30 rounded-lg transition"
              >
                Rename
              </button>
              <button
                type="button"
                onClick={() => handleResolveConflict('replace')}
                className="px-3 py-1.5 text-xs font-semibold text-white bg-app-accent hover:opacity-90 rounded-lg shadow-sm transition"
              >
                Replace
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
