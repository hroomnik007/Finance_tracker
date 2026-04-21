-- Add PIN hash to users
ALTER TABLE users ADD COLUMN IF NOT EXISTS pin_hash VARCHAR(255);

-- WebAuthn credentials table
CREATE TABLE IF NOT EXISTS webauthn_credentials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  credential_id TEXT NOT NULL UNIQUE,
  public_key TEXT NOT NULL,
  counter INTEGER NOT NULL DEFAULT 0,
  device_type VARCHAR(32),
  backed_up BOOLEAN NOT NULL DEFAULT false,
  name VARCHAR(100) NOT NULL DEFAULT 'Biometrický kľúč',
  created_at TIMESTAMP NOT NULL DEFAULT now()
);
