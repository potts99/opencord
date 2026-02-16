# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build & Dev Commands

### Central Auth Server (working directory: `apps/auth/`)
```bash
go run ./cmd/server                  # Run auth server (port 9090)
go build -o bin/server ./cmd/server  # Build binary
go test ./...                        # Test all packages
go vet ./...                         # Static analysis
go mod tidy                          # Sync dependencies
```

### Instance API (working directory: `apps/api/`)
```bash
go run ./cmd/server                  # Run dev server (port 8080, reads from env vars)
go build -o bin/server ./cmd/server  # Build binary
go test ./...                        # Test all packages
go vet ./...                         # Static analysis
go mod tidy                          # Sync dependencies after changing imports
```

### Web Frontend
```bash
npx nx run web:dev       # Vite dev server on port 3000, proxies /api → localhost:8080
npx nx run web:build     # Production build to apps/web/dist/
npx nx run web:lint      # ESLint
```

### Shared Packages
```bash
npx nx run shared:build      # Build @opencord/shared
npx nx run api-client:build  # Build @opencord/api-client (depends on shared)
npx nx run ui:build          # Build @opencord/ui
```

### Mobile (Expo)
```bash
npx nx run mobile:start  # Expo dev server
```

### Nx (from repo root)
```bash
npm install                         # Install all workspace dependencies
npx nx run-many --target=build      # Build all projects
npx nx run-many --target=test       # Test all projects
npx nx run-many --target=lint       # Lint all projects
```

### Docker
```bash
docker compose up -d postgres postgres-auth redis  # Start DBs + cache for local dev
docker compose up -d                               # Start full stack
docker compose down                                # Stop all services
docker compose logs -f auth                        # Follow auth server logs
docker compose logs -f api                         # Follow API logs
```

### Database Migrations
```bash
# Migrations run automatically on API startup via golang-migrate
# Manual migration with CLI:
migrate -path apps/api/migrations -database "$DATABASE_URL" up
migrate -path apps/api/migrations -database "$DATABASE_URL" down 1
```

## Architecture Overview

**OpenCord is a self-hostable Discord alternative with centralized authentication.** A central auth server (`apps/auth/`) owns all user identity — registration, login, passwords, and JWT issuance. Instance backends (`apps/api/`) are stateless JWT validators that trust the auth server's ES256 signatures via JWKS. The same account (username, avatar, email) works across every instance.

```
Client ──① register/login──→ Central Auth Server (apps/auth/, port 9090)
       ←── JWT (ES256) ──────┘         │
       ──② Bearer JWT──→ Instance (apps/api/, port 8080)
                          validates via JWKS public key
```

This is an Nx monorepo with npm workspaces. The Go backends and TypeScript frontend are independent — they share no code, only a contract defined by the REST API and WebSocket protocol.

## Central Auth Server (`apps/auth/`)

Go 1.21+ standalone service. Owns all user identity: registration, login, password hashing (bcrypt), ES256 JWT signing, refresh token rotation, profile management.

**Key files:** `cmd/server/main.go` (entry point), `internal/auth/service.go` (core logic), `internal/auth/jwks.go` (ES256 key pair management + JWKS endpoint), `internal/auth/handler.go` (HTTP handlers), `internal/auth/repository.go` (PostgreSQL queries).

**JWT format:** ES256 (asymmetric). Claims include `iss`, `sub` (user UUID), `exp`, `iat`, `username`, `display_name`, `avatar_url`. `kid` header enables key rotation. Expiry: 15 minutes.

**JWKS endpoint:** `GET /.well-known/jwks.json` — returns ES256 public key in standard JWK format. Instances fetch this to validate JWTs locally.

**Key management:** On startup, loads P-256 key pair from `KEY_DIR` (PEM files) or auto-generates if missing. `kid` = truncated SHA-256 of public key.

## Instance Backend (`apps/api/`)

Go 1.21+ backend using chi router. Single entry point at `cmd/server/main.go` that manually wires all dependencies (no DI framework, no dependency injection container).

### Dependency Wiring Pattern
`main.go` creates everything in order: `database.Connect()` → `auth.NewJWKSClient(authServerURL)` → per-domain `NewPostgresRepository(db)` → `auth.NewService(jwksClient)` → `auth.NewHandler(authService, userRepo)` → per-domain `NewHandler(repo)` → chi router with routes. The WebSocket `Hub` is created as a singleton, started via `go hub.Run()`, and injected into the `message.Handler` so it can broadcast after DB writes.

### Domain Package Pattern
Each domain package in `internal/` follows this structure:
- **`models.go`** — Request/response structs with JSON tags (camelCase). Go struct field names are PascalCase, JSON keys are camelCase.
- **`repository.go`** — Defines a `Repository` interface and a `PostgresRepository` struct implementing it using raw `database/sql` (no ORM). All SQL uses positional params (`$1`, `$2`). Returns pointers to domain structs.
- **`handler.go`** — HTTP handlers with signature `func(w http.ResponseWriter, r *http.Request)`. Each handler file defines its own local `writeJSON(w, data, status)` and `writeError(w, message, status)` helper functions (these are NOT shared across packages).
- **`service.go`** — Only the `auth` package has a service layer currently. Other packages have handlers that call repositories directly.

Domain packages: `auth`, `user`, `channel`, `message`, `member`, `invite`, `instance`, `upload`, `ws`, `rtc`.

### Cross-Package Dependencies
- `message.Handler` depends on `ws.Hub` (to broadcast after writes)
- `invite.Handler` depends on `member.Repository` (to create membership on join)
- All authenticated handlers depend on `auth.UserFromContext(ctx)` to get the current user UUID
- `ws.HandleWebSocket` takes an `AuthValidator` callback (closure over `authService.ValidateAccessToken`)

### Auth System (`internal/auth/`)
- **No local auth.** Instances do NOT handle registration, login, or token issuance. All auth goes through the central auth server.
- **JWKS client** (`jwks_client.go`): Fetches ES256 public keys from `{AUTH_SERVER_URL}/.well-known/jwks.json` on startup. Background goroutine refreshes every 5 minutes. On unknown `kid`, triggers immediate refetch (handles key rotation).
- **JWT validation:** `auth.Service.ValidateAccessToken()` uses ES256 public key from JWKS client. Extracts `sub` (user UUID), `username`, `display_name`, `avatar_url` into `TokenClaims`.
- **Middleware:** `auth.Handler.Middleware` extracts `Authorization: Bearer <token>`, validates JWT via JWKS, upserts user into local cache table (for JOINs), stores both `UserID` and full `TokenClaims` in context.
- **User cache upsert:** `user.PostgresRepository.UpsertFromClaims(claims)` does `INSERT ... ON CONFLICT (id) DO UPDATE` to sync profile data from JWT claims into the local `users` table.
- **Context keys:** `UserContextKey` for UUID, `ClaimsContextKey` for full `*TokenClaims`.

### WebSocket System (`internal/ws/`)
Three files: `hub.go`, `client.go`, `handler.go`.

- **Hub** (`hub.go`): Central goroutine with `register`, `unregister`, `broadcast` channels. Maintains `clients map[*Client]bool` and `channels map[string]map[*Client]bool` (channel ID → subscribed clients). Thread-safe via `sync.RWMutex`. The `Run()` method is an infinite select loop.
- **Client** (`client.go`): Each WS connection gets a `Client` with `ReadPump()` and `WritePump()` goroutines. Constants: `writeWait=10s`, `pongWait=60s`, `pingPeriod=54s`, `maxMessageSize=4096`. Send buffer: `chan []byte` with capacity 256.
- **Handler** (`handler.go`): `HandleWebSocket(hub, validateToken)` upgrades HTTP → WS. Auth via `?token=` query param (not header, because WebSocket API doesn't support custom headers). `CheckOrigin` returns true (CORS handled at router level).

**Client → Server events:** `ping`, `subscribe_channel`, `unsubscribe_channel`, `typing_start`, `rtc:*`
**Server → Client events:** `pong`, `message_create`, `message_update`, `message_delete`, `typing_start`, `rtc:*`

All events are JSON: `{"event": "event_name", "data": {...}}`

### Real-Time Message Flow
1. Client sends `POST /api/channels/{id}/messages` with JSON body
2. `message.Handler.Create` saves to DB via `repo.Create()`
3. Handler calls `hub.BroadcastToChannel(channelID, ws.Event{Type: "message_create", Data: msg})`
4. Hub marshals to JSON, sends to all clients subscribed to that channel
5. On the frontend, `useWSMessages` hook receives the event and calls `queryClient.invalidateQueries()` to refetch

### WebRTC Signaling (`internal/rtc/` + `ws/client.go`)
RTC signaling is handled within the WebSocket client's `handleRTCEvent()`. Events with prefix `rtc:` are relayed to all peers in the channel. The `internal/rtc/` package is a documentation placeholder. Events: `rtc:join`, `rtc:offer`, `rtc:answer`, `rtc:ice_candidate`, `rtc:leave`.

### File Upload (`internal/upload/`)
Multipart form upload at `POST /api/upload`. Field name: `file`. Max size: 10MB. Allowed extensions: `.jpg`, `.jpeg`, `.png`, `.gif`, `.webp`. Files saved to `UPLOAD_PATH` directory with UUID filenames. Returns `{"data": {"url": "..."}}`. Uploaded files served statically at `/uploads/*`.

### Instance Info (`internal/instance/`)
`instance_settings` is a singleton table (enforced by `CHECK (id = 1)`). `GET /api/instance` is the only public endpoint — used by clients to discover instance name, icon, description, registration status, and `authServerUrl` before joining. The `auth_server_url` column is seeded from the `AUTH_SERVER_URL` env var on startup.

## Database Schema

### Central Auth Database
PostgreSQL (PlanetScale in prod, local in dev). Migration: `apps/auth/migrations/000001_init.up.sql`.
- `users` — id, email (unique), username (unique), display_name, avatar_url, password_hash, created_at, updated_at
- `refresh_tokens` — id, user_id → users (CASCADE), token_hash (unique), expires_at, created_at

### Instance Database
PostgreSQL 16. All tables use UUID primary keys via `uuid_generate_v4()`. Timestamps are `TIMESTAMPTZ`. Migrations: `apps/api/migrations/`.

**Tables:**
- `users` — **Cache table** upserted from JWT claims. id, email (nullable), username (unique), display_name, avatar_url, password_hash (nullable, legacy), created_at, updated_at
- `channels` — id, name, type (CHECK: 'text'|'voice'), position, created_at
- `messages` — id, channel_id → channels (CASCADE), author_id → users (CASCADE), content, image_url, created_at, updated_at. Index: `idx_messages_channel_created` on (channel_id, created_at DESC) for cursor pagination.
- `members` — id, user_id → users (CASCADE, UNIQUE), role (CHECK: 'owner'|'admin'|'member'), joined_at
- `invites` — id, code (unique, 12-char hex), created_by → users, expires_at (nullable), created_at
- `instance_settings` — id (CHECK: =1, singleton), name, icon_url, description, registration_open (default true), auth_server_url. Seeded with INSERT on creation.

**Key SQL patterns:**
- Cursor pagination: `WHERE created_at < (SELECT created_at FROM messages WHERE id = $before) ORDER BY created_at DESC LIMIT $limit`
- Partial updates: `COALESCE($new, existing_column)` pattern
- Null list handling: handlers check `if slice == nil { slice = []T{} }` before JSON encoding to return `[]` not `null`

## REST API Routes

Defined in `cmd/server/main.go`. Chi router uses `{param}` syntax (not `:param`).

### Central Auth Routes (`apps/auth/`)
**Public:**
- `GET /.well-known/jwks.json` — ES256 public key in JWK format
- `POST /api/auth/register` — `{email, username, displayName, password}` → `{accessToken, refreshToken, user}`
- `POST /api/auth/login` — `{email, password}` → same response
- `POST /api/auth/refresh` — `{refreshToken}` → new token pair

**Authenticated (Bearer token):**
- `DELETE /api/auth/logout` — `{refreshToken}` → 204
- `GET /api/users/me` — profile
- `PATCH /api/users/me` — update displayName/avatarUrl

### Instance Routes (`apps/api/`)
**Public (no auth):**
- `GET /api/instance` — Instance info (includes `authServerUrl`)

**Authenticated (Bearer token from central auth):**
- `GET /api/users/me` — from local cache
- `POST /api/channels`, `GET /api/channels`, `GET /api/channels/{id}`, `PATCH /api/channels/{id}`, `DELETE /api/channels/{id}`
- `GET /api/channels/{id}/messages?before=<uuid>&limit=50`, `POST /api/channels/{id}/messages`
- `PATCH /api/messages/{id}`, `DELETE /api/messages/{id}` — ownership enforced (author only)
- `POST /api/invites`, `GET /api/invites`, `POST /api/invites/{code}/join`
- `GET /api/members`, `DELETE /api/members/{userId}` (admin/owner), `PATCH /api/members/{userId}` (owner only)
- `POST /api/upload` — multipart file upload

**WebSocket:** `GET /api/ws?token=<jwt>` — outside the `/api` route group, registered directly on the root router

### Response Format
```
Success:      {"data": <object or array>}
Error:        {"error": "human-readable message"}
Paginated:    {"data": [...], "hasMore": true|false}
No content:   HTTP 204 with empty body
```

### Authorization Rules
- Message edit/delete: author only (checked via `existing.AuthorID != userID`)
- Member kick: admin or owner
- Role change: owner only
- Invite creation: any authenticated member
- Channel CRUD: any authenticated member (no role check currently)

## Frontend Architecture (`apps/web/`)

React 19 + Vite 6 + Tailwind CSS v4. Discord-like three-column layout.

### Auth & Multi-Instance State (Core Concept)
The client has a single global auth session with the central auth server. It connects to multiple instances using the same JWT.

**Auth store** (`src/stores/auth-store.ts`):
- State: `authServerUrl`, `user`, `accessToken`, `refreshToken`
- Persisted to localStorage as `opencord-auth`.
- Single global session — not per-instance.

**Instance store** (`src/stores/instance-store.ts`):
- State: `instances: Map<string, InstanceState>` + `activeInstanceUrl: string | null`
- `InstanceState` holds: `url`, `info` (InstanceInfo), `connection` (InstanceConnection object). No per-instance auth.
- Persisted to localStorage via Zustand `persist` middleware. The `partialize` function excludes live `connection` objects.
- On app load, `useInitConnections()` hook iterates stored instances, creates `InstanceConnection` objects with the central auth token, and calls `connectWS()`.

**`@opencord/api-client` package** (`packages/api-client/`):
- `AuthClient` — Manages central auth. Methods: `register()`, `login()`, `refresh()`, `logout()`, `getMe()`, `updateMe()`.
- `HttpClient` — Fetch wrapper. Automatically adds `Authorization: Bearer` header. On 401, calls `onAuthFailure` callback (returns new access token or null).
- `InstanceConnection` — Manages one instance. Takes `accessToken` from caller (central auth provides it). No auth methods. Methods map 1:1 to instance REST endpoints. WS event handlers registered via `onWSEvent(handler)`.
- `ConnectionManager` — Manages multiple `InstanceConnection` objects. (Note: the web app uses Zustand store directly instead.)

### React Query Integration
- Query keys always scoped by instance URL: `[instanceUrl, 'channels']`, `[instanceUrl, 'messages', channelId]`, `[instanceUrl, 'members']`
- `useMessages()` uses `useInfiniteQuery` for cursor pagination. `getNextPageParam` returns the last message's ID for the `before` param.
- `useWSMessages()` hook subscribes to a channel's WS events and calls `queryClient.invalidateQueries()` on `message_create`, `message_update`, `message_delete` events. This triggers React Query to refetch.
- Default `staleTime: 30000` (30s), `retry: 1`.

### Routing
React Router v7. Routes: `/auth` (central login/register), `/add-instance` (URL + invite code), `/instance/:encodedUrl/channel/:channelId`. The `encodedUrl` is `encodeURIComponent(instanceUrl)`. `RequireAuth` wrapper redirects to `/auth` if no central session.

### Vite Config
- Path aliases: `@/` → `src/`, `@opencord/*` → `../../packages/*/src`
- Dev server proxy: `/api` → `http://localhost:8080` (with WebSocket support)
- Plugins: `@vitejs/plugin-react`, `@tailwindcss/vite`

### Component Structure
- `Layout` — Flex row: InstanceSidebar (72px) + ChannelSidebar (240px) + main content (flex-1) via `<Outlet />`
- `InstanceSidebar` — Vertical list of instance avatars with active indicator (white pill). "+" button navigates to `/add-instance`.
- `ChannelSidebar` — Instance name header, text/voice channel lists with `#`/speaker icons, inline channel creation input, user info panel at bottom.
- `MessageList` — Reverses messages (API returns newest-first), groups consecutive messages from same author within 5 minutes, auto-scrolls to bottom on new messages.
- `MessageInput` — Form with Enter to submit. Typing indicator throttled to one event per 3 seconds.
- `MemberSidebar` — Groups members by role (owner, admin, member) with avatars.
- `AuthPage` — Central auth login/register page. Shown when no central auth session exists.
- `AddInstancePage` — Two-step flow: (1) enter URL, fetch instance info, verify auth server matches (2) enter invite code to join.

### Tauri Desktop
Config at `apps/web/src-tauri/tauri.conf.json`. Same Vite app wrapped as native desktop. Dev URL: `http://localhost:3000`. Default window: 1200x800, min 800x600.

## Shared Packages (`packages/`)

### `@opencord/shared` (`packages/shared/`)
- `types.ts` — All TypeScript interfaces matching Go backend models. UUIDs are `string`. Timestamps are `string` (ISO 8601). Nullable fields use `| null`. WebSocket event types are a union type `WSEventType`.
- `constants.ts` — `WS_RECONNECT_INTERVAL=3000`, `WS_MAX_RECONNECT_ATTEMPTS=10`, `MESSAGE_PAGE_SIZE=50`, `MAX_MESSAGE_LENGTH=4000`, `MAX_IMAGE_SIZE=10MB`, `ACCESS_TOKEN_EXPIRY=15min`.
- `validation.ts` — Validation functions returning `string | null` (null = valid): `validateEmail`, `validateUsername` (2-32 chars, alphanumeric+hyphens+underscores), `validatePassword` (min 8 chars), `validateChannelName`, `validateMessage`, `validateInstanceUrl` (uses `new URL()`), `validateDisplayName`.

### `@opencord/ui` (`packages/ui/`)
React components styled with Tailwind CSS classes (dark theme):
- `Avatar` — Image or colored initials fallback. Deterministic color from name hash. Sizes: sm (32px), md (40px), lg (64px).
- `Button` — Variants: primary (indigo), secondary (gray), danger (red), ghost (transparent). Sizes: sm, md, lg. Loading state with spinner.
- `Input` — With optional label and error message. Uses `forwardRef`. Dark gray background.
- `Spinner` — Animated SVG. Sizes: sm, md, lg.

## Mobile App (`apps/mobile/`)

Expo React Native with NativeWind (Tailwind for RN). Uses Expo Router (file-based routing in `app/` directory).

Screens: `app/_layout.tsx` (root Stack navigator with dark theme), `app/index.tsx` (home/welcome), `app/add-instance.tsx` (two-step URL+login flow).

Uses same `@opencord/api-client` and `@opencord/shared` packages as web.

## Docker Setup

### Services (docker-compose.yml)
- `postgres` — PostgreSQL 16 Alpine, port 5432, instance database
- `postgres-auth` — PostgreSQL 16 Alpine, port 5433, central auth database
- `redis` — Redis 7 Alpine, port 6379, healthcheck via `redis-cli ping`, persistent volume
- `auth` — Central auth Go binary, port 9090, depends on healthy postgres-auth, ES256 key volume at `/app/keys`
- `api` — Instance Go binary, port 8080, depends on healthy postgres+redis+auth, upload volume at `/app/uploads`
- `web` — Nginx serving Vite build output, port 3000→80, depends on api

### Dockerfiles
- `docker/Dockerfile.auth` — Multi-stage: `golang:1.22-alpine` builder → `alpine:3.19` runtime. Copies migrations and creates keys dir.
- `docker/Dockerfile.api` — Multi-stage: `golang:1.22-alpine` builder → `alpine:3.19` runtime. Copies migrations alongside binary.
- `docker/Dockerfile.web` — Multi-stage: `node:22-alpine` builder (runs `npx nx run web:build`) → `nginx:alpine` runtime.

### Nginx (`docker/nginx.conf`)
- SPA fallback: `try_files $uri $uri/ /index.html`
- API proxy: `/api/` → `http://api:8080` with WebSocket upgrade headers and 86400s read timeout
- Upload proxy: `/uploads/` → `http://api:8080`
- Gzip enabled for text/css/js/json/xml

## Conventions

### Naming
- **Go:** PascalCase exported, camelCase unexported. Files: `snake_case.go`
- **TypeScript:** camelCase variables/functions, PascalCase components/types/interfaces. Files: `kebab-case.ts` / `kebab-case.tsx`
- **SQL:** snake_case tables and columns
- **REST URLs:** kebab-case paths, camelCase JSON bodies
- **React Query keys:** `[instanceUrl, resource, ...params]`

### API Patterns
- All responses wrapped in `{"data": ...}` for success
- Errors: `{"error": "human-readable message"}` with appropriate HTTP status
- Paginated lists: `{"data": [...], "hasMore": true}`
- Cursor pagination: `?before=<uuid>&limit=50` (not offset-based)
- Null arrays: always return `[]` not `null` (handlers check `if slice == nil`)
- 204 No Content: for DELETE and logout (no response body)
- chi URL params use `{param}` syntax, retrieved via `chi.URLParam(r, "param")`

### Go Handler Pattern
Every handler follows this exact pattern:
1. Parse URL params / decode JSON body
2. Get user from context via `auth.UserFromContext(r.Context())`
3. Call repository method
4. Optionally broadcast WebSocket event
5. Call `writeJSON(w, data, statusCode)` or `writeError(w, message, statusCode)`

### Frontend State Pattern
- Zustand for client-side state (instances, active instance, connections)
- React Query for server state (API data)
- WebSocket events invalidate React Query caches (not direct state mutation)
- Instance URL used as namespace for all query keys

## Environment Variables

### Central Auth Server (`apps/auth/`)
| Variable | Default | Description |
|----------|---------|-------------|
| `DATABASE_URL` | `postgres://opencord:opencord@localhost:5432/opencord_auth?sslmode=disable` | Auth database connection |
| `PORT` | `9090` | Auth server port |
| `KEY_DIR` | `./keys` | ES256 key pair directory (PEM files) |
| `ISSUER` | `http://localhost:9090` | JWT `iss` claim |

### Instance API (`apps/api/`)
| Variable | Default | Description |
|----------|---------|-------------|
| `DATABASE_URL` | `postgres://opencord:opencord@localhost:5432/opencord?sslmode=disable` | Instance database connection |
| `REDIS_URL` | `redis://localhost:6379` | Redis connection string |
| `AUTH_SERVER_URL` | `http://localhost:9090` | Central auth server URL (for JWKS) |
| `UPLOAD_PATH` | `./uploads` | Directory for uploaded files |
| `INSTANCE_NAME` | `My OpenCord` | Display name in instance info |
| `INSTANCE_URL` | `http://localhost:<PORT>` | Base URL for upload URLs |
| `PORT` | `8080` | API server port |

### Web Frontend
| Variable | Default | Description |
|----------|---------|-------------|
| `VITE_AUTH_SERVER_URL` | `http://localhost:9090` | Central auth server URL |

## Key Design Decisions

1. **Central auth with ES256 JWTs.** Asymmetric signing so instances validate without a shared secret. The auth server signs, instances verify via JWKS public key.
2. **Profile data in JWT claims.** Instances get username/avatar without extra HTTP calls to the auth server (15min staleness acceptable).
3. **Instance `users` table is a cache.** Upserted from JWT claims on every authenticated request. Used for JOINs in message/member queries.
4. **No shared `writeJSON`/`writeError`.** Each handler package defines its own helpers. This avoids a shared `utils` package and keeps packages self-contained.
5. **No service layer for most domains.** Only auth packages have services. Other handlers call repositories directly.
6. **WebSocket auth via query param.** The WebSocket API doesn't support custom headers during handshake, so JWT is passed as `?token=`.
7. **React Query invalidation over direct cache mutation.** WS events trigger `invalidateQueries()` to refetch, rather than surgically patching cache.
8. **JWT with refresh token rotation.** On refresh, old token is deleted. This limits the window for stolen refresh tokens.
9. **Connection pool:** `database.Connect()` sets `MaxOpenConns=25`, `MaxIdleConns=5`.
