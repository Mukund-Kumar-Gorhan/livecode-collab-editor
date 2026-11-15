import { create } from 'zustand';
import { User } from '../types';
import { authApi, injectAuthStore } from '../services/api';

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
    },

    login: async (email: string, password: string) => {
      set({ isLoading: true });
      try {
        const response = await authApi.login({ email, password });
        set({
          user: response.data.user,
          accessToken: response.data.accessToken,
          isLoading: false,
        });
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
        set({
          user: loginResponse.data.user,
          accessToken: loginResponse.data.accessToken,
          isLoading: false,
        });
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
        set({
          user: response.data.user,
          accessToken: response.data.accessToken,
          isInitialized: true,
          isLoading: false,
        });
      } catch {
        set({
          user: null,
          accessToken: null,
          isInitialized: true,
          isLoading: false,
        });
      }
    },
  };
});

