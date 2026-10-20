import React, { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useLedger } from '../context/LedgerContext';
import { Badge, Card, CardHeader, EmptyState, StatCard, cx } from '../components/ui/primitives';
import DataTable, { Column } from '../components/ui/DataTable';
import Icon from '../components/ui/Icon';
import { ConfirmModal } from '../components/ui/Modal';
import { AccountFormModal, OperationFormModal } from '../components/ledger/LedgerForms';
import { ExportButtons, PeriodPicker, SignedAmount } from '../components/ledger/ReportToolbar';
import { formatDate, formatNumber } from '../lib/format';
import {
  CATEGORY_LABELS,
  Operation,
  Period,
  ROLE_LABELS,
  TYPE_LABELS,
  inPeriod,
  openingBalance,
  periodFromPreset,
  periodText,
  sortByDate,
  totalsOf,
} from '../lib/ledger';
import { ReportTable, shareWhatsApp } from '../lib/export';

type ReportType = 'statement' | 'byCurrency' | 'credit' | 'debit' | 'monthly';

const REPORT_TYPES: Array<{ value: ReportType; label: string; description: string }> = [
  { value: 'statement', label: 'كشف حساب تفصيلي', description: 'كل الحركات مع الرصيد التراكمي' },
  { value: 'byCurrency', label: 'كشف حسب العملة', description: 'حركات كل عملة ورصيدها على حدة' },
  { value: 'credit', label: 'حركات لنا فقط', description: 'القيود الموجبة (التحصيل)' },
  { value: 'debit', label: 'حركات لهم فقط', description: 'القيود السالبة (الصرف)' },
  { value: 'monthly', label: 'ملخص شهري', description: 'التحصيل والصرف والصافي لكل شهر' },
];

interface Row extends Operation {
  running: number;
}

const AccountDetail: React.FC = () => {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const { accountsById, opsByAccount, mainCurrency, roleOf, deleteAccount, deleteOperations, ready, cashboxes, phoneCashboxes } =
    useLedger();
  const account = accountsById[id];
  const allOps = useMemo(() => sortByDate(opsByAccount[id] || []), [opsByAccount, id]);

  const [period, setPeriod] = useState<Period>(periodFromPreset('all'));
  const [reportType, setReportType] = useState<ReportType>('statement');
  const [editAccount, setEditAccount] = useState(false);
  const [opModal, setOpModal] = useState<{ open: boolean; op?: Operation | null }>({ open: false });
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleteOp, setDeleteOp] = useState<Operation | null>(null);

  const balance = useMemo(() => {
    const byCurrency: Record<string, number> = {};
    let total = 0;
    allOps.forEach((o) => {
      total += o.amountUSD;
      byCurrency[o.currency] = (byCurrency[o.currency] || 0) + o.amount;
    });
    return { total, byCurrency };
  }, [allOps]);

  const opening = useMemo(() => openingBalance(allOps, period), [allOps, period]);
  const periodOps = useMemo(() => allOps.filter((o) => inPeriod(o.date, period)), [allOps, period]);
  const totals = useMemo(() => totalsOf(periodOps), [periodOps]);

  const shownOps = useMemo(() => {
    const base =
      reportType === 'credit'
        ? periodOps.filter((o) => o.amount >= 0)
        : reportType === 'debit'
          ? periodOps.filter((o) => o.amount < 0)
          : periodOps;
    let running = reportType === 'statement' ? opening : 0;
    return base.map((o) => ({ ...o, running: (running += o.amountUSD) }) as Row);
  }, [periodOps, reportType, opening]);

  const monthly = useMemo(() => {
    const m: Record<string, { collected: number; spent: number; count: number }> = {};
    periodOps.forEach((o) => {
      const k = o.date.slice(0, 7);
      const r = (m[k] ??= { collected: 0, spent: 0, count: 0 });
      if (o.amountUSD >= 0) r.collected += o.amountUSD;
      else r.spent -= o.amountUSD;
      r.count += 1;
    });
    let running = opening;
    return Object.keys(m)
      .sort()
      .map((k) => ({ month: k, ...m[k], net: m[k].collected - m[k].spent, running: (running += m[k].collected - m[k].spent) }));
  }, [periodOps, opening]);

  const linkedBoxes = useMemo(
    () => [...cashboxes, ...phoneCashboxes].filter((b) => b.linkedAccountIds.includes(id) || b.cashAccountId === id),
    [cashboxes, phoneCashboxes, id],
  );

  if (!account) {
    return (
      <Card>
        {ready ? (
          <EmptyState icon="ledger" title="الحساب غير موجود" description="ربما حُذف من التطبيق أو من جهاز آخر." />
        ) : (
          <EmptyState icon="ledger" title="جاري التحميل..." />
        )}
        <div className="pb-8 text-center">
          <Link to="/accounts" className="text-sm font-medium text-brand-600">
            العودة إلى الحسابات
          </Link>
        </div>
      </Card>
    );
  }

  const closing = opening + totals.net;
  const typeMeta = REPORT_TYPES.find((t) => t.value === reportType)!;

  const buildReport = (): ReportTable => {
    const head = `${account.code ? `${account.code} - ` : ''}${account.name} (رقم ${account.id})`;
    const subtitle = `${head} · ${periodText(period)} · العملة الرئيسية ${mainCurrency}`;
    const summary: Array<[string, string]> = [
      ['الرصيد الافتتاحي', formatNumber(opening)],
      ['مجموع التحصيل (لنا)', formatNumber(totals.collected)],
      ['مجموع الصرف (لهم)', formatNumber(totals.spent)],
      [totals.net >= 0 ? 'صافي الإيراد' : 'صافي الخسارة', formatNumber(Math.abs(totals.net))],
      ['الرصيد الختامي', `${formatNumber(Math.abs(closing))} ${closing >= 0 ? 'لنا' : 'لهم'}`],
    ];
    if (reportType === 'monthly') {
      return {
        title: 'ملخص شهري للحساب',
        subtitle,
        summary,
        columns: ['الشهر', 'عدد القيود', 'التحصيل', 'الصرف', 'الصافي', 'الرصيد'],
        numericColumns: [1, 2, 3, 4, 5],
        rows: monthly.map((m) => [m.month, String(m.count), m.collected, m.spent, m.net, m.running]),
        footer: [['الإجمالي', String(totals.count), totals.collected, totals.spent, totals.net, closing]],
      };
    }
    if (reportType === 'byCurrency') {
      const currencies = Array.from(new Set(periodOps.map((o) => o.currency)));
      return {
        title: 'كشف حساب حسب العملة',
        subtitle,
        summary,
        columns: ['التاريخ', 'البيان', 'لنا', 'لهم', 'الرصيد'],
        numericColumns: [2, 3, 4],
        rows: [],
        sections: currencies.map((c) => {
          let r = 0;
          const ops = periodOps.filter((o) => o.currency === c);
          return {
            heading: `العملة: ${c}`,
            rows: ops.map((o) => [
              formatDate(o.date),
              o.statement || '—',
              o.amount >= 0 ? o.amount : '',
              o.amount < 0 ? -o.amount : '',
              (r += o.amount),
            ]),
            footer: [['', `رصيد ${c}`, '', '', r]],
          };
        }),
      };
    }
    return {
      title: typeMeta.label,
      subtitle,
      summary,
      columns: ['التاريخ', 'البيان', 'لنا', 'لهم', 'العملة', 'سعر الصرف', `المعادل ${mainCurrency}`, 'الرصيد'],
      numericColumns: [2, 3, 5, 6, 7],
      rows: [
        ...(reportType === 'statement' && period.from ? [['', 'رصيد افتتاحي', '', '', '', '', '', opening] as Array<string | number>] : []),
        ...shownOps.map((o) => [
          formatDate(o.date),
          o.statement || '—',
          o.amount >= 0 ? o.amount : '',
          o.amount < 0 ? -o.amount : '',
          o.currency,
          o.exchangeRate,
          o.amountUSD,
          o.running,
        ]),
      ],
      footer: [['', 'الإجمالي', '', '', '', '', shownOps.reduce((s, o) => s + o.amountUSD, 0), reportType === 'statement' ? closing : '']],
    };
  };

  const sendWhatsApp = () => {
    const lines = [
      `كشف رصيد: ${account.name}`,
      `الرصيد: ${formatNumber(Math.abs(balance.total))} ${mainCurrency} ${balance.total >= 0 ? '(لنا)' : '(لهم)'}`,
      ...Object.entries(balance.byCurrency).map(([c, v]) => `• ${c}: ${formatNumber(Math.abs(v))} ${v >= 0 ? 'لنا' : 'لهم'}`),
    ];
    shareWhatsApp(lines.join('\n'), account.phone);
  };

  const columns: Array<Column<Row>> = [
    {
      key: 'date',
      header: 'التاريخ',
      className: 'w-36',
      render: (o) => <span className="text-ink-muted">{formatDate(o.date, { dateStyle: 'medium' })}</span>,
    },
    { key: 'statement', header: 'البيان', render: (o) => o.statement || <span className="text-ink-faint">بدون بيان</span> },
    {
      key: 'in',
      header: 'لنا',
      numeric: true,
      className: 'w-32',
      render: (o) => (o.amount >= 0 ? <span className="text-success-700">{formatNumber(o.amount)}</span> : '—'),
    },
    {
      key: 'out',
      header: 'لهم',
      numeric: true,
      className: 'w-32',
      render: (o) => (o.amount < 0 ? <span className="text-danger-700">{formatNumber(-o.amount)}</span> : '—'),
    },
    {
      key: 'cur',
      header: 'العملة / الصرف',
      className: 'w-32',
      render: (o) => (
        <span className="num text-xs text-ink-muted">
          {o.currency}
          {o.exchangeRate !== 1 && ` · ${formatNumber(o.exchangeRate, 2)}`}
        </span>
      ),
    },
    {
      key: 'main',
      header: `المعادل ${mainCurrency}`,
      numeric: true,
      className: 'w-32',
      render: (o) => formatNumber(o.amountUSD),
    },
    {
      key: 'running',
      header: 'الرصيد',
      className: 'w-36 text-end',
      render: (o) => <SignedAmount value={o.running} />,
    },
    {
      key: 'actions',
      header: '',
      className: 'w-20',
      render: (o) => (
        <div className="flex justify-end gap-1">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setOpModal({ open: true, op: o });
            }}
            title="تعديل"
            className="grid h-8 w-8 place-items-center rounded-md text-ink-subtle hover:bg-slate-100 hover:text-brand-600"
          >
            <Icon name="edit" size={15} />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setDeleteOp(o);
            }}
            title="حذف"
            className="grid h-8 w-8 place-items-center rounded-md text-ink-subtle hover:bg-danger-50 hover:text-danger-600"
          >
            <Icon name="trash" size={15} />
          </button>
        </div>
      ),
    },
  ];

  return (
    <>
      {/* الترويسة */}
      <div className="mb-6 overflow-hidden rounded-2xl bg-gradient-to-br from-brand-800 to-brand-950 text-white shadow-card">
        <div className="flex flex-wrap items-start justify-between gap-4 px-6 pb-4 pt-5">
          <div className="min-w-0">
            <Link to="/accounts" className="mb-2 inline-flex items-center gap-1 text-xs text-white/60 hover:text-white">
              <Icon name="chevronLeft" size={14} className="rotate-180" /> الحسابات
            </Link>
            <h1 className="truncate text-2xl font-bold">{account.name}</h1>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-white/75">
              <span className="num rounded-full bg-white/15 px-2.5 py-0.5">رقم {account.id}</span>
              {account.code && <span className="num rounded-full bg-white/15 px-2.5 py-0.5">رمز {account.code}</span>}
              <span className="rounded-full bg-white/15 px-2.5 py-0.5">{CATEGORY_LABELS[account.category] || 'أخرى'}</span>
              <span className="rounded-full bg-white/15 px-2.5 py-0.5">{TYPE_LABELS[account.type] || account.type}</span>
              <span className="rounded-full bg-white/15 px-2.5 py-0.5">
                {ROLE_LABELS[roleOf(account.id) as keyof typeof ROLE_LABELS]}
              </span>
              {account.phone && (
                <span className="num" dir="ltr">
                  {account.phone}
                </span>
              )}
              {linkedBoxes.map((b) => (
                <span key={b.id} className="inline-flex items-center gap-1 rounded-full bg-white/15 px-2.5 py-0.5">
                  <Icon name="wallet" size={12} /> {b.name}
                </span>
              ))}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setOpModal({ open: true, op: null })}
              className="inline-flex h-9 items-center gap-2 rounded-lg bg-white px-3.5 text-sm font-semibold text-brand-800 hover:bg-brand-50"
            >
              <Icon name="plusSquare" size={16} /> قيد جديد
            </button>
            <HeaderIcon icon="share" title="إرسال الرصيد واتساب" onClick={sendWhatsApp} />
            <HeaderIcon icon="edit" title="تعديل الحساب" onClick={() => setEditAccount(true)} />
            <HeaderIcon icon="trash" title="حذف الحساب" onClick={() => setConfirmDelete(true)} danger />
          </div>
        </div>
        <div className="flex flex-wrap items-end gap-6 border-t border-white/10 bg-white/5 px-6 py-4">
          <div>
            <p className="text-xs text-white/60">الرصيد الإجمالي بـ {mainCurrency}</p>
            <p className="mt-1 flex items-baseline gap-2">
              <span className={cx('num text-3xl font-bold', balance.total >= 0 ? 'text-emerald-300' : 'text-rose-300')}>
                {formatNumber(Math.abs(balance.total))}
              </span>
              <span className="text-sm text-white/70">{balance.total >= 0 ? 'لنا' : 'لهم'}</span>
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {Object.entries(balance.byCurrency).map(([c, v]) => (
              <div
                key={c}
                className={cx(
                  'rounded-xl border px-3 py-1.5 text-center',
                  v >= 0 ? 'border-emerald-300/40 bg-emerald-400/10' : 'border-rose-300/40 bg-rose-400/10',
                )}
              >
                <p className="text-[10px] text-white/60">{c}</p>
                <p className={cx('text-sm font-bold', v >= 0 ? 'text-emerald-200' : 'text-rose-200')}>
                  {v >= 0 ? 'لنا' : 'لهم'} <span className="num">{formatNumber(Math.abs(v))}</span>
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* لوحة التقرير */}
      <Card className="mb-6">
        <div className="flex flex-col gap-4 px-5 py-4 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-sm font-semibold text-ink">نوع التقرير</span>
            <div className="flex flex-wrap gap-1.5">
              {REPORT_TYPES.map((t) => (
                <button
                  key={t.value}
                  onClick={() => setReportType(t.value)}
                  title={t.description}
                  className={cx(
                    'h-8 rounded-lg px-3 text-xs font-medium transition',
                    reportType === t.value
                      ? 'bg-brand-600 text-white shadow-sm'
                      : 'border border-line-strong bg-surface text-ink-muted hover:bg-slate-50',
                  )}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <PeriodPicker value={period} onChange={setPeriod} />
            <ExportButtons build={buildReport} disabled={periodOps.length === 0} />
          </div>
        </div>
      </Card>

      <div className="mb-6 grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-5">
        <StatCard label="رصيد افتتاحي" value={formatNumber(opening)} unit={mainCurrency} icon="calendar" tone="neutral" />
        <StatCard label="التحصيل (لنا)" value={formatNumber(totals.collected)} unit={mainCurrency} icon="trendUp" tone="success" />
        <StatCard label="الصرف (لهم)" value={formatNumber(totals.spent)} unit={mainCurrency} icon="coins" tone="danger" />
        <StatCard
          label={totals.net >= 0 ? 'صافي الإيراد' : 'صافي الخسارة'}
          value={formatNumber(Math.abs(totals.net))}
          unit={mainCurrency}
          icon="scale"
          tone={totals.net >= 0 ? 'brand' : 'warning'}
        />
        <StatCard
          label="الرصيد الختامي"
          value={formatNumber(Math.abs(closing))}
          unit={closing >= 0 ? `${mainCurrency} لنا` : `${mainCurrency} لهم`}
          icon="wallet"
          tone={closing >= 0 ? 'success' : 'danger'}
        />
      </div>

      <Card className="overflow-hidden">
        <CardHeader
          title={typeMeta.label}
          subtitle={`${typeMeta.description} · ${periodText(period)} · ${formatNumber(periodOps.length, 0)} قيد`}
        />
        {reportType === 'monthly' ? (
          <DataTable
            columns={[
              { key: 'm', header: 'الشهر', render: (m) => <span className="num font-medium">{m.month}</span> },
              { key: 'c', header: 'القيود', numeric: true, render: (m) => formatNumber(m.count, 0) },
              { key: 'in', header: 'التحصيل', numeric: true, render: (m) => formatNumber(m.collected) },
              { key: 'out', header: 'الصرف', numeric: true, render: (m) => formatNumber(m.spent) },
              { key: 'net', header: 'الصافي', className: 'text-end', render: (m) => <SignedAmount value={m.net} /> },
              { key: 'r', header: 'الرصيد', className: 'text-end', render: (m) => <SignedAmount value={m.running} /> },
            ]}
            rows={monthly}
            rowKey={(m) => m.month}
            empty={{ title: 'لا توجد حركات في هذه الفترة', icon: 'calendar' }}
          />
        ) : reportType === 'byCurrency' ? (
          <div className="divide-y divide-line">
            {Array.from(new Set(periodOps.map((o) => o.currency))).map((c) => {
              let r = 0;
              const ops = periodOps.filter((o) => o.currency === c).map((o) => ({ ...o, running: (r += o.amount) }));
              return (
                <div key={c}>
                  <div className="flex items-center justify-between bg-slate-50 px-5 py-2.5">
                    <Badge tone="brand">{c}</Badge>
                    <SignedAmount value={r} currency={c} label />
                  </div>
                  <DataTable columns={columns.filter((col) => !['cur', 'main'].includes(col.key))} rows={ops} rowKey={(o) => o.id} />
                </div>
              );
            })}
            {periodOps.length === 0 && <EmptyState icon="calendar" title="لا توجد حركات في هذه الفترة" />}
          </div>
        ) : (
          <DataTable
            columns={columns}
            rows={shownOps}
            rowKey={(o) => o.id}
            maxHeight="640px"
            onRowClick={(o) => setOpModal({ open: true, op: o })}
            empty={{
              title: 'لا توجد قيود في هذه الفترة',
              description: 'أضف قيداً من زر "قيد جديد" وسيظهر على الهاتف أيضاً.',
              icon: 'ledger',
            }}
            mobileCard={(o) => (
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-medium text-ink">{o.statement || 'بدون بيان'}</p>
                  <p className="mt-0.5 text-xs text-ink-subtle">{formatDate(o.date)}</p>
                </div>
                <div className="text-end">
                  <SignedAmount value={o.amount} currency={o.currency} />
                  <p className="text-[11px] text-ink-subtle">
                    الرصيد <span className="num">{formatNumber(o.running)}</span>
                  </p>
                </div>
              </div>
            )}
            footer={
              <tr>
                <td colSpan={2}>الإجمالي</td>
                <td className="text-end">
                  <span className="num text-success-700">{formatNumber(totals.collected)}</span>
                </td>
                <td className="text-end">
                  <span className="num text-danger-700">{formatNumber(totals.spent)}</span>
                </td>
                <td />
                <td className="text-end">
                  <span className="num">{formatNumber(totals.net)}</span>
                </td>
                <td className="text-end">{reportType === 'statement' && <SignedAmount value={closing} />}</td>
                <td />
              </tr>
            }
          />
        )}
      </Card>

      <AccountFormModal open={editAccount} onClose={() => setEditAccount(false)} account={account} />
      <OperationFormModal
        open={opModal.open}
        onClose={() => setOpModal({ open: false })}
        accountId={account.id}
        operation={opModal.op}
      />
      <ConfirmModal
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title="حذف الحساب"
        message={
          <>
            سيُحذف حساب <b>{account.name}</b> و<b>{formatNumber(allOps.length, 0)}</b> قيد مرتبط به من المنصة وتطبيق الهاتف.
            لا يمكن التراجع.
          </>
        }
        onConfirm={() => deleteAccount(account.id).then(() => navigate('/accounts'))}
      />
      <ConfirmModal
        open={!!deleteOp}
        onClose={() => setDeleteOp(null)}
        title="حذف القيد"
        message={
          deleteOp && (
            <>
              حذف القيد <b>{deleteOp.statement || 'بدون بيان'}</b> بمبلغ{' '}
              <b className="num">
                {formatNumber(deleteOp.amount)} {deleteOp.currency}
              </b>
              ؟ سيُحذف من الهاتف أيضاً.
            </>
          )
        }
        onConfirm={() => deleteOp && deleteOperations([deleteOp.id])}
      />
    </>
  );
};

const HeaderIcon: React.FC<{ icon: 'share' | 'edit' | 'trash'; title: string; onClick: () => void; danger?: boolean }> = ({
  icon,
  title,
  onClick,
  danger,
}) => (
  <button
    onClick={onClick}
    title={title}
    aria-label={title}
    className={cx(
      'grid h-9 w-9 place-items-center rounded-lg bg-white/10 text-white transition hover:bg-white/20',
      danger && 'hover:bg-rose-500/40',
    )}
  >
    <Icon name={icon} size={17} />
  </button>
);

export default AccountDetail;
