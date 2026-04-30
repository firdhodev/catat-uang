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
  const [selectedEmail, setSelectedEmail] = useState<PendingEmail | null>(null);
  const [processResult, setProcessResult] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState('pending');

  const fetchEmails = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/process-emails');
      const data = await res.json();
      setEmails(data.data || []);
      setTotal(data.count || 0);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchEmails(); }, [fetchEmails]);

  const handleProcessAll = async () => {
    setProcessing(true);
    setProcessResult(null);
    try {
      const res = await fetch('/api/process-emails', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ limit: 20 }),
      });
      const data = await res.json();
      setProcessResult(`✅ ${data.processed} berhasil | ❌ ${data.failed} gagal`);
      fetchEmails();
    } catch {
      setProcessResult('❌ Gagal memproses');
    } finally {
      setProcessing(false);
    }
  };

  const statusBadge = (s: string) => {
    const map: Record<string, string> = {
      pending: 'badge-pending',
      done: 'badge-done',
      failed: 'badge-failed',
      processing: 'badge-income',
      skipped: 'badge-pending',
    };
    return <span className={`badge ${map[s] || 'badge-pending'}`}>{s}</span>;
  };

  return (
    <div className="page-container">
      {/* Body preview modal */}
      {selectedEmail && (
        <div className="modal-overlay" onClick={() => setSelectedEmail(null)}>
          <div className="modal" style={{ maxWidth: 640 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">📬 Detail Email</div>
              <button className="modal-close" onClick={() => setSelectedEmail(null)}>×</button>
            </div>
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>Subject</div>
              <div style={{ fontWeight: 600 }}>{selectedEmail.subject || '(tanpa subject)'}</div>
            </div>
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>Platform</div>
              <div>{selectedEmail.platform_name || '-'}</div>
            </div>
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>Status</div>
              {statusBadge(selectedEmail.status)}
              {selectedEmail.error_message && (
                <div style={{ marginTop: 8, fontSize: 12, color: 'var(--expense)' }}>
                  Error: {selectedEmail.error_message}
                </div>
              )}
            </div>
            <div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8 }}>Isi Email</div>
              <pre style={{
                background: 'var(--bg-primary)',
                border: '1px solid var(--border)',
                borderRadius: 8,
                padding: 16,
                fontSize: 12,
                color: 'var(--text-secondary)',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
                maxHeight: 300,
                overflow: 'auto',
              }}>
                {selectedEmail.body}
              </pre>
            </div>
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
          <button
            className="btn btn-primary"
            onClick={handleProcessAll}
            disabled={processing || total === 0}
            id="btn-process-all"
          >
            {processing ? <><span className="spinner" style={{ width: 14, height: 14 }} /> Memproses...</> : '🤖 Proses Semua dengan AI'}
          </button>
          <button className="btn btn-secondary" onClick={fetchEmails} id="btn-refresh">
            🔄 Refresh
          </button>
        </div>
      </div>

      {processResult && (
        <div className={`alert ${processResult.startsWith('✅') ? 'alert-success' : 'alert-error'}`} style={{ marginBottom: 24 }}>
          {processResult}
        </div>
      )}

      {/* Info box */}
      <div className="alert alert-info" style={{ marginBottom: 24 }}>
        💡 <strong>Cara kerja:</strong> Klik "Proses Semua dengan AI" untuk menganalisa email yang dikirim dari Google Apps Script secara otomatis. AI akan mengekstrak nominal, kategori, dan deskripsi transaksi.
      </div>

      {/* Table */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {loading ? (
          <div className="loading"><div className="spinner" /> Memuat...</div>
        ) : emails.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">📭</div>
            <div className="empty-state-title">Tidak ada email pending</div>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 8 }}>
              Email akan muncul di sini setelah Google Apps Script mengirimnya
            </p>
          </div>
        ) : (
          <div className="table-container" style={{ border: 'none' }}>
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
                    <td style={{ fontSize: 12, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                      {email.received_at ? formatDate(email.received_at) : formatDate(email.created_at)}
                    </td>
                    <td>
                      <span style={{ fontSize: 13, fontWeight: 500 }}>{email.platform_name || '-'}</span>
                    </td>
                    <td style={{ maxWidth: 200 }}>
                      <div style={{ fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {email.subject || '(tanpa subject)'}
                      </div>
                    </td>
                    <td style={{ maxWidth: 250 }}>
                      <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                        {truncate(email.body.replace(/\s+/g, ' '), 80)}
                      </span>
                    </td>
                    <td>{statusBadge(email.status)}</td>
                    <td>
                      <button className="btn btn-secondary btn-sm" onClick={() => setSelectedEmail(email)}>
                        👁️ Lihat
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Apps Script setup info */}
      <div className="card" style={{ marginTop: 24 }}>
        <div style={{ fontWeight: 700, marginBottom: 12 }}>📋 Setup Google Apps Script</div>
        <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.8 }}>
          <p>Untuk email otomatis masuk ke sini, kamu perlu:</p>
          <ol style={{ paddingLeft: 20, marginTop: 8 }}>
            <li>Buka <a href="https://script.google.com" target="_blank" rel="noopener" style={{ color: 'var(--accent-hover)' }}>script.google.com</a></li>
            <li>Buat project baru</li>
            <li>Copy-paste kode dari file <code style={{ background: 'var(--bg-primary)', padding: '2px 6px', borderRadius: 4 }}>google-apps-script/email-scanner.gs</code></li>
            <li>Isi konfigurasi Supabase URL dan API Key di bagian atas script</li>
            <li>Jalankan fungsi <code style={{ background: 'var(--bg-primary)', padding: '2px 6px', borderRadius: 4 }}>setupTrigger()</code> untuk pasang trigger otomatis</li>
          </ol>
        </div>
      </div>
    </div>
  );
}
