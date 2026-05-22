-- ============================================================
-- DEMO ACCOUNT FIX SCRIPT
-- Fixes two issues with the demo@finvu.sk account:
--   1. Household name "Rodina Rodina Demových" → "Rodina Demových"
--   2. Transactions missing household_id / created_by (shows +0,00€ for all members)
--
-- Run inside the Docker container:
--   docker exec -i finance-tracker-postgres-1 \
--     psql -U <DB_USER> -d finance_tracker \
--     -f /path/to/fix-demo-data.sql
--
-- Or pipe from host:
--   docker exec -i finance-tracker-postgres-1 \
--     psql -U <DB_USER> -d finance_tracker \
--     < backend/src/scripts/fix-demo-data.sql
-- ============================================================

\echo '=== BEFORE: demo user ==='
SELECT id, email, name, household_id, savings_enabled
FROM users
WHERE email = 'demo@finvu.sk';

\echo '=== BEFORE: all demo-related users ==='
SELECT id, email, name, household_id
FROM users
WHERE email IN ('demo@finvu.sk', 'lucia@finvu.sk', 'tomas@finvu.sk');

\echo '=== BEFORE: households with Demových ==='
SELECT id, name, invite_code, created_by FROM households WHERE name LIKE '%Demov%';

\echo '=== BEFORE: transaction counts by household_id and created_by ==='
SELECT
  COUNT(*)       AS tx_count,
  household_id,
  created_by
FROM transactions
WHERE user_id = (SELECT id FROM users WHERE email = 'demo@finvu.sk')
GROUP BY household_id, created_by;

-- ── FIX 1: Correct doubled household name ────────────────────────────────
UPDATE households
SET name = 'Rodina Demových'
WHERE name = 'Rodina Rodina Demových';

\echo '=== FIX 1 applied: household name corrected ==='

-- ── FIX 2: Stamp household_id + created_by on all demo transactions ──────
-- The seed created transactions before the household existed, leaving both
-- household_id and created_by as NULL.  The getMonthlyStats endpoint only
-- counts transactions WHERE transactions.household_id = <id>, so everything
-- showed as +0,00€ / -0,00€ for every member.

UPDATE transactions
SET
  household_id = (
    SELECT household_id
    FROM   users
    WHERE  email = 'demo@finvu.sk'
  ),
  created_by = (
    SELECT id
    FROM   users
    WHERE  email = 'demo@finvu.sk'
  )
WHERE
  user_id      = (SELECT id FROM users WHERE email = 'demo@finvu.sk')
  AND household_id IS NULL;

\echo '=== FIX 2 applied: transactions stamped with household_id + created_by ==='

-- ── VERIFICATION ─────────────────────────────────────────────────────────
\echo ''
\echo '=== AFTER: household name ==='
SELECT id, name, invite_code FROM households WHERE name LIKE '%Demov%';

\echo '=== AFTER: transaction counts (all should show household_id = <integer>, not NULL) ==='
SELECT
  COUNT(*)       AS tx_count,
  type,
  household_id,
  created_by
FROM transactions
WHERE user_id = (SELECT id FROM users WHERE email = 'demo@finvu.sk')
GROUP BY type, household_id, created_by
ORDER BY type;

\echo '=== AFTER: Demo1 / Demo2 are real user accounts (no virtual-member magic needed) ==='
SELECT id, email, name, household_id
FROM users
WHERE email IN ('lucia@finvu.sk', 'tomas@finvu.sk');

\echo ''
\echo '=== Fix complete. Demo1 and Demo2 are real accounts sharing the household.'
\echo '    They have no transactions of their own — that is expected.'
\echo '    All transactions belong to demo@finvu.sk (createdBy = demo uuid).'
\echo '    The household monthly-stats view will now show real numbers for Demo. ==='
