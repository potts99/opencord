import type {
  InstanceInfo,
  Channel,
  CreateChannelRequest,
  UpdateChannelRequest,
  Message,
  CreateMessageRequest,
  UpdateMessageRequest,
  MessageListResponse,
  Member,
  UpdateMemberRequest,
  Invite,
  CreateInviteRequest,
  User,
  WSEvent,
  ApiResponse,
  AuthResponse,
  RegisterRequest,
  LoginRequest,
} from '@opencord/shared';
import { WS_RECONNECT_INTERVAL, WS_MAX_RECONNECT_ATTEMPTS } from '@opencord/shared';
import { HttpClient } from './http-client';

export type WSEventHandler = (event: WSEvent) => void;

export class InstanceConnection {
  private http: HttpClient;
  private ws: WebSocket | null = null;
  private wsEventHandlers: Set<WSEventHandler> = new Set();
  private wsReconnectAttempts = 0;
  private wsReconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private _connected = false;

  readonly url: string;

  constructor(
    url: string,
    options?: {
      accessToken?: string;
      refreshToken?: string;
      onAuthFailure?: () => Promise<string | null>;
      onTokenRefreshed?: (accessToken: string, refreshToken: string) => void;
    }
  ) {
    this.url = url.replace(/\/$/, '');
    this.http = new HttpClient(this.url, options);
  }

  get connected(): boolean {
    return this._connected;
  }

  setAccessToken(token: string) {
    this.http.setAccessToken(token);
  }

  setTokens(accessToken: string, refreshToken: string) {
    this.http.setTokens(accessToken, refreshToken);
  }

  // === Local Auth (only available on instances without central auth) ===

  async register(req: RegisterRequest): Promise<AuthResponse> {
    const res = await this.http.request<ApiResponse<AuthResponse>>('POST', '/api/auth/register', {
      body: req,
      auth: false,
    });
    this.http.setTokens(res.data.accessToken, res.data.refreshToken);
    return res.data;
  }

  async login(req: LoginRequest): Promise<AuthResponse> {
    const res = await this.http.request<ApiResponse<AuthResponse>>('POST', '/api/auth/login', {
      body: req,
      auth: false,
    });
    this.http.setTokens(res.data.accessToken, res.data.refreshToken);
    return res.data;
  }

  async refresh(): Promise<AuthResponse> {
    const refreshToken = this.http.getRefreshToken();
    if (!refreshToken) throw new Error('No refresh token');
    const res = await this.http.request<ApiResponse<AuthResponse>>('POST', '/api/auth/refresh', {
      body: { refreshToken },
      auth: false,
    });
    this.http.setTokens(res.data.accessToken, res.data.refreshToken);
    return res.data;
  }

  async logout(): Promise<void> {
    const refreshToken = this.http.getRefreshToken();
    if (!refreshToken) return;
    await this.http.request('DELETE', '/api/auth/logout', {
      body: { refreshToken },
    });
    this.http.clearTokens();
  }

  // === Instance ===

  async getInstanceInfo(): Promise<InstanceInfo> {
    const res = await this.http.request<ApiResponse<InstanceInfo>>('GET', '/api/instance', { auth: false });
    return res.data;
  }

  // === User ===

  async getMe(): Promise<User> {
    const res = await this.http.request<ApiResponse<User>>('GET', '/api/users/me');
    return res.data;
  }

  // === Channels ===

  async createChannel(req: CreateChannelRequest): Promise<Channel> {
    const res = await this.http.request<ApiResponse<Channel>>('POST', '/api/channels', { body: req });
    return res.data;
  }

  async getChannels(): Promise<Channel[]> {
    const res = await this.http.request<ApiResponse<Channel[]>>('GET', '/api/channels');
    return res.data;
  }

  async getChannel(id: string): Promise<Channel> {
    const res = await this.http.request<ApiResponse<Channel>>('GET', `/api/channels/${id}`);
    return res.data;
  }

  async updateChannel(id: string, req: UpdateChannelRequest): Promise<Channel> {
    const res = await this.http.request<ApiResponse<Channel>>('PATCH', `/api/channels/${id}`, { body: req });
    return res.data;
  }

  async deleteChannel(id: string): Promise<void> {
    await this.http.request('DELETE', `/api/channels/${id}`);
  }

  // === Messages ===

  async getMessages(channelId: string, before?: string): Promise<MessageListResponse> {
    const params: Record<string, string> = {};
    if (before) params.before = before;
    return this.http.request<MessageListResponse>('GET', `/api/channels/${channelId}/messages`, { params });
  }

  async sendMessage(channelId: string, req: CreateMessageRequest): Promise<Message> {
    const res = await this.http.request<ApiResponse<Message>>('POST', `/api/channels/${channelId}/messages`, {
      body: req,
    });
    return res.data;
  }

  async updateMessage(id: string, req: UpdateMessageRequest): Promise<Message> {
    const res = await this.http.request<ApiResponse<Message>>('PATCH', `/api/messages/${id}`, { body: req });
    return res.data;
  }

  async deleteMessage(id: string): Promise<void> {
    await this.http.request('DELETE', `/api/messages/${id}`);
  }

  // === Members ===

  async getMembers(): Promise<Member[]> {
    const res = await this.http.request<ApiResponse<Member[]>>('GET', '/api/members');
    return res.data;
  }

  async kickMember(userId: string): Promise<void> {
    await this.http.request('DELETE', `/api/members/${userId}`);
  }

  async updateMemberRole(userId: string, req: UpdateMemberRequest): Promise<Member> {
    const res = await this.http.request<ApiResponse<Member>>('PATCH', `/api/members/${userId}`, { body: req });
    return res.data;
  }

  // === Invites ===

  async createInvite(req?: CreateInviteRequest): Promise<Invite> {
    const res = await this.http.request<ApiResponse<Invite>>('POST', '/api/invites', { body: req ?? {} });
    return res.data;
  }

  async getInvites(): Promise<Invite[]> {
    const res = await this.http.request<ApiResponse<Invite[]>>('GET', '/api/invites');
    return res.data;
  }

  async joinWithInvite(code: string): Promise<Member> {
    const res = await this.http.request<ApiResponse<Member>>('POST', `/api/invites/${code}/join`);
    return res.data;
  }

  // === Upload ===

  async uploadImage(file: File): Promise<string> {
    const formData = new FormData();
    formData.append('file', file);

    const token = this.http.getAccessToken();
    const response = await fetch(`${this.url}/api/upload`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: formData,
    });

    if (!response.ok) throw new Error('Upload failed');
    const data = await response.json();
    return data.data.url;
  }

  // === WebSocket ===

  connectWS() {
    if (this.ws) return;

    const token = this.http.getAccessToken();
    if (!token) return;

    const wsUrl = this.url.replace(/^http/, 'ws') + '/api/ws?token=' + encodeURIComponent(token);
    this.ws = new WebSocket(wsUrl);

    this.ws.onopen = () => {
      this._connected = true;
      this.wsReconnectAttempts = 0;
    };

    this.ws.onmessage = (event) => {
      try {
        const wsEvent: WSEvent = JSON.parse(event.data);
        this.wsEventHandlers.forEach((handler) => handler(wsEvent));
      } catch {
        // ignore parse errors
      }
    };

    this.ws.onclose = () => {
      this._connected = false;
      this.ws = null;
      this.attemptReconnect();
    };

    this.ws.onerror = () => {
      this.ws?.close();
    };
  }

  disconnectWS() {
    if (this.wsReconnectTimer) {
      clearTimeout(this.wsReconnectTimer);
      this.wsReconnectTimer = null;
    }
    this.wsReconnectAttempts = WS_MAX_RECONNECT_ATTEMPTS; // prevent reconnect
    this.ws?.close();
    this.ws = null;
    this._connected = false;
  }

  onWSEvent(handler: WSEventHandler): () => void {
    this.wsEventHandlers.add(handler);
    return () => this.wsEventHandlers.delete(handler);
  }

  sendWSEvent(event: WSEvent) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(event));
    }
  }

  subscribeChannel(channelId: string) {
    this.sendWSEvent({ event: 'subscribe_channel', data: { channelId } });
  }

  unsubscribeChannel(channelId: string) {
    this.sendWSEvent({ event: 'unsubscribe_channel', data: { channelId } });
  }

  sendTyping(channelId: string) {
    this.sendWSEvent({ event: 'typing_start', data: { channelId } });
  }

  private attemptReconnect() {
    if (this.wsReconnectAttempts >= WS_MAX_RECONNECT_ATTEMPTS) return;

    this.wsReconnectTimer = setTimeout(() => {
      this.wsReconnectAttempts++;
      this.connectWS();
    }, WS_RECONNECT_INTERVAL);
  }
}
