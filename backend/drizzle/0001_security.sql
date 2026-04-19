ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "email_verified" boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "verification_token" varchar(255),
  ADD COLUMN IF NOT EXISTS "reset_token" varchar(255),
  ADD COLUMN IF NOT EXISTS "reset_token_expiry" timestamp;
