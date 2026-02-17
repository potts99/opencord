# OpenCord MVP — Feature Tracker

## Phase 1: Project Scaffold
- [x] Init Nx workspace with package.json, nx.json, tsconfig.base.json
- [x] Create CLAUDE.md with architecture docs and conventions
- [x] Create .gitignore, .env.example (per-app)
- [x] Scaffold directory structure for all apps and packages
- [x] Set up Go module with dependencies (go.mod, go.sum)
- [x] Set up shared packages (shared, api-client, ui)
- [x] Docker Compose with Postgres + Redis + Auth + API + Web
- [x] Dockerfiles (multi-stage Go build, Vite + Nginx)
- [x] Nginx config with SPA fallback + API/WS proxy

## Phase 2: Central Auth + Instance Info
- [x] Central auth server (`apps/auth/`) with ES256 JWT signing
- [x] Auth database migration: users, refresh_tokens tables
- [x] `POST /api/auth/register` — email/username/password registration (central auth)
- [x] `POST /api/auth/login` — email/password login (central auth)
- [x] `POST /api/auth/refresh` — JWT refresh token rotation (central auth)
- [x] `DELETE /api/auth/logout` — invalidate refresh token (central auth)
- [x] ES256 key pair management with auto-generation and JWKS endpoint
- [x] `GET /.well-known/jwks.json` — public key distribution
- [x] `GET /api/users/me`, `PATCH /api/users/me` (central auth)
- [x] Password hashing with bcrypt (central auth)
- [x] Instance JWKS client — fetches public keys, validates JWTs locally
- [x] Instance auth middleware — validates ES256 JWT, upserts user cache
- [x] Instance database migration: users (cache), channels, members, invites, messages, instance_settings
- [x] `GET /api/instance` public endpoint (name, icon, description, registration status, authServerUrl)
- [x] Central auth deployed to Railway with PlanetScale PostgreSQL
- [x] `AuthClient` class in api-client package
- [x] Central auth login/register page (`apps/web/src/pages/auth.tsx`)
- [x] Global auth store (Zustand, persisted to localStorage)
- [x] Updated "Add Instance" flow (URL → verify authServerUrl → invite code → join)
- [x] Instance connections use central JWT (shared across all instances)
- [x] `onAuthFailure` callback for token refresh via central auth
- [x] Instance setup documentation (`docs/setup-instance.md`)
- [ ] Input validation on registration (email format, password length, username rules)
- [ ] Error messages for duplicate email/username on register
- [ ] "Forgot password" flow (email-based reset)
- [ ] Auto-create first user as instance owner (when no members exist on join)
- [ ] End-to-end testing: register → add instance → join → chat

## Phase 3: Channels & Members
- [x] Database migration: channels, members, invites tables
- [x] Channel CRUD endpoints (POST, GET, GET/:id, PATCH, DELETE)
- [x] Member list endpoint (GET /api/members)
- [x] Member kick (DELETE /api/members/:userId) — admin/owner only
- [x] Member role change (PATCH /api/members/:userId) — owner only
- [x] Invite creation (POST /api/invites) with optional expiry
- [x] Invite list (GET /api/invites)
- [x] Join via invite (POST /api/invites/:code/join)
- [x] Channel sidebar UI with text/voice channel sections
- [x] Inline channel creation in sidebar
- [x] Instance switcher sidebar (left icon bar)
- [x] Member sidebar (right panel, grouped by role)
- [ ] Channel reordering (drag-and-drop or position update)
- [ ] Channel deletion confirmation dialog
- [ ] Invite link copy-to-clipboard UI
- [ ] Invite management UI (view, revoke)
- [ ] Role management UI (promote/demote members)
- [ ] Instance settings page (name, icon, description, registration toggle)
- [ ] Member count display

## Phase 4: Real-Time Messaging
- [x] Database migration: messages table with cursor pagination index
- [x] Message CRUD endpoints (POST, GET with cursor pagination, PATCH, DELETE)
- [x] Message ownership enforcement (edit/delete own messages only)
- [x] WebSocket hub with per-channel subscriptions
- [x] WebSocket client with read/write pump goroutines
- [x] WebSocket auth via query param token (validated via JWKS)
- [x] Real-time broadcast: message_create, message_update, message_delete events
- [x] Chat UI with message list + input
- [x] Message grouping (same author within 5 minutes)
- [x] Auto-scroll to bottom on new messages
- [x] React Query infinite query for cursor-based pagination
- [x] WebSocket → React Query cache invalidation
- [x] useWSMessages hook for real-time subscriptions
- [ ] "Load older messages" working with infinite scroll (scroll-to-top trigger)
- [ ] Optimistic message sending (show immediately, confirm on response)
- [ ] Message edit UI (inline editing)
- [ ] Message delete UI (confirmation, "message deleted" placeholder)
- [ ] Unread message indicators (per-channel)
- [ ] @mentions with autocomplete
- [ ] Link previews / URL embeds
- [ ] Markdown rendering in messages
- [ ] Message timestamps (relative: "2 minutes ago", absolute on hover)
- [ ] "New messages" divider when scrolling up

## Phase 5: Image Uploads
- [x] Multipart upload endpoint (POST /api/upload)
- [x] File type validation (.jpg, .jpeg, .png, .gif, .webp)
- [x] UUID filename generation, local file storage
- [x] Static file serving at /uploads/*
- [x] Image preview in messages (img tag)
- [ ] Image upload UI in message input (file picker button)
- [ ] Drag-and-drop image upload
- [ ] Paste image from clipboard
- [ ] Upload progress indicator
- [ ] Image lightbox/modal on click
- [ ] Image size limits enforced client-side
- [ ] Configurable S3/MinIO backend (instead of local storage)
- [ ] Image thumbnails / resizing

## Phase 6: Presence & Typing
- [x] Typing indicator WS event (typing_start)
- [x] Typing indicator throttle on client (3s debounce)
- [ ] Typing indicator display UI ("User is typing...")
- [ ] Multiple users typing display ("User1, User2 are typing...")
- [ ] Typing indicator timeout (stop showing after 5s without event)
- [ ] Online/offline status via WebSocket heartbeat
- [ ] Store presence state in Redis (for multi-instance scalability)
- [ ] Online/offline dot on member avatars
- [ ] Idle status detection (no activity for 5min)
- [ ] Custom status messages
- [ ] "Last seen" timestamp for offline users

## Phase 7: Voice Channels
- [x] WebRTC signaling relay over WebSocket (rtc:* events)
- [x] Voice channel type in database (text|voice)
- [x] Voice channels displayed in sidebar
- [ ] Voice channel join/leave UI
- [ ] WebRTC peer connection setup (getUserMedia, createOffer/Answer)
- [ ] ICE candidate exchange via WS signaling
- [ ] Full-mesh P2P audio connections
- [ ] Mute/unmute toggle
- [ ] Deafen toggle
- [ ] Voice activity indicator (speaking detection)
- [ ] Participant list in voice channel
- [ ] Disconnect on tab close / cleanup
- [ ] Audio device selection (input/output)
- [ ] Voice channel user limit
- [ ] Screen sharing (post-MVP)

## Phase 8: Desktop & Mobile
- [x] Tauri v2 config in apps/web/src-tauri/
- [x] Expo React Native app scaffolded
- [x] Mobile home screen + add instance flow
- [ ] Tauri desktop build working (test on macOS/Windows/Linux)
- [ ] Desktop notifications (Tauri notification API)
- [ ] System tray icon with unread badge
- [ ] Auto-update mechanism (Tauri updater)
- [ ] Desktop keyboard shortcuts (Cmd/Ctrl+K search, etc.)
- [ ] Mobile channel list screen
- [ ] Mobile message view screen
- [ ] Mobile member list screen
- [ ] Mobile push notifications (Expo Notifications)
- [ ] Mobile image picker for uploads
- [ ] Mobile voice channel support
- [ ] Deep linking (opencord:// URL scheme)
- [ ] Offline message queue (send when reconnected)

## Phase 9: Polish & Self-Hosting
- [ ] Rate limiting (per-IP and per-user)
- [ ] Request body size limits
- [ ] Input sanitization (XSS prevention)
- [ ] Error boundary components (React)
- [ ] Loading skeletons for channels, messages, members
- [ ] Empty state illustrations
- [ ] 404 page
- [ ] Responsive layout (mobile web)
- [ ] Dark/light theme toggle
- [ ] User settings page (change password, display name, avatar)
- [ ] Server-side logging improvements (structured JSON logs)
- [ ] Health check endpoint (GET /api/health)
- [ ] Graceful shutdown handling
- [ ] Database connection retry on startup
- [ ] Docker Compose production config (resource limits, restart policies)
- [ ] Environment variable validation on startup
- [ ] README.md with self-hosting guide
- [ ] CONTRIBUTING.md
- [ ] LICENSE file
- [ ] GitHub Actions CI (build + test on PR)

## Summary

| Phase | Done | Remaining | Status |
|-------|------|-----------|--------|
| 1. Scaffold | 9/9 | 0 | Complete |
| 2. Central Auth + Instance | 21/26 | 5 | Core done, deployed |
| 3. Channels & Members | 12/19 | 7 | Core done |
| 4. Messaging | 13/23 | 10 | Core done |
| 5. Image Uploads | 5/13 | 8 | Backend done |
| 6. Presence & Typing | 2/11 | 9 | Events only |
| 7. Voice Channels | 3/15 | 12 | Signaling only |
| 8. Desktop & Mobile | 3/16 | 13 | Scaffolded |
| 9. Polish | 0/20 | 20 | Not started |
| **Total** | **68/152** | **84** | **45% complete** |
