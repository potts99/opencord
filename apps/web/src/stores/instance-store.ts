import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { InstanceInfo, User } from '@opencord/shared';
import { InstanceConnection } from '@opencord/api-client';

export interface InstanceState {
  url: string;
  info: InstanceInfo | null;
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  connection: InstanceConnection | null;
}

interface InstanceStore {
  instances: Map<string, InstanceState>;
  activeInstanceUrl: string | null;

  addInstance: (url: string, info: InstanceInfo) => void;
  removeInstance: (url: string) => void;
  setActiveInstance: (url: string) => void;
  setInstanceAuth: (url: string, user: User, accessToken: string, refreshToken: string) => void;
  setInstanceConnection: (url: string, connection: InstanceConnection) => void;
  getActiveConnection: () => InstanceConnection | null;
  getConnection: (url: string) => InstanceConnection | null;
}

export const useInstanceStore = create<InstanceStore>()(
  persist(
    (set, get) => ({
      instances: new Map(),
      activeInstanceUrl: null,

      addInstance: (url, info) => {
        const instances = new Map(get().instances);
        instances.set(url, {
          url,
          info,
          user: null,
          accessToken: null,
          refreshToken: null,
          connection: null,
        });
        set({
          instances,
          activeInstanceUrl: get().activeInstanceUrl ?? url,
        });
      },

      removeInstance: (url) => {
        const instances = new Map(get().instances);
        const state = instances.get(url);
        if (state?.connection) {
          state.connection.disconnectWS();
        }
        instances.delete(url);
        const newActive = get().activeInstanceUrl === url
          ? (instances.keys().next().value ?? null)
          : get().activeInstanceUrl;
        set({ instances, activeInstanceUrl: newActive });
      },

      setActiveInstance: (url) => set({ activeInstanceUrl: url }),

      setInstanceAuth: (url, user, accessToken, refreshToken) => {
        const instances = new Map(get().instances);
        const existing = instances.get(url);
        if (existing) {
          instances.set(url, { ...existing, user, accessToken, refreshToken });
          set({ instances });
        }
      },

      setInstanceConnection: (url, connection) => {
        const instances = new Map(get().instances);
        const existing = instances.get(url);
        if (existing) {
          instances.set(url, { ...existing, connection });
          set({ instances });
        }
      },

      getActiveConnection: () => {
        const { activeInstanceUrl, instances } = get();
        if (!activeInstanceUrl) return null;
        return instances.get(activeInstanceUrl)?.connection ?? null;
      },

      getConnection: (url) => {
        return get().instances.get(url)?.connection ?? null;
      },
    }),
    {
      name: 'opencord-instances',
      partialize: (state) => {
        // Don't persist connection objects
        const serializable: Record<string, Omit<InstanceState, 'connection'>> = {};
        for (const [url, inst] of state.instances) {
          serializable[url] = {
            url: inst.url,
            info: inst.info,
            user: inst.user,
            accessToken: inst.accessToken,
            refreshToken: inst.refreshToken,
          };
        }
        return {
          instances: serializable,
          activeInstanceUrl: state.activeInstanceUrl,
        };
      },
      merge: (persisted: any, current) => {
        const instances = new Map<string, InstanceState>();
        if (persisted?.instances) {
          for (const [url, inst] of Object.entries(persisted.instances as Record<string, any>)) {
            instances.set(url, { ...inst, connection: null });
          }
        }
        return {
          ...current,
          instances,
          activeInstanceUrl: persisted?.activeInstanceUrl ?? null,
        };
      },
    }
  )
);
