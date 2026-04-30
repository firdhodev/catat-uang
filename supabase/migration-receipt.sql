-- Migration: tambah kolom receipt_url dan notes ke transactions
-- Jalankan di Supabase SQL Editor

ALTER TABLE transactions
  ADD COLUMN IF NOT EXISTS receipt_url TEXT,
  ADD COLUMN IF NOT EXISTS notes TEXT;

-- Setup Supabase Storage bucket untuk receipts
-- Jalankan ini SETELAH membuat bucket "receipts" di Supabase Dashboard → Storage
-- Storage → New bucket → Name: "receipts" → Public: YES → Create

-- Policy agar bisa upload via anon key
INSERT INTO storage.buckets (id, name, public)
VALUES ('receipts', 'receipts', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY IF NOT EXISTS "receipts_public_read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'receipts');

CREATE POLICY IF NOT EXISTS "receipts_anon_insert"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'receipts');
