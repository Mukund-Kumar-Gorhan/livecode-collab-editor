export type SupportedLanguage = 'python' | 'javascript' | 'java' | 'cpp';

export type AppTheme = 'midnight' | 'light' | 'dracula' | 'one-dark' | 'cyberpunk';

export interface LanguageOption {
  id: SupportedLanguage;
  name: string;
  defaultCode: string;
}

export interface User {
  id: string;
  email: string;
  name: string | null;
  bio?: string | null;
  avatarColor?: string | null;
  avatarUrl?: string | null;
  theme?: AppTheme;
  editorFontSize?: number;
  defaultLanguage?: SupportedLanguage;
  tabSize?: number;
  isAdmin?: boolean;
  status?: 'ACTIVE' | 'DISABLED';
  createdAt?: string;
  updatedAt?: string;
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
    avatarColor?: string | null;
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
    avatarColor?: string | null;
    avatarUrl?: string | null;
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
  avatarUrl?: string | null;
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
  stdin?: string;
  runBy: string;
  runById?: string;
  timestamp: number;
}

// ------------------------------------------------------------------------------
// Admin Types
// ------------------------------------------------------------------------------
export interface AdminStats {
  totalUsers: number;
  totalRooms: number;
  runsToday: number;
  activeNow: number;
  successRate: number; // 0 to 100 percentage
  languageUsage: {
    language: SupportedLanguage;
    count: number;
    percentage: number;
  }[];
  runsLast7Days: {
    date: string;
    dayLabel: string;
    runs: number;
    successCount: number;
  }[];
}

export interface AdminUserListItem {
  id: string;
  email: string;
  name: string | null;
  avatarColor?: string | null;
  avatarUrl?: string | null;
  isAdmin: boolean;
  status: 'ACTIVE' | 'DISABLED';
  createdAt: string;
  roomsCount?: number;
}

export interface AdminRoomListItem {
  id: string;
  shortId: string;
  name: string;
  language: SupportedLanguage;
  description?: string | null;
  ownerId: string;
  createdAt: string;
  updatedAt: string;
  owner?: {
    id: string;
    name: string | null;
    email: string;
    avatarColor?: string | null;
    avatarUrl?: string | null;
  };
  membersCount: number;
}

export interface AdminRunLogItem {
  id: string;
  roomId: string;
  roomName?: string;
  userId?: string | null;
  userEmail?: string | null;
  userName?: string | null;
  language: string;
  status: 'QUEUED' | 'RUNNING' | 'SUCCESS' | 'ERROR' | 'TIMEOUT';
  durationMs?: number;
  output?: string | null;
  createdAt: string;
}

export interface AdminAuditLogItem {
  id: string;
  timestamp: string;
  adminId: string;
  adminEmail: string;
  adminName?: string | null;
  action: string;
  targetType: 'USER' | 'ROOM' | 'SYSTEM' | 'RUN';
  targetId: string;
  targetName?: string | null;
  details?: string;
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

