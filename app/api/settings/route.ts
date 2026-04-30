import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

// GET /api/settings
export async function GET() {
  const { data, error } = await supabase
    .from('app_settings')
    .select('*');

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}

// POST /api/settings - update satu atau banyak settings
export async function POST(request: NextRequest) {
  const body = await request.json();
  // body: { key: string, value: string } or array of those

  const updates = Array.isArray(body) ? body : [body];

  const { error } = await supabase
    .from('app_settings')
    .upsert(
      updates.map((u: { key: string; value: string; label?: string }) => ({
        key: u.key,
        value: u.value,
        label: u.label,
        updated_at: new Date().toISOString(),
      })),
      { onConflict: 'key' }
    );

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
