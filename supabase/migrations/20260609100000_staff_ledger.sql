/*
  Staff ledger / personalliggare.

  The ledger is intentionally separate from schedule_people so guards and other
  unscheduled staff can sign in without first being added to the schedule.
*/

CREATE TABLE IF NOT EXISTS staff_ledger_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_person_id uuid REFERENCES schedule_people(id) ON DELETE SET NULL,
  schedule_entry_id uuid REFERENCES schedule_entries(id) ON DELETE SET NULL,
  name text NOT NULL,
  role text NOT NULL DEFAULT 'extra',
  day text NOT NULL,
  position text,
  check_in_at timestamptz NOT NULL DEFAULT now(),
  check_out_at timestamptz,
  note text,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE staff_ledger_entries ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='staff_ledger_entries' AND policyname='Allow anon read staff_ledger_entries') THEN
    CREATE POLICY "Allow anon read staff_ledger_entries" ON staff_ledger_entries FOR SELECT TO anon USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='staff_ledger_entries' AND policyname='Allow anon insert staff_ledger_entries') THEN
    CREATE POLICY "Allow anon insert staff_ledger_entries" ON staff_ledger_entries FOR INSERT TO anon WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='staff_ledger_entries' AND policyname='Allow anon update staff_ledger_entries') THEN
    CREATE POLICY "Allow anon update staff_ledger_entries" ON staff_ledger_entries FOR UPDATE TO anon USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='staff_ledger_entries' AND policyname='Allow anon delete staff_ledger_entries') THEN
    CREATE POLICY "Allow anon delete staff_ledger_entries" ON staff_ledger_entries FOR DELETE TO anon USING (true);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_staff_ledger_entries_updated_at') THEN
    CREATE TRIGGER update_staff_ledger_entries_updated_at
      BEFORE UPDATE ON staff_ledger_entries
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

UPDATE users
SET roles = array_append(roles, 'staff_ledger')
WHERE role = 'admin'
  AND NOT roles @> ARRAY['staff_ledger'];

INSERT INTO users (name, username, pin, role, roles, active)
SELECT 'Personalliggare', 'personalliggare', '1122', 'staff_ledger', ARRAY['staff_ledger'], true
WHERE NOT EXISTS (
  SELECT 1 FROM users WHERE pin = '1122' OR username = 'personalliggare'
);
