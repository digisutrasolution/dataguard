-- Team users: active flag + last-login tracking.
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_active     BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ;
