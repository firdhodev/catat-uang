-- ============================================================
-- Insert Platform Krom Bank ke Supabase
-- Jalankan di Supabase SQL Editor
-- ============================================================
-- Data berdasarkan email notifikasi Krom:
--   - "Dana Diterima"            → income (transfer masuk)
--   - "Transaksi QRIS Berhasil"  → expense (pembayaran QRIS)
-- Email sender: noreply@krom.id

INSERT INTO financial_platforms (name, type, email_sender, email_keywords, notes, is_active)
VALUES (
  'Krom Bank',
  'bank',
  'noreply@krom.id',
  ARRAY[
    'Dana Diterima',
    'Transaksi QRIS Berhasil',
    'Kamu telah menerima dana',
    'Kamu telah melakukan pembayaran QRIS',
    'Tanggal & Waktu',
    'Jumlah',
    'Merchant',
    'Tim Krom',
    'PT Krom Bank Indonesia',
    'Tabungan Utama',
    'krom'
  ],
  'PT Krom Bank Indonesia Tbk - Digital Banking',
  true
)
ON CONFLICT DO NOTHING;

-- Verifikasi:
SELECT id, name, email_sender, email_keywords, is_active
FROM financial_platforms
WHERE name = 'Krom Bank';
