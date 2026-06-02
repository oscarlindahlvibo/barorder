CREATE TABLE IF NOT EXISTS native_push_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  role text NOT NULL,
  platform text NOT NULL,
  token text NOT NULL UNIQUE,
  user_agent text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE native_push_tokens ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='native_push_tokens' AND policyname='Allow anon read native_push_tokens') THEN
    CREATE POLICY "Allow anon read native_push_tokens" ON native_push_tokens FOR SELECT TO anon USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='native_push_tokens' AND policyname='Allow anon insert native_push_tokens') THEN
    CREATE POLICY "Allow anon insert native_push_tokens" ON native_push_tokens FOR INSERT TO anon WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='native_push_tokens' AND policyname='Allow anon update native_push_tokens') THEN
    CREATE POLICY "Allow anon update native_push_tokens" ON native_push_tokens FOR UPDATE TO anon USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='native_push_tokens' AND policyname='Allow anon delete native_push_tokens') THEN
    CREATE POLICY "Allow anon delete native_push_tokens" ON native_push_tokens FOR DELETE TO anon USING (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_native_push_tokens_updated_at') THEN
    CREATE TRIGGER update_native_push_tokens_updated_at
      BEFORE UPDATE ON native_push_tokens
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;
