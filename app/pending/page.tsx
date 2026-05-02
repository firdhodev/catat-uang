'use client';

import { useEffect, useState, useCallback } from 'react';
import { format, parseISO } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';

interface PendingEmail {
  id: string;
  gmail_message_id: string;
  platform_name?: string;
  subject?: string;
  body: string;
  received_at?: string;
  status: string;
  error_message?: string;
  created_at: string;
}

function truncate(str: string, n: number) {
  return str.length > n ? str.slice(0, n) + '...' : str;
}

function formatDate(d: string) {
  try { return format(parseISO(d), 'dd MMM yyyy, HH:mm', { locale: idLocale }); }
  catch { return d.slice(0, 16); }
}

export default function PendingPage() {
  const [emails, setEmails] = useState<PendingEmail[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [processing, setProcessing] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [selectedEmail, setSelectedEmail] = useState<PendingEmail | null>(null);
  const [processResult, setProcessResult] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; type: string } | null>(null);

  const showToast = (msg: string, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const fetchEmails = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/process-emails');
      const data = await res.json();
      setEmails(data.data || []); setTotal(data.count || 0);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchEmails(); }, [fetchEmails]);

  const handleProcessAll = async () => {
    setProcessing(true); setProcessResult(null);
    try {
      const res = await fetch('/api/process-emails', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ limit: 20 }) });
      const data = await res.json();
      setProcessResult(`✅ ${data.processed} berhasil | ❌ ${data.failed} gagal`);
      fetchEmails();
    } catch { setProcessResult('❌ Gagal memproses'); }
    finally { setProcessing(false); }
  };

  const handleProcessOne = async (email: PendingEmail) => {
    setProcessingId(email.id);
    try {
      const res = await fetch('/api/process-emails', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ limit: 1, id: email.id }) });
      const data = await res.json();
      if (data.processed > 0) showToast('✅ Email berhasil diproses AI!');
      else showToast('❌ Gagal diproses: ' + (data.details?.[0]?.message || 'error'), 'error');
      fetchEmails();
    } catch { showToast('❌ Gagal memproses', 'error'); }
    finally { setProcessingId(null); }
  };

  const handleDelete = async (email: PendingEmail) => {
    if (!confirm(`Hapus email "${email.subject || 'tanpa subject'}" dari antrian?`)) return;
    setDeletingId(email.id);
    try {
      await fetch(`/api/pending-emails/${email.id}`, { method: 'DELETE' });
      showToast('🗑️ Email dihapus dari antrian');
      fetchEmails();
      if (selectedEmail?.id === email.id) setSelectedEmail(null);
    } catch { showToast('❌ Gagal menghapus', 'error'); }
    finally { setDeletingId(null); }
  };

  const handleSkip = async (email: PendingEmail) => {
    try {
      await fetch(`/api/pending-emails/${email.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'skipped', error_message: 'Dilewati manual' }) });
      showToast('⏭️ Email dilewati'); fetchEmails();
    } catch { showToast('❌ Gagal', 'error'); }
  };

  const statusBadge = (s: string) => {
    const map: Record<string, string> = { pending: 'badge-pending', done: 'badge-done', failed: 'badge-failed', processing: 'badge-income', skipped: 'badge-pending' };
    return <span className={`badge ${map[s] || 'badge-pending'}`}>{s}</span>;
  };

  return (
    <div className="page-container">
      {toast && (
        <div className="toast-container">
          <div className={`toast toast-${toast.type}`}>{toast.msg}</div>
        </div>
      )}

      {/* Detail Modal */}
      {selectedEmail && (
        <div className="modal-overlay" onClick={() => setSelectedEmail(null)}>
          <div className="modal" style={{ maxWidth: 640 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">📬 Detail Email</div>
              <button className="modal-close" onClick={() => setSelectedEmail(null)}>×</button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
              <div>
                <div style={{ fontSize: 10, color: '#999', fontWeight: 800, textTransform: 'uppercase', marginBottom: 4 }}>Subject</div>
                <div style={{ fontWeight: 700, fontSize: 14 }}>{selectedEmail.subject || '(tanpa subject)'}</div>
              </div>
              <div>
                <div style={{ fontSize: 10, color: '#999', fontWeight: 800, textTransform: 'uppercase', marginBottom: 4 }}>Platform</div>
                <div style={{ fontWeight: 700, fontSize: 14 }}>{selectedEmail.platform_name || '-'}</div>
              </div>
              <div>
                <div style={{ fontSize: 10, color: '#999', fontWeight: 800, textTransform: 'uppercase', marginBottom: 4 }}>Status</div>
                {statusBadge(selectedEmail.status)}
              </div>
              <div>
                <div style={{ fontSize: 10, color: '#999', fontWeight: 800, textTransform: 'uppercase', marginBottom: 4 }}>Diterima</div>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{selectedEmail.received_at ? formatDate(selectedEmail.received_at) : '-'}</div>
              </div>
            </div>

            {selectedEmail.error_message && (
              <div className="alert alert-warning" style={{ marginBottom: 16 }}>⚠️ {selectedEmail.error_message}</div>
            )}

            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 10, color: '#999', fontWeight: 800, textTransform: 'uppercase', marginBottom: 8 }}>Isi Email</div>
              <pre style={{ background: '#f5f5f5', border: '2px solid #0D0D0D', borderRadius: 4, padding: 16, fontSize: 12, color: '#555', whiteSpace: 'pre-wrap', wordBreak: 'break-word', maxHeight: 300, overflow: 'auto', fontWeight: 600 }}>
                {selectedEmail.body}
              </pre>
            </div>

            {selectedEmail.status === 'pending' && (
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                <button className="btn btn-secondary" onClick={() => { handleSkip(selectedEmail); setSelectedEmail(null); }}>⏭️ Lewati</button>
                <button className="btn btn-danger" onClick={() => handleDelete(selectedEmail)} disabled={deletingId === selectedEmail.id}>🗑️ Hapus</button>
                <button className="btn btn-primary" onClick={() => handleProcessOne(selectedEmail)} disabled={processingId === selectedEmail.id}>
                  {processingId === selectedEmail.id ? <><span className="spinner" style={{ width: 14, height: 14 }} /> Memproses...</> : '🤖 Proses dengan AI'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Header */}
      <div className="page-topbar">
        <div className="topbar-left">
          <h1 className="page-title">📬 Email Pending</h1>
          <p className="page-subtitle">{total} email menunggu diproses AI</p>
        </div>
        <div className="topbar-right">
          <button className="btn btn-primary" onClick={handleProcessAll} disabled={processing || total === 0} id="btn-process-all">
            {processing ? <><span className="spinner" style={{ width: 14, height: 14 }} /> Memproses...</> : '🤖 Proses Semua dengan AI'}
          </button>
          <button className="btn btn-secondary" onClick={fetchEmails} id="btn-refresh">🔄 Refresh</button>
        </div>
      </div>

      {processResult && (
        <div className={`alert ${processResult.startsWith('✅') ? 'alert-success' : 'alert-error'}`} style={{ marginBottom: 24 }}>
          {processResult}
        </div>
      )}

      <div className="alert alert-info" style={{ marginBottom: 24 }}>
        💡 <strong>Cara kerja:</strong> Klik <strong>&quot;🤖 Proses dengan AI&quot;</strong> per baris. Gunakan <strong>&quot;⏭️ Lewati&quot;</strong> untuk skip, atau <strong>&quot;🗑️ Hapus&quot;</strong> untuk hapus dari antrian.
      </div>

      {/* Table */}
      <div style={{ background: '#FAFAFA', border: '2px solid #0D0D0D', borderRadius: 4, boxShadow: '4px 4px 0px #0D0D0D', overflow: 'hidden', marginBottom: 24 }}>
        {loading ? (
          <div className="loading"><div className="spinner" /> Memuat...</div>
        ) : emails.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">📭</div>
            <div className="empty-state-title">Tidak ada email pending</div>
            <p style={{ fontSize: 13, color: '#999', marginTop: 8, fontWeight: 600 }}>
              Email akan muncul di sini setelah Google Apps Script mengirimnya
            </p>
          </div>
        ) : (
          <div className="table-container" style={{ border: 'none', boxShadow: 'none' }}>
            <table className="table">
              <thead>
                <tr>
                  <th>Diterima</th>
                  <th>Platform</th>
                  <th>Subject</th>
                  <th>Preview</th>
                  <th>Status</th>
                  <th>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {emails.map(email => (
                  <tr key={email.id}>
                    <td style={{ fontSize: 12, color: '#666', whiteSpace: 'nowrap', fontWeight: 700 }}>
                      {email.received_at ? formatDate(email.received_at) : formatDate(email.created_at)}
                    </td>
                    <td><span style={{ fontSize: 13, fontWeight: 700 }}>{email.platform_name || '-'}</span></td>
                    <td style={{ maxWidth: 180 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {email.subject || '(tanpa subject)'}
                      </div>
                    </td>
                    <td style={{ maxWidth: 200 }}>
                      <span style={{ fontSize: 12, color: '#999', fontWeight: 600 }}>
                        {truncate(email.body.replace(/\s+/g, ' '), 60)}
                      </span>
                    </td>
                    <td>{statusBadge(email.status)}</td>
                    <td>
                      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                        <button className="btn btn-secondary btn-sm" onClick={() => setSelectedEmail(email)} title="Lihat detail">👁️</button>
                        {email.status === 'pending' && (
                          <>
                            <button className="btn btn-primary btn-sm" onClick={() => handleProcessOne(email)} disabled={processingId === email.id} title="Proses dengan AI">
                              {processingId === email.id ? <span className="spinner" style={{ width: 12, height: 12 }} /> : '🤖'}
                            </button>
                            <button className="btn btn-secondary btn-sm" onClick={() => handleSkip(email)} title="Lewati">⏭️</button>
                            <button className="btn btn-secondary btn-sm" onClick={() => handleDelete(email)} disabled={deletingId === email.id} title="Hapus" style={{ color: '#FF3B3B' }}>
                              {deletingId === email.id ? <span className="spinner" style={{ width: 12, height: 12 }} /> : '🗑️'}
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Setup info */}
      <div className="card">
        <div style={{ fontWeight: 800, marginBottom: 12, fontSize: 14, textTransform: 'uppercase' }}>📋 Setup Google Apps Script</div>
        <div style={{ fontSize: 13, color: '#555', lineHeight: 1.9, fontWeight: 600 }}>
          <p>Untuk email otomatis masuk ke sini, kamu perlu:</p>
          <ol style={{ paddingLeft: 20, marginTop: 8 }}>
            <li>Buka <a href="https://script.google.com" target="_blank" rel="noopener" style={{ color: '#0066FF', fontWeight: 800, textDecoration: 'underline' }}>script.google.com</a></li>
            <li>Buat project baru</li>
            <li>Copy-paste kode dari file <code style={{ background: '#f0f0f0', padding: '2px 6px', borderRadius: 4, border: '1px solid #ccc', fontSize: 12 }}>google-apps-script/email-scanner.gs</code></li>
            <li>Isi konfigurasi Supabase URL dan API Key di bagian atas script</li>
            <li>Jalankan fungsi <code style={{ background: '#f0f0f0', padding: '2px 6px', borderRadius: 4, border: '1px solid #ccc', fontSize: 12 }}>setupTrigger()</code> untuk pasang trigger otomatis</li>
          </ol>
        </div>
      </div>
    </div>
  );
}
