import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { parseEmailWithAI } from '@/lib/ai';

// POST /api/process-emails - proses pending emails dengan AI
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const limit = body.limit || 10; // proses max 10 email per request

  // Ambil email yang pending
  const { data: pendingEmails, error: fetchError } = await supabase
    .from('pending_emails')
    .select('*')
    .eq('status', 'pending')
    .order('received_at', { ascending: true })
    .limit(limit);

  if (fetchError) {
    return NextResponse.json({ error: fetchError.message }, { status: 500 });
  }

  if (!pendingEmails || pendingEmails.length === 0) {
    return NextResponse.json({ message: 'No pending emails', processed: 0 });
  }

  const results = {
    processed: 0,
    failed: 0,
    skipped: 0,
    details: [] as { id: string; status: string; message?: string }[],
  };

  for (const email of pendingEmails) {
    // Mark as processing
    await supabase
      .from('pending_emails')
      .update({ status: 'processing' })
      .eq('id', email.id);

    try {
      const parsed = await parseEmailWithAI(email.body, email.subject);

      if (!parsed) {
        // AI gagal parse, tandai failed
        await supabase
          .from('pending_emails')
          .update({ status: 'failed', error_message: 'AI gagal mengparse email ini' })
          .eq('id', email.id);
        results.failed++;
        results.details.push({ id: email.id, status: 'failed', message: 'AI parse failed' });
        continue;
      }

      // Simpan ke transactions
      const { error: insertError } = await supabase
        .from('transactions')
        .insert({
          amount: parsed.amount,
          type: parsed.type,
          category: parsed.category,
          description: parsed.description,
          platform: email.platform_name || '',
          source: 'email',
          source_email_id: email.id,
          ai_confidence: parsed.confidence,
          is_verified: parsed.confidence >= 0.85,
          transaction_date: parsed.transaction_date,
        });

      if (insertError) throw new Error(insertError.message);

      // Mark email as done
      await supabase
        .from('pending_emails')
        .update({ status: 'done' })
        .eq('id', email.id);

      results.processed++;
      results.details.push({ id: email.id, status: 'done' });

    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error';
      await supabase
        .from('pending_emails')
        .update({ status: 'failed', error_message: errorMsg })
        .eq('id', email.id);
      results.failed++;
      results.details.push({ id: email.id, status: 'failed', message: errorMsg });
    }
  }

  return NextResponse.json(results);
}

// GET /api/process-emails - lihat pending emails
export async function GET() {
  const { data, error, count } = await supabase
    .from('pending_emails')
    .select('*', { count: 'exact' })
    .eq('status', 'pending')
    .order('received_at', { ascending: false })
    .limit(50);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data, count });
}
