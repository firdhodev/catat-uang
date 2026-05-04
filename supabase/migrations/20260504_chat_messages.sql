-- =====================================================
-- MIGRATION: Chat Messages Table
-- Jalankan di Supabase SQL Editor
-- =====================================================

-- Tabel untuk menyimpan riwayat chat dengan AI
CREATE TABLE IF NOT EXISTS chat_messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  transaction_id UUID REFERENCES transactions(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Index untuk query berurutan
CREATE INDEX IF NOT EXISTS idx_chat_messages_created_at 
  ON chat_messages (created_at ASC);

-- RLS Policy (buka akses untuk anon key, karena single user)
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all for anon" ON chat_messages
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Pastikan tabel transactions ada kolom 'source'
-- Jika belum ada, tambahkan:
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name='transactions' AND column_name='source'
  ) THEN
    ALTER TABLE transactions ADD COLUMN source TEXT DEFAULT 'manual';
  END IF;
END $$;

-- =====================================================
-- SELESAI - chat_messages table siap digunakan
-- =====================================================
