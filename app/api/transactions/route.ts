import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

// GET /api/transactions - list transaksi dengan filter
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const month = searchParams.get('month'); // format: YYYY-MM
  const type = searchParams.get('type');
  const category = searchParams.get('category');
  const limit = parseInt(searchParams.get('limit') || '100');
  const page = parseInt(searchParams.get('page') || '1');

  let query = supabase
    .from('transactions')
    .select('*', { count: 'exact' })
    .order('transaction_date', { ascending: false })
    .range((page - 1) * limit, page * limit - 1);

  if (month) {
    const start = `${month}-01T00:00:00`;
    const end = `${month}-31T23:59:59`;
    query = query.gte('transaction_date', start).lte('transaction_date', end);
  }
  if (type) query = query.eq('type', type);
  if (category) query = query.eq('category', category);

  const { data, error, count } = await query;

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data, count, page, limit });
}

// POST /api/transactions - tambah transaksi baru (manual)
export async function POST(request: NextRequest) {
  const body = await request.json();

  const { data, error } = await supabase
    .from('transactions')
    .insert({
      amount: body.amount,
      type: body.type,
      category: body.category || 'Lainnya',
      description: body.description || '',
      platform: body.platform || '',
      source: 'manual',
      is_verified: true,
      ai_confidence: body.ai_confidence || null,
      receipt_url: body.receipt_url || null,
      notes: body.notes || null,
      transaction_date: body.transaction_date || new Date().toISOString(),
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data }, { status: 201 });
}
