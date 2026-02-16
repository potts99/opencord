import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User } from '@opencord/shared';

interface AuthState {
  authServerUrl: string | null;
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;

  setAuth: (authServerUrl: string, user: User, accessToken: string, refreshToken: string) => void;
  setTokens: (accessToken: string, refreshToken: string) => void;
  setUser: (user: User) => void;
  clearAuth: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      authServerUrl: null,
      user: null,
      accessToken: null,
      refreshToken: null,

      setAuth: (authServerUrl, user, accessToken, refreshToken) =>
        set({ authServerUrl, user, accessToken, refreshToken }),

      setTokens: (accessToken, refreshToken) =>
        set({ accessToken, refreshToken }),

      setUser: (user) => set({ user }),

      clearAuth: () =>
        set({ authServerUrl: null, user: null, accessToken: null, refreshToken: null }),
    }),
    {
      name: 'opencord-auth',
    }
  )
);
