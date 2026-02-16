import type {
  AuthResponse,
  RegisterRequest,
  LoginRequest,
  User,
  ApiResponse,
  ApiError,
} from '@opencord/shared';

export class AuthClient {
  private baseUrl: string;
  private accessToken: string | null = null;
  private refreshToken: string | null = null;
  private onTokenRefreshed?: (accessToken: string, refreshToken: string) => void;

  constructor(
    url: string,
    options?: {
      accessToken?: string;
      refreshToken?: string;
      onTokenRefreshed?: (accessToken: string, refreshToken: string) => void;
    }
  ) {
    this.baseUrl = url.replace(/\/$/, '');
    this.accessToken = options?.accessToken ?? null;
    this.refreshToken = options?.refreshToken ?? null;
    this.onTokenRefreshed = options?.onTokenRefreshed;
  }

  getAccessToken(): string | null {
    return this.accessToken;
  }

  getRefreshToken(): string | null {
    return this.refreshToken;
  }

  async register(req: RegisterRequest): Promise<AuthResponse> {
    const res = await this.request<ApiResponse<AuthResponse>>('POST', '/api/auth/register', req);
    this.accessToken = res.data.accessToken;
    this.refreshToken = res.data.refreshToken;
    return res.data;
  }

  async login(req: LoginRequest): Promise<AuthResponse> {
    const res = await this.request<ApiResponse<AuthResponse>>('POST', '/api/auth/login', req);
    this.accessToken = res.data.accessToken;
    this.refreshToken = res.data.refreshToken;
    return res.data;
  }

  async refresh(): Promise<AuthResponse> {
    if (!this.refreshToken) throw new Error('No refresh token');
    const res = await this.request<ApiResponse<AuthResponse>>('POST', '/api/auth/refresh', {
      refreshToken: this.refreshToken,
    });
    this.accessToken = res.data.accessToken;
    this.refreshToken = res.data.refreshToken;
    this.onTokenRefreshed?.(res.data.accessToken, res.data.refreshToken);
    return res.data;
  }

  async logout(): Promise<void> {
    if (!this.refreshToken) return;
    await this.request('DELETE', '/api/auth/logout', { refreshToken: this.refreshToken });
    this.accessToken = null;
    this.refreshToken = null;
  }

  async getMe(): Promise<User> {
    const res = await this.authedRequest<ApiResponse<User>>('GET', '/api/users/me');
    return res.data;
  }

  async updateMe(data: { displayName?: string; avatarUrl?: string }): Promise<User> {
    const res = await this.authedRequest<ApiResponse<User>>('PATCH', '/api/users/me', data);
    return res.data;
  }

  private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      const error: ApiError = await response.json().catch(() => ({ error: 'Request failed' }));
      throw new Error(error.error);
    }

    if (response.status === 204) return undefined as T;
    return response.json();
  }

  private async authedRequest<T>(method: string, path: string, body?: unknown): Promise<T> {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (this.accessToken) {
      headers['Authorization'] = `Bearer ${this.accessToken}`;
    }

    let response = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    // On 401, try refreshing
    if (response.status === 401 && this.refreshToken) {
      try {
        await this.refresh();
        headers['Authorization'] = `Bearer ${this.accessToken}`;
        response = await fetch(`${this.baseUrl}${path}`, {
          method,
          headers,
          body: body ? JSON.stringify(body) : undefined,
        });
      } catch {
        // Refresh failed
      }
    }

    if (!response.ok) {
      const error: ApiError = await response.json().catch(() => ({ error: 'Request failed' }));
      throw new Error(error.error);
    }

    if (response.status === 204) return undefined as T;
    return response.json();
  }
}
