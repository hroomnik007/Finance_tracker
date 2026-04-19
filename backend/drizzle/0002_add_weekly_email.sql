ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "weekly_email_enabled" boolean NOT NULL DEFAULT false;
