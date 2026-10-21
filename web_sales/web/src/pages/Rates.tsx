import React, { useMemo, useState } from 'react';
import { useLedger } from '../context/LedgerContext';
import { Button, Card, CardHeader, EmptyState, PageHeader, cx } from '../components/ui/primitives';
import DataTable, { Column } from '../components/ui/DataTable';
import Icon from '../components/ui/Icon';
import { ConfirmModal } from '../components/ui/Modal';
import { ExportButtons } from '../components/ledger/ReportToolbar';
import { RateFormModal } from '../components/trade/AdminForms';
import { LineChart } from '../components/trade/Charts';
import { formatDate, formatNumber } from '../lib/format';
import { RateEntry } from '../lib/trade';

// أسعار العملات حسب التاريخ والساعة (كما في الأصيل) — تُستخدم تلقائياً في الفواتير والإشعارات.
// نعرض أيضاً متوسط الأسعار الفعلية المستخدمة في قيود الهاتف لكل عملة.

const Rates: React.FC = () => {
  const { rates, operations, mainCurrency, deleteRate } = useLedger();
  const [modal, setModal] = useState<{ open: boolean; currency?: string }>({ open: false });
  const [selected, setSelected] = useState('');
  const [confirm, setConfirm] = useState<RateEntry | null>(null);

  const currencies = useMemo(() => {
    const map = new Map<string, { last?: RateEntry; count: number; used: number[] }>();
    rates.forEach((r) => {
      const x = map.get(r.currency) || { count: 0, used: [] };
      if (!x.last || r.date > x.last.date) x.last = r;
      x.count += 1;
      map.set(r.currency, x);
    });
    operations.forEach((o) => {
      if (o.currency === mainCurrency || !(o.exchangeRate > 0)) return;
      const x = map.get(o.currency) || { count: 0, used: [] };
      x.used.push(o.exchangeRate);
      map.set(o.currency, x);
    });
    return Array.from(map.entries()).map(([currency, x]) => ({
      currency,
      last: x.last,
      count: x.count,
      avgUsed: x.used.length ? x.used.reduce((s, v) => s + v, 0) / x.used.length : 0,
      usedCount: x.used.length,
    }));
  }, [rates, operations, mainCurrency]);

  const current = selected || currencies[0]?.currency || '';
  const history = rates.filter((r) => r.currency === current);
  const chart = [...history].sort((a, b) => a.date.localeCompare(b.date)).map((r) => ({ label: r.date.slice(0, 10), value: r.rate }));

  const columns: Array<Column<RateEntry>> = [
    { key: 'd', header: 'التاريخ والساعة', render: (r) => <span className="num">{formatDate(r.date, { dateStyle: 'medium', timeStyle: 'short' })}</span> },
    { key: 'r', header: `السعر (${current} لكل 1 ${mainCurrency})`, numeric: true, render: (r) => formatNumber(r.rate, 4) },
    {
      key: 'del',
      header: '',
      className: 'w-12',
      render: (r) => (
        <button onClick={() => setConfirm(r)} title="حذف" className="grid h-8 w-8 place-items-center rounded-md text-ink-subtle hover:bg-danger-50 hover:text-danger-600">
          <Icon name="trash" size={15} />
        </button>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="أسعار العملات"
        description={`أسعار الصرف حسب التاريخ مقابل ${mainCurrency} — تُعبّأ تلقائياً في الفواتير والإشعارات`}
        actions={
          <Button icon="plus" onClick={() => setModal({ open: true, currency: current || undefined })}>
            سعر جديد
          </Button>
        }
      />
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[320px_minmax(0,1fr)]">
        <Card className="h-fit overflow-hidden">
          <CardHeader title="العملات" subtitle="آخر سعر مسجّل ومتوسط الأسعار في قيود الهاتف" />
          {currencies.length ? (
            <ul className="divide-y divide-line">
              {currencies.map((c) => (
                <li key={c.currency}>
                  <button
                    onClick={() => setSelected(c.currency)}
                    className={cx('flex w-full items-center justify-between gap-3 px-5 py-3 text-start hover:bg-slate-50', c.currency === current && 'bg-brand-50')}
                  >
                    <div>
                      <p className="font-semibold">{c.currency}</p>
                      <p className="text-xs text-ink-subtle">
                        {c.count} سعر مسجّل{c.usedCount ? ` · ${c.usedCount} قيد` : ''}
                      </p>
                    </div>
                    <div className="text-end">
                      <p className="num font-semibold">{c.last ? formatNumber(c.last.rate, 4) : '—'}</p>
                      {c.avgUsed > 0 && <p className="num text-[11px] text-ink-subtle">متوسط القيود {formatNumber(c.avgUsed, 4)}</p>}
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState icon="coins" title="لا توجد أسعار بعد" description="سجّل سعر أول عملة من الزر في الأعلى." />
          )}
        </Card>
        <div className="space-y-6">
          {chart.length > 1 && (
            <Card className="p-5">
              <p className="mb-3 text-sm font-semibold">تغيّر سعر {current}</p>
              <LineChart data={chart} height={200} digits={4} />
            </Card>
          )}
          <Card className="overflow-hidden">
            <div className="flex items-center justify-between border-b border-line px-5 py-4">
              <p className="text-sm font-semibold">سجل أسعار {current || '—'}</p>
              <ExportButtons
                disabled={!history.length}
                build={() => ({
                  title: `أسعار ${current}`,
                  subtitle: `مقابل ${mainCurrency}`,
                  columns: ['التاريخ', 'السعر'],
                  numericColumns: [1],
                  rows: history.map((r) => [r.date.slice(0, 16).replace('T', ' '), r.rate]),
                })}
              />
            </div>
            <DataTable columns={columns} rows={history} rowKey={(r) => r.id} empty={{ title: 'لا توجد أسعار مسجّلة لهذه العملة', icon: 'coins' }} />
          </Card>
        </div>
      </div>
      <RateFormModal open={modal.open} currency={modal.currency} onClose={() => setModal({ open: false })} />
      <ConfirmModal open={!!confirm} onClose={() => setConfirm(null)} title="حذف السعر" message="سيُحذف هذا السعر من الجدول (لا يؤثر على القيود المسجّلة)." onConfirm={() => confirm && deleteRate(confirm.id)} />
    </>
  );
};

export default Rates;
