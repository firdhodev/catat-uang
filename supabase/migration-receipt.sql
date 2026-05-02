-- Migration: tambah kolom receipt_url dan notes ke transactions
ALTER TABLE transactions
  ADD COLUMN IF NOT EXISTS receipt_url TEXT,
  ADD COLUMN IF NOT EXISTS notes TEXT;

-- Setup Supabase Storage bucket untuk receipts
INSERT INTO storage.buckets (id, name, public)
VALUES ('receipts', 'receipts', true)
ON CONFLICT (id) DO NOTHING;

-- Drop dulu kalau sudah ada, baru buat ulang
DROP POLICY IF EXISTS "receipts_public_read" ON storage.objects;
DROP POLICY IF EXISTS "receipts_anon_insert" ON storage.objects;
DROP POLICY IF EXISTS "receipts_anon_update" ON storage.objects;
DROP POLICY IF EXISTS "receipts_anon_delete" ON storage.objects;

-- Policy: siapa saja bisa baca
CREATE POLICY "receipts_public_read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'receipts');

-- Policy: siapa saja bisa upload
CREATE POLICY "receipts_anon_insert"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'receipts');

-- Policy: siapa saja bisa update
CREATE POLICY "receipts_anon_update"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'receipts');

-- Policy: siapa saja bisa hapus
CREATE POLICY "receipts_anon_delete"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'receipts');
