/*
  Add username/password login and multi-role permissions.

  Existing PIN users keep working: the app accepts the old PIN as the first
  password until an admin saves a new password hash.
*/

ALTER TABLE users ADD COLUMN IF NOT EXISTS username text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS roles text[] NOT NULL DEFAULT ARRAY[]::text[];

UPDATE users
SET username = CASE pin
  WHEN '0000' THEN 'admin'
  WHEN '1234' THEN 'bar'
  WHEN '5555' THEN 'personal'
  WHEN '4444' THEN 'servering'
  WHEN '6789' THEN 'lager'
  WHEN '2468' THEN 'kok'
  WHEN '1357' THEN 'gastskarm'
  ELSE lower(regexp_replace(name, '[^a-zA-Z0-9]+', '', 'g')) || '-' || left(id::text, 4)
END
WHERE username IS NULL OR username = '';

UPDATE users
SET roles = CASE
  WHEN role = 'admin' THEN ARRAY['admin', 'barpersonal', 'lager', 'personal', 'serveringsansvarig', 'kitchen', 'kitchen_display']
  WHEN pin = '1234' THEN ARRAY['barpersonal', 'lager']
  WHEN role = 'serveringsansvarig' THEN ARRAY['serveringsansvarig', 'barpersonal', 'lager', 'personal']
  ELSE ARRAY[role]
END
WHERE roles IS NULL OR array_length(roles, 1) IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS users_username_unique_idx
ON users (lower(username))
WHERE username IS NOT NULL;
