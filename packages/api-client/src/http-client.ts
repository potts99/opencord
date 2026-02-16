import type { ApiError } from '@opencord/shared';

export class HttpClient {
  private baseUrl: string;
  private accessToken: string | null = null;
  private onAuthFailure?: () => Promise<string | null>;

  constructor(
    baseUrl: string,
    options?: {
      accessToken?: string;
      onAuthFailure?: () => Promise<string | null>;
    }
  ) {
    this.baseUrl = baseUrl.replace(/\/$/, '');
    this.accessToken = options?.accessToken ?? null;
    this.onAuthFailure = options?.onAuthFailure;
  }

  setAccessToken(token: string) {
    this.accessToken = token;
  }

  clearTokens() {
    this.accessToken = null;
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

    let response = await fetch(url.toString(), {
      method,
      headers,
      body: options?.body ? JSON.stringify(options.body) : undefined,
    });

    if (response.status === 401 && options?.auth !== false && this.onAuthFailure) {
      const newToken = await this.onAuthFailure();
      if (newToken) {
        this.accessToken = newToken;
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
}
