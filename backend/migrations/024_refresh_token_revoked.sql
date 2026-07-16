-- Refresh token rotation: mark old tokens as revoked instead of deleting them
-- outright, so reuse of a rotated-out token can be detected (theft indicator).
ALTER TABLE refresh_tokens ADD COLUMN IF NOT EXISTS revoked_at TIMESTAMPTZ DEFAULT NULL;
