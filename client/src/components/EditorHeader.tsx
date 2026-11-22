import React, { useState, useRef, useEffect } from 'react';
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
  MoreVertical,
  Download,
} from 'lucide-react';
import { Room, RoomRole } from '../types';
import { toast } from '../store/toastStore';
import { getUserInitials } from '../utils/colors';
import { ThemeSwitcher } from './ThemeSwitcher';

export interface ActiveUser {
  clientId: number;
  userId?: string;
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
  onOpenMembers?: () => void;
  onDownloadZip?: () => void;
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
  onOpenMembers,
  onDownloadZip,
  connectionStatus = 'connected',
  activeUsers = [],
  typingUsers = [],
}) => {
  const [copied, setCopied] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const handleShare = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    toast.success('Room link copied to clipboard!');
    setTimeout(() => setCopied(false), 2000);
  };

  // Close mobile dropdown menu on click outside or escape
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsMobileMenuOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsMobileMenuOpen(false);
      }
    };

    if (isMobileMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isMobileMenuOpen]);

  const isViewer = role === 'VIEWER';
  const displayUserCount = Math.max(activeUsers.length, 1);

  return (
    <header className="h-12 bg-app-surface border-b border-app-border px-2 sm:px-4 flex items-center justify-between select-none relative overflow-visible z-20">
      {/* Brand & Room Info */}
      <div className="flex items-center space-x-1.5 sm:space-x-3 min-w-0">
        {onBackToDashboard && (
          <button
            onClick={onBackToDashboard}
            className="text-app-text-muted hover:text-app-text p-1 hover:bg-app-surface-2 rounded-lg transition shrink-0"
            title="Back to Dashboard"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
        )}

        {/* Toggle Explorer Button */}
        {onToggleExplorer && (
          <button
            onClick={onToggleExplorer}
            className={`p-1.5 rounded-lg border border-app-border transition shrink-0 ${
              isExplorerOpen
                ? 'bg-app-accent/15 text-app-accent border-app-accent/30'
                : 'text-app-text-muted hover:text-app-text hover:bg-app-surface-2'
            }`}
            title="Toggle File Explorer (Ctrl+B)"
          >
            <FolderTree className="w-4 h-4" />
          </button>
        )}

        <div className="flex items-center space-x-1.5 text-app-accent font-semibold tracking-wide shrink-0">
          <Code2 className="w-5 h-5 shrink-0" />
          <span className="hidden md:inline text-xs font-bold text-app-text font-heading">LiveCode</span>
        </div>

        <span className="text-app-border text-xs hidden md:inline">/</span>

        {/* Room Name & Code */}
        <div className="flex items-center space-x-1.5 min-w-0">
          <span className="text-xs text-app-text font-medium max-w-[80px] xs:max-w-[120px] sm:max-w-xs truncate">
            {room?.name || 'Room'}
          </span>
          <span className="hidden sm:inline text-[11px] text-app-accent font-mono bg-app-surface-2 px-1.5 py-0.5 rounded border border-app-border shrink-0">
            {room?.shortId || 'session'}
          </span>
        </div>

        {/* Role Badge */}
        {role && (
          <span
            className={`text-[9px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded shrink-0 hidden xs:inline-block ${
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
          <span className="hidden sm:flex items-center space-x-1 text-[10px] font-bold tracking-wider px-2 py-0.5 rounded bg-app-warning/20 text-app-warning border border-app-warning/40 shrink-0">
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
      <div className="flex items-center space-x-2 shrink-0">
        {/* Active File Language Indicator Badge - hidden on mobile */}
        <div
          className="hidden sm:flex items-center space-x-1.5 bg-app-surface-2 border border-app-border px-2.5 py-1 rounded-lg text-xs font-mono"
          title={`Active file: ${activeFile || 'None'}`}
        >
          <span className="text-[10px] text-app-text-muted font-semibold tracking-wider uppercase">LANG</span>
          <span className="text-app-text font-medium text-[11px]">{activeLanguageName}</span>
        </div>

        {/* Prominent Run Button - ALWAYS VISIBLE */}
        <button
          onClick={onRunCode}
          disabled={isRunning || isViewer || !activeFile || !isExecutable}
          className="flex items-center space-x-1.5 bg-app-success hover:opacity-90 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-semibold px-2.5 sm:px-3 py-1.5 rounded-lg transition shadow-sm font-heading shrink-0"
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

      {/* Right Section: Desktop View */}
      <div className="hidden md:flex items-center space-x-2">
        {/* Active Users Initials Stack */}
        <div className="flex items-center -space-x-1.5 mr-1">
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

        {/* Members Button (opens Members panel modal) */}
        <button
          onClick={onOpenMembers}
          className="flex items-center space-x-1.5 bg-app-surface-2 hover:bg-app-border rounded-lg px-2.5 py-1 text-xs text-app-text border border-app-border transition shadow-sm font-medium"
          title="View and manage room members"
        >
          <Users className="w-3.5 h-3.5 text-app-accent" />
          <span className="text-[11px]">Members</span>
          <span className="text-[10px] font-mono bg-app-border/80 px-1.5 py-0.2 rounded-full text-app-text-muted">
            {room?.members?.length || displayUserCount}
          </span>
        </button>

        {/* Header Theme Switcher */}
        <ThemeSwitcher compact />

        {/* Share Button with Link Copying */}
        <button
          onClick={handleShare}
          className="flex items-center space-x-1.5 bg-app-surface-2 hover:bg-app-border text-app-text text-xs px-2.5 py-1.5 rounded-lg border border-app-border transition shadow-sm font-medium"
          title="Share room link"
        >
          {copied ? <Check className="w-3.5 h-3.5 text-app-success" /> : <Share2 className="w-3.5 h-3.5 text-app-accent" />}
          <span className="text-[11px]">
            {copied ? 'Copied!' : 'Share'}
          </span>
        </button>

        {/* Download ZIP Button */}
        {onDownloadZip && (
          <button
            onClick={onDownloadZip}
            className="flex items-center space-x-1 bg-app-surface-2 hover:bg-app-border text-app-text text-xs p-1.5 rounded-lg border border-app-border transition shadow-sm font-medium"
            title="Download Workspace as ZIP"
          >
            <Download className="w-3.5 h-3.5 text-app-accent" />
          </button>
        )}
      </div>

      {/* Right Section: Mobile "..." Dropdown Menu */}
      <div className="flex md:hidden items-center space-x-1 relative" ref={menuRef}>
        <button
          onClick={() => setIsMobileMenuOpen((prev) => !prev)}
          className={`p-1.5 rounded-lg border border-app-border transition ${
            isMobileMenuOpen
              ? 'bg-app-accent/15 text-app-accent border-app-accent/30'
              : 'text-app-text-muted hover:text-app-text hover:bg-app-surface-2'
          }`}
          title="More options"
          aria-label="More options"
        >
          <MoreVertical className="w-4 h-4" />
        </button>

        {/* Mobile Dropdown Popup */}
        {isMobileMenuOpen && (
          <div className="absolute right-0 top-10 w-56 bg-app-surface border border-app-border rounded-xl shadow-2xl py-2 px-1 z-50 flex flex-col space-y-1 animate-in fade-in zoom-in-95 duration-100">
            {/* Header info / language */}
            <div className="px-3 py-1.5 border-b border-app-border/60 text-[11px] flex items-center justify-between text-app-text-muted">
              <span>{activeFile || 'No file selected'}</span>
              <span className="font-mono text-app-accent font-semibold">{activeLanguageName}</span>
            </div>

            {/* Members Button */}
            <button
              onClick={() => {
                setIsMobileMenuOpen(false);
                onOpenMembers?.();
              }}
              className="w-full flex items-center justify-between px-3 py-2 text-xs text-app-text hover:bg-app-surface-2 rounded-lg transition"
            >
              <div className="flex items-center space-x-2">
                <Users className="w-3.5 h-3.5 text-app-accent" />
                <span>Members</span>
              </div>
              <span className="text-[10px] font-mono bg-app-surface-2 px-2 py-0.5 rounded-full border border-app-border text-app-text-muted">
                {room?.members?.length || displayUserCount} online
              </span>
            </button>

            {/* Theme Switcher in Dropdown */}
            <div className="px-3 py-1.5 flex items-center justify-between text-xs text-app-text">
              <span>Theme</span>
              <ThemeSwitcher compact />
            </div>

            {/* Share Room Link */}
            <button
              onClick={() => {
                handleShare();
              }}
              className="w-full flex items-center justify-between px-3 py-2 text-xs text-app-text hover:bg-app-surface-2 rounded-lg transition"
            >
              <div className="flex items-center space-x-2">
                {copied ? <Check className="w-3.5 h-3.5 text-app-success" /> : <Share2 className="w-3.5 h-3.5 text-app-accent" />}
                <span>{copied ? 'Link Copied!' : 'Share Room Link'}</span>
              </div>
            </button>

            {/* Download ZIP */}
            {onDownloadZip && (
              <button
                onClick={() => {
                  setIsMobileMenuOpen(false);
                  onDownloadZip();
                }}
                className="w-full flex items-center space-x-2 px-3 py-2 text-xs text-app-text hover:bg-app-surface-2 rounded-lg transition"
              >
                <Download className="w-3.5 h-3.5 text-app-accent" />
                <span>Download ZIP</span>
              </button>
            )}

            {/* Room Code */}
            <div className="px-3 py-1.5 border-t border-app-border/60 text-[10px] text-app-text-muted flex items-center justify-between font-mono">
              <span>Code: {room?.shortId}</span>
              <span className="text-app-success">{connectionStatus}</span>
            </div>
          </div>
        )}
      </div>
    </header>
  );
};
