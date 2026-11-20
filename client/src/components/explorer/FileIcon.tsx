import React from 'react';
import {
  FileCode,
  FileText,
  FileJson,
  Folder,
  FolderOpen,
  Code,
  File,
  Terminal,
  Coffee,
} from 'lucide-react';

interface FileIconProps {
  filename: string;
  isFolder?: boolean;
  isOpen?: boolean;
  className?: string;
}

export const FileIcon: React.FC<FileIconProps> = ({
  filename,
  isFolder = false,
  isOpen = false,
  className = 'w-4 h-4',
}) => {
  if (isFolder) {
    return isOpen ? (
      <FolderOpen className={`${className} text-amber-400 shrink-0`} />
    ) : (
      <Folder className={`${className} text-amber-400 shrink-0`} />
    );
  }

  const ext = filename.split('.').pop()?.toLowerCase();

  switch (ext) {
    case 'py':
      return <FileCode className={`${className} text-yellow-400 shrink-0`} />;
    case 'js':
    case 'mjs':
    case 'cjs':
      return <Code className={`${className} text-yellow-300 shrink-0`} />;
    case 'ts':
    case 'tsx':
    case 'jsx':
      return <Code className={`${className} text-sky-400 shrink-0`} />;
    case 'java':
      return <Coffee className={`${className} text-orange-400 shrink-0`} />;
    case 'c':
    case 'cpp':
    case 'cc':
    case 'h':
    case 'hpp':
      return <Terminal className={`${className} text-blue-400 shrink-0`} />;
    case 'json':
      return <FileJson className={`${className} text-emerald-400 shrink-0`} />;
    case 'md':
    case 'markdown':
    case 'txt':
      return <FileText className={`${className} text-slate-300 shrink-0`} />;
    case 'html':
      return <FileCode className={`${className} text-orange-500 shrink-0`} />;
    case 'css':
    case 'scss':
      return <FileCode className={`${className} text-cyan-400 shrink-0`} />;
    case 'sh':
    case 'bash':
      return <Terminal className={`${className} text-emerald-400 shrink-0`} />;
    default:
      return <File className={`${className} text-gray-400 shrink-0`} />;
  }
};
