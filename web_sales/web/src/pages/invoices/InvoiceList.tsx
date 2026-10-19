import React, { useMemo, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { Badge, Button, Card, StatCard, cx } from '../../components/ui/primitives';
import DataTable, { Column } from '../../components/ui/DataTable';
import Drawer from '../../components/ui/Drawer';
import Icon from '../../components/ui/Icon';
import { formatDate, formatMoney, formatNumber, toDate } from '../../lib/format';
import {
  InvoiceStatus,
  PAYMENT_LABELS,
  PaymentMethod,
  STATUS_META,
  SalesInvoice,
  invoiceAmounts,
  itemSubtotal,
  itemVat,
  useSalesInvoices,
} from '../../lib/salesInvoices';

type Period = 'today' | '7d' | 'month' | 'all';

const PERIODS: Array<{ value: Period; label: string }> = [
  { value: 'today', label: 'اليوم' },
  { value: '7d', label: 'آخر 7 أيام' },
  { value: 'month', label: 'هذا الشهر' },
  { value: 'all', label: 'الكل' },
];

const PAGE_SIZE = 50;

const periodStart = (p: Period): number | null => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  if (p === 'today') return d.getTime();
  if (p === '7d') return d.getTime() - 6 * 86400000;
  if (p === 'month') return new Date(d.getFullYear(), d.getMonth(), 1).getTime();
  return null;
};

const invoiceTime = (inv: SalesInvoice) => toDate(inv.createdAt || inv.date)?.getTime() ?? 0;
const statusOf = (inv: SalesInvoice): InvoiceStatus => inv.status ?? 'closed';
const paymentOf = (inv: SalesInvoice): PaymentMethod => inv.paymentMethod ?? 'cash';

const csvCell = (v: unknown) => {
  const s = v === null || v === undefined ? '' : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

const exportCsv = (rows: SalesInvoice[]) => {
  const header = [
    'رقم الفاتورة',
    'التاريخ',
    'العميل',
    'الجوال',
    'الكاشير',
    'الدفع',
    'الحالة',
    'قبل الضريبة',
    'الضريبة',
    'الخصم',
    'الإجمالي',
  ];
  const lines = rows.map((inv) => {
    const a = invoiceAmounts(inv);
    return [
      inv.number || inv.id,
      inv.createdAt || inv.date || '',
      inv.customerName || '',
      inv.customerPhone || '',
      inv.createdByName || '',
      PAYMENT_LABELS[paymentOf(inv)],
      STATUS_META[statusOf(inv)]?.label || inv.status,
      a.subtotal.toFixed(2),
      a.vat.toFixed(2),
      a.discount.toFixed(2),
      a.total.toFixed(2),
    ]
      .map(csvCell)
      .join(',');
  });
  // BOM حتى يفتح Excel الملف بالعربية بشكل صحيح
  const blob = new Blob(['﻿' + [header.join(','), ...lines].join('\n')], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `invoices-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
};

const InvoiceList: React.FC = () => {
  const { user, currency } = useApp();
  const { invoices, loading } = useSalesInvoices(user?.uid || null);
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<InvoiceStatus | 'all'>('all');
  const [payment, setPayment] = useState<PaymentMethod | 'all'>('all');
  const [period, setPeriod] = useState<Period>('all');
  const [limit, setLimit] = useState(PAGE_SIZE);
  const [selected, setSelected] = useState<SalesInvoice | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const from = periodStart(period);
    return invoices
      .filter((inv) => status === 'all' || statusOf(inv) === status)
      .filter((inv) => payment === 'all' || paymentOf(inv) === payment)
      .filter((inv) => from === null || invoiceTime(inv) >= from)
      .filter(
        (inv) =>
          !q ||
          [inv.number, inv.id, inv.customerName, inv.customerPhone].some(
            (v) => v && String(v).toLowerCase().includes(q),
          ),
      )
      .sort((a, b) => invoiceTime(b) - invoiceTime(a));
  }, [invoices, query, status, payment, period]);

  const summary = useMemo(() => {
    const closed = filtered.filter((inv) => statusOf(inv) === 'closed');
    const amounts = closed.map(invoiceAmounts);
    return {
      count: filtered.length,
      closedCount: closed.length,
      total: amounts.reduce((s, a) => s + a.total, 0),
      vat: amounts.reduce((s, a) => s + a.vat, 0),
      cancelled: filtered.filter((inv) => statusOf(inv) === 'cancelled').length,
    };
  }, [filtered]);

  const visible = filtered.slice(0, limit);
  const filtersActive = query || status !== 'all' || payment !== 'all' || period !== 'all';

  const columns: Array<Column<SalesInvoice>> = [
    {
      key: 'number',
      header: 'رقم الفاتورة',
      render: (inv) => <span className="num whitespace-nowrap font-medium text-brand-700">{inv.number || inv.id}</span>,
    },
    {
      key: 'date',
      header: 'التاريخ',
      render: (inv) => (
        <span className="whitespace-nowrap text-ink-muted">
          {formatDate(inv.createdAt || inv.date, { dateStyle: 'medium', timeStyle: 'short' })}
        </span>
      ),
    },
    {
      key: 'customer',
      header: 'العميل',
      render: (inv) =>
        inv.customerName ? (
          <div className="min-w-0">
            <p className="truncate">{inv.customerName}</p>
            {inv.customerPhone && (
              <p className="num text-xs text-ink-subtle" dir="ltr">
                {inv.customerPhone}
              </p>
            )}
          </div>
        ) : (
          <span className="text-ink-faint">عميل نقدي</span>
        ),
    },
    {
      key: 'cashier',
      header: 'الكاشير',
      className: 'hidden xl:table-cell',
      render: (inv) => <span className="text-ink-muted">{inv.createdByName || '—'}</span>,
    },
    {
      key: 'payment',
      header: 'الدفع',
      className: 'hidden lg:table-cell',
      render: (inv) => <Badge tone="neutral">{PAYMENT_LABELS[paymentOf(inv)]}</Badge>,
    },
    {
      key: 'status',
      header: 'الحالة',
      render: (inv) => {
        const meta = STATUS_META[statusOf(inv)];
        return meta ? <Badge tone={meta.tone}>{meta.label}</Badge> : <Badge>{inv.status}</Badge>;
      },
    },
    {
      key: 'total',
      header: 'الإجمالي',
      numeric: true,
      render: (inv) => (
        <span className={statusOf(inv) === 'cancelled' ? 'text-ink-faint line-through' : ''}>
          {formatNumber(invoiceAmounts(inv).total)}
        </span>
      ),
    },
  ];

  return (
    <>
      <div className="mb-6 grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <StatCard
          label="المبيعات (فواتير مغلقة)"
          value={formatNumber(summary.total)}
          unit={currency}
          icon="wallet"
          tone="brand"
        />
        <StatCard
          label="عدد الفواتير"
          value={formatNumber(summary.count, 0)}
          hint={`${formatNumber(summary.closedCount, 0)} مغلقة`}
          icon="receipt"
          tone="info"
        />
        <StatCard
          label="ضريبة القيمة المضافة"
          value={formatNumber(summary.vat)}
          unit={currency}
          icon="percent"
          tone="warning"
        />
        <StatCard label="فواتير ملغاة" value={formatNumber(summary.cancelled, 0)} icon="alert" tone="danger" />
      </div>

      <Card className="overflow-hidden">
        {/* شريط الفلاتر */}
        <div className="flex flex-wrap items-center gap-2 border-b border-line p-3 sm:gap-3 sm:p-4">
          <div className="relative w-full min-w-[220px] sm:w-auto sm:flex-1">
            <Icon
              name="search"
              size={16}
              className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-ink-faint"
            />
            <input
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setLimit(PAGE_SIZE);
              }}
              placeholder="ابحث برقم الفاتورة أو اسم العميل أو الجوال"
              className="field-input py-2 ps-9"
            />
          </div>
          <div
            className="flex w-full rounded-lg border border-line-strong bg-surface p-0.5 sm:w-auto"
            role="group"
            aria-label="الفترة"
          >
            {PERIODS.map((p) => (
              <button
                key={p.value}
                onClick={() => {
                  setPeriod(p.value);
                  setLimit(PAGE_SIZE);
                }}
                className={cx(
                  'h-9 flex-1 whitespace-nowrap rounded-md px-3 text-xs font-medium transition sm:h-8 sm:flex-none',
                  period === p.value ? 'bg-brand-600 text-white' : 'text-ink-muted hover:bg-slate-100',
                )}
              >
                {p.label}
              </button>
            ))}
          </div>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as InvoiceStatus | 'all')}
            className="field-input min-w-0 flex-1 py-2 sm:w-auto sm:flex-none"
            aria-label="الحالة"
          >
            <option value="all">كل الحالات</option>
            {(Object.keys(STATUS_META) as InvoiceStatus[]).map((s) => (
              <option key={s} value={s}>
                {STATUS_META[s].label}
              </option>
            ))}
          </select>
          <select
            value={payment}
            onChange={(e) => setPayment(e.target.value as PaymentMethod | 'all')}
            className="field-input min-w-0 flex-1 py-2 sm:w-auto sm:flex-none"
            aria-label="طريقة الدفع"
          >
            <option value="all">كل طرق الدفع</option>
            {(Object.keys(PAYMENT_LABELS) as PaymentMethod[]).map((p) => (
              <option key={p} value={p}>
                {PAYMENT_LABELS[p]}
              </option>
            ))}
          </select>
          <Button
            variant="secondary"
            icon="download"
            onClick={() => exportCsv(filtered)}
            disabled={filtered.length === 0}
            aria-label="تصدير CSV"
            className="px-3 sm:px-4"
          >
            <span className="hidden sm:inline">تصدير CSV</span>
          </Button>
        </div>

        <DataTable
          columns={columns}
          rows={visible}
          rowKey={(inv) => inv.id}
          loading={loading}
          onRowClick={setSelected}
          mobileCard={(inv) => {
            const meta = STATUS_META[statusOf(inv)];
            const cancelled = statusOf(inv) === 'cancelled';
            return (
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-medium text-ink">{inv.customerName || 'عميل نقدي'}</p>
                  <p className="num mt-0.5 truncate text-xs text-brand-700">{inv.number || inv.id}</p>
                  <p className="mt-1 text-xs text-ink-subtle">
                    {formatDate(inv.createdAt || inv.date, { dateStyle: 'medium', timeStyle: 'short' })} ·{' '}
                    {PAYMENT_LABELS[paymentOf(inv)]}
                  </p>
                </div>
                <div className="shrink-0 text-end">
                  <p className={cx('num font-semibold', cancelled ? 'text-ink-faint line-through' : 'text-ink')}>
                    {formatNumber(invoiceAmounts(inv).total)}
                  </p>
                  {meta && (
                    <Badge tone={meta.tone} className="mt-1">
                      {meta.label}
                    </Badge>
                  )}
                </div>
              </div>
            );
          }}
          empty={
            filtersActive
              ? { title: 'لا توجد فواتير مطابقة', description: 'جرّب تغيير الفترة أو الفلاتر.', icon: 'filter' }
              : {
                  title: 'لا توجد فواتير بعد',
                  description: 'ستظهر هنا فواتير نقاط البيع فور مزامنتها من التطبيق.',
                  icon: 'receipt',
                }
          }
        />

        {!loading && filtered.length > 0 && (
          <div className="flex items-center justify-between gap-3 border-t border-line px-5 py-3 text-xs text-ink-subtle">
            <span>
              عرض <span className="num">{formatNumber(visible.length, 0)}</span> من{' '}
              <span className="num">{formatNumber(filtered.length, 0)}</span> فاتورة
            </span>
            {visible.length < filtered.length && (
              <Button variant="ghost" size="sm" onClick={() => setLimit((l) => l + PAGE_SIZE)}>
                عرض المزيد
              </Button>
            )}
          </div>
        )}
      </Card>

      <InvoiceDrawer invoice={selected} currency={currency} onClose={() => setSelected(null)} />
    </>
  );
};

const InvoiceDrawer: React.FC<{ invoice: SalesInvoice | null; currency: string; onClose: () => void }> = ({
  invoice,
  currency,
  onClose,
}) => {
  if (!invoice) return null;
  const a = invoiceAmounts(invoice);
  const meta = STATUS_META[statusOf(invoice)];
  const paid = Number(invoice.amountPaid) || 0;

  const info: Array<[string, React.ReactNode]> = [
    ['التاريخ', formatDate(invoice.createdAt || invoice.date, { dateStyle: 'full', timeStyle: 'short' })],
    ['العميل', invoice.customerName || 'عميل نقدي'],
    [
      'الجوال',
      invoice.customerPhone ? (
        <span className="num" dir="ltr">
          {invoice.customerPhone}
        </span>
      ) : (
        '—'
      ),
    ],
    ['الكاشير', invoice.createdByName || '—'],
    ['طريقة الدفع', PAYMENT_LABELS[paymentOf(invoice)] + (invoice.bankName ? ` · ${invoice.bankName}` : '')],
  ];

  const totals: Array<[string, number, string?]> = [
    ['المجموع قبل الضريبة', a.subtotal],
    ['ضريبة القيمة المضافة', a.vat],
    ...(a.discount ? ([['الخصم', -a.discount, 'text-danger-700']] as Array<[string, number, string]>) : []),
  ];

  return (
    <Drawer
      open
      onClose={onClose}
      title={
        <span>
          فاتورة <span className="num text-brand-700">{invoice.number || invoice.id}</span>
        </span>
      }
      subtitle={meta && <Badge tone={meta.tone}>{meta.label}</Badge>}
      footer={
        <div className="flex items-center justify-between">
          <span className="font-semibold text-ink">الإجمالي</span>
          <span className="flex items-baseline gap-1.5">
            <span className="num text-xl font-bold text-ink">{formatNumber(a.total)}</span>
            <span className="text-xs text-ink-subtle">{currency}</span>
          </span>
        </div>
      }
    >
      <dl className="grid grid-cols-1 gap-x-6 gap-y-3 px-6 py-5 sm:grid-cols-2">
        {info.map(([label, value]) => (
          <div key={label}>
            <dt className="text-xs text-ink-subtle">{label}</dt>
            <dd className="mt-0.5 text-sm text-ink">{value}</dd>
          </div>
        ))}
      </dl>

      <div className="border-y border-line">
        <table className="table-base">
          <thead>
            <tr>
              <th>الصنف</th>
              <th className="text-end">الكمية</th>
              <th className="text-end">السعر</th>
              <th className="text-end">الإجمالي</th>
            </tr>
          </thead>
          <tbody>
            {(invoice.items || []).map((item, i) => (
              <tr key={i}>
                <td>
                  <p className="font-medium">{item.productName || 'صنف'}</p>
                  {!!item.vatRate && (
                    <p className="text-xs text-ink-subtle">
                      ضريبة <span className="num">{formatNumber(item.vatRate, 0)}%</span>
                    </p>
                  )}
                </td>
                <td className="text-end">
                  <span className="num">{formatNumber(item.quantity ?? 1, 0)}</span>
                </td>
                <td className="text-end">
                  <span className="num">{formatNumber(item.unitPrice)}</span>
                </td>
                <td className="text-end font-medium">
                  <span className="num">{formatNumber(itemSubtotal(item) + itemVat(item))}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <dl className="space-y-2 px-6 py-5 text-sm">
        {totals.map(([label, value, tone]) => (
          <div key={label} className="flex justify-between">
            <dt className="text-ink-subtle">{label}</dt>
            <dd className={cx('num', tone || 'text-ink')}>{formatMoney(value, currency)}</dd>
          </div>
        ))}
        {paid > 0 && (
          <>
            <div className="flex justify-between border-t border-line pt-2">
              <dt className="text-ink-subtle">المدفوع</dt>
              <dd className="num text-ink">{formatMoney(paid, currency)}</dd>
            </div>
            {paid - a.total > 0.004 && (
              <div className="flex justify-between">
                <dt className="text-ink-subtle">الباقي للعميل</dt>
                <dd className="num text-ink">{formatMoney(paid - a.total, currency)}</dd>
              </div>
            )}
          </>
        )}
      </dl>
    </Drawer>
  );
};

export default InvoiceList;
