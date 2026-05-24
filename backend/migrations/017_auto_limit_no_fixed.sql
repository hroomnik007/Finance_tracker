-- Disable auto_limit for categories that have no fixed expense transactions.
-- After this migration, auto_limit is only true when fixed expenses actually exist.
UPDATE categories
SET auto_limit = false
WHERE auto_limit = true
  AND NOT EXISTS (
    SELECT 1 FROM transactions t
    WHERE t.category_id = categories.id
      AND t.is_fixed = true
      AND t.type = 'expense'
  );
