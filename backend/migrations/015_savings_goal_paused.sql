-- Migration 015: add paused flag to savings_goals
ALTER TABLE savings_goals ADD COLUMN IF NOT EXISTS paused BOOLEAN NOT NULL DEFAULT FALSE;
