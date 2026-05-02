'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend
} from 'recharts';
import { format, parseISO } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';

interface StatsData {
  month: string;
  totalIncome: number;
  totalExpense: number;
  balance: number;
  byCategory: { category: string; amount: number }[];
  byDay: { date: string; income: number; expense: number }[];
  pendingEmails: number;
  recentTransactions: Transaction[];
}

interface Transaction {
  id: string;
  amount: number;
  type: 'income' | 'expense';
  category: string;
  description: string;
  platform: string;
  transaction_date: string;
  is_verified: boolean;
  ai_confidence?: number;
}

const CATEGORY_COLORS = [
  '#7B00FF', '#00C853', '#FF3B3B', '#FFE500', '#0066FF',
  '#FF6B00', '#00BCD4', '#E91E63', '#4CAF50', '#9E9E9E',
];

function formatRupiah(amount: number) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency', currency: 'IDR',
    minimumFractionDigits: 0, maximumFractionDigits: 0,
  }).format(amount);
}

function formatShortDate(dateStr: string) {
  try { return format(parseISO(dateStr), 'dd MMM', { locale: idLocale }); }
  catch { return dateStr.slice(0, 10); }
}

export default function DashboardPage() {
  const [stats, setStats] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [processing, setProcessing] = useState(false);
  const [processResult, setProcessResult] = useState<string | null>(null);

  const fetchStats = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/stats?month=${month}`);
      const data = await res.json();
      setStats(data);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, [month]);

  useEffect(() => { fetchStats(); }, [fetchStats]);

  const handleProcessEmails = async () => {
    setProcessing(true);
    setProcessResult(null);
    try {
      const res = await fetch('/api/process-emails', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ limit: 10 }),
      });
      const data = await res.json();
      setProcessResult(`✅ Selesai: ${data.processed} berhasil, ${data.failed} gagal`);
      fetchStats();
    } catch {
      setProcessResult('❌ Gagal memproses email');
    } finally { setProcessing(false); }
  };

  const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: { color: string; name: string; value: number }[]; label?: string }) => {
    if (active && payload && payload.length) {
      return (
        <div style={{
          background: '#fff', border: '2px solid #0D0D0D',
          borderRadius: 4, padding: '12px 16px', fontSize: '13px',
          boxShadow: '3px 3px 0px #0D0D0D',
        }}>
          <p style={{ color: '#666', marginBottom: 6, fontWeight: 700 }}>{label}</p>
          {payload.map((p, i) => (
            <p key={i} style={{ color: p.color, fontWeight: 800 }}>
              {p.name}: {formatRupiah(p.value)}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  if (loading) {
    return (
      <div className="page-container">
        <div className="loading">
          <div className="spinner" />
          Memuat dashboard...
        </div>
      </div>
    );
  }

  const chartData = stats?.byDay.map(d => ({ ...d, date: formatShortDate(d.date) })) || [];

  return (
    <div className="page-container">
      {/* Header */}
      <div className="page-topbar">
        <div className="topbar-left">
          <h1 className="page-title">Dashboard</h1>
          <p className="page-subtitle">
            Ringkasan keuangan bulan {format(new Date(month + '-01'), 'MMMM yyyy', { locale: idLocale })}
          </p>
        </div>
        <div className="topbar-right">
          <div className="month-picker">
            <span style={{ fontSize: '13px' }}>📅</span>
            <input
              type="month"
              value={month}
              onChange={e => setMonth(e.target.value)}
            />
          </div>
          <button
            className={`btn btn-primary ${processing ? 'btn-secondary' : ''}`}
            onClick={handleProcessEmails}
            disabled={processing}
            id="btn-process-emails"
          >
            {processing ? <><span className="spinner" style={{ width: 14, height: 14 }} /> Memproses...</> : '🤖 Proses Email AI'}
          </button>
        </div>
      </div>

      {/* Process result */}
      {processResult && (
        <div className={`alert ${processResult.startsWith('✅') ? 'alert-success' : 'alert-error'}`}>
          {processResult}
          <button onClick={() => setProcessResult(null)} style={{ marginLeft: 'auto', cursor: 'pointer', background: 'none', border: 'none', color: 'inherit', fontSize: '18px', fontWeight: 800 }}>×</button>
        </div>
      )}

      {/* Pending alert */}
      {(stats?.pendingEmails || 0) > 0 && (
        <div className="alert alert-warning" style={{ marginBottom: 24 }}>
          📬 Ada <strong>{stats?.pendingEmails}</strong> email transaksi yang belum diproses.
          <Link href="/pending" style={{ marginLeft: 8, textDecoration: 'underline', fontWeight: 800 }}>Lihat →</Link>
        </div>
      )}

      {/* Stat Cards */}
      <div className="stats-grid">
        <div className="stat-card income">
          <div className="stat-label">💚 Total Pemasukan</div>
          <div className="stat-value income">{formatRupiah(stats?.totalIncome || 0)}</div>
          <div className="stat-sub">Bulan ini</div>
        </div>
        <div className="stat-card expense">
          <div className="stat-label">❤️ Total Pengeluaran</div>
          <div className="stat-value expense">{formatRupiah(stats?.totalExpense || 0)}</div>
          <div className="stat-sub">Bulan ini</div>
        </div>
        <div className="stat-card balance">
          <div className="stat-label">💜 Saldo Bersih</div>
          <div className={`stat-value ${(stats?.balance || 0) >= 0 ? 'balance' : 'expense'}`}>
            {formatRupiah(stats?.balance || 0)}
          </div>
          <div className="stat-sub">{(stats?.balance || 0) >= 0 ? '🎉 Surplus' : '⚠️ Defisit'}</div>
        </div>
        <div className="stat-card pending">
          <div className="stat-label">📬 Email Pending</div>
          <div className="stat-value warning">{stats?.pendingEmails || 0}</div>
          <div className="stat-sub">Belum diproses AI</div>
        </div>
      </div>

      {/* Charts */}
      <div className="charts-grid">
        <div className="chart-card">
          <div className="chart-title">Tren Keuangan (30 Hari Terakhir)</div>
          <div className="chart-sub">Pemasukan vs Pengeluaran harian</div>
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={chartData} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
              <defs>
                <linearGradient id="incomeGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#00C853" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#00C853" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="expenseGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#FF3B3B" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#FF3B3B" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.07)" />
              <XAxis dataKey="date" tick={{ fill: '#888', fontSize: 11, fontWeight: 700 }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fill: '#888', fontSize: 10 }} tickLine={false} axisLine={false}
                tickFormatter={v => v >= 1000000 ? `${(v / 1000000).toFixed(0)}jt` : v >= 1000 ? `${(v / 1000).toFixed(0)}rb` : v.toString()} />
              <Tooltip content={<CustomTooltip />} />
              <Area type="monotone" dataKey="income" name="Pemasukan" stroke="#00C853" fill="url(#incomeGrad)" strokeWidth={2.5} dot={false} />
              <Area type="monotone" dataKey="expense" name="Pengeluaran" stroke="#FF3B3B" fill="url(#expenseGrad)" strokeWidth={2.5} dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="chart-card">
          <div className="chart-title">Pengeluaran per Kategori</div>
          <div className="chart-sub">Bulan ini</div>
          {(stats?.byCategory?.length || 0) > 0 ? (
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie
                  data={stats?.byCategory?.slice(0, 8)}
                  dataKey="amount" nameKey="category"
                  cx="50%" cy="50%"
                  innerRadius={50} outerRadius={88} paddingAngle={3}
                >
                  {stats?.byCategory?.slice(0, 8).map((_, i) => (
                    <Cell key={i} fill={CATEGORY_COLORS[i % CATEGORY_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(v) => typeof v === 'number' ? formatRupiah(v) : v} />
                <Legend formatter={(v) => <span style={{ fontSize: '11px', color: '#666', fontWeight: 700 }}>{v}</span>} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="empty-state" style={{ padding: '40px 20px' }}>
              <div className="empty-state-icon">📊</div>
              <div className="empty-state-title">Belum ada data</div>
            </div>
          )}
        </div>
      </div>

      {/* Recent Transactions */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '20px 24px' }}>
          <div className="section-header">
            <div className="section-title">🕐 Transaksi Terbaru</div>
            <Link href="/transactions" className="section-link">Lihat semua →</Link>
          </div>
        </div>

        {(stats?.recentTransactions?.length || 0) === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">💳</div>
            <div className="empty-state-title">Belum ada transaksi</div>
            <p style={{ fontSize: '13px', color: '#999', marginTop: 8, fontWeight: 600 }}>
              Tambah manual atau proses email untuk mulai
            </p>
          </div>
        ) : (
          <div className="table-container" style={{ border: 'none', boxShadow: 'none' }}>
            <table className="table">
              <thead>
                <tr>
                  <th>Tanggal</th>
                  <th>Deskripsi</th>
                  <th>Kategori</th>
                  <th>Platform</th>
                  <th>Jumlah</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {stats?.recentTransactions.map(tx => (
                  <tr key={tx.id}>
                    <td style={{ color: '#666', fontSize: '12px', whiteSpace: 'nowrap', fontWeight: 700 }}>
                      {formatShortDate(tx.transaction_date)}
                    </td>
                    <td style={{ maxWidth: 200 }}>
                      <div style={{ fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {tx.description || '-'}
                      </div>
                    </td>
                    <td><span style={{ fontSize: '13px', fontWeight: 600, color: '#555' }}>{tx.category}</span></td>
                    <td style={{ fontSize: '12px', color: '#999', fontWeight: 600 }}>{tx.platform || '-'}</td>
                    <td>
                      <span className={`amount amount-${tx.type}`}>
                        {tx.type === 'income' ? '+' : '-'}{formatRupiah(tx.amount)}
                      </span>
                    </td>
                    <td>
                      {tx.is_verified
                        ? <span className="badge badge-done">✓ Verified</span>
                        : <span className="badge badge-pending">Review</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
