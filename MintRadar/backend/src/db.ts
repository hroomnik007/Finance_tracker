import { Pool } from 'pg'

export const pool = new Pool({
  connectionString: process.env['DATABASE_URL'],
  max: 5,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
})

export async function initDb(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS mints (
      url TEXT PRIMARY KEY,
      name TEXT,
      discovered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      is_known BOOLEAN NOT NULL DEFAULT FALSE
    );

    CREATE TABLE IF NOT EXISTS mint_history (
      id BIGSERIAL PRIMARY KEY,
      url TEXT NOT NULL REFERENCES mints(url) ON DELETE CASCADE,
      online BOOLEAN NOT NULL,
      latency_ms INTEGER,
      checked_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_mint_history_url_checked
      ON mint_history(url, checked_at DESC);
  `)
}
