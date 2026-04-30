'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

const CATEGORIES_EXPENSE = [
  'Makanan & Minuman', 'Transport', 'Belanja', 'Tagihan & Utilitas',
  'Kesehatan', 'Hiburan', 'Pendidikan', 'Investasi', 'Transfer Keluar', 'Lainnya'
];
const CATEGORIES_INCOME = [
  'Gaji', 'Freelance', 'Transfer Masuk', 'Cashback & Reward', 'Pemasukan Lainnya'
];

function formatRupiah(amount: number) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency', currency: 'IDR',
    minimumFractionDigits: 0, maximumFractionDigits: 0,
  }).format(amount);
}

interface AIResult {
  amount: number;
  type: 'income' | 'expense';
  category: string;
  description: string;
  platform: string;
  confidence: number;
  notes: string;
}

export default function ManualInputPage() {
  const [type, setType] = useState<'expense' | 'income'>('expense');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('Makanan & Minuman');
  const [description, setDescription] = useState('');
  const [platform, setPlatform] = useState('');
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 16));
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: string } | null>(null);
  const [platforms, setPlatforms] = useState<{ name: string }[]>([]);

  // AI state
  const [aiText, setAiText] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResult, setAiResult] = useState<AIResult | null>(null);
  const [aiApplied, setAiApplied] = useState(false);

  // Receipt upload state
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [receiptPreview, setReceiptPreview] = useState<string | null>(null);
  const [receiptUrl, setReceiptUrl] = useState<string | null>(null);
  const [uploadLoading, setUploadLoading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const showToast = (msg: string, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  useEffect(() => {
    fetch('/api/platforms')
      .then(r => r.json())
      .then(d => setPlatforms(d.data || []))
      .catch(() => {});
  }, []);

  const categories = type === 'income' ? CATEGORIES_INCOME : CATEGORIES_EXPENSE;

  const handleTypeChange = (newType: 'expense' | 'income') => {
    setType(newType);
    setCategory(newType === 'income' ? CATEGORIES_INCOME[0] : CATEGORIES_EXPENSE[0]);
  };

  // ── AI Parse ──────────────────────────────────────────────
  const handleAIParse = async (overrideImageBase64?: string, overrideMime?: string) => {
    if (!aiText.trim() && !overrideImageBase64) {
      showToast('❌ Masukkan deskripsi transaksi terlebih dahulu', 'error');
      return;
    }
    setAiLoading(true);
    setAiResult(null);
    setAiApplied(false);
    try {
      const body: Record<string, string> = { text: aiText };
      if (overrideImageBase64) {
        body.imageBase64 = overrideImageBase64;
        body.imageMimeType = overrideMime || 'image/jpeg';
      }
      const res = await fetch('/api/parse-manual', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal parse');
      setAiResult(data.data);
    } catch (e) {
      showToast(`❌ ${(e as Error).message}`, 'error');
    } finally {
      setAiLoading(false);
    }
  };

  const applyAIResult = () => {
    if (!aiResult) return;
    setType(aiResult.type);
    setAmount(aiResult.amount.toString());
    setCategory(aiResult.category);
    setDescription(aiResult.description);
    if (aiResult.platform) setPlatform(aiResult.platform);
    setAiApplied(true);
    showToast('✅ Hasil AI diterapkan ke form!');
  };

  // ── Receipt Upload ─────────────────────────────────────────
  const handleFileSelect = useCallback(async (file: File) => {
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'application/pdf'];
    if (!allowedTypes.includes(file.type)) {
      showToast('❌ Format tidak didukung. Gunakan JPG, PNG, WebP, atau PDF', 'error');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      showToast('❌ Ukuran file maksimal 5MB', 'error');
      return;
    }

    setReceiptFile(file);
    setReceiptUrl(null);

    // Preview untuk gambar
    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (e) => setReceiptPreview(e.target?.result as string);
      reader.readAsDataURL(file);
    } else {
      setReceiptPreview(null);
    }

    // Otomatis upload
    await uploadReceipt(file);
  }, []); // eslint-disable-line

  const uploadReceipt = async (file: File) => {
    setUploadLoading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch('/api/upload-receipt', { method: 'POST', body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Upload gagal');
      setReceiptUrl(data.url);
      showToast('📎 Bukti berhasil diupload!');

      // Auto-parse dengan AI jika gambar
      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = async (e) => {
          const base64 = (e.target?.result as string).split(',')[1];
          showToast('🤖 Membaca nota dengan AI...', 'success');
          await handleAIParse(base64, file.type);
        };
        reader.readAsDataURL(file);
      }
    } catch (e) {
      showToast(`❌ ${(e as Error).message}`, 'error');
    } finally {
      setUploadLoading(false);
    }
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFileSelect(file);
  }, [handleFileSelect]);

  const removeReceipt = () => {
    setReceiptFile(null);
    setReceiptPreview(null);
    setReceiptUrl(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // ── Submit Form ────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || parseFloat(amount) <= 0) {
      showToast('❌ Masukkan nominal yang valid', 'error');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: parseFloat(amount),
          type,
          category,
          description,
          platform,
          notes,
          receipt_url: receiptUrl || null,
          ai_confidence: aiResult && aiApplied ? aiResult.confidence : null,
          transaction_date: new Date(date).toISOString(),
        }),
      });

      if (!res.ok) throw new Error('Gagal menyimpan');
      showToast('✅ Transaksi berhasil disimpan!');

      // Reset
      setAmount('');
      setDescription('');
      setNotes('');
      setPlatform('');
      setDate(new Date().toISOString().slice(0, 16));
      setAiText('');
      setAiResult(null);
      setAiApplied(false);
      removeReceipt();
    } catch {
      showToast('❌ Gagal menyimpan transaksi', 'error');
    } finally {
      setLoading(false);
    }
  };

  const quickAmounts = [10000, 20000, 50000, 100000, 200000, 500000];

  const confidenceColor = (c: number) =>
    c >= 0.85 ? 'var(--income)' : c >= 0.6 ? 'var(--warning, #fbbf24)' : 'var(--expense)';

  return (
    <div className="page-container">
      {toast && (
        <div className="toast-container">
          <div className={`toast toast-${toast.type}`}>{toast.msg}</div>
        </div>
      )}

      <div className="page-header">
        <h1 className="page-title">✍️ Input Manual</h1>
        <p className="page-subtitle">Tambah transaksi dengan AI normalisasi otomatis</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: 24, alignItems: 'start' }}>
        {/* Kolom Kiri: AI + Form */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* ── AI Parser ── */}
          <div className="card">
            <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>🤖 AI Auto-Parse</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 16 }}>
              Ketik bebas atau upload nota/struk — AI akan otomatis mengisi form
            </div>

            <div className="form-group">
              <textarea
                className="form-input"
                rows={2}
                value={aiText}
                onChange={e => setAiText(e.target.value)}
                placeholder={'Contoh:\n"makan siang warteg 15rb gopay"\n"transfer ke adik 500ribu"'}
                style={{ resize: 'none', fontFamily: 'inherit' }}
                id="input-ai-text"
              />
            </div>

            <div style={{ display: 'flex', gap: 10, marginBottom: aiResult ? 16 : 0 }}>
              <button
                className="btn btn-primary"
                onClick={() => handleAIParse()}
                disabled={aiLoading || !aiText.trim()}
                style={{ flex: 1 }}
                id="btn-ai-parse"
              >
                {aiLoading
                  ? <><span className="spinner" style={{ width: 14, height: 14 }} /> Menganalisa...</>
                  : '🤖 Parse dengan AI'}
              </button>
            </div>

            {/* AI Result Preview */}
            {aiResult && (
              <div style={{
                background: 'var(--bg-primary)',
                border: `1px solid ${aiApplied ? 'var(--income)' : 'var(--accent)'}`,
                borderRadius: 'var(--radius-md)',
                padding: 16,
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                  <div style={{ fontWeight: 600, fontSize: 13 }}>Hasil Analisis AI</div>
                  <div style={{ fontSize: 12, color: confidenceColor(aiResult.confidence), fontWeight: 700 }}>
                    {Math.round(aiResult.confidence * 100)}% akurasi
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
                  <div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>NOMINAL</div>
                    <div style={{ fontWeight: 700, color: aiResult.type === 'income' ? 'var(--income)' : 'var(--expense)' }}>
                      {aiResult.type === 'income' ? '+' : '-'}{formatRupiah(aiResult.amount)}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>KATEGORI</div>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>{aiResult.category}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>DESKRIPSI</div>
                    <div style={{ fontSize: 13 }}>{aiResult.description}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>PLATFORM</div>
                    <div style={{ fontSize: 13 }}>{aiResult.platform || '-'}</div>
                  </div>
                </div>

                {aiResult.notes && (
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 12, fontStyle: 'italic' }}>
                    💭 {aiResult.notes}
                  </div>
                )}

                {!aiApplied ? (
                  <button className="btn btn-primary" onClick={applyAIResult} style={{ width: '100%', justifyContent: 'center' }}>
                    ✅ Terapkan ke Form
                  </button>
                ) : (
                  <div style={{ textAlign: 'center', color: 'var(--income)', fontSize: 13, fontWeight: 600 }}>
                    ✅ Sudah diterapkan — cek dan sesuaikan form di bawah
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ── Upload Nota/Struk ── */}
          <div className="card">
            <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>📎 Upload Bukti / Nota / Struk</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 14 }}>
              JPG, PNG, WebP, atau PDF — maks 5MB. AI akan otomatis membaca nominal dari foto struk.
            </div>

            {!receiptFile ? (
              <div
                onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                style={{
                  border: `2px dashed ${dragOver ? 'var(--accent)' : 'var(--border)'}`,
                  borderRadius: 'var(--radius-md)',
                  padding: '32px 20px',
                  textAlign: 'center',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  background: dragOver ? 'var(--accent-dim)' : 'transparent',
                }}
              >
                <div style={{ fontSize: 32, marginBottom: 8 }}>📸</div>
                <div style={{ fontSize: 13, color: 'var(--text-secondary)', fontWeight: 500 }}>
                  Drag & drop atau klik untuk pilih file
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                  JPG, PNG, WebP, PDF • Maks 5MB
                </div>
              </div>
            ) : (
              <div style={{
                border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: 12,
                display: 'flex', gap: 12, alignItems: 'center',
              }}>
                {receiptPreview ? (
                  <img src={receiptPreview} alt="Preview"
                    style={{ width: 64, height: 64, objectFit: 'cover', borderRadius: 6, flexShrink: 0 }} />
                ) : (
                  <div style={{ width: 64, height: 64, background: 'var(--bg-primary)', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, flexShrink: 0 }}>📄</div>
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {receiptFile.name}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                    {(receiptFile.size / 1024).toFixed(0)} KB
                  </div>
                  {uploadLoading && (
                    <div style={{ fontSize: 11, color: 'var(--accent-hover)', marginTop: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
                      <span className="spinner" style={{ width: 10, height: 10 }} /> Mengupload...
                    </div>
                  )}
                  {receiptUrl && !uploadLoading && (
                    <div style={{ fontSize: 11, color: 'var(--income)', marginTop: 4 }}>✅ Uploaded</div>
                  )}
                </div>
                <button onClick={removeReceipt} style={{
                  background: 'none', border: 'none', color: 'var(--expense)',
                  cursor: 'pointer', fontSize: 18, padding: 4, flexShrink: 0
                }}>×</button>
              </div>
            )}

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,.pdf"
              style={{ display: 'none' }}
              onChange={e => { const f = e.target.files?.[0]; if (f) handleFileSelect(f); }}
            />
          </div>

          {/* ── Form Transaksi ── */}
          <div className="card">
            <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 16 }}>
              📝 Detail Transaksi
              {aiApplied && <span style={{ fontSize: 11, color: 'var(--income)', marginLeft: 8, fontWeight: 400 }}>• Terisi AI</span>}
            </div>

            <form onSubmit={handleSubmit}>
              {/* Type Toggle */}
              <div className="form-group">
                <label className="form-label">Jenis Transaksi</label>
                <div className="type-toggle">
                  <button type="button" className={`type-btn expense ${type === 'expense' ? 'active' : ''}`}
                    onClick={() => handleTypeChange('expense')} id="btn-type-expense">
                    💸 Pengeluaran
                  </button>
                  <button type="button" className={`type-btn income ${type === 'income' ? 'active' : ''}`}
                    onClick={() => handleTypeChange('income')} id="btn-type-income">
                    💰 Pemasukan
                  </button>
                </div>
              </div>

              {/* Amount */}
              <div className="form-group">
                <label className="form-label">Nominal (Rp) *</label>
                <div style={{ position: 'relative' }}>
                  <span style={{
                    position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)',
                    color: 'var(--text-muted)', fontWeight: 600, fontSize: 14,
                  }}>Rp</span>
                  <input
                    id="input-amount" className="form-input" type="number"
                    value={amount} onChange={e => setAmount(e.target.value)}
                    placeholder="0" style={{ paddingLeft: 40 }} required
                  />
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 10 }}>
                  {quickAmounts.map(a => (
                    <button key={a} type="button" className="btn btn-secondary btn-sm"
                      onClick={() => setAmount(a.toString())} style={{ fontSize: 12 }}>
                      {formatRupiah(a)}
                    </button>
                  ))}
                </div>
                {amount && (
                  <div className="form-hint">= {formatRupiah(parseFloat(amount) || 0)}</div>
                )}
              </div>

              <div className="form-row">
                {/* Category */}
                <div className="form-group">
                  <label className="form-label">Kategori *</label>
                  <select id="select-category" className="form-select" value={category}
                    onChange={e => setCategory(e.target.value)}>
                    {categories.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>

                {/* Platform */}
                <div className="form-group">
                  <label className="form-label">Platform / Sumber</label>
                  <input id="input-platform" className="form-input" type="text"
                    value={platform} onChange={e => setPlatform(e.target.value)}
                    placeholder="BCA, GoPay, Cash..." list="platforms-list" />
                  <datalist id="platforms-list">
                    {platforms.map(p => <option key={p.name} value={p.name} />)}
                    <option value="Cash" />
                    <option value="Transfer" />
                  </datalist>
                </div>
              </div>

              {/* Description */}
              <div className="form-group">
                <label className="form-label">Deskripsi</label>
                <input id="input-description" className="form-input" type="text"
                  value={description} onChange={e => setDescription(e.target.value)}
                  placeholder="Contoh: Makan Siang di Warung Padang" />
              </div>

              {/* Notes */}
              <div className="form-group">
                <label className="form-label">Catatan (opsional)</label>
                <input className="form-input" type="text" value={notes}
                  onChange={e => setNotes(e.target.value)}
                  placeholder="Catatan tambahan..." />
              </div>

              {/* Date */}
              <div className="form-group">
                <label className="form-label">Tanggal & Waktu *</label>
                <input id="input-date" className="form-input" type="datetime-local"
                  value={date} onChange={e => setDate(e.target.value)} required />
              </div>

              {/* Receipt indicator */}
              {receiptUrl && (
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16,
                  padding: '8px 12px', background: 'var(--income-dim)', borderRadius: 8,
                  fontSize: 13, color: 'var(--income)',
                }}>
                  📎 Bukti transaksi terlampir
                  <a href={receiptUrl} target="_blank" rel="noopener"
                    style={{ color: 'var(--income)', marginLeft: 'auto', fontSize: 11 }}>
                    Lihat →
                  </a>
                </div>
              )}

              <button type="submit" className="btn btn-primary btn-lg" disabled={loading}
                id="btn-submit-manual" style={{ width: '100%', justifyContent: 'center' }}>
                {loading
                  ? <><span className="spinner" style={{ width: 16, height: 16 }} /> Menyimpan...</>
                  : `💾 Simpan ${type === 'income' ? 'Pemasukan' : 'Pengeluaran'}`}
              </button>
            </form>
          </div>
        </div>

        {/* Kolom Kanan: Hints */}
        <div>
          <div className="card" style={{ marginBottom: 16 }}>
            <div style={{ fontWeight: 700, marginBottom: 12, fontSize: 14 }}>💡 Contoh Input AI</div>
            <div style={{ fontSize: 12, lineHeight: 2, color: 'var(--text-secondary)' }}>
              <div style={{ marginBottom: 8 }}>
                <div style={{ color: 'var(--expense)', fontWeight: 600, fontSize: 11, marginBottom: 4 }}>PENGELUARAN:</div>
                {[
                  '"makan siang warteg 15rb"',
                  '"bayar listrik 150ribu"',
                  '"bensin 50k bca"',
                  '"transfer ke adik 500rb"',
                  '"shopee 1.2jt"',
                ].map(ex => (
                  <div key={ex} style={{
                    padding: '4px 10px', background: 'var(--bg-primary)', borderRadius: 6,
                    marginBottom: 4, cursor: 'pointer', fontSize: 11, fontFamily: 'monospace',
                  }}
                    onClick={() => setAiText(ex.replace(/"/g, ''))}
                  >{ex}</div>
                ))}
              </div>
              <div>
                <div style={{ color: 'var(--income)', fontWeight: 600, fontSize: 11, marginBottom: 4 }}>PEMASUKAN:</div>
                {[
                  '"gaji bulan april 5jt"',
                  '"terima transfer 2.5juta"',
                  '"cashback gopay 10rb"',
                ].map(ex => (
                  <div key={ex} style={{
                    padding: '4px 10px', background: 'var(--bg-primary)', borderRadius: 6,
                    marginBottom: 4, cursor: 'pointer', fontSize: 11, fontFamily: 'monospace',
                  }}
                    onClick={() => setAiText(ex.replace(/"/g, ''))}
                  >{ex}</div>
                ))}
              </div>
              <div style={{ marginTop: 8, fontSize: 11, color: 'var(--text-muted)', fontStyle: 'italic' }}>
                Klik contoh untuk mencoba →
              </div>
            </div>
          </div>

          <div className="card">
            <div style={{ fontWeight: 700, marginBottom: 12, fontSize: 14 }}>📁 Kategori</div>
            <div style={{ fontSize: 12, lineHeight: 1.9, color: 'var(--text-secondary)' }}>
              <div><strong style={{ color: 'var(--expense)' }}>Pengeluaran:</strong></div>
              <div>🍽️ Makanan & Minuman</div>
              <div>🚗 Transport</div>
              <div>🛍️ Belanja</div>
              <div>⚡ Tagihan & Utilitas</div>
              <div>🏥 Kesehatan</div>
              <div>🎮 Hiburan</div>
              <div style={{ marginTop: 8 }}><strong style={{ color: 'var(--income)' }}>Pemasukan:</strong></div>
              <div>💼 Gaji</div>
              <div>💻 Freelance</div>
              <div>↙️ Transfer Masuk</div>
              <div>🎁 Cashback & Reward</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
