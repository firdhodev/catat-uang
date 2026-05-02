'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

const DEFAULT_EXPENSE = ['Makanan & Minuman','Transport','Belanja','Tagihan & Utilitas','Kesehatan','Hiburan','Pendidikan','Investasi','Transfer Keluar','Lainnya'];
const DEFAULT_INCOME = ['Gaji','Freelance','Transfer Masuk','Cashback & Reward','Pemasukan Lainnya'];

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
  const [category, setCategory] = useState('');
  const [description, setDescription] = useState('');
  const [platform, setPlatform] = useState('');
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 16));
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: string } | null>(null);
  const [platforms, setPlatforms] = useState<{ name: string }[]>([]);
  const [categoriesExpense, setCategoriesExpense] = useState<string[]>(DEFAULT_EXPENSE);
  const [categoriesIncome, setCategoriesIncome] = useState<string[]>(DEFAULT_INCOME);

  const [aiText, setAiText] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResult, setAiResult] = useState<AIResult | null>(null);
  const [aiApplied, setAiApplied] = useState(false);

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
    fetch('/api/platforms').then(r => r.json()).then(d => setPlatforms(d.data || [])).catch(() => {});
    fetch('/api/categories').then(r => r.json()).then(d => {
      if (d.expense) { setCategoriesExpense(d.expense); }
      if (d.income) { setCategoriesIncome(d.income); }
      // Set default category on first load
      setCategory(prev => prev || (d.expense?.[0] ?? DEFAULT_EXPENSE[0]));
    }).catch(() => { setCategory(prev => prev || DEFAULT_EXPENSE[0]); });
  }, []);

  const categories = type === 'income' ? categoriesIncome : categoriesExpense;

  const handleTypeChange = (newType: 'expense' | 'income') => {
    setType(newType);
    setCategory(newType === 'income' ? (categoriesIncome[0] ?? DEFAULT_INCOME[0]) : (categoriesExpense[0] ?? DEFAULT_EXPENSE[0]));
  };

  const handleAIParse = async (overrideImageBase64?: string, overrideMime?: string) => {
    if (!aiText.trim() && !overrideImageBase64) {
      showToast('❌ Masukkan deskripsi transaksi terlebih dahulu', 'error');
      return;
    }
    setAiLoading(true); setAiResult(null); setAiApplied(false);
    try {
      const body: Record<string, string> = { text: aiText };
      if (overrideImageBase64) { body.imageBase64 = overrideImageBase64; body.imageMimeType = overrideMime || 'image/jpeg'; }
      const res = await fetch('/api/parse-manual', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal parse');
      setAiResult(data.data);
    } catch (e) { showToast(`❌ ${(e as Error).message}`, 'error'); }
    finally { setAiLoading(false); }
  };

  const applyAIResult = () => {
    if (!aiResult) return;
    setType(aiResult.type); setAmount(aiResult.amount.toString());
    setCategory(aiResult.category); setDescription(aiResult.description);
    if (aiResult.platform) setPlatform(aiResult.platform);
    setAiApplied(true); showToast('✅ Hasil AI diterapkan ke form!');
  };

  const handleFileSelect = useCallback(async (file: File) => {
    const allowed = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'application/pdf'];
    if (!allowed.includes(file.type)) { showToast('❌ Format tidak didukung. Gunakan JPG, PNG, WebP, atau PDF', 'error'); return; }
    if (file.size > 5 * 1024 * 1024) { showToast('❌ Ukuran file maksimal 5MB', 'error'); return; }
    setReceiptFile(file); setReceiptUrl(null);
    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (e) => setReceiptPreview(e.target?.result as string);
      reader.readAsDataURL(file);
    } else { setReceiptPreview(null); }
    setUploadLoading(true);
    try {
      const formData = new FormData(); formData.append('file', file);
      const res = await fetch('/api/upload-receipt', { method: 'POST', body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Upload gagal');
      setReceiptUrl(data.url); showToast('📎 Bukti berhasil diupload!');
      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = async (e) => {
          const base64 = (e.target?.result as string).split(',')[1];
          showToast('🤖 Membaca nota dengan AI...', 'success');
          await handleAIParse(base64, file.type);
        };
        reader.readAsDataURL(file);
      }
    } catch (e) { showToast(`❌ ${(e as Error).message}`, 'error'); }
    finally { setUploadLoading(false); }
  }, []); // eslint-disable-line

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFileSelect(file);
  }, [handleFileSelect]);

  const removeReceipt = () => {
    setReceiptFile(null); setReceiptPreview(null); setReceiptUrl(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || parseFloat(amount) <= 0) { showToast('❌ Masukkan nominal yang valid', 'error'); return; }
    setLoading(true);
    try {
      const res = await fetch('/api/transactions', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: parseFloat(amount), type, category, description, platform, notes,
          receipt_url: receiptUrl || null,
          ai_confidence: aiResult && aiApplied ? aiResult.confidence : null,
          transaction_date: new Date(date).toISOString(),
        }),
      });
      if (!res.ok) throw new Error('Gagal menyimpan');
      showToast('✅ Transaksi berhasil disimpan!');
      setAmount(''); setDescription(''); setNotes(''); setPlatform('');
      setDate(new Date().toISOString().slice(0, 16));
      setAiText(''); setAiResult(null); setAiApplied(false); removeReceipt();
    } catch { showToast('❌ Gagal menyimpan transaksi', 'error'); }
    finally { setLoading(false); }
  };

  const quickAmounts = [10000, 20000, 50000, 100000, 200000, 500000];
  const confidenceColor = (c: number) => c >= 0.85 ? '#007A33' : c >= 0.6 ? '#AA8800' : '#FF3B3B';

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

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 340px', gap: 24, alignItems: 'start' }}>
        {/* Left Column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* AI Parser */}
          <div className="card">
            <div style={{ fontWeight: 800, fontSize: 15, marginBottom: 4, textTransform: 'uppercase', letterSpacing: '-0.3px' }}>🤖 AI Auto-Parse</div>
            <div style={{ fontSize: 12, color: '#666', marginBottom: 16, fontWeight: 600 }}>
              Ketik bebas atau upload nota/struk — AI akan otomatis mengisi form
            </div>

            <div className="form-group">
              <textarea className="form-input" rows={2} value={aiText}
                onChange={e => setAiText(e.target.value)}
                placeholder={'Contoh:\n"makan siang warteg 15rb gopay"\n"transfer ke adik 500ribu"'}
                style={{ resize: 'none', fontFamily: 'inherit' }}
                id="input-ai-text"
              />
            </div>

            <div style={{ display: 'flex', gap: 10, marginBottom: aiResult ? 16 : 0 }}>
              <button className="btn btn-primary" onClick={() => handleAIParse()}
                disabled={aiLoading || !aiText.trim()} style={{ flex: 1, justifyContent: 'center' }}
                id="btn-ai-parse">
                {aiLoading ? <><span className="spinner" style={{ width: 14, height: 14 }} /> Menganalisa...</> : '🤖 Parse dengan AI'}
              </button>
            </div>

            {aiResult && (
              <div style={{
                background: '#FAFAFA',
                border: `2px solid ${aiApplied ? '#00C853' : '#0D0D0D'}`,
                borderRadius: 4,
                padding: 16,
                boxShadow: `3px 3px 0px ${aiApplied ? '#00C853' : '#0D0D0D'}`,
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                  <div style={{ fontWeight: 800, fontSize: 13, textTransform: 'uppercase' }}>Hasil Analisis AI</div>
                  <div style={{ fontSize: 12, color: confidenceColor(aiResult.confidence), fontWeight: 800 }}>
                    {Math.round(aiResult.confidence * 100)}% akurasi
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
                  <div>
                    <div style={{ fontSize: 10, color: '#999', fontWeight: 800, textTransform: 'uppercase' }}>NOMINAL</div>
                    <div style={{ fontWeight: 800, color: aiResult.type === 'income' ? '#007A33' : '#FF3B3B' }}>
                      {aiResult.type === 'income' ? '+' : '-'}{formatRupiah(aiResult.amount)}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: 10, color: '#999', fontWeight: 800, textTransform: 'uppercase' }}>KATEGORI</div>
                    <div style={{ fontWeight: 700, fontSize: 13 }}>{aiResult.category}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 10, color: '#999', fontWeight: 800, textTransform: 'uppercase' }}>DESKRIPSI</div>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{aiResult.description}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 10, color: '#999', fontWeight: 800, textTransform: 'uppercase' }}>PLATFORM</div>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{aiResult.platform || '-'}</div>
                  </div>
                </div>

                {aiResult.notes && (
                  <div style={{ fontSize: 11, color: '#666', marginBottom: 12, fontStyle: 'italic', fontWeight: 600 }}>
                    💭 {aiResult.notes}
                  </div>
                )}

                {!aiApplied ? (
                  <button className="btn btn-primary" onClick={applyAIResult} style={{ width: '100%', justifyContent: 'center' }}>
                    ✅ Terapkan ke Form
                  </button>
                ) : (
                  <div style={{ textAlign: 'center', color: '#007A33', fontSize: 13, fontWeight: 800 }}>
                    ✅ Sudah diterapkan — cek dan sesuaikan form di bawah
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Upload Receipt */}
          <div className="card">
            <div style={{ fontWeight: 800, fontSize: 15, marginBottom: 4, textTransform: 'uppercase', letterSpacing: '-0.3px' }}>📎 Upload Bukti / Nota / Struk</div>
            <div style={{ fontSize: 12, color: '#666', marginBottom: 14, fontWeight: 600 }}>
              JPG, PNG, WebP, atau PDF — maks 5MB. AI akan otomatis membaca nominal dari foto struk.
            </div>

            {!receiptFile ? (
              <div
                onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                style={{
                  border: `2px dashed ${dragOver ? '#0066FF' : '#0D0D0D'}`,
                  borderRadius: 4,
                  padding: '32px 20px',
                  textAlign: 'center',
                  cursor: 'pointer',
                  background: dragOver ? '#F0F5FF' : 'transparent',
                  transition: 'all 0.15s',
                }}
              >
                <div style={{ fontSize: 36, marginBottom: 8 }}>📸</div>
                <div style={{ fontSize: 13, color: '#555', fontWeight: 700 }}>Drag & drop atau klik untuk pilih file</div>
                <div style={{ fontSize: 11, color: '#999', marginTop: 4, fontWeight: 600 }}>JPG, PNG, WebP, PDF • Maks 5MB</div>
              </div>
            ) : (
              <div style={{ border: '2px solid #0D0D0D', borderRadius: 4, padding: 12, display: 'flex', gap: 12, alignItems: 'center', boxShadow: '2px 2px 0px #0D0D0D' }}>
                {receiptPreview ? (
                  <img src={receiptPreview} alt="Preview" style={{ width: 64, height: 64, objectFit: 'cover', borderRadius: 4, flexShrink: 0, border: '2px solid #0D0D0D' }} />
                ) : (
                  <div style={{ width: 64, height: 64, background: '#f0f0f0', borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, flexShrink: 0, border: '2px solid #0D0D0D' }}>📄</div>
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{receiptFile.name}</div>
                  <div style={{ fontSize: 11, color: '#666', marginTop: 2, fontWeight: 600 }}>{(receiptFile.size / 1024).toFixed(0)} KB</div>
                  {uploadLoading && <div style={{ fontSize: 11, color: '#0066FF', marginTop: 4, display: 'flex', alignItems: 'center', gap: 4, fontWeight: 700 }}><span className="spinner" style={{ width: 10, height: 10 }} /> Mengupload...</div>}
                  {receiptUrl && !uploadLoading && <div style={{ fontSize: 11, color: '#007A33', marginTop: 4, fontWeight: 800 }}>✅ Uploaded</div>}
                </div>
                <button onClick={removeReceipt} style={{ background: 'none', border: 'none', color: '#FF3B3B', cursor: 'pointer', fontSize: 20, padding: 4, flexShrink: 0, fontWeight: 800 }}>×</button>
              </div>
            )}

            <input ref={fileInputRef} type="file" accept="image/*,.pdf" style={{ display: 'none' }}
              onChange={e => { const f = e.target.files?.[0]; if (f) handleFileSelect(f); }} />
          </div>

          {/* Form */}
          <div className="card">
            <div style={{ fontWeight: 800, fontSize: 15, marginBottom: 16, textTransform: 'uppercase', letterSpacing: '-0.3px' }}>
              📝 Detail Transaksi
              {aiApplied && <span style={{ fontSize: 11, color: '#007A33', marginLeft: 8, fontWeight: 700, textTransform: 'none' }}>• Terisi AI</span>}
            </div>

            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label className="form-label">Jenis Transaksi</label>
                <div className="type-toggle">
                  <button type="button" className={`type-btn expense ${type === 'expense' ? 'active' : ''}`}
                    onClick={() => handleTypeChange('expense')} id="btn-type-expense">💸 Pengeluaran</button>
                  <button type="button" className={`type-btn income ${type === 'income' ? 'active' : ''}`}
                    onClick={() => handleTypeChange('income')} id="btn-type-income">💰 Pemasukan</button>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Nominal (Rp) *</label>
                <div style={{ position: 'relative' }}>
                  <span style={{ position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)', color: '#666', fontWeight: 800, fontSize: 14 }}>Rp</span>
                  <input id="input-amount" className="form-input" type="number"
                    value={amount} onChange={e => setAmount(e.target.value)}
                    placeholder="0" style={{ paddingLeft: 40 }} required />
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 10 }}>
                  {quickAmounts.map(a => (
                    <button key={a} type="button" className="btn btn-secondary btn-sm"
                      onClick={() => setAmount(a.toString())} style={{ fontSize: 12 }}>
                      {formatRupiah(a)}
                    </button>
                  ))}
                </div>
                {amount && <div className="form-hint">= {formatRupiah(parseFloat(amount) || 0)}</div>}
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Kategori *</label>
                  <select id="select-category" className="form-select" value={category} onChange={e => setCategory(e.target.value)}>
                    {categories.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Platform / Sumber</label>
                  <input id="input-platform" className="form-input" type="text"
                    value={platform} onChange={e => setPlatform(e.target.value)}
                    placeholder="BCA, GoPay, Cash..." list="platforms-list" />
                  <datalist id="platforms-list">
                    {platforms.map(p => <option key={p.name} value={p.name} />)}
                    <option value="Cash" /><option value="Transfer" />
                  </datalist>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Deskripsi</label>
                <input id="input-description" className="form-input" type="text"
                  value={description} onChange={e => setDescription(e.target.value)}
                  placeholder="Contoh: Makan Siang di Warung Padang" />
              </div>

              <div className="form-group">
                <label className="form-label">Catatan (opsional)</label>
                <input className="form-input" type="text" value={notes}
                  onChange={e => setNotes(e.target.value)} placeholder="Catatan tambahan..." />
              </div>

              <div className="form-group">
                <label className="form-label">Tanggal & Waktu *</label>
                <input id="input-date" className="form-input" type="datetime-local"
                  value={date} onChange={e => setDate(e.target.value)} required />
              </div>

              {receiptUrl && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, padding: '10px 14px', background: '#E6FFF0', border: '2px solid #00C853', borderRadius: 4, fontSize: 13, color: '#007A33', fontWeight: 700 }}>
                  📎 Bukti transaksi terlampir
                  <a href={receiptUrl} target="_blank" rel="noopener" style={{ color: '#007A33', marginLeft: 'auto', fontSize: 11, fontWeight: 800 }}>Lihat →</a>
                </div>
              )}

              <button type="submit" className="btn btn-primary btn-lg" disabled={loading}
                id="btn-submit-manual" style={{ width: '100%', justifyContent: 'center' }}>
                {loading ? <><span className="spinner" style={{ width: 16, height: 16 }} /> Menyimpan...</> : `💾 Simpan ${type === 'income' ? 'Pemasukan' : 'Pengeluaran'}`}
              </button>
            </form>
          </div>
        </div>

        {/* Right Column */}
        <div>
          <div className="card" style={{ marginBottom: 16 }}>
            <div style={{ fontWeight: 800, marginBottom: 12, fontSize: 14, textTransform: 'uppercase' }}>💡 Contoh Input AI</div>
            <div style={{ fontSize: 12, lineHeight: 1.9, color: '#555' }}>
              <div style={{ marginBottom: 8 }}>
                <div style={{ color: '#FF3B3B', fontWeight: 800, fontSize: 10, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '1px' }}>PENGELUARAN:</div>
                {['"makan siang warteg 15rb"', '"bayar listrik 150ribu"', '"bensin 50k bca"', '"shopee 1.2jt"'].map(ex => (
                  <div key={ex} style={{ padding: '5px 10px', background: '#f5f5f5', borderRadius: 4, marginBottom: 4, cursor: 'pointer', fontSize: 11, fontFamily: 'monospace', fontWeight: 700, border: '1.5px solid #e5e5e5', transition: 'all 0.15s' }}
                    onClick={() => setAiText(ex.replace(/"/g, ''))}>{ex}</div>
                ))}
              </div>
              <div>
                <div style={{ color: '#007A33', fontWeight: 800, fontSize: 10, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '1px' }}>PEMASUKAN:</div>
                {['"gaji bulan april 5jt"', '"terima transfer 2.5juta"', '"cashback gopay 10rb"'].map(ex => (
                  <div key={ex} style={{ padding: '5px 10px', background: '#f5f5f5', borderRadius: 4, marginBottom: 4, cursor: 'pointer', fontSize: 11, fontFamily: 'monospace', fontWeight: 700, border: '1.5px solid #e5e5e5', transition: 'all 0.15s' }}
                    onClick={() => setAiText(ex.replace(/"/g, ''))}>{ex}</div>
                ))}
              </div>
              <div style={{ marginTop: 8, fontSize: 11, color: '#999', fontStyle: 'italic', fontWeight: 600 }}>Klik contoh untuk mencoba →</div>
            </div>
          </div>

          <div className="card">
            <div style={{ fontWeight: 800, marginBottom: 12, fontSize: 14, textTransform: 'uppercase' }}>📁 Kategori</div>
            <div style={{ fontSize: 12, lineHeight: 2, color: '#555', fontWeight: 600 }}>
              <div><strong style={{ color: '#FF3B3B' }}>Pengeluaran:</strong></div>
              {categoriesExpense.map(cat => <div key={cat}>• {cat}</div>)}
              <div style={{ marginTop: 8 }}><strong style={{ color: '#007A33' }}>Pemasukan:</strong></div>
              {categoriesIncome.map(cat => <div key={cat}>• {cat}</div>)}
              <div style={{ marginTop: 8, fontSize: 11, color: '#999', fontStyle: 'italic' }}>
                Atur kategori di <a href="/settings" style={{ color: '#0066FF', fontWeight: 800, textDecoration: 'underline' }}>Pengaturan → Kategori</a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
