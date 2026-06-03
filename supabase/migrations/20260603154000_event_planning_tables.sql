/*
  Add event planning boards and shopping list support.
*/

CREATE TABLE IF NOT EXISTS planning_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  status text NOT NULL DEFAULT 'todo',
  assignee_id uuid REFERENCES users(id) ON DELETE SET NULL,
  due_date date,
  priority text NOT NULL DEFAULT 'normal',
  tags text[] NOT NULL DEFAULT ARRAY[]::text[],
  checklist jsonb NOT NULL DEFAULT '[]'::jsonb,
  attachments jsonb NOT NULL DEFAULT '[]'::jsonb,
  archived boolean NOT NULL DEFAULT false,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS shopping_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_name text NOT NULL,
  quantity text NOT NULL DEFAULT '',
  store text NOT NULL DEFAULT 'Övrigt',
  assignee_id uuid REFERENCES users(id) ON DELETE SET NULL,
  purchased boolean NOT NULL DEFAULT false,
  archived boolean NOT NULL DEFAULT false,
  note text,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE planning_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE shopping_items ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='planning_tasks' AND policyname='Allow anon read planning_tasks') THEN
    CREATE POLICY "Allow anon read planning_tasks" ON planning_tasks FOR SELECT TO anon USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='planning_tasks' AND policyname='Allow anon insert planning_tasks') THEN
    CREATE POLICY "Allow anon insert planning_tasks" ON planning_tasks FOR INSERT TO anon WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='planning_tasks' AND policyname='Allow anon update planning_tasks') THEN
    CREATE POLICY "Allow anon update planning_tasks" ON planning_tasks FOR UPDATE TO anon USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='planning_tasks' AND policyname='Allow anon delete planning_tasks') THEN
    CREATE POLICY "Allow anon delete planning_tasks" ON planning_tasks FOR DELETE TO anon USING (true);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='shopping_items' AND policyname='Allow anon read shopping_items') THEN
    CREATE POLICY "Allow anon read shopping_items" ON shopping_items FOR SELECT TO anon USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='shopping_items' AND policyname='Allow anon insert shopping_items') THEN
    CREATE POLICY "Allow anon insert shopping_items" ON shopping_items FOR INSERT TO anon WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='shopping_items' AND policyname='Allow anon update shopping_items') THEN
    CREATE POLICY "Allow anon update shopping_items" ON shopping_items FOR UPDATE TO anon USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='shopping_items' AND policyname='Allow anon delete shopping_items') THEN
    CREATE POLICY "Allow anon delete shopping_items" ON shopping_items FOR DELETE TO anon USING (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_planning_tasks_updated_at') THEN
    CREATE TRIGGER update_planning_tasks_updated_at
      BEFORE UPDATE ON planning_tasks
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_shopping_items_updated_at') THEN
    CREATE TRIGGER update_shopping_items_updated_at
      BEFORE UPDATE ON shopping_items
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;
