/*
  # Åseda Truckmeet - Bar Restocking App Schema (v2 - idempotent)

  Creates all tables and policies safely with IF NOT EXISTS checks.
*/

-- Users table
CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  pin text NOT NULL,
  role text NOT NULL DEFAULT 'barpersonal',
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE users ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='users' AND policyname='Allow anon read users') THEN
    CREATE POLICY "Allow anon read users" ON users FOR SELECT TO anon USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='users' AND policyname='Allow anon insert users') THEN
    CREATE POLICY "Allow anon insert users" ON users FOR INSERT TO anon WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='users' AND policyname='Allow anon update users') THEN
    CREATE POLICY "Allow anon update users" ON users FOR UPDATE TO anon USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='users' AND policyname='Allow anon delete users') THEN
    CREATE POLICY "Allow anon delete users" ON users FOR DELETE TO anon USING (true);
  END IF;
END $$;

-- Locations table
CREATE TABLE IF NOT EXISTS locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE locations ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='locations' AND policyname='Allow anon read locations') THEN
    CREATE POLICY "Allow anon read locations" ON locations FOR SELECT TO anon USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='locations' AND policyname='Allow anon insert locations') THEN
    CREATE POLICY "Allow anon insert locations" ON locations FOR INSERT TO anon WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='locations' AND policyname='Allow anon update locations') THEN
    CREATE POLICY "Allow anon update locations" ON locations FOR UPDATE TO anon USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='locations' AND policyname='Allow anon delete locations') THEN
    CREATE POLICY "Allow anon delete locations" ON locations FOR DELETE TO anon USING (true);
  END IF;
END $$;

-- Products table
CREATE TABLE IF NOT EXISTS products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  category text NOT NULL,
  unit text NOT NULL DEFAULT 'st',
  active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE products ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='products' AND policyname='Allow anon read products') THEN
    CREATE POLICY "Allow anon read products" ON products FOR SELECT TO anon USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='products' AND policyname='Allow anon insert products') THEN
    CREATE POLICY "Allow anon insert products" ON products FOR INSERT TO anon WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='products' AND policyname='Allow anon update products') THEN
    CREATE POLICY "Allow anon update products" ON products FOR UPDATE TO anon USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='products' AND policyname='Allow anon delete products') THEN
    CREATE POLICY "Allow anon delete products" ON products FOR DELETE TO anon USING (true);
  END IF;
END $$;

-- Restock requests table
CREATE TABLE IF NOT EXISTS restock_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id),
  location_id uuid REFERENCES locations(id),
  priority text NOT NULL DEFAULT 'normal',
  note text,
  status text NOT NULL DEFAULT 'mottagen',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE restock_requests ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='restock_requests' AND policyname='Allow anon read restock_requests') THEN
    CREATE POLICY "Allow anon read restock_requests" ON restock_requests FOR SELECT TO anon USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='restock_requests' AND policyname='Allow anon insert restock_requests') THEN
    CREATE POLICY "Allow anon insert restock_requests" ON restock_requests FOR INSERT TO anon WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='restock_requests' AND policyname='Allow anon update restock_requests') THEN
    CREATE POLICY "Allow anon update restock_requests" ON restock_requests FOR UPDATE TO anon USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='restock_requests' AND policyname='Allow anon delete restock_requests') THEN
    CREATE POLICY "Allow anon delete restock_requests" ON restock_requests FOR DELETE TO anon USING (true);
  END IF;
END $$;

-- Restock request items table
CREATE TABLE IF NOT EXISTS restock_request_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid REFERENCES restock_requests(id) ON DELETE CASCADE,
  product_id uuid REFERENCES products(id),
  quantity integer NOT NULL DEFAULT 1,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE restock_request_items ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='restock_request_items' AND policyname='Allow anon read restock_request_items') THEN
    CREATE POLICY "Allow anon read restock_request_items" ON restock_request_items FOR SELECT TO anon USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='restock_request_items' AND policyname='Allow anon insert restock_request_items') THEN
    CREATE POLICY "Allow anon insert restock_request_items" ON restock_request_items FOR INSERT TO anon WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='restock_request_items' AND policyname='Allow anon update restock_request_items') THEN
    CREATE POLICY "Allow anon update restock_request_items" ON restock_request_items FOR UPDATE TO anon USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='restock_request_items' AND policyname='Allow anon delete restock_request_items') THEN
    CREATE POLICY "Allow anon delete restock_request_items" ON restock_request_items FOR DELETE TO anon USING (true);
  END IF;
END $$;

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_restock_requests_updated_at') THEN
    CREATE TRIGGER update_restock_requests_updated_at
      BEFORE UPDATE ON restock_requests
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;
