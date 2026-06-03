/*
  Add structured schedule positions and people with availability.
*/

CREATE TABLE IF NOT EXISTS schedule_positions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS schedule_people (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  preferred_day text NOT NULL,
  available_start text NOT NULL,
  available_end text NOT NULL,
  note text,
  active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE schedule_entries ADD COLUMN IF NOT EXISTS position_id uuid REFERENCES schedule_positions(id);
ALTER TABLE schedule_entries ADD COLUMN IF NOT EXISTS assigned_staff_ids text[] NOT NULL DEFAULT ARRAY[]::text[];

ALTER TABLE schedule_positions ENABLE ROW LEVEL SECURITY;
ALTER TABLE schedule_people ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='schedule_positions' AND policyname='Allow anon read schedule_positions') THEN
    CREATE POLICY "Allow anon read schedule_positions" ON schedule_positions FOR SELECT TO anon USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='schedule_positions' AND policyname='Allow anon insert schedule_positions') THEN
    CREATE POLICY "Allow anon insert schedule_positions" ON schedule_positions FOR INSERT TO anon WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='schedule_positions' AND policyname='Allow anon update schedule_positions') THEN
    CREATE POLICY "Allow anon update schedule_positions" ON schedule_positions FOR UPDATE TO anon USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='schedule_positions' AND policyname='Allow anon delete schedule_positions') THEN
    CREATE POLICY "Allow anon delete schedule_positions" ON schedule_positions FOR DELETE TO anon USING (true);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='schedule_people' AND policyname='Allow anon read schedule_people') THEN
    CREATE POLICY "Allow anon read schedule_people" ON schedule_people FOR SELECT TO anon USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='schedule_people' AND policyname='Allow anon insert schedule_people') THEN
    CREATE POLICY "Allow anon insert schedule_people" ON schedule_people FOR INSERT TO anon WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='schedule_people' AND policyname='Allow anon update schedule_people') THEN
    CREATE POLICY "Allow anon update schedule_people" ON schedule_people FOR UPDATE TO anon USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='schedule_people' AND policyname='Allow anon delete schedule_people') THEN
    CREATE POLICY "Allow anon delete schedule_people" ON schedule_people FOR DELETE TO anon USING (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_schedule_people_updated_at') THEN
    CREATE TRIGGER update_schedule_people_updated_at
      BEFORE UPDATE ON schedule_people
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

INSERT INTO schedule_positions (name, sort_order)
SELECT position, row_number() OVER (ORDER BY position)
FROM (
  SELECT DISTINCT position
  FROM schedule_entries
  WHERE position IS NOT NULL AND position <> ''
) positions
WHERE NOT EXISTS (
  SELECT 1 FROM schedule_positions existing
  WHERE lower(existing.name) = lower(positions.position)
);

UPDATE schedule_entries entry
SET position_id = position.id
FROM schedule_positions position
WHERE entry.position_id IS NULL
  AND entry.position = position.name;
