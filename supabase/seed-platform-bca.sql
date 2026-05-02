-- ============================================================
-- Update/Insert Platform BCA ke Supabase
-- Jalankan di Supabase SQL Editor
-- ============================================================
-- Data berdasarkan email notifikasi myBCA:
--   - "Tarik Tunai Berhasil"    → Cardless - Tarik Tunai
--   - "Setor Tunai Berhasil"    → Cardless - Setor Tunai
--   - "Transfer Transaksi Berhasil" → berbagai jenis transfer

-- Update jika sudah ada (email sender lama: notifikasi@bca.co.id)
-- Insert jika belum ada
INSERT INTO financial_platforms (name, type, email_sender, email_keywords, notes, is_active)
VALUES (
  'BCA',
  'bank',
  'bca@bca.co.id',
  ARRAY[
    'Berhasil',
    'Nominal',
    'Tanggal Transaksi',
    'Jenis Transfer',
    'Nomor Referensi',
    'myBCA',
    'fasilitas myBCA',
    'PT Bank Central Asia',
    'Tarik Tunai',
    'Setor Tunai',
    'IDR'
  ],
  'Bank Central Asia - myBCA Mobile Banking',
  true
)
ON CONFLICT DO NOTHING;

-- Jika sudah ada row BCA lama (dengan email sender lama), update:
UPDATE financial_platforms
SET
  email_sender   = 'bca@bca.co.id',
  email_keywords = ARRAY[
    'Berhasil',
    'Nominal',
    'Tanggal Transaksi',
    'Jenis Transfer',
    'Nomor Referensi',
    'myBCA',
    'fasilitas myBCA',
    'PT Bank Central Asia',
    'Tarik Tunai',
    'Setor Tunai',
    'IDR'
  ],
  notes      = 'Bank Central Asia - myBCA Mobile Banking',
  is_active  = true,
  updated_at = NOW()
WHERE name = 'BCA'
  AND email_sender != 'bca@bca.co.id';

-- Verifikasi:
SELECT id, name, email_sender, email_keywords, is_active
FROM financial_platforms
WHERE name = 'BCA';
