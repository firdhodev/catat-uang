import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Types
export interface Transaction {
  id: string;
  amount: number;
  type: 'income' | 'expense';
  category: string;
  description: string;
  platform: string;
  source: 'email' | 'manual';
  source_email_id?: string;
  ai_confidence?: number;
  is_verified: boolean;
  transaction_date: string;
  created_at: string;
}

export interface PendingEmail {
  id: string;
  gmail_message_id: string;
  platform_name?: string;
  subject?: string;
  body: string;
  received_at?: string;
  status: 'pending' | 'processing' | 'done' | 'failed' | 'skipped';
  error_message?: string;
  created_at: string;
}

export interface FinancialPlatform {
  id: string;
  name: string;
  type: 'bank' | 'ewallet' | 'crypto' | 'paylater' | 'other';
  email_sender?: string;
  email_keywords?: string[];
  is_active: boolean;
  notes?: string;
}

export interface Category {
  id: string;
  name: string;
  icon: string;
  color: string;
  type: 'income' | 'expense' | 'both';
  is_default: boolean;
}

export interface AppSetting {
  key: string;
  value: string;
  label: string;
}
