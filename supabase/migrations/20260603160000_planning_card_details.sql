/*
  Add checklist, tags and attachments to planning cards.
*/

ALTER TABLE planning_tasks ADD COLUMN IF NOT EXISTS tags text[] NOT NULL DEFAULT ARRAY[]::text[];
ALTER TABLE planning_tasks ADD COLUMN IF NOT EXISTS checklist jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE planning_tasks ADD COLUMN IF NOT EXISTS attachments jsonb NOT NULL DEFAULT '[]'::jsonb;
