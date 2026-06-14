-- Indexes to support the common access pattern: a user's scripts ordered by
-- most-recently updated. Without these, every list query is a full table scan.
CREATE INDEX IF NOT EXISTS idx_scripts_user_id ON public.scripts (user_id);
CREATE INDEX IF NOT EXISTS idx_scripts_user_updated_at ON public.scripts (user_id, updated_at DESC);
