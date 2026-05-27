/*
  # Request types and priority levels

  Adds support for bar restocking, empty-crate pickup and waste pickup requests.
  Replaces the old "normal" priority with "inom_20" while preserving old rows.
*/

ALTER TABLE restock_requests
  ADD COLUMN IF NOT EXISTS request_type text NOT NULL DEFAULT 'restock';

UPDATE restock_requests
SET priority = 'inom_20'
WHERE priority = 'normal';

ALTER TABLE restock_requests
  ALTER COLUMN priority SET DEFAULT 'inom_20';
