-- User display preferences
ALTER TABLE users ADD COLUMN IF NOT EXISTS default_page VARCHAR(50) DEFAULT 'dashboard';
ALTER TABLE users ADD COLUMN IF NOT EXISTS currency_format VARCHAR(10) DEFAULT 'sk';
