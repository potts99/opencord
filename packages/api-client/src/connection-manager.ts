import type { InstanceConfig } from '@opencord/shared';
import { InstanceConnection } from './instance-connection';

const STORAGE_KEY = 'opencord_instances';

export class ConnectionManager {
  private connections = new Map<string, InstanceConnection>();
  private storage: Storage | null = null;

  constructor(storage?: Storage) {
    this.storage = storage ?? (typeof localStorage !== 'undefined' ? localStorage : null);
    this.loadFromStorage();
  }

  private loadFromStorage() {
    if (!this.storage) return;
    try {
      const raw = this.storage.getItem(STORAGE_KEY);
      if (!raw) return;
      const configs: InstanceConfig[] = JSON.parse(raw);
      for (const config of configs) {
        if (config.accessToken) {
          this.addConnection(config.url, {
            accessToken: config.accessToken,
            refreshToken: config.refreshToken ?? undefined,
          });
        }
      }
    } catch {
      // ignore storage errors
    }
  }

  private saveToStorage() {
    if (!this.storage) return;
    const configs: InstanceConfig[] = [];
    for (const [url, conn] of this.connections) {
      configs.push({
        url,
        name: '', // will be updated when instance info is fetched
        iconUrl: null,
        accessToken: (conn as any).http?.getAccessToken?.() ?? null,
        refreshToken: null, // refresh token stored separately for security
      });
    }
    this.storage.setItem(STORAGE_KEY, JSON.stringify(configs));
  }

  addConnection(
    url: string,
    options?: { accessToken?: string; refreshToken?: string }
  ): InstanceConnection {
    const normalized = url.replace(/\/$/, '');
    if (this.connections.has(normalized)) {
      return this.connections.get(normalized)!;
    }

    const conn = new InstanceConnection(normalized, {
      ...options,
      onTokenRefreshed: () => this.saveToStorage(),
    });
    this.connections.set(normalized, conn);
    this.saveToStorage();
    return conn;
  }

  getConnection(url: string): InstanceConnection | undefined {
    return this.connections.get(url.replace(/\/$/, ''));
  }

  removeConnection(url: string) {
    const normalized = url.replace(/\/$/, '');
    const conn = this.connections.get(normalized);
    if (conn) {
      conn.disconnectWS();
      this.connections.delete(normalized);
      this.saveToStorage();
    }
  }

  getAllConnections(): Map<string, InstanceConnection> {
    return new Map(this.connections);
  }

  getConnectionUrls(): string[] {
    return Array.from(this.connections.keys());
  }

  connectAllWS() {
    for (const conn of this.connections.values()) {
      conn.connectWS();
    }
  }

  disconnectAllWS() {
    for (const conn of this.connections.values()) {
      conn.disconnectWS();
    }
  }
}
