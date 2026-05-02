-- ============================================================
-- Insert Platform Bank BTN ke Supabase
-- Jalankan di Supabase SQL Editor
-- ============================================================
-- Data berdasarkan email notifikasi BTN Mobile Banking:
--   - "Notifikasi Transaksi Transfer"
--   - "Notifikasi Transaksi Pembelian"
--   - "Notifikasi QR Merchant"

INSERT INTO financial_platforms (name, type, email_sender, email_keywords, notes, is_active)
VALUES (
  'Bank BTN',
  'bank',
  'balebybtn@btn.co.id',
  ARRAY[
    'Notifikasi Transaksi',
    'Nominal Pembayaran',
    'SUKSES',
    'QR Payment',
    'BTN Mobile',
    'berhasil dilakukan',
    'Bale by BTN'
  ],
  'Bank Tabungan Negara - Mobile Banking (Bale by BTN)',
  true
)
ON CONFLICT DO NOTHING;

-- Verifikasi berhasil:
SELECT id, name, email_sender, email_keywords, is_active
FROM financial_platforms
WHERE name = 'Bank BTN';
