import type { ApiError } from '@opencord/shared';

export class HttpClient {
  private baseUrl: string;
  private accessToken: string | null = null;
  private refreshToken: string | null = null;
  private onTokenRefreshed?: (accessToken: string, refreshToken: string) => void;

  constructor(
    baseUrl: string,
    options?: {
      accessToken?: string;
      refreshToken?: string;
      onTokenRefreshed?: (accessToken: string, refreshToken: string) => void;
    }
  ) {
    this.baseUrl = baseUrl.replace(/\/$/, '');
    this.accessToken = options?.accessToken ?? null;
    this.refreshToken = options?.refreshToken ?? null;
    this.onTokenRefreshed = options?.onTokenRefreshed;
  }

  setTokens(accessToken: string, refreshToken: string) {
    this.accessToken = accessToken;
    this.refreshToken = refreshToken;
  }

  clearTokens() {
    this.accessToken = null;
    this.refreshToken = null;
  }

  getAccessToken(): string | null {
    return this.accessToken;
  }

  getBaseUrl(): string {
    return this.baseUrl;
  }

  async request<T>(
    method: string,
    path: string,
    options?: { body?: unknown; params?: Record<string, string>; auth?: boolean }
  ): Promise<T> {
    const url = new URL(`${this.baseUrl}${path}`);
    if (options?.params) {
      Object.entries(options.params).forEach(([k, v]) => url.searchParams.set(k, v));
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (options?.auth !== false && this.accessToken) {
      headers['Authorization'] = `Bearer ${this.accessToken}`;
    }

    const response = await fetch(url.toString(), {
      method,
      headers,
      body: options?.body ? JSON.stringify(options.body) : undefined,
    });

    if (response.status === 401 && this.refreshToken && options?.auth !== false) {
      const refreshed = await this.tryRefresh();
      if (refreshed) {
        return this.request<T>(method, path, options);
      }
    }

    if (!response.ok) {
      const error: ApiError = await response.json().catch(() => ({ error: 'Request failed' }));
      throw new Error(error.error);
    }

    if (response.status === 204) {
      return undefined as T;
    }

    return response.json();
  }

  private async tryRefresh(): Promise<boolean> {
    if (!this.refreshToken) return false;

    try {
      const response = await fetch(`${this.baseUrl}/api/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: this.refreshToken }),
      });

      if (!response.ok) return false;

      const data = await response.json();
      this.accessToken = data.data.accessToken;
      this.refreshToken = data.data.refreshToken;
      this.onTokenRefreshed?.(data.data.accessToken, data.data.refreshToken);
      return true;
    } catch {
      return false;
    }
  }
}
