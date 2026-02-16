-- Users table becomes a cache: password_hash no longer required, add updated_at
ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL;
ALTER TABLE users ALTER COLUMN email DROP NOT NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Add auth_server_url to instance_settings
ALTER TABLE instance_settings ADD COLUMN IF NOT EXISTS auth_server_url TEXT;

-- Refresh tokens no longer needed on instances (handled by central auth)
DROP TABLE IF EXISTS refresh_tokens;
