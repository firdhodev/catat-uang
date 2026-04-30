'use client';

import { useEffect, useState, useCallback } from 'react';
import { format, parseISO } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';

interface Transaction {
  id: string;
  amount: number;
  type: 'income' | 'expense';
  category: string;
  description: string;
  platform: string;
  source: string;
  ai_confidence?: number;
  is_verified: boolean;
  transaction_date: string;
  created_at: string;
}

interface EditForm {
  amount: string;
  type: 'income' | 'expense';
  category: string;
  description: string;
  platform: string;
  transaction_date: string;
  is_verified: boolean;
}

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

function formatDate(dateStr: string) {
  try {
    return format(parseISO(dateStr), 'dd MMM yyyy, HH:mm', { locale: idLocale });
  } catch { return dateStr.slice(0, 16); }
}

export default function TransactionsPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [filterType, setFilterType] = useState('');
  const [filterMonth, setFilterMonth] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<EditForm | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: string } | null>(null);
  const [search, setSearch] = useState('');

  const showToast = (msg: string, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const fetchTransactions = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '20',
        ...(filterType && { type: filterType }),
        ...(filterMonth && { month: filterMonth }),
      });
      const res = await fetch(`/api/transactions?${params}`);
      const data = await res.json();
      setTransactions(data.data || []);
      setTotal(data.count || 0);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, [page, filterType, filterMonth]);

  useEffect(() => { fetchTransactions(); }, [fetchTransactions]);

  const startEdit = (tx: Transaction) => {
    setEditingId(tx.id);
    setEditForm({
      amount: tx.amount.toString(),
      type: tx.type,
      category: tx.category,
      description: tx.description || '',
      platform: tx.platform || '',
      transaction_date: tx.transaction_date.slice(0, 16),
      is_verified: tx.is_verified,
    });
  };

  const saveEdit = async () => {
    if (!editingId || !editForm) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/transactions/${editingId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...editForm,
          amount: parseFloat(editForm.amount),
        }),
      });
      if (!res.ok) throw new Error('Gagal menyimpan');
      showToast('✅ Transaksi berhasil diupdate');
      setEditingId(null);
      fetchTransactions();
    } catch { showToast('❌ Gagal menyimpan perubahan', 'error'); }
    finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await fetch(`/api/transactions/${deleteId}`, { method: 'DELETE' });
      showToast('🗑️ Transaksi dihapus');
      setDeleteId(null);
      fetchTransactions();
    } catch { showToast('❌ Gagal menghapus', 'error'); }
  };

  const categories = editForm?.type === 'income' ? CATEGORIES_INCOME : CATEGORIES_EXPENSE;

  const filtered = search
    ? transactions.filter(tx =>
        tx.description?.toLowerCase().includes(search.toLowerCase()) ||
        tx.category?.toLowerCase().includes(search.toLowerCase()) ||
        tx.platform?.toLowerCase().includes(search.toLowerCase())
      )
    : transactions;

  return (
    <div className="page-container">
      {/* Toast */}
      {toast && (
        <div className="toast-container">
          <div className={`toast toast-${toast.type}`}>{toast.msg}</div>
        </div>
      )}

      {/* Delete Confirm Modal */}
      {deleteId && (
        <div className="modal-overlay" onClick={() => setDeleteId(null)}>
          <div className="modal" style={{ maxWidth: 400 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">🗑️ Hapus Transaksi</div>
              <button className="modal-close" onClick={() => setDeleteId(null)}>×</button>
            </div>
            <p style={{ color: 'var(--text-secondary)', marginBottom: 24 }}>
              Apakah kamu yakin ingin menghapus transaksi ini? Tindakan ini tidak bisa dibatalkan.
            </p>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
              <button className="btn btn-secondary" onClick={() => setDeleteId(null)}>Batal</button>
              <button className="btn btn-danger" onClick={handleDelete}>Hapus</button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {editingId && editForm && (
        <div className="modal-overlay" onClick={() => setEditingId(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">✏️ Edit Transaksi</div>
              <button className="modal-close" onClick={() => setEditingId(null)}>×</button>
            </div>

            <div className="type-toggle" style={{ marginBottom: 20 }}>
              <button
                className={`type-btn expense ${editForm.type === 'expense' ? 'active' : ''}`}
                onClick={() => setEditForm({ ...editForm, type: 'expense', category: CATEGORIES_EXPENSE[0] })}
              >💸 Pengeluaran</button>
              <button
                className={`type-btn income ${editForm.type === 'income' ? 'active' : ''}`}
                onClick={() => setEditForm({ ...editForm, type: 'income', category: CATEGORIES_INCOME[0] })}
              >💰 Pemasukan</button>
            </div>

            <div className="form-group">
              <label className="form-label">Nominal (Rp)</label>
              <input className="form-input" type="number" value={editForm.amount}
                onChange={e => setEditForm({ ...editForm, amount: e.target.value })} />
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Kategori</label>
                <select className="form-select" value={editForm.category}
                  onChange={e => setEditForm({ ...editForm, category: e.target.value })}>
                  {categories.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Platform</label>
                <input className="form-input" type="text" value={editForm.platform}
                  placeholder="BCA, GoPay, dll"
                  onChange={e => setEditForm({ ...editForm, platform: e.target.value })} />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Deskripsi</label>
              <input className="form-input" type="text" value={editForm.description}
                onChange={e => setEditForm({ ...editForm, description: e.target.value })} />
            </div>

            <div className="form-group">
              <label className="form-label">Tanggal & Waktu</label>
              <input className="form-input" type="datetime-local" value={editForm.transaction_date}
                onChange={e => setEditForm({ ...editForm, transaction_date: e.target.value })} />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 24 }}>
              <input type="checkbox" id="verified-check" checked={editForm.is_verified}
                onChange={e => setEditForm({ ...editForm, is_verified: e.target.checked })}
                style={{ accentColor: 'var(--accent)', width: 16, height: 16 }} />
              <label htmlFor="verified-check" style={{ fontSize: 14, cursor: 'pointer' }}>
                Tandai sebagai terverifikasi
              </label>
            </div>

            <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
              <button className="btn btn-secondary" onClick={() => setEditingId(null)}>Batal</button>
              <button className="btn btn-primary" onClick={saveEdit} disabled={saving}>
                {saving ? 'Menyimpan...' : '💾 Simpan'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Page Header */}
      <div className="page-topbar">
        <div className="topbar-left">
          <h1 className="page-title">Daftar Transaksi</h1>
          <p className="page-subtitle">{total} transaksi ditemukan</p>
        </div>
        <div className="topbar-right">
          {/* Search */}
          <div className="search-bar">
            <span className="search-icon">🔍</span>
            <input
              className="search-input"
              placeholder="Cari transaksi..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>

          {/* Filter Type */}
          <select className="form-select" style={{ width: 'auto', padding: '10px 14px' }}
            value={filterType} onChange={e => { setFilterType(e.target.value); setPage(1); }}>
            <option value="">Semua Tipe</option>
            <option value="income">Pemasukan</option>
            <option value="expense">Pengeluaran</option>
          </select>

          {/* Filter Month */}
          <input type="month" className="form-input" style={{ width: 'auto' }}
            value={filterMonth}
            onChange={e => { setFilterMonth(e.target.value); setPage(1); }} />
        </div>
      </div>

      {/* Table */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {loading ? (
          <div className="loading"><div className="spinner" /> Memuat...</div>
        ) : filtered.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">💳</div>
            <div className="empty-state-title">Tidak ada transaksi</div>
          </div>
        ) : (
          <div className="table-container" style={{ border: 'none' }}>
            <table className="table">
              <thead>
                <tr>
                  <th>Tanggal</th>
                  <th>Deskripsi</th>
                  <th>Kategori</th>
                  <th>Platform</th>
                  <th>Jumlah</th>
                  <th>AI</th>
                  <th>Status</th>
                  <th>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(tx => (
                  <tr key={tx.id}>
                    <td style={{ fontSize: '12px', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                      {formatDate(tx.transaction_date)}
                    </td>
                    <td style={{ maxWidth: 200 }}>
                      <div style={{ fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {tx.description || '-'}
                      </div>
                    </td>
                    <td>
                      <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>{tx.category}</span>
                    </td>
                    <td style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                      {tx.platform || '-'}
                    </td>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      <span className={`amount amount-${tx.type}`}>
                        {tx.type === 'income' ? '+' : '-'}{formatRupiah(tx.amount)}
                      </span>
                    </td>
                    <td>
                      {tx.source === 'email' && tx.ai_confidence !== undefined ? (
                        <div className="confidence-bar">
                          <div className="confidence-track">
                            <div
                              className="confidence-fill"
                              style={{
                                width: `${(tx.ai_confidence * 100).toFixed(0)}%`,
                                background: tx.ai_confidence >= 0.8 ? 'var(--income)' : tx.ai_confidence >= 0.5 ? 'var(--warning)' : 'var(--expense)',
                              }}
                            />
                          </div>
                          <span className="confidence-text" style={{
                            color: tx.ai_confidence >= 0.8 ? 'var(--income)' : tx.ai_confidence >= 0.5 ? 'var(--warning)' : 'var(--expense)',
                          }}>
                            {(tx.ai_confidence * 100).toFixed(0)}%
                          </span>
                        </div>
                      ) : (
                        <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>—</span>
                      )}
                    </td>
                    <td>
                      {tx.is_verified
                        ? <span className="badge badge-done">✓ Verified</span>
                        : <span className="badge badge-pending">Review</span>
                      }
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button className="btn-icon btn-sm" onClick={() => startEdit(tx)} title="Edit">✏️</button>
                        <button className="btn-icon btn-sm" onClick={() => setDeleteId(tx.id)} title="Hapus"
                          style={{ color: 'var(--expense)' }}>🗑️</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {total > 20 && (
          <div style={{ padding: '16px 20px', borderTop: '1px solid var(--border)', display: 'flex', gap: 8, justifyContent: 'center' }}>
            <button className="btn btn-secondary btn-sm" disabled={page === 1} onClick={() => setPage(p => p - 1)}>← Prev</button>
            <span style={{ padding: '6px 12px', fontSize: 13, color: 'var(--text-secondary)' }}>
              Hal {page} / {Math.ceil(total / 20)}
            </span>
            <button className="btn btn-secondary btn-sm" disabled={page * 20 >= total} onClick={() => setPage(p => p + 1)}>Next →</button>
          </div>
        )}
      </div>
    </div>
  );
}
