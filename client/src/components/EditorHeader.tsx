import React, { useState } from 'react';
import { Play, Share2, Users, Circle, Code2, ArrowLeft, Check, Eye, PenLine } from 'lucide-react';
import { Room, RoomRole, SupportedLanguage } from '../types';
import { toast } from '../store/toastStore';
import { getUserInitials } from '../utils/colors';

export interface ActiveUser {
  clientId: number;
  name: string;
  color: string;
  isCurrentUser?: boolean;
}

interface EditorHeaderProps {
  room?: Room | null;
  role?: RoomRole | null;
  language: SupportedLanguage;
  onLanguageChange: (lang: SupportedLanguage) => void;
  onRunCode: () => void;
  isRunning?: boolean;
  onBackToDashboard?: () => void;
  connectionStatus?: 'connected' | 'connecting' | 'disconnected';
  activeUsers?: ActiveUser[];
  typingUsers?: string[];
}

export const EditorHeader: React.FC<EditorHeaderProps> = ({
  room,
  role,
  language,
  onLanguageChange,
  onRunCode,
  isRunning = false,
  onBackToDashboard,
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
    <header className="h-12 bg-[#252526] border-b border-[#3c3c3c] px-4 flex items-center justify-between select-none">
      {/* Brand & Room Info */}
      <div className="flex items-center space-x-3">
        {onBackToDashboard && (
          <button
            onClick={onBackToDashboard}
            className="text-gray-400 hover:text-white p-1 hover:bg-[#323233] rounded transition"
            title="Back to Dashboard"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
        )}

        <div className="flex items-center space-x-2 text-sky-400 font-semibold tracking-wide">
          <Code2 className="w-5 h-5" />
          <span className="text-sm font-bold text-gray-100">LiveCode</span>
        </div>

        <span className="text-gray-500 text-xs">/</span>

        {/* Room Name & Code */}
        <div className="flex items-center space-x-2">
          <span className="text-xs text-gray-200 font-medium max-w-xs truncate">
            {room?.name || 'Collaborative Room'}
          </span>
          <span className="text-xs text-sky-400 font-mono bg-[#1e1e1e] px-2 py-0.5 rounded border border-[#3c3c3c]">
            {room?.shortId || 'session'}
          </span>
        </div>

        {/* Role Badge */}
        {role && (
          <span
            className={`text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded ${
              role === 'OWNER'
                ? 'bg-emerald-950/80 text-emerald-400 border border-emerald-500/30'
                : role === 'EDITOR'
                ? 'bg-sky-950/80 text-sky-400 border border-sky-500/30'
                : 'bg-amber-950/80 text-amber-400 border border-amber-500/30'
            }`}
          >
            {role}
          </span>
        )}

        {/* VIEWER View-Only Badge */}
        {isViewer && (
          <span className="flex items-center space-x-1 text-[10px] font-bold tracking-wider px-2 py-0.5 rounded bg-amber-900/40 text-amber-300 border border-amber-500/40">
            <Eye className="w-3 h-3" />
            <span>VIEW ONLY</span>
          </span>
        )}

        {/* Real-time Connection Status */}
        <div className="hidden sm:flex items-center space-x-1.5 pl-2 text-xs">
          {connectionStatus === 'connected' && (
            <>
              <Circle className="w-2 h-2 fill-emerald-400 text-emerald-400 animate-pulse" />
              <span className="text-emerald-400 text-[11px] font-medium">Online</span>
            </>
          )}
          {connectionStatus === 'connecting' && (
            <>
              <Circle className="w-2 h-2 fill-amber-400 text-amber-400 animate-ping" />
              <span className="text-amber-400 text-[11px] font-medium">Reconnecting...</span>
            </>
          )}
          {connectionStatus === 'disconnected' && (
            <>
              <Circle className="w-2 h-2 fill-red-400 text-red-400" />
              <span className="text-red-400 text-[11px] font-medium">Offline</span>
            </>
          )}
        </div>

        {/* "Rahul is typing..." indicator */}
        {typingUsers.length > 0 && (
          <div className="hidden md:flex items-center space-x-1.5 pl-3 text-sky-400 text-[11px] italic animate-pulse">
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
      <div className="flex items-center space-x-3">
        {/* Language Selector Dropdown */}
        <div className="flex items-center space-x-1.5">
          <label htmlFor="language-select" className="text-xs text-gray-400 font-medium hidden md:inline">
            Language:
          </label>
          <select
            id="language-select"
            value={language}
            disabled={isViewer}
            onChange={(e) => onLanguageChange(e.target.value as SupportedLanguage)}
            title={isViewer ? 'Language changes disabled in View-Only mode' : 'Change workspace language'}
            className="bg-[#1e1e1e] text-gray-200 text-xs rounded border border-[#3c3c3c] px-2.5 py-1.5 focus:outline-none focus:border-sky-500 font-mono transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
          >
            <option value="python">Python 3.11</option>
            <option value="javascript">JavaScript (Node.js)</option>
            <option value="java">Java 17</option>
            <option value="cpp">C++ (g++ 13)</option>
          </select>
        </div>

        {/* Run Button */}
        <button
          onClick={onRunCode}
          disabled={isRunning}
          className="flex items-center space-x-1.5 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 disabled:opacity-50 text-white text-xs font-semibold px-3 py-1.5 rounded transition shadow-sm"
          title="Run code in Docker Sandbox"
        >
          <Play className="w-3.5 h-3.5 fill-current" />
          <span>{isRunning ? 'Running...' : 'Run'}</span>
        </button>
      </div>

      {/* Right Collaboration Avatars & Share */}
      <div className="flex items-center space-x-2">
        {/* Active Users Initials Stack */}
        <div className="hidden sm:flex items-center -space-x-1.5 mr-1">
          {activeUsers.slice(0, 4).map((user) => (
            <div
              key={user.clientId}
              className="w-6 h-6 rounded-full border-2 border-[#252526] flex items-center justify-center text-[10px] font-bold text-white shadow-sm cursor-default select-none"
              style={{ backgroundColor: user.color }}
              title={`${user.name}${user.isCurrentUser ? ' (You)' : ''}`}
            >
              {getUserInitials(user.name)}
            </div>
          ))}
          {activeUsers.length > 4 && (
            <div
              className="w-6 h-6 rounded-full border-2 border-[#252526] bg-[#3c3c3c] flex items-center justify-center text-[9px] font-bold text-gray-300"
              title={`${activeUsers.length - 4} more users`}
            >
              +{activeUsers.length - 4}
            </div>
          )}
        </div>

        {/* Real User Count Badge */}
        <div className="flex items-center space-x-1 bg-[#1e1e1e] border border-[#3c3c3c] rounded px-2 py-1 text-xs text-gray-300">
          <Users className="w-3.5 h-3.5 text-sky-400" />
          <span className="text-[11px] font-medium">
            {displayUserCount} {displayUserCount === 1 ? 'user' : 'users'}
          </span>
        </div>

        {/* Share Button with Link Copying */}
        <button
          onClick={handleShare}
          className="flex items-center space-x-1.5 bg-[#323233] hover:bg-[#3c3c3c] text-gray-200 hover:text-white text-xs px-2.5 py-1 rounded border border-[#3c3c3c] transition shadow-sm"
          title="Share room link"
        >
          {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Share2 className="w-3.5 h-3.5 text-sky-400" />}
          <span className="hidden sm:inline text-[11px] font-medium">
            {copied ? 'Copied!' : 'Share'}
          </span>
        </button>
      </div>
    </header>
  );
};
