import React from 'react';
import { X } from 'lucide-react';
import { FileIcon } from '../explorer/FileIcon';

export interface EditorTabsProps {
  openFiles: string[];
  activeFile: string | null;
  onSelectTab: (path: string) => void;
  onCloseTab: (path: string, e: React.MouseEvent) => void;
}

export const EditorTabs: React.FC<EditorTabsProps> = ({
  openFiles,
  activeFile,
  onSelectTab,
  onCloseTab,
}) => {
  if (openFiles.length === 0) {
    return null;
  }

  return (
    <div className="h-9 bg-app-surface border-b border-app-border flex items-center overflow-x-auto scrollbar-none select-none">
      {openFiles.map((filePath) => {
        const isActive = filePath === activeFile;
        const filename = filePath.split('/').pop() || filePath;

        return (
          <div
            key={filePath}
            onClick={() => onSelectTab(filePath)}
            className={`group h-full flex items-center space-x-2 px-3 border-r border-app-border cursor-pointer text-xs font-mono transition-colors shrink-0 ${
              isActive
                ? 'bg-app-bg text-app-text border-t-2 border-t-app-accent font-medium'
                : 'bg-app-surface text-app-text-muted hover:bg-app-surface-2/60 hover:text-app-text'
            }`}
            title={filePath}
          >
            <FileIcon filename={filename} className="w-3.5 h-3.5" />
            <span className="text-[11.5px] max-w-[140px] truncate">{filename}</span>

            {/* Tab Close Button */}
            <button
              onClick={(e) => onCloseTab(filePath, e)}
              className="p-0.5 rounded text-app-text-muted hover:text-app-text hover:bg-app-surface-2 opacity-60 group-hover:opacity-100 transition"
              title="Close Tab"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        );
      })}
    </div>
  );
};
