-- Migration 012: Performance indexes on high-frequency query columns
CREATE INDEX IF NOT EXISTS transactions_user_id_idx     ON transactions(user_id);
CREATE INDEX IF NOT EXISTS transactions_date_idx         ON transactions(date);
CREATE INDEX IF NOT EXISTS transactions_household_id_idx ON transactions(household_id);
CREATE INDEX IF NOT EXISTS categories_user_id_idx        ON categories(user_id);
CREATE INDEX IF NOT EXISTS refresh_tokens_user_id_idx    ON refresh_tokens(user_id);
