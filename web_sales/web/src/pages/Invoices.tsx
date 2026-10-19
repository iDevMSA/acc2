import React, { useMemo, useState } from 'react';
import { useApp } from '../context/AppContext';
import { useInvoiceProfitability } from '../hooks/useInvoiceProfitability';
import { Badge, Card, CardHeader, EmptyState, PageHeader, Spinner, StatCard, Tone, cx } from '../components/ui/primitives';
import DataTable, { Column } from '../components/ui/DataTable';
import Icon from '../components/ui/Icon';
import { formatMoney, formatNumber, formatPercent } from '../lib/format';

const marginTone = (margin: number): Tone => (margin >= 25 ? 'success' : margin >= 10 ? 'warning' : 'danger');

const Invoices: React.FC = () => {
  const { user, currency } = useApp();
  const { data: profitabilityData, loading } = useInvoiceProfitability(user?.uid || null);
  const [selectedInvoice, setSelectedInvoice] = useState<string | null>(null);
  const [query, setQuery] = useState('');

  const selectedData = profitabilityData.find((item) => item.invoiceId === selectedInvoice);

  const totals = useMemo(() => {
    const revenue = profitabilityData.reduce((sum, item) => sum + item.revenue, 0);
    const cogs = profitabilityData.reduce((sum, item) => sum + item.cogs, 0);
    const profit = profitabilityData.reduce((sum, item) => sum + item.profit, 0);
    return { revenue, cogs, profit, margin: revenue > 0 ? (profit / revenue) * 100 : 0 };
  }, [profitabilityData]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? profitabilityData.filter((inv) => inv.invoiceId.toLowerCase().includes(q)) : profitabilityData;
  }, [profitabilityData, query]);

  type Item = NonNullable<typeof selectedData>['items'][number];
  const itemColumns: Array<Column<Item>> = [
    { key: 'name', header: 'المنتج', render: (item) => <span className="font-medium">{item.name}</span> },
    { key: 'qty', header: 'الكمية', numeric: true, render: (item) => formatNumber(item.quantity, 0) },
    { key: 'price', header: 'سعر البيع', numeric: true, render: (item) => formatNumber(item.salePrice) },
    { key: 'cost', header: 'التكلفة', numeric: true, render: (item) => <span className="text-ink-muted">{formatNumber(item.costPrice)}</span> },
    {
      key: 'profit',
      header: 'الربح',
      numeric: true,
      render: (item) => (
        <span className={item.itemProfit >= 0 ? 'text-success-700' : 'text-danger-700'}>{formatNumber(item.itemProfit)}</span>
      ),
    },
  ];

  return (
    <>
      <PageHeader title="الفواتير" description="تحليل ربحية كل فاتورة على مستوى الأصناف" />

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="إجمالي الإيرادات"
          value={formatNumber(totals.revenue, 0)}
          unit={currency}
          hint={`${formatNumber(profitabilityData.length, 0)} فاتورة`}
          icon="wallet"
          tone="brand"
        />
        <StatCard label="تكلفة البضاعة المباعة" value={formatNumber(totals.cogs, 0)} unit={currency} icon="tag" tone="danger" />
        <StatCard label="إجمالي الربح" value={formatNumber(totals.profit, 0)} unit={currency} icon="trendUp" tone="success" />
        <StatCard label="متوسط هامش الربح" value={formatPercent(totals.margin)} icon="percent" tone="info" />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[340px_minmax(0,1fr)]">
        {/* قائمة الفواتير */}
        <Card className="flex max-h-[calc(100vh-330px)] min-h-[420px] flex-col overflow-hidden">
          <CardHeader title="قائمة الفواتير" subtitle={`${formatNumber(filtered.length, 0)} فاتورة`} />
          <div className="border-b border-line p-3">
            <div className="relative">
              <Icon name="search" size={16} className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-ink-faint" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="ابحث برقم الفاتورة"
                className="field-input py-2 ps-9"
              />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="grid place-items-center py-12">
                <Spinner />
              </div>
            ) : filtered.length > 0 ? (
              <ul className="divide-y divide-line">
                {filtered.map((invoice) => {
                  const active = selectedInvoice === invoice.invoiceId;
                  return (
                    <li key={invoice.invoiceId}>
                      <button
                        onClick={() => setSelectedInvoice(invoice.invoiceId)}
                        className={cx(
                          'relative flex w-full items-center justify-between gap-3 px-4 py-3 text-start transition',
                          active ? 'bg-brand-50' : 'hover:bg-slate-50'
                        )}
                      >
                        {active && <span className="absolute inset-y-0 start-0 w-[3px] bg-brand-600" />}
                        <div className="min-w-0">
                          <p className={cx('num truncate font-medium', active ? 'text-brand-700' : 'text-ink')}>
                            #{invoice.invoiceId}
                          </p>
                          <p className="mt-0.5 text-xs text-ink-subtle">
                            الربح <span className="num">{formatNumber(invoice.profit)}</span>
                          </p>
                        </div>
                        <Badge tone={marginTone(invoice.margin)}>
                          <span className="num">{formatPercent(invoice.margin)}</span>
                        </Badge>
                      </button>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <EmptyState title="لا توجد فواتير" icon="receipt" />
            )}
          </div>
        </Card>

        {/* تفاصيل الفاتورة */}
        <Card className="overflow-hidden">
          {selectedData ? (
            <>
              <CardHeader
                title={
                  <span>
                    تفاصيل الفاتورة <span className="num text-brand-700">#{selectedData.invoiceId}</span>
                  </span>
                }
                subtitle={`${formatNumber(selectedData.items.length, 0)} صنف`}
                actions={
                  <Badge tone={marginTone(selectedData.margin)}>
                    هامش <span className="num">{formatPercent(selectedData.margin, 2)}</span>
                  </Badge>
                }
              />
              <div className="grid grid-cols-1 divide-y divide-line border-b border-line sm:grid-cols-3 sm:divide-x sm:divide-y-0 sm:divide-x-reverse">
                {[
                  { label: 'الإيراد', value: selectedData.revenue, className: 'text-ink' },
                  { label: 'تكلفة البضاعة', value: selectedData.cogs, className: 'text-danger-700' },
                  { label: 'الربح', value: selectedData.profit, className: 'text-success-700' },
                ].map((s) => (
                  <div key={s.label} className="px-5 py-4">
                    <p className="text-xs text-ink-subtle">{s.label}</p>
                    <p className="mt-1 flex items-baseline gap-1.5">
                      <span className={cx('num text-xl font-semibold', s.className)}>{formatNumber(s.value)}</span>
                      <span className="text-xs text-ink-subtle">{currency}</span>
                    </p>
                  </div>
                ))}
              </div>

              <div className="px-5 py-4">
                <div className="mb-1.5 flex justify-between text-xs text-ink-subtle">
                  <span>هامش الربح</span>
                  <span className="num font-medium text-ink">{formatPercent(selectedData.margin, 2)}</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full bg-brand-600"
                    style={{ width: `${Math.min(Math.max(selectedData.margin, 0), 100)}%` }}
                  />
                </div>
              </div>

              <DataTable
                columns={itemColumns}
                rows={selectedData.items}
                rowKey={(item, i) => `${item.name}-${i}`}
                empty={{ title: 'لا توجد أصناف في هذه الفاتورة' }}
                footer={
                  <tr>
                    <td colSpan={4}>الإجمالي</td>
                    <td className="text-end">
                      <span className="num">{formatMoney(selectedData.profit, currency)}</span>
                    </td>
                  </tr>
                }
              />
            </>
          ) : (
            <EmptyState
              className="h-full min-h-[420px]"
              icon="receipt"
              title="اختر فاتورة لعرض التفاصيل"
              description="اختر فاتورة من القائمة لعرض الإيراد والتكلفة والربح لكل صنف."
            />
          )}
        </Card>
      </div>
    </>
  );
};

export default Invoices;
