import type { ApiError, ApiResponse, AuthResponse } from '@opencord/shared';

export class HttpClient {
  private baseUrl: string;
  private accessToken: string | null = null;
  private refreshToken: string | null = null;
  private onAuthFailure?: () => Promise<string | null>;
  private onTokenRefreshed?: (accessToken: string, refreshToken: string) => void;

  constructor(
    baseUrl: string,
    options?: {
      accessToken?: string;
      refreshToken?: string;
      onAuthFailure?: () => Promise<string | null>;
      onTokenRefreshed?: (accessToken: string, refreshToken: string) => void;
    }
  ) {
    this.baseUrl = baseUrl.replace(/\/$/, '');
    this.accessToken = options?.accessToken ?? null;
    this.refreshToken = options?.refreshToken ?? null;
    this.onAuthFailure = options?.onAuthFailure;
    this.onTokenRefreshed = options?.onTokenRefreshed;
  }

  setAccessToken(token: string) {
    this.accessToken = token;
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

  getRefreshToken(): string | null {
    return this.refreshToken;
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

    let response = await fetch(url.toString(), {
      method,
      headers,
      body: options?.body ? JSON.stringify(options.body) : undefined,
    });

    if (response.status === 401 && options?.auth !== false) {
      const newToken = await this.tryRefresh();
      if (newToken) {
        headers['Authorization'] = `Bearer ${newToken}`;
        response = await fetch(url.toString(), {
          method,
          headers,
          body: options?.body ? JSON.stringify(options.body) : undefined,
        });
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

  private async tryRefresh(): Promise<string | null> {
    // Try local refresh first (if we have a refresh token)
    if (this.refreshToken) {
      try {
        const resp = await fetch(`${this.baseUrl}/api/auth/refresh`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken: this.refreshToken }),
        });
        if (resp.ok) {
          const data: ApiResponse<AuthResponse> = await resp.json();
          this.accessToken = data.data.accessToken;
          this.refreshToken = data.data.refreshToken;
          this.onTokenRefreshed?.(data.data.accessToken, data.data.refreshToken);
          return data.data.accessToken;
        }
      } catch {
        // Local refresh failed, fall through
      }
    }

    // Fall back to external auth failure callback (central auth refresh)
    if (this.onAuthFailure) {
      const newToken = await this.onAuthFailure();
      if (newToken) {
        this.accessToken = newToken;
        return newToken;
      }
    }

    return null;
  }
}
