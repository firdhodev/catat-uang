import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

// GET /api/platforms
export async function GET() {
  const { data, error } = await supabase
    .from('financial_platforms')
    .select('*')
    .order('name');

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}

// POST /api/platforms - tambah platform baru
export async function POST(request: NextRequest) {
  const body = await request.json();

  const { data, error } = await supabase
    .from('financial_platforms')
    .insert({
      name: body.name,
      type: body.type || 'bank',
      email_sender: body.email_sender || null,
      email_keywords: body.email_keywords || [],
      notes: body.notes || '',
      is_active: true,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data }, { status: 201 });
}
