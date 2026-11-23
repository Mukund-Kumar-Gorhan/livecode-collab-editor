import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import {
  Room,
  RoomRole,
  SupportedLanguage,
  User,
  RunResult,
  AdminStats,
  AdminUserListItem,
  AdminRoomListItem,
  AdminRunLogItem,
  AdminAuditLogItem,
  PaginatedResult,
} from '../types';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true,
});

// Reference to token getter/setter from Zustand store (injected to prevent circular dependencies)
let getAccessToken: () => string | null = () => null;
let setAccessToken: (token: string | null) => void = () => { };
let onAuthFailure: () => void = () => { };

export const injectAuthStore = (
  getToken: () => string | null,
  setToken: (token: string | null) => void,
  logoutHandler: () => void
) => {
  getAccessToken = getToken;
  setAccessToken = setToken;
  onAuthFailure = logoutHandler;
};

// Request interceptor: attach Bearer token
apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = getAccessToken();
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor: automatically refresh token on 401
interface CustomAxiosRequestConfig extends InternalAxiosRequestConfig {
  _retry?: boolean;
}

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as CustomAxiosRequestConfig;

    if (!originalRequest) {
      return Promise.reject(error);
    }

    // Skip retry for auth endpoints to prevent infinite loops
    const isAuthRoute =
      originalRequest.url?.includes('/auth/login') ||
      originalRequest.url?.includes('/auth/register') ||
      originalRequest.url?.includes('/auth/refresh');

    if (error.response?.status === 401 && !originalRequest._retry && !isAuthRoute) {
      originalRequest._retry = true;

      try {
        const refreshResponse = await axios.post<{
          success: boolean;
          data: { accessToken: string; user: User };
        }>(
          `${API_BASE_URL}/auth/refresh`,
          {},
          { withCredentials: true }
        );

        const newAccessToken = refreshResponse.data.data.accessToken;
        setAccessToken(newAccessToken);

        if (originalRequest.headers) {
          originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
        }

        return apiClient(originalRequest);
      } catch (refreshError) {
        setAccessToken(null);
        onAuthFailure();
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

// Auth endpoints
export const authApi = {
  getConfig: async () => {
    const res = await apiClient.get<{
      success: boolean;
      data: { inviteCodeRequired: boolean };
    }>('/auth/config');
    return res.data;
  },

  register: async (payload: { name: string; email: string; password: string; inviteCode?: string }) => {
    const res = await apiClient.post<{ success: boolean; message: string; data: { user: User } }>(
      '/auth/register',
      payload
    );
    return res.data;
  },

  login: async (payload: { email: string; password: string }) => {
    const res = await apiClient.post<{
      success: boolean;
      message: string;
      data: { accessToken: string; user: User };
    }>('/auth/login', payload);
    return res.data;
  },

  refresh: async () => {
    const res = await apiClient.post<{
      success: boolean;
      data: { accessToken: string; user: User };
    }>('/auth/refresh');
    return res.data;
  },

  logout: async () => {
    const res = await apiClient.post<{ success: boolean; message: string }>('/auth/logout');
    return res.data;
  },

  getMe: async () => {
    const res = await apiClient.get<{ success: boolean; data: { user: User } }>('/auth/me');
    return res.data;
  },
};

// Room endpoints
export const roomApi = {
  createRoom: async (payload: {
    name: string;
    language?: SupportedLanguage;
    description?: string;
  }) => {
    const res = await apiClient.post<{
      success: boolean;
      message: string;
      data: { room: Room; role: RoomRole };
    }>('/rooms', payload);
    return res.data;
  },

  listRooms: async () => {
    const res = await apiClient.get<{ success: boolean; data: { rooms: Room[] } }>('/rooms');
    return res.data;
  },

  getRoom: async (shortId: string) => {
    const res = await apiClient.get<{
      success: boolean;
      data: { room: Room; role: RoomRole | null };
    }>(`/rooms/${shortId}`);
    return res.data;
  },

  joinRoom: async (shortId: string) => {
    const res = await apiClient.post<{
      success: boolean;
      message: string;
      data: { room: Room; role: RoomRole };
    }>(`/rooms/${shortId}/join`);
    return res.data;
  },

  updateMemberRole: async (shortId: string, userId: string, role: 'EDITOR' | 'VIEWER') => {
    const res = await apiClient.patch<{
      success: boolean;
      message: string;
      data: { member: unknown };
    }>(`/rooms/${shortId}/members/${userId}`, { role });
    return res.data;
  },

  removeMember: async (shortId: string, userId: string) => {
    const res = await apiClient.delete<{ success: boolean; message: string }>(
      `/rooms/${shortId}/members/${userId}`
    );
    return res.data;
  },

  deleteRoom: async (shortId: string) => {
    const res = await apiClient.delete<{ success: boolean; message: string }>(`/rooms/${shortId}`);
    return res.data;
  },

  runCode: async (shortId: string, activeFile?: string, stdin?: string) => {
    const res = await apiClient.post<{
      success: boolean;
      message: string;
      data: RunResult;
    }>(`/rooms/${shortId}/run`, { activeFile, stdin });
    return res.data;
  },
};

// User Profile endpoints
export const userApi = {
  getMe: async () => {
    const res = await apiClient.get<{ success: boolean; data: { user: User } }>('/users/me');
    return res.data;
  },

  updateMe: async (payload: {
    name?: string;
    bio?: string | null;
    avatarColor?: string | null;
    theme?: string;
    editorFontSize?: number;
    defaultLanguage?: SupportedLanguage;
    tabSize?: number;
  }) => {
    const res = await apiClient.patch<{
      success: boolean;
      message: string;
      data: { user: User };
    }>('/users/me', payload);
    return res.data;
  },

  uploadAvatar: async (file: File | Blob) => {
    const res = await apiClient.post<{
      success: boolean;
      message: string;
      data: { user: User };
    }>('/users/me/avatar', file, {
      headers: {
        'Content-Type': file.type || 'image/png',
      },
    });
    return res.data;
  },

  deleteAvatar: async () => {
    const res = await apiClient.delete<{
      success: boolean;
      message: string;
      data: { user: User };
    }>('/users/me/avatar');
    return res.data;
  },

  changePassword: async (payload: { currentPassword: string; newPassword: string }) => {
    const res = await apiClient.patch<{
      success: boolean;
      message: string;
    }>('/users/me/password', payload);
    return res.data;
  },
};

// Runner service API (queried exclusively through server endpoint)
export const runnerApi = {
  checkHealth: async () => {
    const res = await apiClient.get<{
      status: string;
      service: string;
      supportedLanguages: string[];
      queue: { activeJobs: number; queuedJobs: number; maxConcurrency: number };
    }>('/runner/health', { timeout: 4000 });
    return res.data;
  },
};

// Admin panel endpoints
export const adminApi = {
  getStats: async () => {
    const res = await apiClient.get<{
      success: boolean;
      data: AdminStats;
    }>('/admin/stats');
    return res.data;
  },

  getUsers: async (params?: { search?: string; page?: number; limit?: number }) => {
    const res = await apiClient.get<{
      success: boolean;
      data: PaginatedResult<AdminUserListItem>;
    }>('/admin/users', { params });
    return res.data;
  },

  updateUserStatus: async (id: string, status: 'ACTIVE' | 'DISABLED') => {
    const res = await apiClient.patch<{
      success: boolean;
      message: string;
      data: { id: string; status: 'ACTIVE' | 'DISABLED' };
    }>(`/admin/users/${id}/status`, { status });
    return res.data;
  },

  updateUserRole: async (id: string, isAdmin: boolean) => {
    const res = await apiClient.patch<{
      success: boolean;
      message: string;
      data: { id: string; isAdmin: boolean };
    }>(`/admin/users/${id}/role`, { isAdmin });
    return res.data;
  },

  deleteUser: async (id: string) => {
    const res = await apiClient.delete<{
      success: boolean;
      message: string;
    }>(`/admin/users/${id}`);
    return res.data;
  },

  getRooms: async (params?: { search?: string; page?: number; limit?: number }) => {
    const res = await apiClient.get<{
      success: boolean;
      data: PaginatedResult<AdminRoomListItem>;
    }>('/admin/rooms', { params });
    return res.data;
  },

  deleteRoom: async (shortId: string) => {
    const res = await apiClient.delete<{
      success: boolean;
      message: string;
    }>(`/admin/rooms/${shortId}`);
    return res.data;
  },

  getRunLogs: async (params?: {
    language?: string;
    status?: string;
    page?: number;
    limit?: number;
  }) => {
    const res = await apiClient.get<{
      success: boolean;
      data: PaginatedResult<AdminRunLogItem>;
    }>('/admin/runs', { params });
    return res.data;
  },

  getAuditLogs: async (params?: { page?: number; limit?: number }) => {
    const res = await apiClient.get<{
      success: boolean;
      data: PaginatedResult<AdminAuditLogItem>;
    }>('/admin/audit-logs', { params });
    return res.data;
  },
};

