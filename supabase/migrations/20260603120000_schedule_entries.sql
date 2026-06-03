/*
  Add staff scheduling support.
*/

CREATE TABLE IF NOT EXISTS schedule_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  day text NOT NULL,
  position text NOT NULL,
  start_time text NOT NULL,
  end_time text NOT NULL,
  required_count integer NOT NULL DEFAULT 1,
  assigned_names text[] NOT NULL DEFAULT ARRAY[]::text[],
  note text,
  active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE schedule_entries ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='schedule_entries' AND policyname='Allow anon read schedule_entries') THEN
    CREATE POLICY "Allow anon read schedule_entries" ON schedule_entries FOR SELECT TO anon USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='schedule_entries' AND policyname='Allow anon insert schedule_entries') THEN
    CREATE POLICY "Allow anon insert schedule_entries" ON schedule_entries FOR INSERT TO anon WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='schedule_entries' AND policyname='Allow anon update schedule_entries') THEN
    CREATE POLICY "Allow anon update schedule_entries" ON schedule_entries FOR UPDATE TO anon USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='schedule_entries' AND policyname='Allow anon delete schedule_entries') THEN
    CREATE POLICY "Allow anon delete schedule_entries" ON schedule_entries FOR DELETE TO anon USING (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_schedule_entries_updated_at') THEN
    CREATE TRIGGER update_schedule_entries_updated_at
      BEFORE UPDATE ON schedule_entries
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

UPDATE users
SET roles = array_append(roles, 'schedule_display')
WHERE role = 'admin'
  AND NOT roles @> ARRAY['schedule_display'];

INSERT INTO users (name, username, pin, role, roles, active)
SELECT 'Schemaskärm', 'schema', '8642', 'schedule_display', ARRAY['schedule_display'], true
WHERE NOT EXISTS (
  SELECT 1 FROM users WHERE username = 'schema' OR pin = '8642'
);
