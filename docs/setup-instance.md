# Setting Up an OpenCord Instance

An OpenCord instance is a single community server. Users authenticate via the central auth server and then join instances using invite codes. Each instance has its own database, channels, messages, and members.

## Architecture

```
User --> Central Auth Server (Railway)  --> JWT (ES256)
User --> Instance API (self-hosted)     --> validates JWT via JWKS
User --> Web Frontend                   --> talks to both
```

- The **central auth server** handles registration, login, and token management. It signs JWTs with ES256 and exposes a JWKS endpoint.
- The **instance API** validates JWTs using the auth server's public key (fetched from `/.well-known/jwks.json`). It never sees passwords.
- The **web frontend** authenticates with the central auth server, then uses the JWT to connect to any instance.

## Prerequisites

- Docker and Docker Compose
- The central auth server URL (currently `https://central-auth-production-ec7a.up.railway.app`)

## Quick Start (Docker Compose)

### 1. Copy the environment file

```bash
cp .env.example .env
```

### 2. Edit `.env`

```env
# Instance API
DATABASE_URL=postgres://opencord:opencord@postgres:5432/opencord?sslmode=disable
REDIS_URL=redis://redis:6379
AUTH_SERVER_URL=https://central-auth-production-ec7a.up.railway.app
UPLOAD_PATH=/app/uploads
INSTANCE_NAME=My OpenCord
INSTANCE_URL=http://localhost:8080
PORT=8080

# Web frontend
VITE_AUTH_SERVER_URL=https://central-auth-production-ec7a.up.railway.app
```

Set `INSTANCE_NAME` to whatever you want your community to be called.

### 3. Start the services

```bash
# Start everything (postgres, redis, api, web)
docker compose up -d postgres redis api

# Or start just the database for local Go development
docker compose up -d postgres redis
```

### 4. Verify it's running

```bash
curl http://localhost:8080/api/instance
```

You should see:
```json
{
  "data": {
    "name": "My OpenCord",
    "registrationOpen": true,
    "authServerUrl": "https://central-auth-production-ec7a.up.railway.app"
  }
}
```

## Local Development (without Docker for the API)

If you want to run the Go API directly (faster iteration):

### 1. Start only Postgres and Redis

```bash
docker compose up -d postgres redis
```

### 2. Run the API

```bash
cd apps/api
AUTH_SERVER_URL=https://central-auth-production-ec7a.up.railway.app \
INSTANCE_NAME="My OpenCord" \
go run ./cmd/server
```

The API starts on port 8080. Migrations run automatically on startup.

### 3. Run the web frontend

```bash
# Set the auth server URL for the frontend
export VITE_AUTH_SERVER_URL=https://central-auth-production-ec7a.up.railway.app

npx nx run web:dev
```

The web app starts on port 3000 and proxies `/api` requests to `localhost:8080`.

## Railway Deployment

### 1. Create a new service

- Link your GitHub repo in Railway
- Set the root directory to `apps/api`
- Railway auto-detects the `Dockerfile` and `railway.toml`

### 2. Add a PostgreSQL database

Add a Railway PostgreSQL addon. The instance needs its own database (separate from the auth server).

### 3. Set environment variables

| Variable | Value |
|----------|-------|
| `DATABASE_URL` | Provided by Railway PostgreSQL addon |
| `AUTH_SERVER_URL` | `https://central-auth-production-ec7a.up.railway.app` |
| `INSTANCE_NAME` | Your community name |
| `PORT` | `8080` |
| `UPLOAD_PATH` | `./uploads` |
| `INSTANCE_URL` | Your Railway public URL (for upload URLs) |

### 4. Deploy

Push to main. Railway builds and deploys automatically. Migrations run on startup. The healthcheck hits `GET /api/instance`.

## After Setup

### Create the first user

1. Open the web app (or use the central auth server directly)
2. Register an account at the central auth server
3. The first user to join an instance can be promoted to owner

### Create an invite

The instance is empty by default. To let others join, you need an invite code. Use the API directly:

```bash
# First, get a JWT by logging in to the central auth server
TOKEN="your-jwt-here"

# Create an invite
curl -X POST http://localhost:8080/api/invites \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json"
```

This returns an invite code. Other users join by calling `POST /api/invites/{code}/join` with their JWT.

### Create channels

```bash
curl -X POST http://localhost:8080/api/channels \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name": "general", "type": "text"}'
```

## Environment Variables Reference

| Variable | Default | Description |
|----------|---------|-------------|
| `DATABASE_URL` | `postgres://opencord:opencord@localhost:5432/opencord?sslmode=disable` | PostgreSQL connection string |
| `REDIS_URL` | `redis://localhost:6379` | Redis connection string |
| `AUTH_SERVER_URL` | `http://localhost:9090` | Central auth server URL (for JWKS key fetching) |
| `UPLOAD_PATH` | `./uploads` | Directory for uploaded files |
| `INSTANCE_NAME` | `My OpenCord` | Display name shown in instance info |
| `INSTANCE_URL` | `http://localhost:PORT` | Base URL used for generating upload URLs |
| `PORT` | `8080` | API server port |
| `VITE_AUTH_SERVER_URL` | - | Auth server URL for the web frontend (build-time) |

## Troubleshooting

### "failed to initialize JWKS client"
The instance can't reach the auth server. Check that `AUTH_SERVER_URL` is correct and the auth server is running. Try: `curl $AUTH_SERVER_URL/.well-known/jwks.json`

### "migration warning" on startup
Non-fatal. Usually means migrations already ran. Check the logs for the actual error.

### 401 on all authenticated requests
The JWT might be expired (15-minute lifetime) or the auth server's signing key rotated. The JWKS client refreshes keys every 5 minutes and on unknown `kid`. Try logging in again.

### Instance info shows wrong `authServerUrl`
The `auth_server_url` in `instance_settings` is seeded from `AUTH_SERVER_URL` on startup. Restart the API with the correct value.
