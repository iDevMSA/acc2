import React, { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useNewParam } from '../hooks/useNewParam';
import { useLedger } from '../context/LedgerContext';
import { Badge, Button, Card, PageHeader, StatCard, Tabs, cx } from '../components/ui/primitives';
import DataTable, { Column } from '../components/ui/DataTable';
import Icon, { IconName } from '../components/ui/Icon';
import Drawer from '../components/ui/Drawer';
import { ConfirmModal } from '../components/ui/Modal';
import { ExportButtons, PeriodPicker } from '../components/ledger/ReportToolbar';
import { TotalsPanel, TradeDocModal, TradeMode, printTradeDoc } from '../components/trade/TradeForms';
import { formatDate, formatNumber } from '../lib/format';
import { Period, inPeriod, periodFromPreset, periodText } from '../lib/ledger';
import {
  INVOICE_LABELS,
  INVOICE_TONE,
  Invoice,
  InvoiceKind,
  QUOTE_LABELS,
  Quote,
  QuoteStatus,
  invoiceDue,
  lineNet,
} from '../lib/trade';

// الفواتير متعددة الأصناف ومرتجعاتها + العروض والطلبيات (كما في الأصيل: نموذج واحد لأربعة أنواع فواتير
// يربط المخازن بالمحاسبة والسندات تلقائياً، وعروض/طلبيات تُحوَّل إلى فواتير).

type View = 'invoices' | 'quotes';
type KindFilter = 'all' | InvoiceKind;

const QUOTE_STATUS: Record<QuoteStatus, { label: string; tone: 'info' | 'success' | 'neutral' }> = {
  open: { label: 'مفتوح', tone: 'info' },
  converted: { label: 'حُوِّل لفاتورة', tone: 'success' },
  cancelled: { label: 'ملغى', tone: 'neutral' },
};

const NEW_BUTTONS: Array<{ kind: InvoiceKind; icon: IconName; primary?: boolean }> = [
  { kind: 'purchaseReturn', icon: 'refresh' },
  { kind: 'saleReturn', icon: 'refresh' },
  { kind: 'purchase', icon: 'arrowIn' },
  { kind: 'sale', icon: 'arrowOut', primary: true },
];

const Trade: React.FC = () => {
  const [params, setParams] = useSearchParams();
  const view = (params.get('view') as View) || 'invoices';
  const kindFilter = (params.get('kind') as KindFilter) || 'all';
  const ledger = useLedger();
  const { invoices, quotes, accountsById, items, warehouses, company, mainCurrency, deleteInvoice, deleteQuote, setQuoteStatus } = ledger;
  const [period, setPeriod] = useState<Period>(periodFromPreset('month'));
  const [modal, setModal] = useState<{ mode: TradeMode; source?: Quote | null; returnOf?: Invoice | null } | null>(null);
  const [detail, setDetail] = useState<Invoice | null>(null);
  const [confirm, setConfirm] = useState<{ title: string; message: string; run: () => Promise<void> } | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  useNewParam((k) => (k === 'sale' || k === 'purchase') && setModal({ mode: { doc: 'invoice', kind: k } }));

  const setParam = (k: string, v: string, def: string) => {
    const next = new URLSearchParams(params);
    if (v === def) next.delete(k);
    else next.set(k, v);
    setParams(next);
  };

  const party = (id: string) => accountsById[id]?.name || id;
  const names = {
    item: (id: string) => items.find((i) => i.id === id)?.name || id,
    account: (id: string) => accountsById[id]?.name || id,
    warehouse: (id: string) => warehouses.find((w) => w.id === id)?.name || '',
  };

  const rows = useMemo(
    () => invoices.filter((i) => inPeriod(i.date, period) && (kindFilter === 'all' || i.kind === kindFilter)),
    [invoices, period, kindFilter],
  );
  const quoteRows = useMemo(() => quotes.filter((q) => inPeriod(q.date, period)), [quotes, period]);

  const main = (i: Invoice) => i.totals.total / (i.exchangeRate || 1);
  const sumKind = (k: InvoiceKind) => rows.filter((i) => i.kind === k).reduce((s, i) => s + main(i), 0);
  const dueTotal = rows.filter((i) => i.kind === 'sale').reduce((s, i) => s + invoiceDue(i) / (i.exchangeRate || 1), 0);

  const ask = (title: string, message: string, fn: () => Promise<void>) =>
    setConfirm({ title, message, run: () => fn().catch((e) => setActionError(e?.message || 'تعذّر التنفيذ')) });

  const iconBtn = (icon: IconName, title: string, onClick: () => void, danger = false) => (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      title={title}
      className={cx(
        'grid h-8 w-8 place-items-center rounded-md text-ink-subtle',
        danger ? 'hover:bg-danger-50 hover:text-danger-600' : 'hover:bg-slate-100 hover:text-ink',
      )}
    >
      <Icon name={icon} size={15} />
    </button>
  );

  const invColumns: Array<Column<Invoice>> = [
    {
      key: 'n',
      header: 'الفاتورة',
      className: 'w-44',
      render: (i) => (
        <div>
          <Badge tone={INVOICE_TONE[i.kind]}>{INVOICE_LABELS[i.kind]}</Badge>
          <span className="num ms-2 text-xs text-ink-subtle">#{i.number}</span>
        </div>
      ),
    },
    { key: 'date', header: 'التاريخ', className: 'w-32', render: (i) => <span className="text-ink-muted">{formatDate(i.date)}</span> },
    {
      key: 'party',
      header: 'الطرف',
      render: (i) => (
        <Link to={`/accounts/${i.partyId}`} onClick={(e) => e.stopPropagation()} className="font-medium text-brand-700 hover:underline">
          {party(i.partyId)}
        </Link>
      ),
    },
    { key: 'lines', header: 'البنود', numeric: true, className: 'w-16', render: (i) => formatNumber(i.lines.length, 0) },
    {
      key: 'total',
      header: 'الإجمالي',
      numeric: true,
      render: (i) => (
        <>
          {formatNumber(i.totals.total)} <span className="text-xs text-ink-subtle">{i.currency}</span>
        </>
      ),
    },
    { key: 'paid', header: 'نقداً', numeric: true, render: (i) => formatNumber(i.paid || 0) },
    {
      key: 'due',
      header: 'على الحساب',
      numeric: true,
      render: (i) => <span className={invoiceDue(i) > 0 ? 'text-warning-700' : 'text-ink-subtle'}>{formatNumber(invoiceDue(i))}</span>,
    },
    {
      key: 'act',
      header: '',
      className: 'w-32',
      render: (i) => (
        <div className="flex justify-end gap-1">
          {iconBtn('download', 'طباعة / PDF', () => printTradeDoc(i, INVOICE_LABELS[i.kind], party(i.partyId), names, company))}
          {(i.kind === 'sale' || i.kind === 'purchase') &&
            iconBtn('refresh', 'إنشاء مرتجع منها', () =>
              setModal({ mode: { doc: 'invoice', kind: i.kind === 'sale' ? 'saleReturn' : 'purchaseReturn' }, returnOf: i }),
            )}
          {iconBtn(
            'trash',
            'حذف الفاتورة وقيودها وحركاتها',
            () =>
              ask(
                'حذف الفاتورة',
                `ستُحذف ${INVOICE_LABELS[i.kind]} رقم ${i.number} مع قيودها (${i.opIds.length}) وحركات المخزن الناتجة عنها من المنصة والهاتف.`,
                () => deleteInvoice(i.id),
              ),
            true,
          )}
        </div>
      ),
    },
  ];

  const quoteColumns: Array<Column<Quote>> = [
    {
      key: 'n',
      header: 'المستند',
      className: 'w-52',
      render: (q) => (
        <div>
          <Badge tone={q.kind === 'quote' ? 'brand' : 'info'}>{QUOTE_LABELS[q.kind][q.side]}</Badge>
          <span className="num ms-2 text-xs text-ink-subtle">#{q.number}</span>
        </div>
      ),
    },
    { key: 'date', header: 'التاريخ', className: 'w-32', render: (q) => <span className="text-ink-muted">{formatDate(q.date)}</span> },
    { key: 'party', header: 'الطرف', render: (q) => <span className="font-medium">{party(q.partyId)}</span> },
    {
      key: 'valid',
      header: 'صالح حتى',
      render: (q) =>
        q.validUntil ? (
          <span className={cx(q.status === 'open' && q.validUntil < new Date().toISOString().slice(0, 10) && 'text-danger-700')}>
            {formatDate(q.validUntil)}
          </span>
        ) : (
          '—'
        ),
    },
    { key: 'st', header: 'الحالة', render: (q) => <Badge tone={QUOTE_STATUS[q.status].tone}>{QUOTE_STATUS[q.status].label}</Badge> },
    {
      key: 'total',
      header: 'الإجمالي',
      numeric: true,
      render: (q) => (
        <>
          {formatNumber(q.totals.total)} <span className="text-xs text-ink-subtle">{q.currency}</span>
        </>
      ),
    },
    {
      key: 'act',
      header: '',
      className: 'w-44',
      render: (q) => (
        <div className="flex justify-end gap-1">
          {q.status === 'open' && (
            <Button
              size="sm"
              variant="secondary"
              icon="receipt"
              onClick={() => setModal({ mode: { doc: 'invoice', kind: q.side === 'sale' ? 'sale' : 'purchase' }, source: q })}
            >
              فاتورة
            </Button>
          )}
          {q.status === 'open' && iconBtn('edit', 'تعديل', () => setModal({ mode: { doc: 'quote', kind: q.kind, side: q.side }, source: q }))}
          {iconBtn('download', 'طباعة / PDF', () => printTradeDoc(q, QUOTE_LABELS[q.kind][q.side], party(q.partyId), names, company))}
          {q.status === 'open' && iconBtn('close', 'إلغاء', () => setQuoteStatus(q.id, 'cancelled'))}
          {q.status !== 'converted' && iconBtn('trash', 'حذف', () => ask('حذف المستند', 'سيُحذف المستند نهائياً (لا أثر محاسبي له).', () => deleteQuote(q.id)), true)}
        </div>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="الفواتير والعروض"
        description="فواتير البيع والشراء ومرتجعاتها متعددة الأصناف، وعروض الأسعار والطلبيات — كل فاتورة تُرحّل للمخازن والحسابات تلقائياً"
        actions={
          view === 'invoices' ? (
            <div className="flex flex-wrap gap-2">
              {NEW_BUTTONS.map((b) => (
                <Button key={b.kind} variant={b.primary ? 'primary' : 'secondary'} icon={b.icon} onClick={() => setModal({ mode: { doc: 'invoice', kind: b.kind } })}>
                  {INVOICE_LABELS[b.kind]}
                </Button>
              ))}
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" icon="inbox" onClick={() => setModal({ mode: { doc: 'quote', kind: 'order', side: 'purchase' } })}>
                طلبية لمورد
              </Button>
              <Button variant="secondary" icon="inbox" onClick={() => setModal({ mode: { doc: 'quote', kind: 'order', side: 'sale' } })}>
                طلبية من زبون
              </Button>
              <Button variant="secondary" icon="tag" onClick={() => setModal({ mode: { doc: 'quote', kind: 'quote', side: 'purchase' } })}>
                عرض من مورد
              </Button>
              <Button icon="tag" onClick={() => setModal({ mode: { doc: 'quote', kind: 'quote', side: 'sale' } })}>
                عرض سعر لزبون
              </Button>
            </div>
          )
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <StatCard label="المبيعات" value={formatNumber(sumKind('sale') - sumKind('saleReturn'))} unit={mainCurrency} icon="arrowOut" tone="success" hint="بعد المرتجعات" />
        <StatCard label="المشتريات" value={formatNumber(sumKind('purchase') - sumKind('purchaseReturn'))} unit={mainCurrency} icon="arrowIn" tone="info" hint="بعد المرتجعات" />
        <StatCard label="ذمم فواتير البيع" value={formatNumber(dueTotal)} unit={mainCurrency} icon="wallet" tone="warning" hint="المتبقي على الزبائن" />
        <StatCard
          label="عروض وطلبيات مفتوحة"
          value={formatNumber(quotes.filter((q) => q.status === 'open').length, 0)}
          icon="tag"
          tone="brand"
          hint={periodText(period)}
        />
      </div>

      {actionError && (
        <p className="mb-4 flex items-center gap-2 rounded-lg bg-danger-50 px-3 py-2 text-sm text-danger-700">
          <Icon name="alert" size={16} /> {actionError}
        </p>
      )}

      <Card className="overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-line px-5 py-4 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <Tabs<View>
              value={view}
              onChange={(v) => setParam('view', v, 'invoices')}
              items={[
                { value: 'invoices', label: 'الفواتير', icon: 'receipt' },
                { value: 'quotes', label: 'العروض والطلبيات', icon: 'tag' },
              ]}
            />
            {view === 'invoices' && (
              <select
                value={kindFilter}
                onChange={(e) => setParam('kind', e.target.value, 'all')}
                className="h-9 rounded-lg border border-line-strong bg-surface pe-8 ps-3 text-sm shadow-sm"
              >
                <option value="all">كل الأنواع</option>
                {(Object.keys(INVOICE_LABELS) as InvoiceKind[]).map((k) => (
                  <option key={k} value={k}>
                    {INVOICE_LABELS[k]}
                  </option>
                ))}
              </select>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <PeriodPicker value={period} onChange={setPeriod} />
            <ExportButtons
              disabled={view === 'invoices' ? !rows.length : !quoteRows.length}
              build={() =>
                view === 'invoices'
                  ? {
                      title: 'سجل الفواتير',
                      subtitle: periodText(period),
                      columns: ['النوع', 'الرقم', 'التاريخ', 'الطرف', 'الصافي', 'الضريبة', 'الإجمالي', 'نقداً', 'على الحساب', 'العملة'],
                      numericColumns: [4, 5, 6, 7, 8],
                      rows: rows.map((i) => [
                        INVOICE_LABELS[i.kind],
                        String(i.number),
                        formatDate(i.date),
                        party(i.partyId),
                        i.totals.net,
                        i.totals.vat,
                        i.totals.total,
                        i.paid || 0,
                        invoiceDue(i),
                        i.currency,
                      ]),
                    }
                  : {
                      title: 'العروض والطلبيات',
                      subtitle: periodText(period),
                      columns: ['النوع', 'الرقم', 'التاريخ', 'الطرف', 'الحالة', 'الإجمالي', 'العملة'],
                      numericColumns: [5],
                      rows: quoteRows.map((q) => [
                        QUOTE_LABELS[q.kind][q.side],
                        String(q.number),
                        formatDate(q.date),
                        party(q.partyId),
                        QUOTE_STATUS[q.status].label,
                        q.totals.total,
                        q.currency,
                      ]),
                    }
              }
            />
          </div>
        </div>
        {view === 'invoices' ? (
          <DataTable
            columns={invColumns}
            rows={rows}
            rowKey={(i) => i.id}
            onRowClick={setDetail}
            maxHeight="calc(100dvh - 380px)"
            mobileCard={(i) => (
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-medium">{party(i.partyId)}</p>
                  <p className="text-xs text-ink-subtle">
                    {INVOICE_LABELS[i.kind]} #{i.number} · {formatDate(i.date)}
                  </p>
                </div>
                <span className="num font-semibold">
                  {formatNumber(i.totals.total)} <span className="text-xs font-normal text-ink-subtle">{i.currency}</span>
                </span>
              </div>
            )}
            empty={{ title: 'لا توجد فواتير في هذه الفترة', description: 'أنشئ فاتورة بيع أو شراء من الأزرار في الأعلى.', icon: 'receipt' }}
          />
        ) : (
          <DataTable
            columns={quoteColumns}
            rows={quoteRows}
            rowKey={(q) => q.id}
            maxHeight="calc(100dvh - 380px)"
            empty={{ title: 'لا توجد عروض أو طلبيات', description: 'العروض والطلبيات لا تؤثر على الحسابات حتى تُحوَّل إلى فواتير.', icon: 'tag' }}
          />
        )}
      </Card>

      <Drawer
        open={!!detail}
        onClose={() => setDetail(null)}
        title={detail ? `${INVOICE_LABELS[detail.kind]} رقم ${detail.number}` : ''}
        subtitle={detail ? `${party(detail.partyId)} · ${formatDate(detail.date)}` : ''}
        actions={
          detail && (
            <Button size="sm" variant="secondary" icon="download" onClick={() => printTradeDoc(detail, INVOICE_LABELS[detail.kind], party(detail.partyId), names, company)}>
              طباعة
            </Button>
          )
        }
      >
        {detail && (
          <div className="space-y-4">
            <ul className="divide-y divide-line rounded-xl border border-line">
              {detail.lines.map((l, i) => (
                <li key={i} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{l.itemId ? names.item(l.itemId) : l.description || names.account(l.accountId || '')}</p>
                    <p className="num text-xs text-ink-subtle">
                      {formatNumber(l.qty, 2)}
                      {l.bonusQty ? ` + ${formatNumber(l.bonusQty, 2)} بونص` : ''} × {formatNumber(l.unitPrice)}
                      {l.discountPct ? ` − ${l.discountPct}%` : ''}
                      {l.warehouseId ? ` · ${names.warehouse(l.warehouseId)}` : ''}
                    </p>
                  </div>
                  <span className="num font-semibold">{formatNumber(lineNet(l))}</span>
                </li>
              ))}
            </ul>
            <TotalsPanel totals={detail.totals} currency={detail.currency} paid={detail.paid} />
            {detail.statement && <p className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-ink-muted">{detail.statement}</p>}
            <p className="text-xs text-ink-subtle">
              أنشأت هذه الفاتورة {detail.opIds.length} قيداً و{detail.moveIds.length} حركة مخزن. القيود تظهر في كشف حساب الطرف على الهاتف أيضاً.
            </p>
            <Link to={`/accounts/${detail.partyId}`} className="inline-flex items-center gap-1 text-sm font-medium text-brand-600 hover:underline">
              فتح كشف حساب {party(detail.partyId)} <Icon name="chevronLeft" size={14} />
            </Link>
          </div>
        )}
      </Drawer>

      {modal && (
        <TradeDocModal
          open
          onClose={() => setModal(null)}
          mode={modal.mode}
          source={modal.source}
          returnOf={modal.returnOf}
          onSaved={() => setActionError(null)}
        />
      )}
      <ConfirmModal
        open={!!confirm}
        onClose={() => setConfirm(null)}
        title={confirm?.title || ''}
        message={confirm?.message || ''}
        onConfirm={() => confirm?.run()}
      />
    </>
  );
};

export default Trade;
