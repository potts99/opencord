import { useMemo, useEffect } from 'react';
import { InstanceConnection, AuthClient } from '@opencord/api-client';
import { useInstanceStore } from '@/stores/instance-store';
import { useAuthStore } from '@/stores/auth-store';

export function useActiveConnection(): InstanceConnection | null {
  const activeUrl = useInstanceStore((s) => s.activeInstanceUrl);
  const instances = useInstanceStore((s) => s.instances);

  return useMemo(() => {
    if (!activeUrl) return null;
    return instances.get(activeUrl)?.connection ?? null;
  }, [activeUrl, instances]);
}

export function useInitConnections() {
  const instances = useInstanceStore((s) => s.instances);
  const setInstanceConnection = useInstanceStore((s) => s.setInstanceConnection);
  const setInstanceAuth = useInstanceStore((s) => s.setInstanceAuth);
  const centralAccessToken = useAuthStore((s) => s.accessToken);
  const centralRefreshToken = useAuthStore((s) => s.refreshToken);
  const authServerUrl = useAuthStore((s) => s.authServerUrl);
  const setCentralTokens = useAuthStore((s) => s.setTokens);

  useEffect(() => {
    for (const [url, state] of instances) {
      if (state.connection) continue;

      const isLocalAuth = !state.info?.authServerUrl;

      if (isLocalAuth) {
        // Local auth: use per-instance tokens
        if (!state.accessToken) continue;

        const conn = new InstanceConnection(url, {
          accessToken: state.accessToken,
          refreshToken: state.refreshToken ?? undefined,
          onTokenRefreshed: (newAccess, newRefresh) => {
            setInstanceAuth(url, state.user!, newAccess, newRefresh);
          },
        });
        conn.connectWS();
        setInstanceConnection(url, conn);
      } else {
        // Central auth: use global auth store tokens
        if (!centralAccessToken) continue;

        const conn = new InstanceConnection(url, {
          accessToken: centralAccessToken,
          onAuthFailure: async () => {
            if (!authServerUrl || !centralRefreshToken) return null;
            try {
              const authClient = new AuthClient(authServerUrl, {
                accessToken: centralAccessToken,
                refreshToken: centralRefreshToken,
                onTokenRefreshed: (newAccess, newRefresh) => {
                  setCentralTokens(newAccess, newRefresh);
                },
              });
              const resp = await authClient.refresh();
              return resp.accessToken;
            } catch {
              return null;
            }
          },
        });
        conn.connectWS();
        setInstanceConnection(url, conn);
      }
    }
  }, [instances, setInstanceConnection, setInstanceAuth, centralAccessToken, centralRefreshToken, authServerUrl, setCentralTokens]);
}
