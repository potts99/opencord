import { useMemo, useEffect } from 'react';
import { InstanceConnection } from '@opencord/api-client';
import { useInstanceStore } from '@/stores/instance-store';

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

  useEffect(() => {
    for (const [url, state] of instances) {
      if (state.accessToken && !state.connection) {
        const conn = new InstanceConnection(url, {
          accessToken: state.accessToken,
          refreshToken: state.refreshToken ?? undefined,
          onTokenRefreshed: (accessToken, refreshToken) => {
            useInstanceStore.getState().setInstanceAuth(
              url,
              state.user!,
              accessToken,
              refreshToken
            );
          },
        });
        conn.connectWS();
        setInstanceConnection(url, conn);
      }
    }
  }, [instances, setInstanceConnection]);
}
