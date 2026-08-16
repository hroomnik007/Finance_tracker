-- PIN login device-binding + per-account lockout (security audit run-1 fix).
-- PIN login now requires a token bound to a specific device (issued when the
-- PIN is set up) in addition to the correct PIN — bare email+PIN from an
-- unrecognized device is rejected. pin_failed_attempts/pin_locked_until add a
-- per-account lockout independent of the existing per-IP rate limiter.

ALTER TABLE users ADD COLUMN IF NOT EXISTS pin_failed_attempts INTEGER NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS pin_locked_until TIMESTAMPTZ DEFAULT NULL;

CREATE TABLE IF NOT EXISTS pin_device_tokens (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash    VARCHAR(255) NOT NULL,
  label         VARCHAR(255),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_used_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at    TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS pin_device_tokens_user_id_idx ON pin_device_tokens(user_id);
