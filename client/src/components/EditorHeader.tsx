import React, { useState } from 'react';
import {
  Play,
  Share2,
  Users,
  Circle,
  Code2,
  ArrowLeft,
  Check,
  Eye,
  PenLine,
  Loader2,
  FolderTree,
} from 'lucide-react';
import { Room, RoomRole } from '../types';
import { toast } from '../store/toastStore';
import { getUserInitials } from '../utils/colors';
import { ThemeSwitcher } from './ThemeSwitcher';

export interface ActiveUser {
  clientId: number;
  name: string;
  color: string;
  avatarUrl?: string | null;
  isCurrentUser?: boolean;
}

interface EditorHeaderProps {
  room?: Room | null;
  role?: RoomRole | null;
  activeFile?: string | null;
  activeLanguageName?: string;
  isExecutable?: boolean;
  onRunCode: () => void;
  isRunning?: boolean;
  onBackToDashboard?: () => void;
  onToggleExplorer?: () => void;
  isExplorerOpen?: boolean;
  connectionStatus?: 'connected' | 'connecting' | 'disconnected';
  activeUsers?: ActiveUser[];
  typingUsers?: string[];
}

export const EditorHeader: React.FC<EditorHeaderProps> = ({
  room,
  role,
  activeFile,
  activeLanguageName = 'Plain Text',
  isExecutable = true,
  onRunCode,
  isRunning = false,
  onBackToDashboard,
  onToggleExplorer,
  isExplorerOpen = true,
  connectionStatus = 'connected',
  activeUsers = [],
  typingUsers = [],
}) => {
  const [copied, setCopied] = useState(false);

  const handleShare = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    toast.success('Room link copied to clipboard!');
    setTimeout(() => setCopied(false), 2000);
  };

  const isViewer = role === 'VIEWER';
  const displayUserCount = Math.max(activeUsers.length, 1);

  return (
    <header className="h-12 bg-app-surface border-b border-app-border px-3 sm:px-4 flex items-center justify-between select-none">
      {/* Brand & Room Info */}
      <div className="flex items-center space-x-2.5 sm:space-x-3">
        {onBackToDashboard && (
          <button
            onClick={onBackToDashboard}
            className="text-app-text-muted hover:text-app-text p-1 hover:bg-app-surface-2 rounded-lg transition"
            title="Back to Dashboard"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
        )}

        {/* Toggle Explorer Button */}
        {onToggleExplorer && (
          <button
            onClick={onToggleExplorer}
            className={`p-1.5 rounded-lg border border-app-border transition ${
              isExplorerOpen
                ? 'bg-app-accent/15 text-app-accent border-app-accent/30'
                : 'text-app-text-muted hover:text-app-text hover:bg-app-surface-2'
            }`}
            title="Toggle File Explorer"
          >
            <FolderTree className="w-4 h-4" />
          </button>
        )}

        <div className="flex items-center space-x-2 text-app-accent font-semibold tracking-wide">
          <Code2 className="w-5 h-5 shrink-0" />
          <span className="hidden md:inline text-xs font-bold text-app-text font-heading">LiveCode</span>
        </div>

        <span className="text-app-border text-xs hidden md:inline">/</span>

        {/* Room Name & Code */}
        <div className="flex items-center space-x-2">
          <span className="text-xs text-app-text font-medium max-w-[120px] sm:max-w-xs truncate">
            {room?.name || 'Collaborative Room'}
          </span>
          <span className="text-[11px] text-app-accent font-mono bg-app-surface-2 px-2 py-0.5 rounded border border-app-border">
            {room?.shortId || 'session'}
          </span>
        </div>

        {/* Role Badge */}
        {role && (
          <span
            className={`text-[9px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded ${
              role === 'OWNER'
                ? 'bg-app-success/15 text-app-success border border-app-success/30'
                : role === 'EDITOR'
                ? 'bg-app-accent/15 text-app-accent border border-app-accent/30'
                : 'bg-app-warning/15 text-app-warning border border-app-warning/30'
            }`}
          >
            {role}
          </span>
        )}

        {/* VIEWER View-Only Badge */}
        {isViewer && (
          <span className="hidden sm:flex items-center space-x-1 text-[10px] font-bold tracking-wider px-2 py-0.5 rounded bg-app-warning/20 text-app-warning border border-app-warning/40">
            <Eye className="w-3 h-3" />
            <span>VIEW ONLY</span>
          </span>
        )}

        {/* Real-time Connection Status */}
        <div className="hidden lg:flex items-center space-x-1.5 pl-2 text-xs">
          {connectionStatus === 'connected' && (
            <>
              <Circle className="w-2 h-2 fill-app-success text-app-success animate-pulse" />
              <span className="text-app-success text-[11px] font-medium">Online</span>
            </>
          )}
          {connectionStatus === 'connecting' && (
            <>
              <Circle className="w-2 h-2 fill-app-warning text-app-warning animate-ping" />
              <span className="text-app-warning text-[11px] font-medium">Reconnecting...</span>
            </>
          )}
          {connectionStatus === 'disconnected' && (
            <>
              <Circle className="w-2 h-2 fill-app-danger text-app-danger" />
              <span className="text-app-danger text-[11px] font-medium">Offline</span>
            </>
          )}
        </div>

        {/* Typing indicator */}
        {typingUsers.length > 0 && (
          <div className="hidden xl:flex items-center space-x-1.5 pl-2 text-app-accent text-[11px] italic animate-pulse">
            <PenLine className="w-3 h-3" />
            <span>
              {typingUsers.length === 1
                ? `${typingUsers[0]} is typing...`
                : `${typingUsers.slice(0, 2).join(', ')} are typing...`}
            </span>
          </div>
        )}
      </div>

      {/* Center / Action Toolbar */}
      <div className="flex items-center space-x-2 sm:space-x-3">
        {/* Active File Language Indicator Badge */}
        <div
          className="flex items-center space-x-1.5 bg-app-surface-2 border border-app-border px-2.5 py-1 rounded-lg text-xs font-mono"
          title={`Active file: ${activeFile || 'None'}`}
        >
          <span className="text-[10px] text-app-text-muted font-semibold tracking-wider uppercase">LANG</span>
          <span className="text-app-text font-medium text-[11px]">{activeLanguageName}</span>
        </div>

        {/* Prominent Run Button */}
        <button
          onClick={onRunCode}
          disabled={isRunning || isViewer || !activeFile || !isExecutable}
          className="flex items-center space-x-1.5 bg-app-success hover:opacity-90 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition shadow-sm font-heading"
          title={
            isViewer
              ? 'Code execution disabled for Viewers'
              : !activeFile
              ? 'Select an active file to run'
              : !isExecutable
              ? 'Execution not supported for this file type'
              : `Run ${activeFile} in Docker Sandbox`
          }
        >
          {isRunning ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Play className="w-3.5 h-3.5 fill-current" />
          )}
          <span>{isRunning ? 'Running...' : 'Run'}</span>
        </button>
      </div>

      {/* Right Collaboration Avatars, Theme & Share */}
      <div className="flex items-center space-x-2">
        {/* Active Users Initials Stack */}
        <div className="hidden sm:flex items-center -space-x-1.5 mr-1">
          {activeUsers.slice(0, 4).map((u) => (
            <div
              key={u.clientId}
              className="w-6 h-6 rounded-full border-2 border-app-surface overflow-hidden flex items-center justify-center text-[10px] font-bold text-white shadow-sm cursor-default select-none"
              style={{ backgroundColor: u.color }}
              title={`${u.name}${u.isCurrentUser ? ' (You)' : ''}`}
            >
              {u.avatarUrl ? (
                <img src={u.avatarUrl} alt={u.name} className="w-full h-full object-cover" />
              ) : (
                getUserInitials(u.name)
              )}
            </div>
          ))}
          {activeUsers.length > 4 && (
            <div
              className="w-6 h-6 rounded-full border-2 border-app-surface bg-app-surface-2 flex items-center justify-center text-[9px] font-bold text-app-text-muted"
              title={`${activeUsers.length - 4} more users`}
            >
              +{activeUsers.length - 4}
            </div>
          )}
        </div>

        {/* Real User Count Badge */}
        <div className="hidden sm:flex items-center space-x-1 bg-app-surface-2 border border-app-border rounded-lg px-2 py-1 text-xs text-app-text-muted">
          <Users className="w-3.5 h-3.5 text-app-accent" />
          <span className="text-[11px] font-medium">
            {displayUserCount} {displayUserCount === 1 ? 'user' : 'users'}
          </span>
        </div>

        {/* Header Theme Switcher */}
        <ThemeSwitcher compact />

        {/* Share Button with Link Copying */}
        <button
          onClick={handleShare}
          className="flex items-center space-x-1.5 bg-app-surface-2 hover:bg-app-border text-app-text text-xs px-2.5 py-1.5 rounded-lg border border-app-border transition shadow-sm font-medium"
          title="Share room link"
        >
          {copied ? <Check className="w-3.5 h-3.5 text-app-success" /> : <Share2 className="w-3.5 h-3.5 text-app-accent" />}
          <span className="hidden sm:inline text-[11px]">
            {copied ? 'Copied!' : 'Share'}
          </span>
        </button>
      </div>
    </header>
  );
};
