'use client';

import { useState, useEffect } from 'react';

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

export default function ManualInputPage() {
  const [type, setType] = useState<'expense' | 'income'>('expense');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('Makanan & Minuman');
  const [description, setDescription] = useState('');
  const [platform, setPlatform] = useState('');
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 16));
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: string } | null>(null);
  const [platforms, setPlatforms] = useState<{ name: string }[]>([]);
  const [recentInputs, setRecentInputs] = useState<{ amount: number; type: string; category: string; description: string; platform: string; transaction_date: string }[]>([]);

  const showToast = (msg: string, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  useEffect(() => {
    fetch('/api/platforms')
      .then(r => r.json())
      .then(d => setPlatforms(d.data || []))
      .catch(() => {});
    // Load recent from localStorage
    const saved = localStorage.getItem('recent-inputs');
    if (saved) setRecentInputs(JSON.parse(saved));
  }, []);

  const categories = type === 'income' ? CATEGORIES_INCOME : CATEGORIES_EXPENSE;

  const handleTypeChange = (newType: 'expense' | 'income') => {
    setType(newType);
    setCategory(newType === 'income' ? CATEGORIES_INCOME[0] : CATEGORIES_EXPENSE[0]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || parseFloat(amount) <= 0) {
      showToast('❌ Masukkan nominal yang valid', 'error');
      return;
    }

    setLoading(true);
    try {
      const payload = {
        amount: parseFloat(amount),
        type,
        category,
        description,
        platform,
        transaction_date: new Date(date).toISOString(),
      };

      const res = await fetch('/api/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error('Gagal menyimpan');

      showToast('✅ Transaksi berhasil disimpan!');

      // Save to recent
      const newRecent = [payload, ...recentInputs].slice(0, 5);
      setRecentInputs(newRecent);
      localStorage.setItem('recent-inputs', JSON.stringify(newRecent));

      // Reset form
      setAmount('');
      setDescription('');
      setDate(new Date().toISOString().slice(0, 16));
    } catch {
      showToast('❌ Gagal menyimpan transaksi', 'error');
    } finally {
      setLoading(false);
    }
  };

  const quickAmounts = [10000, 20000, 50000, 100000, 200000, 500000];

  return (
    <div className="page-container">
      {toast && (
        <div className="toast-container">
          <div className={`toast toast-${toast.type}`}>{toast.msg}</div>
        </div>
      )}

      <div className="page-header">
        <h1 className="page-title">✍️ Input Manual</h1>
        <p className="page-subtitle">Tambah transaksi yang tidak terdeteksi dari email</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: 24, alignItems: 'start' }}>
        {/* Form */}
        <div className="card">
          <form onSubmit={handleSubmit}>
            {/* Type Toggle */}
            <div className="form-group">
              <label className="form-label">Jenis Transaksi</label>
              <div className="type-toggle">
                <button
                  type="button"
                  className={`type-btn expense ${type === 'expense' ? 'active' : ''}`}
                  onClick={() => handleTypeChange('expense')}
                  id="btn-type-expense"
                >
                  💸 Pengeluaran
                </button>
                <button
                  type="button"
                  className={`type-btn income ${type === 'income' ? 'active' : ''}`}
                  onClick={() => handleTypeChange('income')}
                  id="btn-type-income"
                >
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
                  id="input-amount"
                  className="form-input"
                  type="number"
                  value={amount}
                  onChange={e => setAmount(e.target.value)}
                  placeholder="0"
                  style={{ paddingLeft: 40 }}
                  required
                />
              </div>
              {/* Quick amounts */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 10 }}>
                {quickAmounts.map(a => (
                  <button
                    key={a}
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => setAmount(a.toString())}
                    style={{ fontSize: 12 }}
                  >
                    {formatRupiah(a)}
                  </button>
                ))}
              </div>
              {amount && <div className="form-hint">
                = {formatRupiah(parseFloat(amount) || 0)}
              </div>}
            </div>

            <div className="form-row">
              {/* Category */}
              <div className="form-group">
                <label className="form-label">Kategori *</label>
                <select
                  id="select-category"
                  className="form-select"
                  value={category}
                  onChange={e => setCategory(e.target.value)}
                >
                  {categories.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>

              {/* Platform */}
              <div className="form-group">
                <label className="form-label">Platform / Sumber</label>
                <input
                  id="input-platform"
                  className="form-input"
                  type="text"
                  value={platform}
                  onChange={e => setPlatform(e.target.value)}
                  placeholder="BCA, GoPay, Cash..."
                  list="platforms-list"
                />
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
              <input
                id="input-description"
                className="form-input"
                type="text"
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="Contoh: Makan siang di warung padang"
              />
            </div>

            {/* Date */}
            <div className="form-group">
              <label className="form-label">Tanggal & Waktu *</label>
              <input
                id="input-date"
                className="form-input"
                type="datetime-local"
                value={date}
                onChange={e => setDate(e.target.value)}
                required
              />
            </div>

            <button
              type="submit"
              className="btn btn-primary btn-lg"
              disabled={loading}
              id="btn-submit-manual"
              style={{ width: '100%', justifyContent: 'center' }}
            >
              {loading ? (
                <><span className="spinner" style={{ width: 16, height: 16 }} /> Menyimpan...</>
              ) : (
                `💾 Simpan ${type === 'income' ? 'Pemasukan' : 'Pengeluaran'}`
              )}
            </button>
          </form>
        </div>

        {/* Right sidebar: hints */}
        <div>
          <div className="card" style={{ marginBottom: 16 }}>
            <div style={{ fontWeight: 700, marginBottom: 12, fontSize: 14 }}>💡 Contoh Kategori</div>
            <div style={{ fontSize: 13, lineHeight: 2, color: 'var(--text-secondary)' }}>
              <div><strong style={{ color: 'var(--expense)' }}>Pengeluaran:</strong></div>
              <div>🍽️ Makanan & Minuman</div>
              <div>🚗 Transport (ojol, parkir, bensin)</div>
              <div>🛍️ Belanja (groceries, online shop)</div>
              <div>⚡ Tagihan & Utilitas (listrik, air)</div>
              <div>🏥 Kesehatan (obat, dokter)</div>
              <div>🎮 Hiburan (streaming, game)</div>
              <div>📚 Pendidikan (kursus, buku)</div>
              <div style={{ marginTop: 8 }}><strong style={{ color: 'var(--income)' }}>Pemasukan:</strong></div>
              <div>💼 Gaji</div>
              <div>💻 Freelance / Proyek</div>
              <div>↙️ Transfer Masuk</div>
              <div>🎁 Cashback & Reward</div>
            </div>
          </div>

          {recentInputs.length > 0 && (
            <div className="card">
              <div style={{ fontWeight: 700, marginBottom: 12, fontSize: 14 }}>🕐 Input Terakhir</div>
              {recentInputs.map((r, i) => (
                <div key={i} style={{
                  padding: '10px 0',
                  borderBottom: i < recentInputs.length - 1 ? '1px solid var(--border)' : 'none',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{r.category}</span>
                    <span className={`amount amount-${r.type}`} style={{ fontSize: 13 }}>
                      {r.type === 'income' ? '+' : '-'}{formatRupiah(r.amount)}
                    </span>
                  </div>
                  {r.description && (
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{r.description}</div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
