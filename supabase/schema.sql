-- ============================================
-- Smart Money Tracker - Supabase Schema
-- Jalankan di Supabase SQL Editor
-- ============================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================
-- 1. PLATFORM KEUANGAN
-- ============================================
CREATE TABLE IF NOT EXISTS financial_platforms (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  type VARCHAR(20) NOT NULL DEFAULT 'bank',
  -- type: 'bank', 'ewallet', 'crypto', 'paylater', 'other'
  email_sender TEXT,
  email_keywords TEXT[],
  is_active BOOLEAN DEFAULT true,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 2. EMAIL PENDING (dari Apps Script)
-- ============================================
CREATE TABLE IF NOT EXISTS pending_emails (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  gmail_message_id TEXT UNIQUE NOT NULL,
  platform_id UUID REFERENCES financial_platforms(id) ON DELETE SET NULL,
  platform_name VARCHAR(100),
  subject TEXT,
  body TEXT NOT NULL,
  received_at TIMESTAMPTZ,
  status VARCHAR(20) DEFAULT 'pending',
  -- status: 'pending', 'processing', 'done', 'failed', 'skipped'
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 3. TRANSAKSI
-- ============================================
CREATE TABLE IF NOT EXISTS transactions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  amount DECIMAL(15,2) NOT NULL,
  type VARCHAR(10) NOT NULL,
  -- type: 'income', 'expense'
  category VARCHAR(50) DEFAULT 'Lainnya',
  description TEXT,
  platform VARCHAR(100),
  source VARCHAR(10) DEFAULT 'manual',
  -- source: 'email', 'manual'
  source_email_id UUID REFERENCES pending_emails(id) ON DELETE SET NULL,
  ai_confidence DECIMAL(3,2),
  -- 0.00 - 1.00
  is_verified BOOLEAN DEFAULT false,
  transaction_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 4. KATEGORI
-- ============================================
CREATE TABLE IF NOT EXISTS categories (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name VARCHAR(50) NOT NULL UNIQUE,
  icon VARCHAR(10) DEFAULT '💰',
  color VARCHAR(7) DEFAULT '#6366f1',
  type VARCHAR(10) DEFAULT 'expense',
  -- type: 'income', 'expense', 'both'
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 5. APP SETTINGS (AI config, dll)
-- ============================================
CREATE TABLE IF NOT EXISTS app_settings (
  key VARCHAR(100) PRIMARY KEY,
  value TEXT,
  label VARCHAR(200),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- SEED DATA: Kategori Default
-- ============================================
INSERT INTO categories (name, icon, color, type, is_default) VALUES
  ('Makanan & Minuman', '🍽️', '#f59e0b', 'expense', true),
  ('Transport', '🚗', '#3b82f6', 'expense', true),
  ('Belanja', '🛍️', '#8b5cf6', 'expense', true),
  ('Tagihan & Utilitas', '⚡', '#ef4444', 'expense', true),
  ('Kesehatan', '🏥', '#10b981', 'expense', true),
  ('Hiburan', '🎮', '#f97316', 'expense', true),
  ('Pendidikan', '📚', '#06b6d4', 'expense', true),
  ('Investasi', '📈', '#84cc16', 'expense', true),
  ('Transfer Keluar', '↗️', '#6b7280', 'expense', true),
  ('Lainnya', '💸', '#9ca3af', 'expense', true),
  ('Gaji', '💼', '#10b981', 'income', true),
  ('Freelance', '💻', '#6366f1', 'income', true),
  ('Transfer Masuk', '↙️', '#3b82f6', 'income', true),
  ('Cashback & Reward', '🎁', '#f59e0b', 'income', true),
  ('Pemasukan Lainnya', '💰', '#9ca3af', 'income', true)
ON CONFLICT (name) DO NOTHING;

-- ============================================
-- SEED DATA: Platform Keuangan Populer Indonesia
-- ============================================
INSERT INTO financial_platforms (name, type, email_sender, email_keywords, notes) VALUES
  ('BCA', 'bank', 'bca@bca.co.id', ARRAY['Berhasil', 'Nominal', 'Tanggal Transaksi', 'Jenis Transfer', 'myBCA', 'fasilitas myBCA', 'PT Bank Central Asia', 'Tarik Tunai', 'Setor Tunai', 'IDR'], 'Bank Central Asia - myBCA Mobile Banking'),
  ('Mandiri', 'bank', 'notifikasi@bankmandiri.co.id', ARRAY['Debit', 'Kredit', 'Transfer', 'Mandiri'], 'Bank Mandiri'),
  ('BNI', 'bank', 'wondr@bni.co.id', ARRAY['Transaksi berhasil', 'wondr by BNI', 'wondr', 'Nominal', 'Detail transaksi', 'Tujuan', 'Sumber dana', 'PT Bank Negara Indonesia', 'BNI'], 'Bank Negara Indonesia - Wondr by BNI Digital Banking'),
  ('BRI', 'bank', 'info@bri.co.id', ARRAY['Debit', 'Kredit', 'Transfer', 'BRI'], 'Bank Rakyat Indonesia'),
  ('Bank BTN', 'bank', 'balebybtn@btn.co.id', ARRAY['Notifikasi Transaksi', 'Nominal Pembayaran', 'SUKSES', 'QR Payment', 'BTN Mobile', 'berhasil dilakukan'], 'Bank Tabungan Negara - Mobile Banking'),
  ('GoPay', 'ewallet', 'noreply@gojek.com', ARRAY['GoPay', 'bayar', 'terima', 'transfer'], 'Dompet digital Gojek'),
  ('OVO', 'ewallet', 'no-reply@ovo.id', ARRAY['OVO', 'bayar', 'transfer', 'top up'], 'Dompet digital OVO'),
  ('DANA', 'ewallet', 'noreply@dana.id', ARRAY['DANA', 'bayar', 'transfer', 'top up'], 'Dompet digital DANA'),
  ('ShopeePay', 'ewallet', 'no-reply@shopee.co.id', ARRAY['ShopeePay', 'bayar', 'transfer'], 'Dompet digital Shopee'),
  ('Flip', 'ewallet', 'noreply@flip.id', ARRAY['Flip', 'transfer', 'diterima'], 'Platform transfer uang'),
  ('Jenius', 'bank', 'hello@jenius.com', ARRAY['Jenius', 'debit', 'credit', 'transfer'], 'Bank digital BTPN'),
  ('SeaBank', 'bank', 'noreply@seabank.co.id', ARRAY['SeaBank', 'debet', 'kredit', 'transfer'], 'Bank digital Sea'),
  ('Akulaku', 'paylater', 'notification@akulaku.com', ARRAY['Akulaku', 'cicilan', 'bayar', 'tagihan'], 'Platform paylater'),
  ('Kredivo', 'paylater', 'noreply@kredivo.com', ARRAY['Kredivo', 'cicilan', 'bayar', 'tagihan'], 'Platform paylater')
ON CONFLICT DO NOTHING;

-- ============================================
-- SEED DATA: App Settings Default
-- ============================================
INSERT INTO app_settings (key, value, label) VALUES
  ('ai_base_url', 'http://localhost:11434/v1', 'AI Base URL'),
  ('ai_api_key', 'ollama', 'AI API Key'),
  ('ai_model', 'llama3.2:3b', 'AI Model'),
  ('ai_provider', 'ollama', 'AI Provider (ollama/openrouter/custom)'),
  ('currency', 'IDR', 'Currency'),
  ('timezone', 'Asia/Jakarta', 'Timezone')
ON CONFLICT (key) DO NOTHING;

-- ============================================
-- INDEX untuk performa
-- ============================================
CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(transaction_date DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_type ON transactions(type);
CREATE INDEX IF NOT EXISTS idx_transactions_category ON transactions(category);
CREATE INDEX IF NOT EXISTS idx_pending_emails_status ON pending_emails(status);
CREATE INDEX IF NOT EXISTS idx_pending_emails_gmail_id ON pending_emails(gmail_message_id);
