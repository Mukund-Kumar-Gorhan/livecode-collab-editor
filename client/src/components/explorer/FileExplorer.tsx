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
} from 'lucide-react';
import { FileIcon } from './FileIcon';
import { validateWorkspacePath } from '../../utils/pathValidation';
import { toast } from '../../store/toastStore';

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
  const [width, setWidth] = useState<number>(230);
  const [isResizing, setIsResizing] = useState(false);

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

  // 1. Observe Y.Doc files and folders maps
  useEffect(() => {
    if (!ydoc) return;

    const filesMap = ydoc.getMap('files');
    const foldersMap = ydoc.getMap('folders');

    const updateLists = () => {
      const currentFiles = Array.from(filesMap.keys()).sort();
      const currentFolders = Array.from(foldersMap.keys()).sort();
      setFilePaths(currentFiles);
      setFolderPaths(currentFolders);
    };

    updateLists();

    filesMap.observe(updateLists);
    foldersMap.observe(updateLists);

    return () => {
      filesMap.unobserve(updateLists);
      foldersMap.unobserve(updateLists);
    };
  }, [ydoc]);

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

  // Actions: New File / Folder / Rename / Delete
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

      // Check if renaming a file or a folder prefix
      if (filesMap.has(modalTarget)) {
        const fileContent = filesMap.get(modalTarget) as Y.Text;
        const newText = new Y.Text();
        newText.insert(0, fileContent.toString());
        filesMap.delete(modalTarget);
        filesMap.set(newPath, newText);
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
      setModalType(null);
    } else if (modalType === 'delete') {
      const target = modalTarget;
      if (filesMap.has(target)) {
        filesMap.delete(target);
        if (onFileDeleted) onFileDeleted(target);
        toast.info(`Deleted ${target}`);
      } else {
        // Delete all files and subfolders under this folder
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

        {/* Hover Actions (Owner/Editor only) */}
        {!isViewer && (
          <div className="opacity-0 group-hover:opacity-100 flex items-center space-x-1 transition-opacity">
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
      className="h-full bg-app-surface border-r border-app-border flex flex-col relative select-none shrink-0"
    >
      {/* Explorer Header */}
      <div className="h-8 px-3 border-b border-app-border flex items-center justify-between text-xs font-semibold text-app-text-muted bg-app-surface tracking-wider uppercase">
        <div className="flex items-center space-x-1.5">
          <FolderTree className="w-3.5 h-3.5 text-app-accent" />
          <span className="text-[11px]">Explorer</span>
        </div>

        <div className="flex items-center space-x-1">
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
            </>
          )}
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
        className="flex-1 overflow-y-auto overflow-x-hidden py-1.5 font-mono"
        onContextMenu={(e) => handleContextMenu(e)}
      >
        {tree.length === 0 ? (
          <div className="px-4 py-8 text-center text-app-text-muted text-xs">
            <p>Workspace is empty</p>
            {!isViewer && (
              <button
                onClick={() => handleOpenCreateModal('new-file')}
                className="mt-2 text-app-accent hover:underline text-[11px] font-medium"
              >
                + Create new file
              </button>
            )}
          </div>
        ) : (
          tree.map((node) => renderNode(node, 0))
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
          className="fixed z-50 min-w-[150px] bg-app-surface-2 border border-app-border rounded-lg shadow-xl py-1 text-xs text-app-text"
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
    </div>
  );
};
