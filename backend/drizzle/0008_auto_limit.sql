ALTER TABLE categories ADD COLUMN IF NOT EXISTS auto_limit boolean NOT NULL DEFAULT true;

-- Preserve existing manually-set budget limits (set auto_limit = false for them)
UPDATE categories SET auto_limit = false WHERE budget_limit IS NOT NULL;
