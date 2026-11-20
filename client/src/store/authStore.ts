import { create } from 'zustand';
import { User } from '../types';
import { authApi, userApi, injectAuthStore } from '../services/api';
import { useThemeStore } from './themeStore';

interface AuthState {
  user: User | null;
  accessToken: string | null;
  isLoading: boolean;
  isInitialized: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  checkAuth: () => Promise<void>;
  setAccessToken: (token: string | null) => void;
  setUser: (user: User | null) => void;
  refreshProfile: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => {
  // Inject access token callbacks into API client
  injectAuthStore(
    () => get().accessToken,
    (token) => set({ accessToken: token }),
    () => set({ user: null, accessToken: null })
  );

  return {
    user: null,
    accessToken: null,
    isLoading: false,
    isInitialized: false,

    setAccessToken: (token: string | null) => {
      set({ accessToken: token });
    },

    setUser: (user: User | null) => {
      set({ user });
      if (user?.theme) {
        useThemeStore.getState().initTheme(user.theme);
      }
    },

    login: async (email: string, password: string) => {
      set({ isLoading: true });
      try {
        const response = await authApi.login({ email, password });
        const loggedUser = response.data.user;
        set({
          user: loggedUser,
          accessToken: response.data.accessToken,
          isLoading: false,
        });
        if (loggedUser.theme) {
          useThemeStore.getState().initTheme(loggedUser.theme);
        }
      } catch (error) {
        set({ isLoading: false });
        throw error;
      }
    },

    register: async (name: string, email: string, password: string) => {
      set({ isLoading: true });
      try {
        await authApi.register({ name, email, password });
        // Automatically login after successful registration
        const loginResponse = await authApi.login({ email, password });
        const loggedUser = loginResponse.data.user;
        set({
          user: loggedUser,
          accessToken: loginResponse.data.accessToken,
          isLoading: false,
        });
        if (loggedUser.theme) {
          useThemeStore.getState().initTheme(loggedUser.theme);
        }
      } catch (error) {
        set({ isLoading: false });
        throw error;
      }
    },

    logout: async () => {
      try {
        await authApi.logout();
      } catch {
        // Clear local state regardless of server logout result
      } finally {
        set({ user: null, accessToken: null });
      }
    },

    checkAuth: async () => {
      set({ isLoading: true });
      try {
        const response = await authApi.refresh();
        const currentUser = response.data.user;
        set({
          user: currentUser,
          accessToken: response.data.accessToken,
          isInitialized: true,
          isLoading: false,
        });
        if (currentUser.theme) {
          useThemeStore.getState().initTheme(currentUser.theme);
        }
      } catch {
        set({
          user: null,
          accessToken: null,
          isInitialized: true,
          isLoading: false,
        });
      }
    },

    refreshProfile: async () => {
      try {
        const res = await userApi.getMe();
        const updated = res.data.user;
        set({ user: updated });
        if (updated.theme) {
          useThemeStore.getState().initTheme(updated.theme);
        }
      } catch {
        // Ignore refresh failure
      }
    },
  };
});

