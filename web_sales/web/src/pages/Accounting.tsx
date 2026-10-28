import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useNewParam } from '../hooks/useNewParam';
import { useLedger } from '../context/LedgerContext';
import { Button, Card, PageHeader, StatCard } from '../components/ui/primitives';
import DataTable, { Column } from '../components/ui/DataTable';
import Icon from '../components/ui/Icon';
import { ConfirmModal } from '../components/ui/Modal';
import { OperationFormModal } from '../components/ledger/LedgerForms';
import { ExportButtons, PeriodPicker, SignedAmount } from '../components/ledger/ReportToolbar';
import { formatDate, formatNumber } from '../lib/format';
import { Operation, Period, accountLabel, inPeriod, periodFromPreset, periodText, sortByDate, totalsOf } from '../lib/ledger';

// سجل القيود العام: كل قيود الهاتف والمنصة في مكان واحد (users/{uid}/operations)
const Accounting: React.FC = () => {
  const { operations, accountsById, mainCurrency, deleteOperations, ready } = useLedger();
  const [period, setPeriod] = useState<Period>(periodFromPreset('month'));
  const [q, setQ] = useState('');
  const [dir, setDir] = useState<'all' | 'in' | 'out'>('all');
  const [currency, setCurrency] = useState('');
  const [modal, setModal] = useState<{ open: boolean; op?: Operation | null }>({ open: false });
  const [confirm, setConfirm] = useState<Operation | null>(null);
  useNewParam((k) => k === 'entry' && setModal({ open: true }));

  const currencies = useMemo(() => Array.from(new Set(operations.map((o) => o.currency))).sort(), [operations]);

  const rows = useMemo(() => {
    const s = q.trim();
    return sortByDate(
      operations.filter(
        (o) =>
          inPeriod(o.date, period) &&
          (dir === 'all' || (dir === 'in' ? o.amount >= 0 : o.amount < 0)) &&
          (!currency || o.currency === currency) &&
          (!s || o.statement.includes(s) || accountsById[o.accountId]?.name.includes(s) || o.accountId.includes(s)),
      ),
      'desc',
    );
  }, [operations, period, dir, currency, q, accountsById]);

  const totals = totalsOf(rows);

  const columns: Array<Column<Operation>> = [
    {
      key: 'date',
      header: 'التاريخ',
      className: 'w-44',
      render: (o) => <span className="text-ink-muted">{formatDate(o.date, { dateStyle: 'medium', timeStyle: 'short' })}</span>,
    },
    {
      key: 'acc',
      header: 'الحساب',
      render: (o) => (
        <Link to={`/accounts/${o.accountId}`} onClick={(e) => e.stopPropagation()} className="font-medium text-brand-700 hover:underline">
          {accountLabel(accountsById[o.accountId]) || o.accountId}
        </Link>
      ),
    },
    { key: 'st', header: 'البيان', render: (o) => o.statement || <span className="text-ink-faint">بدون بيان</span> },
    {
      key: 'amt',
      header: 'المبلغ',
      className: 'text-end',
      render: (o) => <SignedAmount value={o.amount} currency={o.currency} />,
    },
    {
      key: 'main',
      header: `المعادل ${mainCurrency}`,
      numeric: true,
      render: (o) => formatNumber(o.amountUSD),
    },
    {
      key: 'del',
      header: '',
      className: 'w-12',
      render: (o) => (
        <button
          onClick={(e) => {
            e.stopPropagation();
            setConfirm(o);
          }}
          title="حذف"
          className="grid h-8 w-8 place-items-center rounded-md text-ink-subtle hover:bg-danger-50 hover:text-danger-600"
        >
          <Icon name="trash" size={15} />
        </button>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="قيود المحاسبة"
        description="كل القيود من الهاتف والمنصة — أي قيد تضيفه أو تعدّله هنا يظهر على الهاتف فوراً"
        actions={
          <Button icon="plusSquare" onClick={() => setModal({ open: true })}>
            قيد جديد
          </Button>
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <StatCard label="مجموع التحصيل (+)" value={formatNumber(totals.collected)} unit={mainCurrency} icon="trendUp" tone="success" />
        <StatCard label="مجموع المصروفات (−)" value={formatNumber(totals.spent)} unit={mainCurrency} icon="coins" tone="danger" />
        <StatCard
          label={totals.net >= 0 ? 'صافي الإيراد' : 'صافي الخسارة'}
          value={formatNumber(Math.abs(totals.net))}
          unit={mainCurrency}
          icon="scale"
          tone={totals.net >= 0 ? 'brand' : 'warning'}
        />
        <StatCard label="عدد القيود" value={formatNumber(totals.count, 0)} icon="receipt" tone="info" hint={periodText(period)} />
      </div>

      <Card className="overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-line px-5 py-4 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Icon name="search" size={16} className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-ink-faint" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="بحث في البيان أو الحساب"
                className="h-9 w-60 rounded-lg border border-line-strong bg-surface pe-3 ps-9 text-sm shadow-sm"
              />
            </div>
            <select
              value={dir}
              onChange={(e) => setDir(e.target.value as typeof dir)}
              className="h-9 rounded-lg border border-line-strong bg-surface pe-8 ps-3 text-sm shadow-sm"
            >
              <option value="all">لنا ولهم</option>
              <option value="in">لنا فقط (+)</option>
              <option value="out">لهم فقط (−)</option>
            </select>
            <select
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              className="h-9 rounded-lg border border-line-strong bg-surface pe-8 ps-3 text-sm shadow-sm"
            >
              <option value="">كل العملات</option>
              {currencies.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <PeriodPicker value={period} onChange={setPeriod} />
            <ExportButtons
              disabled={!rows.length}
              build={() => ({
                title: 'قيود المحاسبة',
                subtitle: periodText(period),
                summary: [
                  ['التحصيل', formatNumber(totals.collected)],
                  ['المصروفات', formatNumber(totals.spent)],
                  ['الصافي', formatNumber(totals.net)],
                ],
                columns: ['التاريخ', 'الحساب', 'البيان', 'المبلغ', 'العملة', `المعادل ${mainCurrency}`],
                numericColumns: [3, 5],
                rows: rows.map((o) => [
                  formatDate(o.date),
                  accountLabel(accountsById[o.accountId]),
                  o.statement,
                  o.amount,
                  o.currency,
                  o.amountUSD,
                ]),
                footer: [['الإجمالي', '', '', '', '', totals.net]],
              })}
            />
          </div>
        </div>
        <DataTable
          columns={columns}
          rows={rows}
          rowKey={(o) => o.id}
          loading={!ready}
          maxHeight="calc(100dvh - 380px)"
          onRowClick={(o) => setModal({ open: true, op: o })}
          empty={{ title: 'لا توجد قيود في هذه الفترة', description: 'غيّر الفترة أو أضف قيداً جديداً.', icon: 'receipt' }}
          mobileCard={(o) => (
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate font-medium text-ink">{accountsById[o.accountId]?.name || o.accountId}</p>
                <p className="truncate text-xs text-ink-subtle">
                  {formatDate(o.date)} · {o.statement || 'بدون بيان'}
                </p>
              </div>
              <SignedAmount value={o.amount} currency={o.currency} />
            </div>
          )}
          footer={
            <tr>
              <td colSpan={3}>الإجمالي ({formatNumber(rows.length, 0)} قيد)</td>
              <td />
              <td className="text-end">
                <span className="num">{formatNumber(totals.net)}</span>
              </td>
              <td />
            </tr>
          }
        />
      </Card>

      <OperationFormModal open={modal.open} operation={modal.op} onClose={() => setModal({ open: false })} />
      <ConfirmModal
        open={!!confirm}
        onClose={() => setConfirm(null)}
        title="حذف القيد"
        message="سيُحذف القيد من المنصة وتطبيق الهاتف."
        onConfirm={() => confirm && deleteOperations([confirm.id])}
      />
    </>
  );
};

export default Accounting;
