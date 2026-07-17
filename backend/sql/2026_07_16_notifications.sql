CREATE TABLE IF NOT EXISTS notifications (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL,
    title VARCHAR(255) NOT NULL,
    body TEXT NOT NULL,
    data JSONB DEFAULT '{}'::jsonb,
    is_read BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    read_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS ix_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS ix_notifications_created_at ON notifications(created_at);

CREATE TABLE IF NOT EXISTS device_push_tokens (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expo_push_token VARCHAR(255),
    native_push_token VARCHAR(255),
    platform VARCHAR(50) NOT NULL,
    device_identifier VARCHAR(255),
    app_version VARCHAR(50),
    environment VARCHAR(50) NOT NULL DEFAULT 'development',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ix_device_push_tokens_user_id ON device_push_tokens(user_id);
CREATE UNIQUE INDEX IF NOT EXISTS uix_device_push_tokens_token ON device_push_tokens(user_id, expo_push_token) WHERE expo_push_token IS NOT NULL;
