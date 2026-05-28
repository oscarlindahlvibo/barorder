INSERT INTO users (name, pin, role, active)
SELECT 'Serveringsansvarig', '4444', 'serveringsansvarig', true
WHERE NOT EXISTS (
  SELECT 1 FROM users WHERE pin = '4444'
);
