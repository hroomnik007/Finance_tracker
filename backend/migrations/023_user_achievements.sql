-- Per-user achievement unlock tracking (source of truth for the Profile → Úspechy grid).
-- One row per unlocked achievement; absence of a row means "locked".
CREATE TABLE IF NOT EXISTS user_achievements (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  achievement_key VARCHAR(50) NOT NULL,
  unlocked_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT user_achievements_unq UNIQUE (user_id, achievement_key)
);

CREATE INDEX IF NOT EXISTS user_achievements_user_id_idx ON user_achievements(user_id);
