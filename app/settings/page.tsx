'use client';

import { useEffect, useState, useCallback } from 'react';

interface Platform {
  id: string;
  name: string;
  type: string;
  email_sender?: string;
  email_keywords?: string[];
  is_active: boolean;
  notes?: string;
}

interface Setting {
  key: string;
  value: string;
  label: string;
}

const PLATFORM_EXAMPLES = {
  bank: {
    name: 'Contoh: BCA, Mandiri, BNI, BRI, CIMB, Jenius',
    email_sender: 'Contoh: notifikasi@bca.co.id',
    keywords: 'Contoh: Debit, Kredit, Transfer, transaksi',
  },
  ewallet: {
    name: 'Contoh: GoPay, OVO, DANA, ShopeePay',
    email_sender: 'Contoh: noreply@gojek.com',
    keywords: 'Contoh: bayar, transfer, top up, refund',
  },
  crypto: {
    name: 'Contoh: Indodax, Pintu, Tokocrypto',
    email_sender: 'Contoh: noreply@indodax.com',
    keywords: 'Contoh: beli, jual, deposit, withdrawal',
  },
  paylater: {
    name: 'Contoh: Akulaku, Kredivo, Shopee PayLater',
    email_sender: 'Contoh: notification@akulaku.com',
    keywords: 'Contoh: cicilan, tagihan, bayar, jatuh tempo',
  },
  other: {
    name: 'Contoh: Platform custom',
    email_sender: 'Contoh: noreply@platform.com',
    keywords: 'Contoh: transaksi, pembayaran',
  },
};

const AI_PRESETS = [
  {
    label: 'Ollama (Local)',
    baseUrl: 'http://localhost:11434/v1',
    apiKey: 'ollama',
    model: 'llama3.2:3b',
    desc: 'Untuk development lokal dengan Ollama',
  },
  {
    label: 'OpenRouter',
    baseUrl: 'https://openrouter.ai/api/v1',
    apiKey: '',
    model: 'meta-llama/llama-3.1-8b-instruct',
    desc: 'Untuk production di Vercel',
  },
  {
    label: 'OpenAI',
    baseUrl: 'https://api.openai.com/v1',
    apiKey: '',
    model: 'gpt-4o-mini',
    desc: 'OpenAI API',
  },
];

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<'ai' | 'platforms'>('ai');
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [platforms, setPlatforms] = useState<Platform[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingAI, setSavingAI] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: string } | null>(null);
  const [testingAI, setTestingAI] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);

  // Platform form
  const [showPlatformForm, setShowPlatformForm] = useState(false);
  const [editingPlatform, setEditingPlatform] = useState<Platform | null>(null);
  const [platForm, setPlatForm] = useState({
    name: '', type: 'bank', email_sender: '', keywords_raw: '', notes: '', is_active: true
  });

  const showToast = (msg: string, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [settingsRes, platformsRes] = await Promise.all([
        fetch('/api/settings').then(r => r.json()),
        fetch('/api/platforms').then(r => r.json()),
      ]);
      const settingsMap: Record<string, string> = {};
      (settingsRes.data as Setting[] || []).forEach((s) => { settingsMap[s.key] = s.value; });
      setSettings(settingsMap);
      setPlatforms(platformsRes.data || []);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const handleSaveAI = async () => {
    setSavingAI(true);
    try {
      await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify([
          { key: 'ai_base_url', value: settings.ai_base_url || '' },
          { key: 'ai_api_key', value: settings.ai_api_key || '' },
          { key: 'ai_model', value: settings.ai_model || '' },
        ]),
      });
      showToast('✅ Pengaturan AI disimpan!');
    } catch {
      showToast('❌ Gagal menyimpan', 'error');
    } finally { setSavingAI(false); }
  };

  const handleTestAI = async () => {
    setTestingAI(true);
    setTestResult(null);
    try {
      const res = await fetch(`${settings.ai_base_url}/models`, {
        headers: { 'Authorization': `Bearer ${settings.ai_api_key}` },
        signal: AbortSignal.timeout(5000),
      });
      if (res.ok) {
        const data = await res.json();
        const models = data.data?.slice(0, 3).map((m: { id: string }) => m.id).join(', ') || 'OK';
        setTestResult(`✅ Koneksi berhasil! Models: ${models}`);
      } else {
        setTestResult(`⚠️ Response ${res.status}: ${res.statusText}`);
      }
    } catch (e) {
      setTestResult(`❌ Gagal terhubung: ${(e as Error).message}`);
    } finally { setTestingAI(false); }
  };

  const applyPreset = (preset: typeof AI_PRESETS[0]) => {
    setSettings(s => ({
      ...s,
      ai_base_url: preset.baseUrl,
      ai_api_key: preset.apiKey || s.ai_api_key,
      ai_model: preset.model,
    }));
    setTestResult(null);
  };

  const openPlatformForm = (p?: Platform) => {
    if (p) {
      setEditingPlatform(p);
      setPlatForm({
        name: p.name,
        type: p.type,
        email_sender: p.email_sender || '',
        keywords_raw: (p.email_keywords || []).join(', '),
        notes: p.notes || '',
        is_active: p.is_active,
      });
    } else {
      setEditingPlatform(null);
      setPlatForm({ name: '', type: 'bank', email_sender: '', keywords_raw: '', notes: '', is_active: true });
    }
    setShowPlatformForm(true);
  };

  const savePlatform = async () => {
    if (!platForm.name.trim()) { showToast('❌ Nama platform wajib diisi', 'error'); return; }
    try {
      const payload = {
        name: platForm.name,
        type: platForm.type,
        email_sender: platForm.email_sender || null,
        email_keywords: platForm.keywords_raw.split(',').map(k => k.trim()).filter(Boolean),
        notes: platForm.notes,
        is_active: platForm.is_active,
      };
      if (editingPlatform) {
        await fetch(`/api/platforms/${editingPlatform.id}`, {
          method: 'PATCH', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        showToast('✅ Platform diupdate');
      } else {
        await fetch('/api/platforms', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        showToast('✅ Platform ditambahkan');
      }
      setShowPlatformForm(false);
      fetchAll();
    } catch { showToast('❌ Gagal menyimpan', 'error'); }
  };

  const deletePlatform = async (id: string) => {
    if (!confirm('Hapus platform ini?')) return;
    try {
      await fetch(`/api/platforms/${id}`, { method: 'DELETE' });
      showToast('🗑️ Platform dihapus');
      fetchAll();
    } catch { showToast('❌ Gagal menghapus', 'error'); }
  };

  const example = PLATFORM_EXAMPLES[platForm.type as keyof typeof PLATFORM_EXAMPLES] || PLATFORM_EXAMPLES.other;

  return (
    <div className="page-container">
      {toast && (
        <div className="toast-container">
          <div className={`toast toast-${toast.type}`}>{toast.msg}</div>
        </div>
      )}

      {/* Platform Form Modal */}
      {showPlatformForm && (
        <div className="modal-overlay" onClick={() => setShowPlatformForm(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">{editingPlatform ? '✏️ Edit Platform' : '➕ Tambah Platform'}</div>
              <button className="modal-close" onClick={() => setShowPlatformForm(false)}>×</button>
            </div>

            <div className="form-group">
              <label className="form-label">Tipe</label>
              <select className="form-select" value={platForm.type}
                onChange={e => setPlatForm({ ...platForm, type: e.target.value })}>
                <option value="bank">🏦 Bank</option>
                <option value="ewallet">📱 E-Wallet</option>
                <option value="crypto">₿ Crypto</option>
                <option value="paylater">💳 Pay Later</option>
                <option value="other">📦 Lainnya</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Nama Platform *</label>
              <input className="form-input" type="text" value={platForm.name}
                onChange={e => setPlatForm({ ...platForm, name: e.target.value })}
                placeholder={example.name} />
            </div>

            <div className="form-group">
              <label className="form-label">Email Sender</label>
              <input className="form-input" type="text" value={platForm.email_sender}
                onChange={e => setPlatForm({ ...platForm, email_sender: e.target.value })}
                placeholder={example.email_sender} />
              <div className="form-hint">Alamat email pengirim notifikasi transaksi</div>
            </div>

            <div className="form-group">
              <label className="form-label">Keywords Filter (pisahkan dengan koma)</label>
              <input className="form-input" type="text" value={platForm.keywords_raw}
                onChange={e => setPlatForm({ ...platForm, keywords_raw: e.target.value })}
                placeholder={example.keywords} />
              <div className="form-hint">Kata kunci yang harus ada di email untuk dianggap sebagai transaksi</div>
            </div>

            <div className="form-group">
              <label className="form-label">Catatan (opsional)</label>
              <input className="form-input" type="text" value={platForm.notes}
                onChange={e => setPlatForm({ ...platForm, notes: e.target.value })}
                placeholder="Deskripsi singkat platform ini" />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 24 }}>
              <input type="checkbox" id="platform-active" checked={platForm.is_active}
                onChange={e => setPlatForm({ ...platForm, is_active: e.target.checked })}
                style={{ accentColor: 'var(--accent)', width: 16, height: 16 }} />
              <label htmlFor="platform-active" style={{ fontSize: 14, cursor: 'pointer' }}>
                Platform aktif (email dari platform ini akan diproses)
              </label>
            </div>

            <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
              <button className="btn btn-secondary" onClick={() => setShowPlatformForm(false)}>Batal</button>
              <button className="btn btn-primary" onClick={savePlatform}>💾 Simpan Platform</button>
            </div>
          </div>
        </div>
      )}

      <div className="page-header">
        <h1 className="page-title">⚙️ Pengaturan</h1>
        <p className="page-subtitle">Konfigurasi AI, platform keuangan, dan preferensi aplikasi</p>
      </div>

      {/* Tabs */}
      <div className="tabs">
        <div className={`tab ${activeTab === 'ai' ? 'active' : ''}`} onClick={() => setActiveTab('ai')}>
          🤖 Konfigurasi AI
        </div>
        <div className={`tab ${activeTab === 'platforms' ? 'active' : ''}`} onClick={() => setActiveTab('platforms')}>
          🏦 Platform Keuangan
        </div>
      </div>

      {loading ? (
        <div className="loading"><div className="spinner" /> Memuat...</div>
      ) : (
        <>
          {/* AI Settings */}
          {activeTab === 'ai' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 24, alignItems: 'start' }}>
              <div className="card">
                <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 20 }}>🤖 Konfigurasi AI API</div>

                <div className="form-group">
                  <label className="form-label">AI Base URL</label>
                  <input className="form-input" type="text"
                    value={settings.ai_base_url || ''}
                    onChange={e => setSettings(s => ({ ...s, ai_base_url: e.target.value }))}
                    placeholder="http://localhost:11434/v1"
                    id="input-ai-url"
                  />
                  <div className="form-hint">
                    Ollama lokal: <code>http://localhost:11434/v1</code> | OpenRouter: <code>https://openrouter.ai/api/v1</code>
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">API Key</label>
                  <input className="form-input" type="password"
                    value={settings.ai_api_key || ''}
                    onChange={e => setSettings(s => ({ ...s, ai_api_key: e.target.value }))}
                    placeholder="ollama (untuk lokal) | sk-or-xxx (untuk OpenRouter)"
                    id="input-ai-key"
                  />
                  <div className="form-hint">Untuk Ollama lokal isi dengan "ollama" atau kosongkan</div>
                </div>

                <div className="form-group">
                  <label className="form-label">Model</label>
                  <input className="form-input" type="text"
                    value={settings.ai_model || ''}
                    onChange={e => setSettings(s => ({ ...s, ai_model: e.target.value }))}
                    placeholder="llama3.2:3b"
                    id="input-ai-model"
                  />
                  <div className="form-hint">
                    Ollama: <code>llama3.2:3b</code>, <code>mistral</code> | OpenRouter: <code>meta-llama/llama-3.1-8b-instruct</code>
                  </div>
                </div>

                {/* Test result */}
                {testResult && (
                  <div className={`alert ${testResult.startsWith('✅') ? 'alert-success' : 'alert-warning'}`} style={{ marginBottom: 16 }}>
                    {testResult}
                  </div>
                )}

                <div style={{ display: 'flex', gap: 12 }}>
                  <button className="btn btn-secondary" onClick={handleTestAI} disabled={testingAI} id="btn-test-ai">
                    {testingAI ? <><span className="spinner" style={{ width: 14, height: 14 }} /> Testing...</> : '🔌 Test Koneksi'}
                  </button>
                  <button className="btn btn-primary" onClick={handleSaveAI} disabled={savingAI} id="btn-save-ai">
                    {savingAI ? 'Menyimpan...' : '💾 Simpan Pengaturan'}
                  </button>
                </div>
              </div>

              {/* Presets */}
              <div>
                <div className="card">
                  <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 16 }}>⚡ Preset Cepat</div>
                  {AI_PRESETS.map((preset) => (
                    <div key={preset.label} style={{
                      padding: '12px',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--border)',
                      marginBottom: 8,
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                    }}
                      onClick={() => applyPreset(preset)}
                      onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--accent)')}
                      onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border)')}
                    >
                      <div style={{ fontWeight: 600, fontSize: 13 }}>{preset.label}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{preset.desc}</div>
                      <div style={{ fontSize: 11, color: 'var(--accent-hover)', marginTop: 4, fontFamily: 'monospace' }}>
                        {preset.model}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="alert alert-info" style={{ marginTop: 16 }}>
                  <div>
                    <strong>💡 Tips:</strong><br />
                    Gunakan <strong>Ollama</strong> saat development lokal, dan ganti ke <strong>OpenRouter</strong> saat deploy ke Vercel.
                    Settings ini tersimpan di Supabase, bisa diubah kapan saja tanpa redeploy.
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Platforms */}
          {activeTab === 'platforms' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                <div style={{ fontSize: 14, color: 'var(--text-secondary)' }}>
                  {platforms.length} platform terdaftar
                </div>
                <button className="btn btn-primary" onClick={() => openPlatformForm()} id="btn-add-platform">
                  ➕ Tambah Platform
                </button>
              </div>

              <div className="alert alert-info" style={{ marginBottom: 20 }}>
                💡 <strong>Catatan:</strong> Platform ini digunakan oleh Google Apps Script untuk memfilter email yang akan diproses. Pastikan <strong>Email Sender</strong> dan <strong>Keywords</strong> sesuai dengan format email notifikasi yang kamu terima.
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
                {platforms.map(p => (
                  <div key={p.id} className="card" style={{
                    opacity: p.is_active ? 1 : 0.5,
                    position: 'relative',
                    overflow: 'hidden',
                  }}>
                    {!p.is_active && (
                      <div style={{
                        position: 'absolute', top: 12, right: 12,
                        background: 'var(--expense-dim)', color: 'var(--expense)',
                        fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 10,
                      }}>NONAKTIF</div>
                    )}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 16 }}>{p.name}</div>
                        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                          {p.type === 'bank' ? '🏦 Bank' :
                            p.type === 'ewallet' ? '📱 E-Wallet' :
                              p.type === 'crypto' ? '₿ Crypto' :
                                p.type === 'paylater' ? '💳 Pay Later' : '📦 Lainnya'}
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button className="btn-icon btn-sm" onClick={() => openPlatformForm(p)}>✏️</button>
                        <button className="btn-icon btn-sm" onClick={() => deletePlatform(p.id)}
                          style={{ color: 'var(--expense)' }}>🗑️</button>
                      </div>
                    </div>

                    {p.email_sender && (
                      <div style={{ marginBottom: 8 }}>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 2 }}>EMAIL SENDER</div>
                        <code style={{ fontSize: 12, color: 'var(--accent-hover)' }}>{p.email_sender}</code>
                      </div>
                    )}

                    {p.email_keywords && p.email_keywords.length > 0 && (
                      <div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6 }}>KEYWORDS</div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                          {p.email_keywords.map(k => (
                            <span key={k} style={{
                              background: 'var(--accent-dim)', color: 'var(--accent-hover)',
                              fontSize: 11, padding: '2px 8px', borderRadius: 10, fontWeight: 600,
                            }}>{k}</span>
                          ))}
                        </div>
                      </div>
                    )}

                    {p.notes && (
                      <div style={{ marginTop: 8, fontSize: 12, color: 'var(--text-muted)' }}>{p.notes}</div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
