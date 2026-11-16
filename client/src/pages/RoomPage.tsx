import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';
import { EditorHeader, ActiveUser } from '../components/EditorHeader';
import { CodeEditor } from '../components/CodeEditor';
import { SupportedLanguage, Room, RoomRole } from '../types';
import { roomApi } from '../services/api';
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
  const [activeUsers, setActiveUsers] = useState<ActiveUser[]>([]);
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const [consoleOutput, setConsoleOutput] = useState<string>(
    `[LiveCode Terminal Ready]\nWorkspace initialized for room.\nSelect language, edit code, and click 'Run'.`
  );
  const [isRunning, setIsRunning] = useState<boolean>(false);

  // Yjs and WebsocketProvider references
  const ydocRef = useRef<Y.Doc | null>(null);
  const providerRef = useRef<WebsocketProvider | null>(null);
  const [collabReady, setCollabReady] = useState(false);

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

  // Initialize Yjs and WebSocket provider once room and auth token are available
  useEffect(() => {
    if (!shortId || !accessToken || !room) return;

    const ydoc = new Y.Doc();
    ydocRef.current = ydoc;

    // Build WebSocket server URL
    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsHost = window.location.hostname === 'localhost' ? 'localhost:5000' : window.location.host;
    const serverUrl = `${wsProtocol}//${wsHost}/collab`;

    const provider = new WebsocketProvider(serverUrl, shortId, ydoc, {
      params: { token: accessToken },
    });
    providerRef.current = provider;

    // Track connection lifecycle
    provider.on('status', ({ status }: { status: 'connected' | 'connecting' | 'disconnected' }) => {
      setConnectionStatus(status);
    });

    // Set local awareness user details
    const userColor = getUserColor(user?.id || user?.email || 'guest');
    const userName = user?.name || user?.email?.split('@')[0] || 'Anonymous';
    provider.awareness.setLocalStateField('user', {
      name: userName,
      color: userColor,
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

    // Sync language selection via Y.Map
    const ymeta = ydoc.getMap('metadata');
    const handleMetaChange = () => {
      const syncedLang = ymeta.get('language') as SupportedLanguage;
      if (syncedLang && syncedLang !== language) {
        setLanguage(syncedLang);
      }
    };
    ymeta.observe(handleMetaChange);

    // Seed local language into metadata if not present
    if (room.language && !ymeta.get('language')) {
      ymeta.set('language', room.language);
    }

    setCollabReady(true);

    return () => {
      provider.awareness.off('change', handleAwarenessChange);
      ymeta.unobserve(handleMetaChange);
      provider.destroy();
      ydoc.destroy();
      ydocRef.current = null;
      providerRef.current = null;
      setCollabReady(false);
    };
  }, [shortId, accessToken, room]);

  const handleLanguageChange = (newLang: SupportedLanguage) => {
    if (role === 'VIEWER') return;
    setLanguage(newLang);
    if (ydocRef.current) {
      ydocRef.current.getMap('metadata').set('language', newLang);
    }
    setConsoleOutput(`[Language Changed] Workspace switched to ${newLang.toUpperCase()}`);
  };

  const handleRunCode = () => {
    setIsRunning(true);
    setConsoleOutput(
      `[Runner] Dispatching job for ${language.toUpperCase()}...\nPlanned docker sandbox limits:\n  --network=none --memory=128m --cpus=0.5 --pids-limit=64 --timeout=5s\n\n[Status] Simulated execution success:\nHello, World from ${language.toUpperCase()}!\nExecution time: 42ms | Exit Code: 0`
    );
    setTimeout(() => {
      setIsRunning(false);
    }, 400);
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
            ydoc={collabReady ? ydocRef.current : null}
            provider={collabReady ? providerRef.current : null}
            isViewer={role === 'VIEWER'}
          />
        </div>

        {/* Bottom Output Console Panel */}
        <div className="h-44 bg-[#181818] border-t border-[#3c3c3c] flex flex-col">
          <div className="h-7 bg-[#252526] px-3 flex items-center justify-between border-b border-[#3c3c3c] text-xs select-none">
            <div className="flex items-center space-x-2 text-gray-300">
              <Terminal className="w-3.5 h-3.5 text-sky-400" />
              <span className="font-semibold text-[11px] uppercase tracking-wider">Console Output</span>
            </div>
            <div className="flex items-center space-x-1 text-emerald-400 text-[11px]">
              <CheckCircle2 className="w-3 h-3" />
              <span>Runner Service: Connected (Stub)</span>
            </div>
          </div>
          <div className="flex-1 p-3 font-mono text-xs text-gray-300 overflow-y-auto whitespace-pre-wrap selection:bg-sky-900 leading-relaxed">
            {consoleOutput}
          </div>
        </div>
      </div>
    </div>
  );
};
