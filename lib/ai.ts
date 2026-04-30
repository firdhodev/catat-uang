import { supabase } from './supabase';

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

async function callAI(
  config: AIConfig,
  messages: { role: string; content: string | { type: string; text?: string; image_url?: { url: string } }[] }[]
): Promise<string> {
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
      messages,
      temperature: 0.1,
      max_tokens: 600,
    }),
    signal: AbortSignal.timeout(30000),
  });

  if (!response.ok) throw new Error(`AI API error: ${response.status}`);
  const data = await response.json();
  return data.choices?.[0]?.message?.content || '';
}

function extractJSON(content: string) {
  const jsonMatch = content.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('No JSON found in AI response');
  return JSON.parse(jsonMatch[0]);
}

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

    const content = await callAI(config, [
      { role: 'system', content: 'Kamu adalah asisten parsing transaksi keuangan. Selalu response dengan JSON valid saja.' },
      { role: 'user', content: prompt }
    ]);

    const parsed = extractJSON(content);
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

// ============================================================
// PARSE INPUT MANUAL (teks bebas + opsional gambar nota)
// ============================================================
const MANUAL_PARSE_PROMPT = `Kamu adalah asisten keuangan personal Indonesia.
Parse input teks transaksi keuangan dan kembalikan HANYA JSON valid.

ATURAN PARSING NOMINAL:
- "rb", "ribu", "rbu" = × 1.000 (contoh: "15rb" = 15000, "15ribu" = 15000)
- "jt", "juta" = × 1.000.000 (contoh: "1.5jt" = 1500000, "2juta" = 2000000)
- "k" setelah angka = × 1.000 (contoh: "15k" = 15000)
- "Rp", "rp" diikuti angka → parse nominal tersebut
- Format 15.000 atau 15,000 → 15000

ATURAN TIPE:
- "expense": makan, beli, bayar, transfer keluar, kirim, belanja, bensin, parkir, dll
- "income": terima, gaji, masuk, dapat, cashback, refund, dll

KATEGORI (pilih satu):
Makanan & Minuman, Transport, Belanja, Tagihan & Utilitas, Kesehatan, Hiburan, Pendidikan, Investasi, Transfer Keluar, Gaji, Freelance, Transfer Masuk, Cashback & Reward, Lainnya

NORMALISASI DESKRIPSI:
- Huruf kapital di awal setiap kata penting
- Hilangkan singkatan tidak baku (ganti "warung" bukan "wrng", "makan" bukan "mkn")
- Gunakan Bahasa Indonesia yang baik dan baku
- Maksimal 60 karakter

FORMAT RESPONSE (hanya JSON):
{
  "amount": 25000,
  "type": "expense",
  "category": "Makanan & Minuman",
  "description": "Makan Siang di Warung Padang",
  "platform": "GoPay",
  "confidence": 0.92,
  "notes": "Alasan singkat parsing"
}`;

export async function parseManualInputWithAI(
  text: string,
  imageBase64?: string,
  imageMimeType?: string
): Promise<{
  amount: number;
  type: 'income' | 'expense';
  category: string;
  description: string;
  platform: string;
  confidence: number;
  notes: string;
} | null> {
  try {
    const config = await getAIConfig();

    type MessageContent = string | { type: string; text?: string; image_url?: { url: string } }[];
    type Message = { role: string; content: MessageContent };
    const messages: Message[] = [
      { role: 'system', content: MANUAL_PARSE_PROMPT },
    ];

    if (imageBase64) {
      // Mode vision — kirim gambar + teks
      messages.push({
        role: 'user',
        content: [
          {
            type: 'text',
            text: `Parse transaksi keuangan ini:\n"${text || 'Lihat detail di gambar nota/struk berikut'}"\n\nEkstrak nominal, tipe, kategori, dan deskripsi dari gambar struk/nota ini:`,
          },
          {
            type: 'image_url',
            image_url: { url: `data:${imageMimeType || 'image/jpeg'};base64,${imageBase64}` },
          },
        ],
      });
    } else {
      messages.push({
        role: 'user',
        content: `Parse transaksi keuangan ini:\n"${text}"`,
      });
    }

    const content = await callAI(config, messages);
    const parsed = extractJSON(content);

    if (!parsed.amount || !parsed.type) {
      throw new Error('AI gagal mengekstrak data transaksi');
    }

    return {
      amount: Number(parsed.amount),
      type: (parsed.type === 'income' ? 'income' : 'expense') as 'income' | 'expense',
      category: parsed.category || 'Lainnya',
      description: parsed.description || text.slice(0, 60),
      platform: parsed.platform || '',
      confidence: Math.min(1, Math.max(0, Number(parsed.confidence) || 0.7)),
      notes: parsed.notes || '',
    };
  } catch (err) {
    console.error('Manual AI parsing error:', err);
    return null;
  }
}

