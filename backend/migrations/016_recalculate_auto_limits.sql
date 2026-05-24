-- One-time recalculation of budget_limit for all auto_limit categories
-- based on existing fixed expense transactions.
UPDATE categories c
SET budget_limit = sub.total
FROM (
  SELECT t.category_id, SUM(t.amount) AS total
  FROM transactions t
  WHERE t.is_fixed = true AND t.type = 'expense'
  GROUP BY t.category_id
  HAVING SUM(t.amount) > 0
) sub
WHERE c.id = sub.category_id AND c.auto_limit = true;
