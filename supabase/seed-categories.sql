-- Seed default categories ke app_settings
-- Jalankan di Supabase SQL Editor jika ingin pre-populate tanpa harus ke halaman Settings

INSERT INTO app_settings (key, value, label, updated_at)
VALUES
  (
    'categories_expense',
    '["Makanan & Minuman","Transport","Belanja","Tagihan & Utilitas","Kesehatan","Hiburan","Pendidikan","Investasi","Transfer Keluar","Lainnya"]',
    'Kategori Pengeluaran',
    NOW()
  ),
  (
    'categories_income',
    '["Gaji","Freelance","Transfer Masuk","Cashback & Reward","Pemasukan Lainnya"]',
    'Kategori Pemasukan',
    NOW()
  )
ON CONFLICT (key) DO NOTHING;
-- Gunakan ON CONFLICT DO NOTHING agar tidak overwrite kategori yang sudah kamu custom sebelumnya
-- Ganti DO NOTHING dengan DO UPDATE SET value = EXCLUDED.value jika ingin reset ke default
