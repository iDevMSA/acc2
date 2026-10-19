import React, { useEffect, useMemo, useState } from 'react';
import { db } from '../config/firebase';
import { ref, onValue } from 'firebase/database';
import { useApp } from '../context/AppContext';
import { Badge, Card, CardHeader, EmptyState, PageHeader, StatCard } from '../components/ui/primitives';
import DataTable, { Column } from '../components/ui/DataTable';
import { formatDate, formatNumber, toDate } from '../lib/format';
import { calculateBalanceSheet, calculateIncomeStatement } from '../lib/statements';

const Accounting: React.FC = () => {
  const { user, currency } = useApp();
  const [accounts, setAccounts] = useState<any[]>([]);
  const [journal, setJournal] = useState<any[]>([]);

  useEffect(() => {
    if (!user) return;

    // تحميل الحسابات
    const accountsRef = ref(db, `users/${user.uid}/accounts`);
    const unsubAccounts = onValue(accountsRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        setAccounts(Object.values(data as any));
      }
    });

    // تحميل السجل العام
    const journalRef = ref(db, `users/${user.uid}/journal_entries`);
    const unsubJournal = onValue(journalRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        setJournal(Object.values(data as any));
      }
    });

    return () => {
      unsubAccounts();
      unsubJournal();
    };
  }, [user]);

  const summary = useMemo(() => {
    const bs = calculateBalanceSheet(journal);
    const is = calculateIncomeStatement(journal);
    return { assets: bs.assets, liabilities: bs.liabilities, revenue: is.revenue, expenses: is.expenses };
  }, [journal]);

  const totals = useMemo(
    () => ({
      debit: journal.reduce((s, e) => s + (e.debit || 0), 0),
      credit: journal.reduce((s, e) => s + (e.credit || 0), 0),
    }),
    [journal]
  );

  const journalColumns: Array<Column<any>> = [
    {
      key: 'date',
      header: 'التاريخ',
      className: 'w-40',
      render: (e) => <span className="text-ink-muted">{toDate(e.date) ? formatDate(e.date) : e.date || '—'}</span>,
    },
    { key: 'statement', header: 'البيان', render: (e) => e.statement || '—' },
    { key: 'account', header: 'الحساب', render: (e) => (e.account ? <Badge>{e.account}</Badge> : '—') },
    { key: 'debit', header: 'مدين', numeric: true, className: 'w-36', render: (e) => (e.debit ? formatNumber(e.debit) : '—') },
    { key: 'credit', header: 'دائن', numeric: true, className: 'w-36', render: (e) => (e.credit ? formatNumber(e.credit) : '—') },
  ];

  return (
    <>
      <PageHeader title="المحاسبة" description="دليل الحسابات والسجل العام للقيود" />

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="الأصول" value={formatNumber(summary.assets)} unit={currency} icon="building" tone="brand" />
        <StatCard label="الخصوم" value={formatNumber(summary.liabilities)} unit={currency} icon="scale" tone="warning" />
        <StatCard label="الإيرادات" value={formatNumber(summary.revenue)} unit={currency} icon="trendUp" tone="success" />
        <StatCard label="المصروفات" value={formatNumber(summary.expenses)} unit={currency} icon="coins" tone="danger" />
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[320px_minmax(0,1fr)]">
        {/* دليل الحسابات */}
        <Card className="flex max-h-[640px] flex-col overflow-hidden">
          <CardHeader title="دليل الحسابات" subtitle={`${formatNumber(accounts.length, 0)} حساب`} />
          <div className="flex-1 overflow-y-auto">
            {accounts.length > 0 ? (
              <ul className="divide-y divide-line">
                {accounts.map((acc, idx) => (
                  <li key={idx} className="flex items-center justify-between gap-3 px-5 py-3 hover:bg-slate-50">
                    <div className="min-w-0">
                      <p className="truncate font-medium text-ink">{acc.name || acc.code}</p>
                      {acc.code && acc.name && <p className="num text-xs text-ink-subtle">{acc.code}</p>}
                    </div>
                    <Badge tone="neutral">{acc.category || 'حساب عام'}</Badge>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState icon="ledger" title="لا توجد حسابات" description="أضف الحسابات من التطبيق لتظهر هنا." />
            )}
          </div>
        </Card>

        {/* السجل العام */}
        <Card className="overflow-hidden">
          <CardHeader title="السجل العام" subtitle={`${formatNumber(journal.length, 0)} قيد`} />
          <DataTable
            columns={journalColumns}
            rows={journal}
            rowKey={(_, i) => String(i)}
            maxHeight="560px"
            empty={{ title: 'لا توجد قيود', description: 'ستظهر القيود المحاسبية هنا عند تسجيلها.', icon: 'ledger' }}
            footer={
              <tr>
                <td colSpan={3}>الإجمالي</td>
                <td className="text-end">
                  <span className="num">{formatNumber(totals.debit)}</span>
                </td>
                <td className="text-end">
                  <span className="num">{formatNumber(totals.credit)}</span>
                </td>
              </tr>
            }
          />
        </Card>
      </div>
    </>
  );
};

export default Accounting;
