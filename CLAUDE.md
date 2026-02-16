# OpenCord — Open-Source Discord Alternative

## Architecture

OpenCord is a self-hostable chat platform. Each deployment is a single **instance** (one community). The client connects to **multiple instances** simultaneously, each with independent auth.

### Monorepo Structure (Nx)

```
apps/api/         — Go backend (chi router, gorilla/websocket)
apps/web/         — React + Vite + Tauri v2 (web & desktop)
apps/mobile/      — Expo React Native
packages/ui/      — Shared React components
packages/shared/  — Shared TypeScript types, constants, validation
packages/crypto/  — E2EE (vodozemac WASM)
packages/api-client/ — Typed API client (multi-instance)
docker/           — Dockerfiles + docker-compose.yml
```

### Tech Stack

- **Backend:** Go 1.22+, chi router, gorilla/websocket, PostgreSQL 16, Redis 7
- **Web/Desktop:** React 18, TypeScript, Vite, Tailwind CSS, Tauri v2
- **Mobile:** React Native (Expo), NativeWind
- **State:** Zustand + React Query (TanStack Query)
- **Auth:** JWT (access + refresh tokens), bcrypt
- **E2EE:** Olm/Megolm via vodozemac WASM
- **Voice:** WebRTC peer-to-peer (full mesh)

## Build Commands

### Root (Nx)
```bash
npm install                    # Install all dependencies
npx nx run api:build           # Build Go API
npx nx run api:dev             # Run API in dev mode
npx nx run api:test            # Run Go tests
npx nx run web:dev             # Vite dev server
npx nx run web:build           # Production build
npx nx run web:lint            # Lint web app
npx nx run web:tauri dev       # Tauri desktop dev
npx nx run web:tauri build     # Tauri desktop build
npx nx run mobile:start        # Expo dev server
npx nx run shared:build        # Build shared package
npx nx run api-client:build    # Build API client
npx nx run crypto:build        # Build crypto package
npx nx run-many --target=build # Build everything
npx nx run-many --target=test  # Test everything
npx nx run-many --target=lint  # Lint everything
```

### Go API (from apps/api/)
```bash
go build -o bin/server ./cmd/server    # Build
go run ./cmd/server                     # Run
go test ./...                           # Test all
go test ./internal/auth/...             # Test specific package
go vet ./...                            # Vet
```

### Docker
```bash
docker compose up -d                    # Start all services
docker compose up -d postgres redis     # Start only DB + cache
docker compose down                     # Stop all
docker compose logs -f api              # Follow API logs
```

### Database Migrations
```bash
# Migrations run automatically on API startup
# Manual: use golang-migrate CLI
migrate -path apps/api/migrations -database "$DATABASE_URL" up
migrate -path apps/api/migrations -database "$DATABASE_URL" down 1
```

## Conventions

### Go Backend
- Package-per-domain: each domain (user, channel, message, etc.) has handler.go, service.go, repository.go, models.go
- Handlers accept `http.ResponseWriter, *http.Request`, return JSON
- Services contain business logic, accept repository interfaces
- Repositories execute SQL, accept `*sql.DB` or `*sqlx.DB`
- Errors returned as `{ "error": "message" }` with appropriate HTTP status
- Auth middleware injects user ID into request context via `auth.UserFromContext(ctx)`
- UUIDs for all primary keys
- Timestamps in RFC3339 / ISO8601 format
- Cursor-based pagination (not offset): `?before=<uuid>&limit=50`

### TypeScript/React
- Functional components only
- Zustand for global state (multi-instance management)
- React Query for server state (API data, cache invalidation via WebSocket)
- Query keys scoped by instance URL: `[instanceUrl, 'channels']`
- Tailwind CSS for styling (web), NativeWind (mobile)
- Path aliases: `@/` maps to `src/`
- Barrel exports from packages via index.ts

### Naming
- Go: PascalCase exported, camelCase unexported
- TypeScript: camelCase variables/functions, PascalCase components/types
- SQL: snake_case tables and columns
- REST: kebab-case URLs, camelCase JSON bodies
- Files: kebab-case for TS, snake_case.go for Go

### API Response Format
```json
// Success
{ "data": { ... } }

// Error
{ "error": "Human-readable message" }

// List with pagination
{ "data": [...], "hasMore": true }
```

### WebSocket Message Format
```json
{ "event": "event_name", "data": { ... } }
```

### Environment Variables
```
DATABASE_URL=postgres://opencord:opencord@localhost:5432/opencord?sslmode=disable
REDIS_URL=redis://localhost:6379
JWT_SECRET=change-me-in-production
UPLOAD_PATH=./uploads
INSTANCE_NAME=My OpenCord
INSTANCE_URL=http://localhost:3000
PORT=8080
```

## Key Design Decisions

1. **One instance = one server.** No multi-server backend. Client manages multiple instance connections.
2. **E2EE by default.** Server stores ciphertext only. No server-side search.
3. **WebRTC full mesh** for voice. Works for small groups (<10). SFU needed for scale (post-MVP).
4. **JWT with refresh tokens.** Short-lived access tokens (15min), long-lived refresh tokens (30 days).
5. **No federation.** Each instance is independent. Users have separate accounts per instance.
