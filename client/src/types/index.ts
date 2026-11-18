export type SupportedLanguage = 'python' | 'javascript' | 'java' | 'cpp';

export interface LanguageOption {
  id: SupportedLanguage;
  name: string;
  defaultCode: string;
}

export interface User {
  id: string;
  email: string;
  name: string | null;
  avatarUrl?: string | null;
  createdAt?: string;
}

export type RoomRole = 'OWNER' | 'EDITOR' | 'VIEWER';

export interface RoomMember {
  id: string;
  roomId: string;
  userId: string;
  role: RoomRole;
  joinedAt: string;
  user?: {
    id: string;
    name: string | null;
    email: string;
    avatarUrl?: string | null;
  };
}

export interface Room {
  id: string;
  shortId: string;
  name: string;
  language: SupportedLanguage;
  description?: string | null;
  ownerId: string;
  role?: RoomRole;
  createdAt: string;
  updatedAt: string;
  owner?: {
    id: string;
    name: string | null;
    email: string;
  };
  members?: RoomMember[];
  _count?: {
    members: number;
  };
}

export interface UserPresence {
  userId: string;
  name: string;
  color: string;
  cursor?: {
    lineNumber: number;
    column: number;
  };
}

export interface RoomState {
  roomId: string;
  name: string;
  activeLanguage: SupportedLanguage;
  peers: UserPresence[];
  isConnected: boolean;
}

export interface RunResult {
  stdout: string;
  stderr: string;
  exitCode: number | null;
  durationMs: number;
  timedOut: boolean;
  runBy: string;
  runById?: string;
  timestamp: number;
}

