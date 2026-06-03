/*
  Add a TV dashboard login for exhibition service.
*/

UPDATE users
SET roles = array_append(roles, 'exhibition_display')
WHERE role = 'admin'
  AND NOT roles @> ARRAY['exhibition_display'];

INSERT INTO users (name, username, pin, role, roles, active)
SELECT 'Utställningsservice TV', 'utstallning', '9753', 'exhibition_display', ARRAY['exhibition_display'], true
WHERE NOT EXISTS (
  SELECT 1 FROM users WHERE username = 'utstallning' OR pin = '9753'
);
