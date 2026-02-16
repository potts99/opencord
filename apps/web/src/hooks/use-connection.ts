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
  const accessToken = useAuthStore((s) => s.accessToken);
  const refreshToken = useAuthStore((s) => s.refreshToken);
  const authServerUrl = useAuthStore((s) => s.authServerUrl);
  const setTokens = useAuthStore((s) => s.setTokens);

  useEffect(() => {
    if (!accessToken) return;

    for (const [url, state] of instances) {
      if (!state.connection) {
        const conn = new InstanceConnection(url, {
          accessToken,
          onAuthFailure: async () => {
            // Refresh with central auth server
            if (!authServerUrl || !refreshToken) return null;
            try {
              const authClient = new AuthClient(authServerUrl, {
                accessToken,
                refreshToken,
                onTokenRefreshed: (newAccess, newRefresh) => {
                  setTokens(newAccess, newRefresh);
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
  }, [instances, setInstanceConnection, accessToken, refreshToken, authServerUrl, setTokens]);
}
