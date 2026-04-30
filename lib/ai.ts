import { supabase } from './supabase';

interface AIConfig {
  baseUrl: string;
  apiKey: string;
  model: string;
}

async function getAIConfig(): Promise<AIConfig> {
  // Try to get config from Supabase settings first
  const { data } = await supabase
    .from('app_settings')
    .select('key, value')
    .in('key', ['ai_base_url', 'ai_api_key', 'ai_model']);

  const settings: Record<string, string> = {};
  if (data) {
    data.forEach((row) => { settings[row.key] = row.value; });
  }

  return {
    baseUrl: settings['ai_base_url'] || process.env.AI_BASE_URL || 'http://localhost:11434/v1',
    apiKey: settings['ai_api_key'] || process.env.AI_API_KEY || 'ollama',
    model: settings['ai_model'] || process.env.AI_MODEL || 'llama3.2:3b',
  };
}

const EMAIL_PARSE_PROMPT = `Kamu adalah asisten parsing transaksi keuangan Indonesia.
Analisa email notifikasi transaksi berikut dan ekstrak informasi dalam format JSON.

INSTRUKSI:
- Tentukan nominal transaksi (angka saja, tanpa titik/koma/Rp)
- Tentukan jenis: "income" (masuk/terima/kredit) atau "expense" (keluar/bayar/debit)
- Pilih kategori yang paling sesuai dari: Makanan & Minuman, Transport, Belanja, Tagihan & Utilitas, Kesehatan, Hiburan, Pendidikan, Investasi, Transfer Keluar, Transfer Masuk, Gaji, Freelance, Cashback & Reward, Lainnya
- Buat deskripsi singkat dalam Bahasa Indonesia
- Tentukan tanggal transaksi (format ISO 8601, gunakan tanggal hari ini jika tidak ada)
- Berikan confidence score 0.0-1.0

FORMAT RESPONSE (hanya JSON, tidak ada teks lain):
{
  "amount": 150000,
  "type": "expense",
  "category": "Makanan & Minuman",
  "description": "Pembayaran di restoran via GoPay",
  "transaction_date": "2024-01-15T12:30:00+07:00",
  "confidence": 0.95
}

EMAIL UNTUK DIPARSE:
`;

export async function parseEmailWithAI(emailBody: string, subject?: string): Promise<{
  amount: number;
  type: 'income' | 'expense';
  category: string;
  description: string;
  transaction_date: string;
  confidence: number;
} | null> {
  try {
    const config = await getAIConfig();

    const prompt = EMAIL_PARSE_PROMPT +
      (subject ? `Subject: ${subject}\n\n` : '') +
      emailBody;

    const response = await fetch(`${config.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://catat-uang.vercel.app',
        'X-Title': 'Smart Money Tracker',
      },
      body: JSON.stringify({
        model: config.model,
        messages: [
          {
            role: 'system',
            content: 'Kamu adalah asisten parsing transaksi keuangan. Selalu response dengan JSON valid saja.'
          },
          { role: 'user', content: prompt }
        ],
        temperature: 0.1,
        max_tokens: 500,
      }),
      signal: AbortSignal.timeout(30000), // 30 second timeout
    });

    if (!response.ok) {
      throw new Error(`AI API error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '';

    // Extract JSON from response (handle if AI adds extra text)
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('No JSON found in AI response');

    const parsed = JSON.parse(jsonMatch[0]);

    // Validate required fields
    if (!parsed.amount || !parsed.type || !parsed.category) {
      throw new Error('Missing required fields in AI response');
    }

    return {
      amount: Number(parsed.amount),
      type: parsed.type as 'income' | 'expense',
      category: parsed.category || 'Lainnya',
      description: parsed.description || '',
      transaction_date: parsed.transaction_date || new Date().toISOString(),
      confidence: Math.min(1, Math.max(0, Number(parsed.confidence) || 0.5)),
    };
  } catch (err) {
    console.error('AI parsing error:', err);
    return null;
  }
}
