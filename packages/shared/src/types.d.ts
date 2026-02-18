export interface User {
    id: string;
    email: string;
    username: string;
    displayName: string;
    avatarUrl: string | null;
    createdAt: string;
}
export interface AuthResponse {
    accessToken: string;
    refreshToken: string;
    user: User;
}
export interface RegisterRequest {
    email: string;
    username: string;
    displayName: string;
    password: string;
}
export interface LoginRequest {
    email: string;
    password: string;
}
export interface RefreshRequest {
    refreshToken: string;
}
export interface Channel {
    id: string;
    name: string;
    type: 'text' | 'voice';
    position: number;
    createdAt: string;
}
export interface CreateChannelRequest {
    name: string;
    type: 'text' | 'voice';
}
export interface UpdateChannelRequest {
    name?: string;
    position?: number;
}
export interface Message {
    id: string;
    channelId: string;
    authorId: string;
    content: string;
    imageUrl: string | null;
    createdAt: string;
    updatedAt: string | null;
    author?: MessageAuthor;
}
export interface MessageAuthor {
    id: string;
    username: string;
    displayName: string;
    avatarUrl: string | null;
}
export interface CreateMessageRequest {
    content: string;
    imageUrl?: string;
}
export interface UpdateMessageRequest {
    content: string;
}
export interface MessageListResponse {
    data: Message[];
    hasMore: boolean;
}
export interface Member {
    id: string;
    userId: string;
    username: string;
    displayName: string;
    avatarUrl: string | null;
    role: 'owner' | 'admin' | 'member';
    joinedAt: string;
}
export interface UpdateMemberRequest {
    role: 'admin' | 'member';
}
export interface Invite {
    id: string;
    code: string;
    createdBy: string;
    expiresAt: string | null;
    createdAt: string;
}
export interface CreateInviteRequest {
    expiresInHours?: number;
}
export interface InstanceInfo {
    name: string;
    iconUrl: string | null;
    description: string | null;
    version: string;
    registrationOpen: boolean;
    authServerUrl: string | null;
}
export type WSEventType = 'ping' | 'pong' | 'subscribe_channel' | 'unsubscribe_channel' | 'message_create' | 'message_update' | 'message_delete' | 'typing_start' | 'presence_update' | 'member_join' | 'member_leave' | 'channel_create' | 'channel_update' | 'channel_delete' | 'rtc:join' | 'rtc:offer' | 'rtc:answer' | 'rtc:ice_candidate' | 'rtc:peer_joined' | 'rtc:peer_left' | 'rtc:leave';
export interface WSEvent<T = unknown> {
    event: WSEventType;
    data: T;
}
export interface ApiResponse<T> {
    data: T;
}
export interface ApiError {
    error: string;
}
export interface InstanceConfig {
    url: string;
    name: string;
    iconUrl: string | null;
    accessToken: string | null;
    refreshToken: string | null;
}
//# sourceMappingURL=types.d.ts.map