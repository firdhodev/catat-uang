import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { getCategories } from '@/lib/ai';

export const dynamic = 'force-dynamic';

interface AIConfig {
  baseUrl: string;
  apiKey: string;
  model: string;
}

async function getAIConfig(): Promise<AIConfig> {
  const { data } = await supabase
    .from('app_settings')
    .select('key, value')
    .in('key', ['ai_base_url', 'ai_api_key', 'ai_model']);

  const settings: Record<string, string> = {};
  if (data) data.forEach((row) => { settings[row.key] = row.value; });

  return {
    baseUrl: settings['ai_base_url'] || process.env.AI_BASE_URL || 'https://openrouter.ai/api/v1',
    apiKey: settings['ai_api_key'] || process.env.AI_API_KEY || '',
    model: settings['ai_model'] || process.env.AI_MODEL || 'google/gemini-2.0-flash-001',
  };
}

// GET /api/chat/history — ambil riwayat chat dari DB
export async function GET() {
  const { data, error } = await supabase
    .from('chat_messages')
    .select('*')
    .order('created_at', { ascending: true })
    .limit(100);

  if (error) return NextResponse.json({ messages: [] });
  return NextResponse.json({ messages: data || [] });
}

// POST /api/chat — kirim pesan ke AI
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { message, imageBase64, imageMimeType } = body;

    if (!message && !imageBase64) {
      return NextResponse.json({ error: 'Pesan diperlukan' }, { status: 400 });
    }

    // Simpan pesan user ke DB
    await supabase.from('chat_messages').insert({
      role: 'user',
      content: message || '📷 [Gambar]',
      created_at: new Date().toISOString(),
    });

    const [config, categories] = await Promise.all([getAIConfig(), getCategories()]);

    // Ambil ringkasan keuangan bulan ini untuk context AI
    const thisMonth = new Date().toISOString().slice(0, 7);
    const { data: txData } = await supabase
      .from('transactions')
      .select('amount, type')
      .gte('transaction_date', `${thisMonth}-01`)
      .lte('transaction_date', `${thisMonth}-31`);

    const totalIncome = txData?.filter(t => t.type === 'income').reduce((a, t) => a + t.amount, 0) || 0;
    const totalExpense = txData?.filter(t => t.type === 'expense').reduce((a, t) => a + t.amount, 0) || 0;
    const balance = totalIncome - totalExpense;

    const formatRp = (n: number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(n);

    const SYSTEM_PROMPT = `Kamu adalah asisten keuangan pribadi bernama "CuanBot" yang berjalan di aplikasi CatatUang.
Kamu berbicara dalam Bahasa Indonesia yang santai, singkat, dan ramah (boleh pakai emoji).

KONTEKS KEUANGAN BULAN INI (${thisMonth}):
- Pemasukan: ${formatRp(totalIncome)}
- Pengeluaran: ${formatRp(totalExpense)}  
- Saldo bersih: ${formatRp(balance)}

KEMAMPUANMU:
1. Mencatat transaksi dari chat natural language (contoh: "makan siang 35rb", "terima gaji 5jt")
2. Menjawab pertanyaan tentang keuangan
3. Memberikan tips keuangan
4. Menampilkan ringkasan saldo jika ditanya

ATURAN PARSING TRANSAKSI:
- "rb", "ribu", "k" = × 1.000 (15rb = 15000)
- "jt", "juta" = × 1.000.000 (1.5jt = 1500000)
- Jika pesan mengandung transaksi, ekstrak dan kembalikan di field "transaction"
- Kategori pengeluaran: ${categories.expense.join(', ')}
- Kategori pemasukan: ${categories.income.join(', ')}

FORMAT RESPONSE (JSON):
{
  "reply": "Teks balasan untuk user (friendly, singkat, pakai emoji)",
  "transaction": {
    "amount": 35000,
    "type": "expense",
    "category": "Makanan & Minuman",
    "description": "Makan Siang",
    "platform": ""
  }
}

Jika TIDAK ada transaksi, kembalikan:
{
  "reply": "Teks balasan",
  "transaction": null
}

JANGAN pernah balas dengan teks biasa, SELALU format JSON valid.`;

    type MessageContent = string | { type: string; text?: string; image_url?: { url: string } }[];
    type Message = { role: string; content: MessageContent };

    const messages: Message[] = [
      { role: 'system', content: SYSTEM_PROMPT }
    ];

    if (imageBase64) {
      messages.push({
        role: 'user',
        content: [
          { type: 'text', text: message || 'Tolong catat transaksi dari gambar struk/nota ini:' },
          { type: 'image_url', image_url: { url: `data:${imageMimeType || 'image/jpeg'};base64,${imageBase64}` } },
        ]
      });
    } else {
      messages.push({ role: 'user', content: message });
    }

    // Panggil AI
    const aiResponse = await fetch(`${config.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://catat-uang.vercel.app',
        'X-Title': 'CatatUang Smart Money Tracker',
      },
      body: JSON.stringify({
        model: config.model,
        messages,
        temperature: 0.3,
        max_tokens: 500,
      }),
      signal: AbortSignal.timeout(30000),
    });

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      throw new Error(`AI API error: ${aiResponse.status} — ${errText}`);
    }

    const aiData = await aiResponse.json();
    const rawContent = aiData.choices?.[0]?.message?.content || '{"reply":"Maaf, AI tidak merespons.","transaction":null}';

    // Parse JSON dari AI
    let parsed: { reply: string; transaction: null | { amount: number; type: string; category: string; description: string; platform: string } };
    try {
      const jsonMatch = rawContent.match(/\{[\s\S]*\}/);
      parsed = JSON.parse(jsonMatch ? jsonMatch[0] : rawContent);
    } catch {
      parsed = { reply: rawContent, transaction: null };
    }

    // Simpan transaksi ke Supabase jika ada
    let savedTransaction = null;
    if (parsed.transaction && parsed.transaction.amount > 0) {
      const tx = parsed.transaction;
      const { data: insertedTx } = await supabase
        .from('transactions')
        .insert({
          amount: Number(tx.amount),
          type: tx.type === 'income' ? 'income' : 'expense',
          category: tx.category || 'Lainnya',
          description: tx.description || message?.slice(0, 100) || '',
          platform: tx.platform || 'Chat AI',
          transaction_date: new Date().toISOString(),
          source: 'chat',
          is_verified: true,
          ai_confidence: 0.85,
        })
        .select()
        .single();
      savedTransaction = insertedTx;
    }

    // Simpan balasan AI ke DB
    await supabase.from('chat_messages').insert({
      role: 'assistant',
      content: parsed.reply,
      transaction_id: savedTransaction?.id || null,
      created_at: new Date().toISOString(),
    });

    return NextResponse.json({
      reply: parsed.reply,
      transaction: savedTransaction,
    });

  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Internal error';
    console.error('Chat API error:', msg);

    // Simpan error message ke chat
    try {
      await supabase.from('chat_messages').insert({
        role: 'assistant',
        content: '❌ Maaf, terjadi error. Pastikan API key AI sudah dikonfigurasi di Settings.',
        created_at: new Date().toISOString(),
      });
    } catch { /* ignore */ }

    return NextResponse.json({ error: msg, reply: '❌ Maaf, terjadi error. Pastikan API key AI sudah dikonfigurasi di Settings.' }, { status: 500 });
  }
}
