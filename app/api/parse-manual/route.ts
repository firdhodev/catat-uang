import { NextRequest, NextResponse } from 'next/server';
import { parseManualInputWithAI } from '@/lib/ai';

export const dynamic = 'force-dynamic';

// POST /api/parse-manual - parse teks/gambar dengan AI
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { text, imageBase64, imageMimeType } = body;

    if (!text && !imageBase64) {
      return NextResponse.json({ error: 'Teks atau gambar diperlukan' }, { status: 400 });
    }

    const result = await parseManualInputWithAI(
      text || '',
      imageBase64 || undefined,
      imageMimeType || undefined
    );

    if (!result) {
      return NextResponse.json(
        { error: 'AI gagal memparse input. Coba dengan deskripsi yang lebih lengkap.' },
        { status: 422 }
      );
    }

    return NextResponse.json({ data: result });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Internal error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
