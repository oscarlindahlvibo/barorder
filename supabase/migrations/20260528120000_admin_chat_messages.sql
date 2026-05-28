CREATE TABLE IF NOT EXISTS admin_chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  target_role text NOT NULL DEFAULT 'all',
  message text NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE admin_chat_messages
  ADD COLUMN IF NOT EXISTS target_role text NOT NULL DEFAULT 'all';

ALTER TABLE admin_chat_messages ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='admin_chat_messages' AND policyname='Allow anon read admin_chat_messages') THEN
    CREATE POLICY "Allow anon read admin_chat_messages" ON admin_chat_messages FOR SELECT TO anon USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='admin_chat_messages' AND policyname='Allow anon insert admin_chat_messages') THEN
    CREATE POLICY "Allow anon insert admin_chat_messages" ON admin_chat_messages FOR INSERT TO anon WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='admin_chat_messages' AND policyname='Allow anon delete admin_chat_messages') THEN
    CREATE POLICY "Allow anon delete admin_chat_messages" ON admin_chat_messages FOR DELETE TO anon USING (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication
    WHERE pubname = 'supabase_realtime'
  ) THEN
    CREATE PUBLICATION supabase_realtime;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'admin_chat_messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE admin_chat_messages;
  END IF;
END $$;
