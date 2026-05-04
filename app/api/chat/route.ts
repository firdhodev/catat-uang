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

    const SYSTEM_PROMPT = `Kamu adalah asisten keuangan pribadi bernama "CuanBot".
Kamu WAJIB selalu merespons dalam format JSON murni. JANGAN gunakan markdown, code block, atau teks lain di luar JSON.

KONTEKS KEUANGAN BULAN INI (${thisMonth}):
- Pemasukan: ${formatRp(totalIncome)}
- Pengeluaran: ${formatRp(totalExpense)}
- Saldo bersih: ${formatRp(balance)}

ATURAN NOMINAL:
- "rb", "ribu", "k" = × 1.000 (contoh: 15rb = 15000, 3jt 900rb = 3900000)
- "jt", "juta" = × 1.000.000 (contoh: 1.5jt = 1500000)

KATEGORI PENGELUARAN: ${categories.expense.join(', ')}
KATEGORI PEMASUKAN: ${categories.income.join(', ')}

WAJIB RETURN JSON SEPERTI INI (TIDAK BOLEH ADA TEKS LAIN):
{"reply":"Pesan ramah ke user pakai emoji","transaction":{"amount":35000,"type":"expense","category":"Makanan & Minuman","description":"Makan Siang","platform":""}}

JIKA TIDAK ADA TRANSAKSI:
{"reply":"Pesan ramah ke user","transaction":null}

ATURAN PENTING:
- type HARUS "income" atau "expense" (tidak boleh lain)
- amount HARUS angka murni tanpa titik/koma (contoh: 3900000 bukan 3.900.000)
- JANGAN gunakan markdown \`\`\`json atau \`\`\` apapun
- Output HARUS dimulai dengan { dan diakhiri dengan }
- reply gunakan Bahasa Indonesia santai dan ramah`;

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
        temperature: 0.1,
        max_tokens: 800,
        response_format: { type: 'json_object' }, // paksa AI return JSON murni
      }),
      signal: AbortSignal.timeout(30000),
    });

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      throw new Error(`AI API error: ${aiResponse.status} — ${errText}`);
    }

    const aiData = await aiResponse.json();
    const rawContent = aiData.choices?.[0]?.message?.content || '{"reply":"Maaf, AI tidak merespons.","transaction":null}';

    console.log('[Chat API] Raw AI content:', rawContent.slice(0, 300));

    // ===== ROBUST JSON PARSING =====
    let parsed: { reply: string; transaction: null | { amount: number; type: string; category: string; description: string; platform: string } };
    
    function extractAndParseJSON(text: string) {
      // 1. Bersihkan markdown code block (```json ... ```)
      let cleaned = text
        .replace(/^```json\s*/i, '')
        .replace(/^```\s*/i, '')
        .replace(/\s*```$/i, '')
        .trim();

      // 2. Cari JSON object: dari { pertama hingga } terakhir
      const firstBrace = cleaned.indexOf('{');
      const lastBrace = cleaned.lastIndexOf('}');
      
      if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
        const jsonStr = cleaned.slice(firstBrace, lastBrace + 1);
        return JSON.parse(jsonStr);
      }
      
      // 3. Coba parse langsung
      return JSON.parse(cleaned);
    }

    try {
      parsed = extractAndParseJSON(rawContent);
      // Validasi field wajib ada
      if (typeof parsed.reply !== 'string') {
        parsed.reply = rawContent;
      }
    } catch (parseErr) {
      console.error('[Chat API] JSON parse failed:', parseErr);
      // Fallback: tampilkan pesan ramah, bukan raw JSON
      parsed = { 
        reply: '🤔 Maaf, saya sedang mengalami masalah teknis. Coba kirim pesan lagi ya!', 
        transaction: null 
      };
    }

    // Pastikan reply tidak mengandung raw JSON
    if (parsed.reply && (parsed.reply.startsWith('{') || parsed.reply.includes('"transaction":'))) {
      try {
        const inner = extractAndParseJSON(parsed.reply);
        if (inner.reply) parsed.reply = inner.reply;
        if (inner.transaction && !parsed.transaction) parsed.transaction = inner.transaction;
      } catch { /* ignore */ }
    }

    // Simpan transaksi ke Supabase jika ada
    let savedTransaction = null;
    if (parsed.transaction && Number(parsed.transaction.amount) > 0) {
      const tx = parsed.transaction;
      const { data: insertedTx, error: txError } = await supabase
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

      if (txError) {
        console.error('[Chat API] Transaction save error:', txError.message);
      } else {
        savedTransaction = insertedTx;
        console.log('[Chat API] Transaction saved:', savedTransaction?.id, tx.type, tx.amount);
      }
    }

    // Simpan balasan AI ke DB (opsional, gagal pun tidak apa-apa)
    try {
      await supabase.from('chat_messages').insert({
        role: 'assistant',
        content: parsed.reply,
        transaction_id: savedTransaction?.id || null,
        created_at: new Date().toISOString(),
      });
    } catch { /* chat_messages table mungkin belum ada */ }

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
