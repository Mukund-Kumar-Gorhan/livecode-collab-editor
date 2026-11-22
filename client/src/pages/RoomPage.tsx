import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';
import { EditorHeader, ActiveUser } from '../components/EditorHeader';
import { CodeEditor } from '../components/CodeEditor';
import { FileExplorer } from '../components/explorer/FileExplorer';
import { EditorTabs } from '../components/editor/EditorTabs';
import { MembersPanel } from '../components/members/MembersPanel';
import { Room, RoomRole, RunResult } from '../types';
import { roomApi, runnerApi } from '../services/api';
import { useAuthStore } from '../store/authStore';
import { toast } from '../store/toastStore';
import { getUserColor } from '../utils/colors';
import { getLanguageInfo } from '../utils/language';
import { downloadWorkspaceAsZip } from '../utils/zipUtils';
import { Terminal, CheckCircle2, Loader2, AlertCircle, Keyboard, ChevronUp, ChevronDown } from 'lucide-react';

export const RoomPage: React.FC = () => {
  const { shortId } = useParams<{ shortId: string }>();
  const navigate = useNavigate();
  const { user, accessToken } = useAuthStore();

  const [room, setRoom] = useState<Room | null>(null);
  const [role, setRole] = useState<RoomRole | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [openFiles, setOpenFiles] = useState<string[]>([]);
  const [activeFile, setActiveFile] = useState<string | null>(null);
  const [isExplorerOpen, setIsExplorerOpen] = useState<boolean>(() => window.innerWidth >= 768);

  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'connecting' | 'disconnected'>('connecting');
  const [runnerStatus, setRunnerStatus] = useState<'connected' | 'checking' | 'disconnected'>('checking');
  const [activeUsers, setActiveUsers] = useState<ActiveUser[]>([]);
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const [latestRun, setLatestRun] = useState<RunResult | null>(null);
  const [consoleOutput] = useState<string>(
    `[LiveCode Terminal Ready]\nWorkspace initialized for room.\nSelect or create a file, edit code, and click 'Run'.`
  );
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [consoleTab, setConsoleTab] = useState<'output' | 'stdin'>('output');
  const [stdinText, setStdinText] = useState<string>('');
  const [isMembersOpen, setIsMembersOpen] = useState<boolean>(false);
  const [isConsoleCollapsed, setIsConsoleCollapsed] = useState<boolean>(false);
  const [consoleHeight, setConsoleHeight] = useState<number>(() =>
    typeof window !== 'undefined' && window.innerWidth < 768 ? 140 : 176
  );
  const [isResizingConsole, setIsResizingConsole] = useState<boolean>(false);

  // Mouse drag handler for console panel height
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizingConsole) return;
      const newHeight = Math.max(70, Math.min(window.innerHeight - 150, window.innerHeight - e.clientY));
      setConsoleHeight(newHeight);
      setIsConsoleCollapsed(false);
    };
    const handleMouseUp = () => {
      if (isResizingConsole) setIsResizingConsole(false);
    };

    if (isResizingConsole) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizingConsole]);

  // Yjs: ydoc + provider
  const ydocRef = useRef<Y.Doc | null>(null);
  const [collab, setCollab] = useState<{ ydoc: Y.Doc; provider: WebsocketProvider } | null>(null);
  const hasToken = !!accessToken;

  const activeLangInfo = activeFile
    ? getLanguageInfo(activeFile)
    : { id: 'plaintext', name: 'Plain Text', monacoLanguage: 'plaintext', isExecutable: false };

  // Keyboard shortcut Ctrl+B / Cmd+B for toggling explorer
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') {
        e.preventDefault();
        setIsExplorerOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Poll/check runner health on mount and periodically
  useEffect(() => {
    let isMounted = true;
    const checkRunnerHealth = async () => {
      try {
        await runnerApi.checkHealth();
        if (isMounted) setRunnerStatus('connected');
      } catch {
        if (isMounted) setRunnerStatus('disconnected');
      }
    };

    checkRunnerHealth();
    const interval = setInterval(checkRunnerHealth, 15000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  // Fetch room details on initial load
  useEffect(() => {
    if (!shortId) return;

    const fetchRoom = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const res = await roomApi.getRoom(shortId);
        setRoom(res.data.room);
        setRole(res.data.role);
      } catch (err: any) {
        const msg = err.response?.data?.message || 'Room not found or access denied';
        setError(msg);
        toast.error(msg);
      } finally {
        setIsLoading(false);
      }
    };

    fetchRoom();
  }, [shortId]);

  // Yjs + WebSocket provider
  useEffect(() => {
    if (!shortId || !hasToken || !room) return;

    const token = useAuthStore.getState().accessToken;
    const ydoc = new Y.Doc();
    ydocRef.current = ydoc;

    // Build WebSocket server URL (always from window.location)
    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const serverUrl = `${wsProtocol}//${window.location.host}/collab`;

    const provider = new WebsocketProvider(serverUrl, shortId, ydoc, {
      params: { token: token || '' },
    });

    // Track connection lifecycle
    provider.on('status', ({ status }: { status: 'connected' | 'connecting' | 'disconnected' }) => {
      setConnectionStatus(status);
    });

    // Set local awareness user details
    const userColor = user?.avatarColor || getUserColor(user?.id || user?.email || 'guest');
    const userName = user?.name || user?.email?.split('@')[0] || 'Anonymous';
    const userIdStr = user?.id !== undefined && user?.id !== null ? String(user.id) : undefined;
    provider.awareness.setLocalStateField('user', {
      name: userName,
      color: userColor,
      avatarUrl: user?.avatarUrl || null,
      userId: userIdStr,
      id: userIdStr,
    });

    // Handle peer awareness updates (active users & typing indicators)
    const handleAwarenessChange = () => {
      const states = provider.awareness.getStates();
      const active: ActiveUser[] = [];
      const typing: string[] = [];

      states.forEach((state: any, clientId: number) => {
        if (state && (state.user || state.userId || state.id)) {
          const userObj = state.user || {};
          const rawUserId = userObj.userId ?? userObj.id ?? state.userId ?? state.id;
          const resolvedUserId = rawUserId !== undefined && rawUserId !== null ? String(rawUserId).trim() : undefined;
          const isSelf = clientId === ydoc.clientID;

          active.push({
            clientId,
            userId: resolvedUserId,
            name: userObj.name || state.name || 'Anonymous',
            color: userObj.color || state.color || '#0ea5e9',
            avatarUrl: userObj.avatarUrl || state.avatarUrl || null,
            isCurrentUser: isSelf,
          });

          if (!isSelf && state.isTyping) {
            typing.push(userObj.name || state.name || 'Anonymous');
          }
        }
      });

      setActiveUsers(active);
      setTypingUsers(typing);
    };
    provider.awareness.on('change', handleAwarenessChange);
    handleAwarenessChange();

    // Observe execution results via Y.Doc Y.Map("run")
    const yrun = ydoc.getMap('run');
    const handleRunUpdate = () => {
      const latest = yrun.get('latest') as RunResult | undefined;
      if (latest) {
        setLatestRun(latest);
      }
    };
    yrun.observe(handleRunUpdate);
    handleRunUpdate();

    // Observe metadata map changes (stdin synchronization)
    const metadataMap = ydoc.getMap('metadata');
    const handleMetadataSync = () => {
      const syncdStdin = metadataMap.get('stdin');
      if (typeof syncdStdin === 'string') {
        setStdinText(syncdStdin);
      }
    };
    metadataMap.observe(handleMetadataSync);
    handleMetadataSync();

    // Observe live role changes & member kicks via Y.Doc Y.Map("roles")
    const rolesMap = ydoc.getMap('roles');
    const handleRolesSync = () => {
      if (!user?.id) return;
      const myLiveRole = rolesMap.get(user.id) as string | undefined;

      if (myLiveRole === 'KICKED') {
        toast.error('You have been removed from this room');
        navigate('/dashboard');
        return;
      }

      if (myLiveRole && (myLiveRole === 'EDITOR' || myLiveRole === 'VIEWER' || myLiveRole === 'OWNER')) {
        setRole((prevRole) => {
          if (prevRole && prevRole !== myLiveRole) {
            toast.info(`Your role changed to ${myLiveRole}`);
          }
          return myLiveRole as RoomRole;
        });
      }

      // Sync members list state if room is loaded
      setRoom((prevRoom) => {
        if (!prevRoom || !prevRoom.members) return prevRoom;
        let changed = false;
        const filtered = prevRoom.members
          .filter((m) => rolesMap.get(m.userId) !== 'KICKED')
          .map((m) => {
            const syncedRole = rolesMap.get(m.userId) as RoomRole | undefined;
            if (syncedRole && syncedRole !== m.role && syncedRole !== 'KICKED' as any) {
              changed = true;
              return { ...m, role: syncedRole };
            }
            return m;
          });

        if (changed || filtered.length !== prevRoom.members.length) {
          return { ...prevRoom, members: filtered };
        }
        return prevRoom;
      });
    };
    rolesMap.observe(handleRolesSync);
    handleRolesSync();

    // Observe files map changes (auto-open default file and react to deletions)
    const filesMap = ydoc.getMap('files');
    const handleFilesSync = () => {
      const currentKeys = Array.from(filesMap.keys());
      if (currentKeys.length > 0) {
        setOpenFiles((prev) => {
          if (prev.length === 0) {
            const defaultFile =
              currentKeys.find((k) => ['main.py', 'index.js', 'Main.java', 'main.cpp'].includes(k)) ||
              currentKeys[0];
            setActiveFile(defaultFile);
            return [defaultFile];
          }

          // Check for remotely deleted open files
          const valid = prev.filter((p) => filesMap.has(p));
          const deleted = prev.filter((p) => !filesMap.has(p));
          deleted.forEach((d) => toast.info(`File "${d}" was deleted`));

          if (valid.length === 0 && currentKeys.length > 0) {
            setActiveFile(currentKeys[0]);
            return [currentKeys[0]];
          }
          return valid;
        });

        setActiveFile((currentActive) => {
          if (currentActive && filesMap.has(currentActive)) {
            return currentActive;
          }
          return currentKeys[0] || null;
        });
      }
    };

    filesMap.observe(handleFilesSync);

    const handleSync = (isSynced: boolean) => {
      if (!isSynced) return;
      handleFilesSync();
      handleRunUpdate();
    };
    provider.on('sync', handleSync);

    setCollab({ ydoc, provider });

    return () => {
      provider.off('sync', handleSync);
      provider.awareness.off('change', handleAwarenessChange);
      filesMap.unobserve(handleFilesSync);
      yrun.unobserve(handleRunUpdate);
      metadataMap.unobserve(handleMetadataSync);
      rolesMap.unobserve(handleRolesSync);
      provider.destroy();
      ydoc.destroy();
      ydocRef.current = null;
      setCollab(null);
    };
  }, [shortId, hasToken, room]);

  // Keep awareness user details updated if user profile changes or loads after socket connects
  useEffect(() => {
    if (!collab?.provider || !user) return;
    const userColor = user.avatarColor || getUserColor(user.id || user.email || 'guest');
    const userName = user.name || user.email?.split('@')[0] || 'Anonymous';
    const userIdStr = user.id !== undefined && user.id !== null ? String(user.id) : undefined;

    collab.provider.awareness.setLocalStateField('user', {
      name: userName,
      color: userColor,
      avatarUrl: user.avatarUrl || null,
      userId: userIdStr,
      id: userIdStr,
    });
  }, [collab, user]);

  const handleSelectFile = (path: string) => {
    if (!openFiles.includes(path)) {
      setOpenFiles((prev) => [...prev, path]);
    }
    setActiveFile(path);
    if (typeof window !== 'undefined' && window.innerWidth < 768) {
      setIsExplorerOpen(false);
    }
  };

  const handleCloseTab = (path: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const nextOpen = openFiles.filter((p) => p !== path);
    setOpenFiles(nextOpen);
    if (activeFile === path) {
      if (nextOpen.length > 0) {
        const idx = openFiles.indexOf(path);
        const nextActive = nextOpen[Math.min(idx, nextOpen.length - 1)];
        setActiveFile(nextActive);
      } else {
        setActiveFile(null);
      }
    }
  };

  const handleFileRenamed = (oldPath: string, newPath: string) => {
    setOpenFiles((prev) => prev.map((p) => (p === oldPath ? newPath : p)));
    if (activeFile === oldPath) {
      setActiveFile(newPath);
    }
  };

  const handleFileDeleted = (path: string) => {
    setOpenFiles((prev) => {
      const filtered = prev.filter((p) => p !== path);
      if (activeFile === path) {
        setActiveFile(filtered.length > 0 ? filtered[filtered.length - 1] : null);
      }
      return filtered;
    });
  };

  const handleStdinChange = (newVal: string) => {
    if (role === 'VIEWER') {
      toast.error('Viewers cannot edit standard input');
      return;
    }
    setStdinText(newVal);
    ydocRef.current?.getMap('metadata').set('stdin', newVal);
  };

  const handleRoleChanged = async (targetUserId: string, newRole: 'EDITOR' | 'VIEWER') => {
    if (!shortId) return;
    try {
      await roomApi.updateMemberRole(shortId, targetUserId, newRole);
      setRoom((prev) => {
        if (!prev || !prev.members) return prev;
        return {
          ...prev,
          members: prev.members.map((m) =>
            m.userId === targetUserId ? { ...m, role: newRole } : m
          ),
        };
      });
      toast.success(`Updated role to ${newRole}`);
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || 'Failed to update member role';
      toast.error(msg);
      throw err;
    }
  };

  const handleMemberRemoved = async (targetUserId: string) => {
    if (!shortId) return;
    try {
      await roomApi.removeMember(shortId, targetUserId);
      setRoom((prev) => {
        if (!prev || !prev.members) return prev;
        return {
          ...prev,
          members: prev.members.filter((m) => m.userId !== targetUserId),
        };
      });
      toast.success('Member removed from room');
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || 'Failed to remove member';
      toast.error(msg);
      throw err;
    }
  };

  const handleRunCode = async () => {
    if (!shortId) return;
    if (role === 'VIEWER') {
      toast.error('Viewers are not permitted to run code');
      return;
    }

    const filesMap = ydocRef.current?.getMap('files');
    const hasFiles = filesMap && filesMap.size > 0;

    if (!hasFiles && !activeFile) {
      toast.error('Please open or upload a file to run');
      return;
    }

    if (isRunning) return;

    setIsRunning(true);
    setConsoleTab('output'); // Auto switch to output tab on run
    try {
      const currentStdin = (ydocRef.current?.getMap('metadata').get('stdin') as string) || stdinText;
      const res = await roomApi.runCode(shortId, activeFile || undefined, currentStdin);
      if (res?.data) {
        setLatestRun(res.data);
      }
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || 'Execution failed';
      toast.error(msg);
    } finally {
      setIsRunning(false);
    }
  };

  if (isLoading) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-app-bg text-app-text-muted">
        <Loader2 className="w-8 h-8 text-app-accent animate-spin mb-3" />
        <span className="text-xs font-mono text-app-text-muted">Loading collaborative room {shortId}...</span>
      </div>
    );
  }

  if (error || !room) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-app-bg text-app-text p-6 text-center">
        <div className="w-12 h-12 rounded-xl bg-app-danger/10 border border-app-danger/20 flex items-center justify-center text-app-danger mb-4">
          <AlertCircle className="w-6 h-6" />
        </div>
        <h2 className="text-base font-bold text-app-text">Room Unavailable</h2>
        <p className="text-xs text-app-text-muted max-w-sm mt-1 mb-6">
          {error || `Room "${shortId}" could not be found or you do not have permission to access it.`}
        </p>
        <button
          onClick={() => navigate('/dashboard')}
          className="bg-app-accent hover:opacity-90 text-app-accent-contrast text-xs font-semibold px-4 py-2 rounded-lg transition"
        >
          Back to Dashboard
        </button>
      </div>
    );
  }

  return (
    <div className="h-screen w-screen flex flex-col bg-app-bg text-app-text overflow-hidden select-none">
      {/* Top Navigation Bar with Live Collaboration Stats */}
      <EditorHeader
        room={room}
        role={role}
        activeFile={activeFile}
        activeLanguageName={activeLangInfo.name}
        isExecutable={activeLangInfo.isExecutable}
        onRunCode={handleRunCode}
        isRunning={isRunning}
        onBackToDashboard={() => navigate('/dashboard')}
        onToggleExplorer={() => setIsExplorerOpen((prev) => !prev)}
        isExplorerOpen={isExplorerOpen}
        onOpenMembers={() => setIsMembersOpen(true)}
        onDownloadZip={() => {
          if (ydocRef.current) {
            downloadWorkspaceAsZip(ydocRef.current).catch((err) =>
              toast.error(err.message || 'ZIP error')
            );
          }
        }}
        connectionStatus={connectionStatus}
        activeUsers={activeUsers}
        typingUsers={typingUsers}
      />

      {/* Main VS Code Layout (Sidebar + Tabs + Editor + Bottom Console) */}
      <div className="flex-1 flex min-h-0 overflow-hidden">
        {/* Left Resizable & Collapsible File Explorer */}
        <FileExplorer
          ydoc={collab?.ydoc ?? null}
          isViewer={role === 'VIEWER'}
          activeFile={activeFile}
          onSelectFile={handleSelectFile}
          onFileDeleted={handleFileDeleted}
          onFileRenamed={handleFileRenamed}
          isOpen={isExplorerOpen}
          onToggleOpen={() => setIsExplorerOpen((prev) => !prev)}
        />

        {/* Center Workspace: Tabs + Monaco Editor + Console */}
        <div className="flex-1 flex flex-col min-w-0 min-h-0">
          {/* Editor Tabs */}
          <EditorTabs
            openFiles={openFiles}
            activeFile={activeFile}
            onSelectTab={handleSelectFile}
            onCloseTab={handleCloseTab}
          />

          {/* Editor Area with Monaco & Yjs Binding */}
          <div className="flex-1 min-h-0 relative">
            <CodeEditor
              activeFile={activeFile}
              ydoc={collab?.ydoc ?? null}
              provider={collab?.provider ?? null}
              isViewer={role === 'VIEWER'}
              fontSize={user?.editorFontSize || 14}
              tabSize={user?.tabSize || 2}
            />
          </div>

          {/* Bottom Output Console Panel */}
          <div
            style={{ height: isConsoleCollapsed ? '32px' : `${consoleHeight}px` }}
            className="bg-app-bg border-t border-app-border flex flex-col shrink-0 relative transition-all duration-150"
          >
            {/* Top Resizer Handle (mouse drag) */}
            {!isConsoleCollapsed && (
              <div
                onMouseDown={() => setIsResizingConsole(true)}
                className="absolute -top-1 left-0 right-0 h-2 cursor-row-resize hover:bg-app-accent/40 active:bg-app-accent transition-colors z-20"
                title="Drag to resize console"
              />
            )}

            <div className="h-8 bg-app-surface px-2 sm:px-3 flex items-center justify-between border-b border-app-border text-xs select-none min-w-0">
              <div className="flex items-center space-x-1 min-w-0">
                {/* Tab: Output */}
                <button
                  type="button"
                  onClick={() => {
                    setConsoleTab('output');
                    if (isConsoleCollapsed) setIsConsoleCollapsed(false);
                  }}
                  className={`flex items-center space-x-1 sm:space-x-1.5 px-2 sm:px-2.5 py-1 rounded text-[10px] sm:text-[11px] font-semibold transition shrink-0 ${
                    consoleTab === 'output'
                      ? 'bg-app-bg text-app-text border border-app-border/60 shadow-sm'
                      : 'text-app-text-muted hover:text-app-text hover:bg-app-bg/50'
                  }`}
                >
                  <Terminal className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-app-accent shrink-0" />
                  <span className="uppercase tracking-wider">Output</span>
                  <span className="hidden sm:inline text-app-text-muted text-[10px]">{activeFile ? `(${activeFile})` : ''}</span>
                </button>

                {/* Tab: Input (stdin) */}
                <button
                  type="button"
                  onClick={() => {
                    setConsoleTab('stdin');
                    if (isConsoleCollapsed) setIsConsoleCollapsed(false);
                  }}
                  className={`flex items-center space-x-1 sm:space-x-1.5 px-2 sm:px-2.5 py-1 rounded text-[10px] sm:text-[11px] font-semibold transition shrink-0 ${
                    consoleTab === 'stdin'
                      ? 'bg-app-bg text-app-text border border-app-border/60 shadow-sm'
                      : 'text-app-text-muted hover:text-app-text hover:bg-app-bg/50'
                  }`}
                >
                  <Keyboard className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-sky-400 shrink-0" />
                  <span className="uppercase tracking-wider">Input</span>
                  <span className="hidden sm:inline uppercase tracking-wider">(stdin)</span>
                  {stdinText.trim().length > 0 && (
                    <span className="w-1.5 h-1.5 rounded-full bg-sky-400 ml-0.5" title="Has stdin input" />
                  )}
                </button>
              </div>

              {/* Real Runner Health Indicator & Collapse Button */}
              <div className="flex items-center space-x-2 shrink-0">
                {runnerStatus === 'connected' && (
                  <div className="flex items-center space-x-1 text-app-success text-[10px] sm:text-[11px]">
                    <CheckCircle2 className="w-3 h-3 shrink-0" />
                    <span>Runner: Ready<span className="hidden md:inline"> (Docker Sandbox)</span></span>
                  </div>
                )}
                {runnerStatus === 'checking' && (
                  <div className="flex items-center space-x-1 text-app-warning text-[10px] sm:text-[11px]">
                    <Loader2 className="w-3 h-3 animate-spin shrink-0" />
                    <span>Checking...</span>
                  </div>
                )}
                {runnerStatus === 'disconnected' && (
                  <div
                    className="flex items-center space-x-1 text-app-danger text-[10px] sm:text-[11px]"
                    title="Runner service unreachable"
                  >
                    <AlertCircle className="w-3 h-3 shrink-0" />
                    <span>Offline</span>
                  </div>
                )}

                {/* Collapse / Expand Toggle Button */}
                <button
                  type="button"
                  onClick={() => setIsConsoleCollapsed((prev) => !prev)}
                  className="p-1 rounded text-app-text-muted hover:text-app-text hover:bg-app-surface-2 transition shrink-0 ml-1"
                  title={isConsoleCollapsed ? 'Expand console' : 'Collapse console'}
                >
                  {isConsoleCollapsed ? (
                    <ChevronUp className="w-3.5 h-3.5" />
                  ) : (
                    <ChevronDown className="w-3.5 h-3.5" />
                  )}
                </button>
              </div>
            </div>

            {/* Console Content: Stdin Input Tab OR Output Tab (Hidden when collapsed) */}
            {!isConsoleCollapsed && (
              consoleTab === 'stdin' ? (
                <div className="flex-1 flex flex-col p-2 bg-app-bg overflow-hidden">
                  <div className="flex items-center justify-between pb-1.5 px-1 text-[11px] text-app-text-muted border-b border-app-border/40">
                    <span className="truncate pr-2">
                      Provide program input (stdin) fed to <code className="text-app-accent font-mono text-[10px]">input() / cin</code>
                    </span>
                    <span className="font-mono text-[10px] shrink-0">
                      {new TextEncoder().encode(stdinText).length} / 10240 B {role === 'VIEWER' && '(Read-only)'}
                    </span>
                  </div>
                  <textarea
                    value={stdinText}
                    onChange={(e) => handleStdinChange(e.target.value)}
                    readOnly={role === 'VIEWER'}
                    disabled={role === 'VIEWER'}
                    placeholder={
                      role === 'VIEWER'
                        ? 'Standard input (stdin) is read-only for viewers'
                        : 'Enter program input (stdin) here...\nEach line will be fed to scanf / cin / input() in order (e.g.\n5\n7)'
                    }
                    className="flex-1 w-full bg-transparent resize-none p-2 font-mono text-xs text-app-text placeholder:text-app-text-muted/40 focus:outline-none"
                    maxLength={10240}
                    spellCheck={false}
                  />
                </div>
              ) : (
                <div className="flex-1 p-2 sm:p-3 font-mono text-xs overflow-y-auto selection:bg-app-accent/30 leading-relaxed text-app-text">
                  {latestRun ? (
                    <div className="flex flex-col space-y-2">
                      {/* Meta details bar */}
                      <div className="flex flex-wrap items-center gap-x-2.5 sm:gap-x-3 gap-y-1 text-[10px] sm:text-[11px] pb-1.5 border-b border-app-border text-app-text-muted">
                        <span className="text-app-accent font-semibold truncate max-w-[120px] sm:max-w-none">
                          Run by {latestRun.runBy}
                        </span>
                        <span>•</span>
                        <span>
                          Duration: <span className="text-app-text">{latestRun.durationMs}ms</span>
                        </span>
                        <span>•</span>
                        <span>
                          Exit code:{' '}
                          <span
                            className={
                              latestRun.exitCode === 0
                                ? 'text-app-success font-semibold'
                                : 'text-app-danger font-semibold'
                            }
                          >
                            {latestRun.exitCode ?? 'none'}
                          </span>
                        </span>
                        {latestRun.timedOut && (
                          <span className="bg-app-warning/20 text-app-warning border border-app-warning/40 px-2 py-0.5 rounded font-semibold text-[10px] animate-pulse">
                            Time limit exceeded (5s)
                          </span>
                        )}
                      </div>

                      {/* Input used summary (first line) */}
                      {latestRun.stdin !== undefined && latestRun.stdin.length > 0 && (
                        <div className="flex items-center space-x-2 text-[10.5px] sm:text-[11px] text-app-text-muted bg-app-surface/60 px-2 py-1 rounded border border-app-border/40 font-mono">
                          <span className="text-sky-400 font-semibold shrink-0">Input:</span>
                          <span className="text-app-text truncate max-w-xs sm:max-w-lg">
                            {latestRun.stdin.split('\n')[0]}
                            {latestRun.stdin.includes('\n') ? ' ...' : ''}
                          </span>
                        </div>
                      )}

                      {/* Explicit timeout notice */}
                      {latestRun.timedOut && (
                        <div className="text-app-warning font-semibold text-xs flex items-center space-x-1.5 bg-app-warning/15 p-2 rounded border border-app-warning/30">
                          <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                          <span>Time limit exceeded: Execution exceeded 5.0 seconds.</span>
                        </div>
                      )}

                      {/* Standard Output */}
                      {latestRun.stdout && (
                        <div className="text-app-text whitespace-pre-wrap break-words">
                          {latestRun.stdout}
                        </div>
                      )}

                      {/* Standard Error (Red) */}
                      {latestRun.stderr && (
                        <div className="text-app-danger whitespace-pre-wrap break-words bg-app-danger/10 p-2 rounded border border-app-danger/25">
                          {latestRun.stderr}
                        </div>
                      )}

                      {/* Empty output notice */}
                      {!latestRun.stdout && !latestRun.stderr && !latestRun.timedOut && (
                        <div className="text-app-text-muted italic text-xs">
                          (Process exited with code {latestRun.exitCode} without producing console output)
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-app-text-muted whitespace-pre-wrap break-words">
                      {consoleOutput}
                    </div>
                  )}
                </div>
              )
            )}
          </div>
        </div>
      </div>

      {/* Members Panel Modal */}
      <MembersPanel
        isOpen={isMembersOpen}
        onClose={() => setIsMembersOpen(false)}
        room={room}
        currentRole={role}
        currentUserId={user?.id}
        activeUsers={activeUsers}
        onRoleChanged={handleRoleChanged}
        onMemberRemoved={handleMemberRemoved}
      />
    </div>
  );
};
