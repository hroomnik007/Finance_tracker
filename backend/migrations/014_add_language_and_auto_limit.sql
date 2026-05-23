-- Migration 014: add language preference to users; add auto_limit to categories
ALTER TABLE users ADD COLUMN IF NOT EXISTS language VARCHAR(10) DEFAULT 'sk';
ALTER TABLE categories ADD COLUMN IF NOT EXISTS auto_limit BOOLEAN NOT NULL DEFAULT TRUE;
