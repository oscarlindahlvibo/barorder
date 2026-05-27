/*
  # Staff call dashboard user

  Adds a dedicated personal dashboard login for security, IT support and serving manager calls.
*/

INSERT INTO users (name, pin, role, active)
SELECT 'Personalansvarig', '5555', 'personal', true
WHERE NOT EXISTS (
  SELECT 1 FROM users WHERE pin = '5555'
);
INSERT INTO users (name, pin, role, active)
SELECT 'Admin', '0000', 'admin', true
WHERE NOT EXISTS (
  SELECT 1 FROM users WHERE pin = '0000'
);
