CREATE TABLE IF NOT EXISTS kitchen_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number text NOT NULL,
  status text NOT NULL DEFAULT 'ready',
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  dismissed_at timestamptz
);

ALTER TABLE kitchen_orders ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='kitchen_orders' AND policyname='Allow anon read kitchen_orders') THEN
    CREATE POLICY "Allow anon read kitchen_orders" ON kitchen_orders FOR SELECT TO anon USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='kitchen_orders' AND policyname='Allow anon insert kitchen_orders') THEN
    CREATE POLICY "Allow anon insert kitchen_orders" ON kitchen_orders FOR INSERT TO anon WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='kitchen_orders' AND policyname='Allow anon update kitchen_orders') THEN
    CREATE POLICY "Allow anon update kitchen_orders" ON kitchen_orders FOR UPDATE TO anon USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='kitchen_orders' AND policyname='Allow anon delete kitchen_orders') THEN
    CREATE POLICY "Allow anon delete kitchen_orders" ON kitchen_orders FOR DELETE TO anon USING (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_kitchen_orders_updated_at') THEN
    CREATE TRIGGER update_kitchen_orders_updated_at
      BEFORE UPDATE ON kitchen_orders
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

INSERT INTO users (name, pin, role, active)
SELECT 'Kök', '2468', 'kitchen', true
WHERE NOT EXISTS (
  SELECT 1 FROM users WHERE pin = '2468'
);

INSERT INTO users (name, pin, role, active)
SELECT 'Köksskärm gäster', '1357', 'kitchen_display', true
WHERE NOT EXISTS (
  SELECT 1 FROM users WHERE pin = '1357'
);

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'kitchen_orders'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE kitchen_orders;
  END IF;
END $$;
