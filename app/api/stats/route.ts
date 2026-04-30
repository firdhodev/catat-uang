import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

// GET /api/stats - statistik untuk dashboard
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const month = searchParams.get('month') || new Date().toISOString().slice(0, 7); // YYYY-MM

  const start = `${month}-01T00:00:00+07:00`;
  // Get last day of month
  const [year, mon] = month.split('-').map(Number);
  const lastDay = new Date(year, mon, 0).getDate();
  const end = `${month}-${lastDay}T23:59:59+07:00`;

  // Total income & expense for month
  const { data: monthData } = await supabase
    .from('transactions')
    .select('amount, type')
    .gte('transaction_date', start)
    .lte('transaction_date', end);

  const totalIncome = monthData?.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0) || 0;
  const totalExpense = monthData?.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0) || 0;

  // Category breakdown for expenses
  const { data: categoryData } = await supabase
    .from('transactions')
    .select('category, amount, type')
    .eq('type', 'expense')
    .gte('transaction_date', start)
    .lte('transaction_date', end);

  const categoryMap: Record<string, number> = {};
  categoryData?.forEach(t => {
    categoryMap[t.category] = (categoryMap[t.category] || 0) + t.amount;
  });
  const byCategory = Object.entries(categoryMap)
    .map(([category, amount]) => ({ category, amount }))
    .sort((a, b) => b.amount - a.amount);

  // Daily data for chart (last 30 days)
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const { data: dailyData } = await supabase
    .from('transactions')
    .select('amount, type, transaction_date')
    .gte('transaction_date', thirtyDaysAgo.toISOString())
    .order('transaction_date', { ascending: true });

  const dailyMap: Record<string, { income: number; expense: number }> = {};
  dailyData?.forEach(t => {
    const day = t.transaction_date.slice(0, 10);
    if (!dailyMap[day]) dailyMap[day] = { income: 0, expense: 0 };
    if (t.type === 'income') dailyMap[day].income += t.amount;
    else dailyMap[day].expense += t.amount;
  });
  const byDay = Object.entries(dailyMap).map(([date, values]) => ({ date, ...values }));

  // Pending emails count
  const { count: pendingCount } = await supabase
    .from('pending_emails')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'pending');

  // Recent transactions
  const { data: recentTx } = await supabase
    .from('transactions')
    .select('*')
    .order('transaction_date', { ascending: false })
    .limit(5);

  return NextResponse.json({
    month,
    totalIncome,
    totalExpense,
    balance: totalIncome - totalExpense,
    byCategory,
    byDay,
    pendingEmails: pendingCount || 0,
    recentTransactions: recentTx || [],
  });
}
