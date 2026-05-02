-- ============================================================
-- Update/Insert Platform BNI (Wondr by BNI) ke Supabase
-- Jalankan di Supabase SQL Editor
-- ============================================================
-- Data berdasarkan email notifikasi Wondr by BNI:
--   - "Transaksi berhasil"       → transfer/pembayaran sukses
--   - "Transaksi belum berhasil" → transaksi gagal (skip/abaikan)
-- Email sender: wondr@bni.co.id

-- Update BNI yang sudah ada (email sender lama salah)
UPDATE financial_platforms
SET
  email_sender   = 'wondr@bni.co.id',
  email_keywords = ARRAY[
    'Transaksi berhasil',
    'wondr by BNI',
    'wondr',
    'Nominal',
    'Detail transaksi',
    'Tujuan',
    'Sumber dana',
    'wondr multicurrency IDR',
    'PT Bank Negara Indonesia',
    'BNI'
  ],
  notes      = 'Bank Negara Indonesia - Wondr by BNI Digital Banking',
  is_active  = true,
  updated_at = NOW()
WHERE name = 'BNI';

-- Jika belum ada sama sekali, insert baru
INSERT INTO financial_platforms (name, type, email_sender, email_keywords, notes, is_active)
VALUES (
  'BNI',
  'bank',
  'wondr@bni.co.id',
  ARRAY[
    'Transaksi berhasil',
    'wondr by BNI',
    'wondr',
    'Nominal',
    'Detail transaksi',
    'Tujuan',
    'Sumber dana',
    'wondr multicurrency IDR',
    'PT Bank Negara Indonesia',
    'BNI'
  ],
  'Bank Negara Indonesia - Wondr by BNI Digital Banking',
  true
)
ON CONFLICT DO NOTHING;

-- Verifikasi:
SELECT id, name, email_sender, email_keywords, is_active
FROM financial_platforms
WHERE name = 'BNI';
