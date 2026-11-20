import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';
import { EditorHeader, ActiveUser } from '../components/EditorHeader';
import { CodeEditor } from '../components/CodeEditor';
import { SupportedLanguage, Room, RoomRole, RunResult } from '../types';
import { roomApi, runnerApi } from '../services/api';
import { useAuthStore } from '../store/authStore';
import { toast } from '../store/toastStore';
import { getUserColor } from '../utils/colors';
import { Terminal, CheckCircle2, Loader2, AlertCircle } from 'lucide-react';

export const RoomPage: React.FC = () => {
  const { shortId } = useParams<{ shortId: string }>();
  const navigate = useNavigate();
  const { user, accessToken } = useAuthStore();

  const [room, setRoom] = useState<Room | null>(null);
  const [role, setRole] = useState<RoomRole | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [language, setLanguage] = useState<SupportedLanguage>('python');
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'connecting' | 'disconnected'>('connecting');
  const [runnerStatus, setRunnerStatus] = useState<'connected' | 'checking' | 'disconnected'>('checking');
  const [activeUsers, setActiveUsers] = useState<ActiveUser[]>([]);
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const [latestRun, setLatestRun] = useState<RunResult | null>(null);
  const [consoleOutput, setConsoleOutput] = useState<string>(
    `[LiveCode Terminal Ready]\nWorkspace initialized for room.\nSelect language, edit code, and click 'Run'.`
  );
  const [isRunning, setIsRunning] = useState<boolean>(false);

  // Yjs: ydoc + provider ko STATE me rakha hai taaki change hote hi editor re-render ho
  const ydocRef = useRef<Y.Doc | null>(null);
  const [collab, setCollab] = useState<{ ydoc: Y.Doc; provider: WebsocketProvider } | null>(null);
  const hasToken = !!accessToken;

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

        if (res.data.room.language) {
          setLanguage(res.data.room.language);
        }
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

  // Yjs + WebSocket provider (token refresh par dobara connect nahi hoga)
  useEffect(() => {
    if (!shortId || !hasToken || !room) return;

    const token = useAuthStore.getState().accessToken;
    const ydoc = new Y.Doc();
    ydocRef.current = ydoc;

    // Build WebSocket server URL
    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsHost = window.location.hostname === 'localhost' ? 'localhost:5000' : window.location.host;
    const serverUrl = `${wsProtocol}//${wsHost}/collab`;

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
    provider.awareness.setLocalStateField('user', {
      name: userName,
      color: userColor,
      avatarUrl: user?.avatarUrl || null,
      userId: user?.id,
    });

    // Handle peer awareness updates (active users & typing indicators)
    const handleAwarenessChange = () => {
      const states = provider.awareness.getStates();
      const active: ActiveUser[] = [];
      const typing: string[] = [];

      states.forEach((state: any, clientId: number) => {
        if (state.user) {
          const isSelf = clientId === ydoc.clientID;
          active.push({
            clientId,
            name: state.user.name || 'Anonymous',
            color: state.user.color || '#0ea5e9',
            avatarUrl: state.user.avatarUrl || null,
            isCurrentUser: isSelf,
          });

          if (!isSelf && state.isTyping) {
            typing.push(state.user.name || 'Anonymous');
          }
        }
      });

      setActiveUsers(active);
      setTypingUsers(typing);
    };
    provider.awareness.on('change', handleAwarenessChange);
    handleAwarenessChange();

    // Language sync via Y.Map
    const ymeta = ydoc.getMap('metadata');
    const handleMetaChange = () => {
      const syncedLang = ymeta.get('language') as SupportedLanguage | undefined;
      if (syncedLang) setLanguage(syncedLang);
    };
    ymeta.observe(handleMetaChange);

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

    // Seed sirf server se sync hone ke BAAD, warna doosre ka language override ho jata hai
    const handleSync = (isSynced: boolean) => {
      if (!isSynced) return;
      if (!ymeta.get('language') && room.language) {
        ymeta.set('language', room.language);
      }
      handleMetaChange();
      handleRunUpdate();
    };
    provider.on('sync', handleSync);

    setCollab({ ydoc, provider });

    return () => {
      provider.off('sync', handleSync);
      provider.awareness.off('change', handleAwarenessChange);
      ymeta.unobserve(handleMetaChange);
      yrun.unobserve(handleRunUpdate);
      provider.destroy();
      ydoc.destroy();
      ydocRef.current = null;
      setCollab(null);
    };
  }, [shortId, hasToken, room]);

  const handleLanguageChange = (newLang: SupportedLanguage) => {
    if (role === 'VIEWER') return;
    setLanguage(newLang);
    if (ydocRef.current) {
      ydocRef.current.getMap('metadata').set('language', newLang);
    }
    setConsoleOutput(`[Language Changed] Workspace switched to ${newLang.toUpperCase()}`);
  };

  const handleRunCode = async () => {
    if (!shortId) return;
    if (role === 'VIEWER') {
      toast.error('Viewers are not permitted to run code');
      return;
    }
    if (isRunning) return;

    setIsRunning(true);
    try {
      await roomApi.runCode(shortId);
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || 'Execution failed';
      toast.error(msg);
    } finally {
      setIsRunning(false);
    }
  };

  if (isLoading) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-[#1e1e1e] text-gray-300">
        <Loader2 className="w-8 h-8 text-sky-400 animate-spin mb-3" />
        <span className="text-xs font-mono text-gray-400">Loading collaborative room {shortId}...</span>
      </div>
    );
  }

  if (error || !room) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-[#181818] text-[#cccccc] p-6 text-center">
        <div className="w-12 h-12 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-400 mb-4">
          <AlertCircle className="w-6 h-6" />
        </div>
        <h2 className="text-base font-bold text-gray-100">Room Unavailable</h2>
        <p className="text-xs text-gray-400 max-w-sm mt-1 mb-6">
          {error || `Room "${shortId}" could not be found or you do not have permission to access it.`}
        </p>
        <button
          onClick={() => navigate('/dashboard')}
          className="bg-sky-600 hover:bg-sky-500 text-white text-xs font-medium px-4 py-2 rounded-lg transition"
        >
          Back to Dashboard
        </button>
      </div>
    );
  }

  return (
    <div className="h-screen w-screen flex flex-col bg-[#1e1e1e] text-[#cccccc] overflow-hidden select-none">
      {/* Top Navigation Bar with Live Collaboration Stats */}
      <EditorHeader
        room={room}
        role={role}
        language={language}
        onLanguageChange={handleLanguageChange}
        onRunCode={handleRunCode}
        isRunning={isRunning}
        onBackToDashboard={() => navigate('/dashboard')}
        connectionStatus={connectionStatus}
        activeUsers={activeUsers}
        typingUsers={typingUsers}
      />

      {/* Main Workspace (Editor + Output Console) */}
      <div className="flex-1 flex flex-col min-h-0">
        {/* Editor Area with Monaco & Yjs Binding */}
        <div className="flex-1 min-h-0">
          <CodeEditor
            language={language}
            ydoc={collab?.ydoc ?? null}
            provider={collab?.provider ?? null}
            isViewer={role === 'VIEWER'}
            fontSize={user?.editorFontSize || 14}
            tabSize={user?.tabSize || 2}
          />
        </div>

        {/* Bottom Output Console Panel */}
        <div className="h-48 bg-app-bg border-t border-app-border flex flex-col">
          <div className="h-7 bg-app-surface px-3 flex items-center justify-between border-b border-app-border text-xs select-none">
            <div className="flex items-center space-x-2 text-app-text-muted">
              <Terminal className="w-3.5 h-3.5 text-app-accent" />
              <span className="font-semibold text-[11px] uppercase tracking-wider text-app-text">Console Output</span>
            </div>

            {/* Real Runner Health Indicator */}
            {runnerStatus === 'connected' && (
              <div className="flex items-center space-x-1.5 text-app-success text-[11px]">
                <CheckCircle2 className="w-3 h-3" />
                <span>Runner: Ready (Docker Sandbox)</span>
              </div>
            )}
            {runnerStatus === 'checking' && (
              <div className="flex items-center space-x-1.5 text-app-warning text-[11px]">
                <Loader2 className="w-3 h-3 animate-spin" />
                <span>Runner: Checking health...</span>
              </div>
            )}
            {runnerStatus === 'disconnected' && (
              <div className="flex items-center space-x-1.5 text-app-danger text-[11px]" title="Runner service unreachable at http://localhost:4000">
                <AlertCircle className="w-3 h-3" />
                <span>Runner: Offline</span>
              </div>
            )}
          </div>

          {/* Console Content: Observes latestRun from Y.Map("run") */}
          <div className="flex-1 p-3 font-mono text-xs overflow-y-auto selection:bg-app-accent/30 leading-relaxed text-app-text">
            {latestRun ? (
              <div className="flex flex-col space-y-2">
                {/* Meta details bar */}
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] pb-1.5 border-b border-app-border text-app-text-muted">
                  <span className="text-app-accent font-semibold">
                    Run by {latestRun.runBy}
                  </span>
                  <span>•</span>
                  <span>
                    Duration: <span className="text-app-text">{latestRun.durationMs}ms</span>
                  </span>
                  <span>•</span>
                  <span>
                    Exit code:{' '}
                    <span className={latestRun.exitCode === 0 ? 'text-app-success font-semibold' : 'text-app-danger font-semibold'}>
                      {latestRun.exitCode ?? 'none'}
                    </span>
                  </span>
                  {latestRun.timedOut && (
                    <span className="bg-app-warning/20 text-app-warning border border-app-warning/40 px-2 py-0.5 rounded font-semibold text-[10px] animate-pulse">
                      Time limit exceeded (5s)
                    </span>
                  )}
                </div>

                {/* Explicit timeout notice */}
                {latestRun.timedOut && (
                  <div className="text-app-warning font-semibold text-xs flex items-center space-x-1.5 bg-app-warning/15 p-2 rounded border border-app-warning/30">
                    <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                    <span>Time limit exceeded: Execution exceeded 5.0 seconds and container was terminated.</span>
                  </div>
                )}

                {/* Standard Output */}
                {latestRun.stdout && (
                  <div className="text-app-text whitespace-pre-wrap">
                    {latestRun.stdout}
                  </div>
                )}

                {/* Standard Error (Red) */}
                {latestRun.stderr && (
                  <div className="text-app-danger whitespace-pre-wrap bg-app-danger/10 p-2 rounded border border-app-danger/25">
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
              <div className="text-app-text-muted whitespace-pre-wrap">
                {consoleOutput}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
