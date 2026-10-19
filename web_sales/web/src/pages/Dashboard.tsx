import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { Badge, Card, CardHeader, PageHeader, StatCard } from '../components/ui/primitives';
import DataTable, { Column } from '../components/ui/DataTable';
import Icon from '../components/ui/Icon';
import { formatDate, formatMoney, formatNumber, formatTime, toDate } from '../lib/format';
import { SalesInvoice, invoiceTotal, useSalesInvoices } from '../lib/salesInvoices';

const startOfDay = (d: Date) => {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
};

const invoiceDate = (inv: SalesInvoice) => toDate(inv.createdAt || inv.date);

const Dashboard: React.FC = () => {
  const { user, currency } = useApp();
  const { invoices } = useSalesInvoices(user?.uid || null);
  // التطبيق يعتبر الفاتورة بلا حالة "مغلقة"
  const closedInvoices = useMemo(() => invoices.filter((inv) => (inv.status ?? 'closed') === 'closed'), [invoices]);

  const { kpis, recent, week } = useMemo(() => {
    const today = startOfDay(new Date()).getTime();

    const todayInvoices = closedInvoices.filter((inv) => {
      const d = invoiceDate(inv);
      return d !== null && startOfDay(d).getTime() === today;
    });

    const revenue = todayInvoices.reduce((sum, inv) => sum + invoiceTotal(inv), 0);
    const largest = todayInvoices.reduce((max, inv) => Math.max(max, invoiceTotal(inv)), 0);

    // إيرادات آخر 7 أيام (من الفواتير المغلقة نفسها)
    const days = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(today);
      d.setDate(d.getDate() - (6 - i));
      return { date: d, total: 0, count: 0 };
    });
    closedInvoices.forEach((inv) => {
      const d = invoiceDate(inv);
      if (!d) return;
      const slot = days.find((day) => day.date.getTime() === startOfDay(d).getTime());
      if (slot) {
        slot.total += invoiceTotal(inv);
        slot.count += 1;
      }
    });

    return {
      kpis: {
        revenue,
        invoices: todayInvoices.length,
        average: todayInvoices.length ? revenue / todayInvoices.length : 0,
        largest,
      },
      recent: [...todayInvoices]
        .sort((a, b) => (invoiceDate(b)?.getTime() || 0) - (invoiceDate(a)?.getTime() || 0))
        .slice(0, 8),
      week: days,
    };
  }, [closedInvoices]);

  const weekTotal = week.reduce((s, d) => s + d.total, 0);
  const weekMax = Math.max(...week.map((d) => d.total), 1);

  const columns: Array<Column<SalesInvoice>> = [
    {
      key: 'number',
      header: 'رقم الفاتورة',
      render: (inv) => (
        <span className="num whitespace-nowrap font-medium text-brand-700">#{inv.number || inv.id}</span>
      ),
    },
    {
      key: 'customer',
      header: 'العميل',
      render: (inv) => inv.customerName || <span className="text-ink-faint">عميل نقدي</span>,
    },
    {
      key: 'time',
      header: 'الوقت',
      render: (inv) => <span className="text-ink-muted">{formatTime(inv.createdAt || inv.date)}</span>,
    },
    { key: 'status', header: 'الحالة', render: () => <Badge tone="success">مغلقة</Badge> },
    { key: 'total', header: 'المبلغ', numeric: true, render: (inv) => formatMoney(invoiceTotal(inv), currency) },
  ];

  return (
    <>
      <PageHeader title="لوحة التحكم" description="ملخص أداء المبيعات اليوم وآخر سبعة أيام" />

      <div className="mb-6 grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <StatCard label="إيرادات اليوم" value={formatNumber(kpis.revenue)} unit={currency} icon="wallet" tone="brand" />
        <StatCard
          label="فواتير اليوم"
          value={formatNumber(kpis.invoices, 0)}
          unit="فاتورة"
          icon="receipt"
          tone="info"
        />
        <StatCard
          label="متوسط قيمة الفاتورة"
          value={formatNumber(kpis.average)}
          unit={currency}
          icon="trendUp"
          tone="success"
        />
        <StatCard
          label="أعلى فاتورة اليوم"
          value={formatNumber(kpis.largest)}
          unit={currency}
          icon="sparkle"
          tone="warning"
        />
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        {/* إيرادات الأسبوع */}
        <Card className="xl:col-span-1">
          <CardHeader title="إيرادات آخر 7 أيام" subtitle="الفواتير المغلقة فقط" />
          <div className="px-5 pb-5 pt-4">
            <p className="text-xs text-ink-subtle">الإجمالي</p>
            <p className="mt-1 flex items-baseline gap-1.5">
              <span className="num text-2xl font-semibold text-ink">{formatNumber(weekTotal)}</span>
              <span className="text-xs text-ink-subtle">{currency}</span>
            </p>
            <div className="mt-6 flex items-end gap-2" dir="ltr">
              {week.map((d) => {
                const isToday = d === week[week.length - 1];
                return (
                  <div key={d.date.toISOString()} className="group flex flex-1 flex-col items-center gap-2">
                    <div className="flex h-40 w-full items-end sm:h-56">
                      <div
                        className={`w-full rounded-t-md transition ${isToday ? 'bg-brand-600' : 'bg-brand-200 group-hover:bg-brand-300'}`}
                        style={{ height: `${Math.max((d.total / weekMax) * 100, d.total > 0 ? 4 : 1.5)}%` }}
                        title={`${formatDate(d.date)} · ${formatMoney(d.total, currency)} · ${d.count} فاتورة`}
                      />
                    </div>
                    <span className={`text-[11px] ${isToday ? 'font-semibold text-ink' : 'text-ink-subtle'}`}>
                      {isToday ? 'اليوم' : formatDate(d.date, { weekday: 'short' })}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </Card>

        {/* آخر الفواتير */}
        <Card className="overflow-hidden xl:col-span-2">
          <CardHeader
            title="آخر فواتير اليوم"
            subtitle="أحدث 8 فواتير مغلقة"
            actions={
              <Link
                to="/invoices"
                className="inline-flex items-center gap-1 text-sm font-medium text-brand-600 hover:text-brand-700"
              >
                كل الفواتير
                <Icon name="chevronLeft" size={14} />
              </Link>
            }
          />
          <DataTable
            columns={columns}
            rows={recent}
            rowKey={(inv) => inv.id}
            mobileCard={(inv) => (
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-medium text-ink">{inv.customerName || 'عميل نقدي'}</p>
                  <p className="mt-0.5 text-xs text-ink-subtle">
                    <span className="num">{inv.number || inv.id}</span> · {formatTime(inv.createdAt || inv.date)}
                  </p>
                </div>
                <p className="shrink-0">
                  <span className="num font-semibold text-ink">{formatNumber(invoiceTotal(inv))}</span>{' '}
                  <span className="text-xs text-ink-subtle">{currency}</span>
                </p>
              </div>
            )}
            empty={{
              title: 'لا توجد فواتير اليوم',
              description: 'ستظهر هنا الفواتير المغلقة من نقاط البيع فور مزامنتها.',
              icon: 'receipt',
            }}
          />
        </Card>
      </div>
    </>
  );
};

export default Dashboard;
