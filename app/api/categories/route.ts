import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { DEFAULT_CATEGORIES } from '@/lib/categories';

export const dynamic = 'force-dynamic';

// GET /api/categories - ambil kategori dari DB
export async function GET() {
  try {
    const { data } = await supabase
      .from('app_settings')
      .select('key, value')
      .in('key', ['categories_expense', 'categories_income']);

    const settings: Record<string, string> = {};
    if (data) {
      data.forEach((row) => { settings[row.key] = row.value; });
    }

    const expense = settings['categories_expense']
      ? JSON.parse(settings['categories_expense'])
      : DEFAULT_CATEGORIES.expense;

    const income = settings['categories_income']
      ? JSON.parse(settings['categories_income'])
      : DEFAULT_CATEGORIES.income;

    return NextResponse.json({ expense, income });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Internal error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// POST /api/categories - simpan kategori
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { expense, income } = body;

    const updates = [];
    if (expense !== undefined) {
      updates.push({ key: 'categories_expense', value: JSON.stringify(expense), label: 'Kategori Pengeluaran', updated_at: new Date().toISOString() });
    }
    if (income !== undefined) {
      updates.push({ key: 'categories_income', value: JSON.stringify(income), label: 'Kategori Pemasukan', updated_at: new Date().toISOString() });
    }

    if (updates.length === 0) {
      return NextResponse.json({ error: 'Tidak ada data untuk disimpan' }, { status: 400 });
    }

    const { error } = await supabase
      .from('app_settings')
      .upsert(updates, { onConflict: 'key' });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Internal error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
