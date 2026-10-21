import React, { useEffect, useMemo, useState } from 'react';
import Modal from '../ui/Modal';
import { Button, cx } from '../ui/primitives';
import { Field, FormError, Input, SearchSelect, Select, Textarea } from '../ui/Form';
import Icon from '../ui/Icon';
import { useLedger } from '../../context/LedgerContext';
import { useAccountOptions } from '../ledger/LedgerForms';
import { CURRENCIES, CompanyInfo, localIso } from '../../lib/ledger';
import { PRICE_LEVELS, stockLevels } from '../../lib/erp';
import {
  INVOICE_LABELS,
  Invoice,
  InvoiceKind,
  QUOTE_LABELS,
  Quote,
  QuoteKind,
  TradeDocBase,
  TradeLine,
  TradeSide,
  computeTotals,
  lineNet,
  rateOn,
  sideOf,
} from '../../lib/trade';
import { formatDate, formatNumber } from '../../lib/format';
import { printReport } from '../../lib/export';

// نموذج المستند التجاري الموحّد (كما في الأصيل): فاتورة بيع/شراء ومرتجعاتها، عرض سعر، طلبية.
// البنود إما أصناف من المخازن أو بنود خدمة/مصروف تُرحَّل على حساب.

export type TradeMode =
  | { doc: 'invoice'; kind: InvoiceKind }
  | { doc: 'quote'; kind: QuoteKind; side: TradeSide };

const num = (v: string) => v.replace(/[^0-9.]/g, '');
const emptyLine = (): LineDraft => ({ mode: 'item', itemId: '', accountId: '', warehouseId: '', description: '', qty: '1', bonusQty: '', unitPrice: '', discountPct: '' });

interface LineDraft {
  mode: 'item' | 'service';
  itemId: string;
  accountId: string;
  warehouseId: string;
  description: string;
  qty: string;
  bonusQty: string;
  unitPrice: string;
  discountPct: string;
}

const toLine = (d: LineDraft): TradeLine => ({
  itemId: d.mode === 'item' ? d.itemId || null : null,
  accountId: d.mode === 'service' ? d.accountId || null : null,
  warehouseId: d.mode === 'item' ? d.warehouseId || null : null,
  description: d.description,
  qty: Number(d.qty) || 0,
  unitPrice: Number(d.unitPrice) || 0,
  discountPct: Number(d.discountPct) || 0,
  bonusQty: Number(d.bonusQty) || 0,
});

const fromLine = (l: TradeLine, defaultWh: string): LineDraft => ({
  mode: l.itemId ? 'item' : 'service',
  itemId: l.itemId || '',
  accountId: l.accountId || '',
  warehouseId: l.warehouseId || defaultWh,
  description: l.description || '',
  qty: String(l.qty || ''),
  bonusQty: l.bonusQty ? String(l.bonusQty) : '',
  unitPrice: String(l.unitPrice || ''),
  discountPct: l.discountPct ? String(l.discountPct) : '',
});

export const TradeDocModal: React.FC<{
  open: boolean;
  onClose: () => void;
  mode: TradeMode;
  /** عرض/طلبية للتعديل، أو مصدر للتحويل إلى فاتورة */
  source?: Quote | null;
  /** فاتورة أصلية لإنشاء مرتجع منها */
  returnOf?: Invoice | null;
  onSaved?: (id: string) => void;
}> = ({ open, onClose, mode, source, returnOf, onSaved }) => {
  const ledger = useLedger();
  const { items, warehouses, cashboxes, accountsById, accountMeta, balances, settings, rates, moves, mainCurrency } = ledger;
  const options = useAccountOptions();
  const levels = useMemo(() => stockLevels(moves), [moves]);
  const side: TradeSide = mode.doc === 'invoice' ? sideOf(mode.kind) : mode.side;
  const isInvoice = mode.doc === 'invoice';
  const editing = mode.doc === 'quote' && source && source.kind === mode.kind ? source : null;

  const [partyId, setPartyId] = useState('');
  const [date, setDate] = useState(localIso().slice(0, 16));
  const [dueDate, setDueDate] = useState('');
  const [currency, setCurrency] = useState(mainCurrency);
  const [rate, setRate] = useState('1');
  const [discountPct, setDiscountPct] = useState('');
  const [vatPct, setVatPct] = useState('');
  const [priceLevel, setPriceLevel] = useState(0);
  const [paid, setPaid] = useState('');
  const [cashboxId, setCashboxId] = useState('');
  const [refNumber, setRefNumber] = useState('');
  const [statement, setStatement] = useState('');
  const [lines, setLines] = useState<LineDraft[]>([emptyLine()]);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const defaultWh = warehouses[0]?.id || '';

  useEffect(() => {
    if (!open) return;
    setErr(null);
    const base: Partial<TradeDocBase> | null = source || returnOf || null;
    setPartyId(base?.partyId || '');
    setDate(editing ? (editing.date || '').slice(0, 16) : localIso().slice(0, 16));
    setDueDate(editing?.dueDate || (mode.doc === 'quote' ? (editing as Quote | null)?.validUntil || '' : ''));
    setCurrency(base?.currency || mainCurrency);
    setRate(String(base?.exchangeRate || 1));
    setDiscountPct(base?.discountPct ? String(base.discountPct) : '');
    setVatPct(base ? (base.vatPct ? String(base.vatPct) : '') : settings.defaultVatPct ? String(settings.defaultVatPct) : '');
    setPaid('');
    setCashboxId(cashboxes[0]?.id || '');
    setRefNumber(returnOf ? String(returnOf.number) : '');
    setStatement(editing?.statement || (source && !editing ? `من ${QUOTE_LABELS[source.kind][source.side]} رقم ${source.number}` : '') || (returnOf ? `مرتجع ${INVOICE_LABELS[returnOf.kind]} رقم ${returnOf.number}` : ''));
    setLines(base?.lines?.length ? base.lines.map((l) => fromLine(l, defaultWh)) : [{ ...emptyLine(), warehouseId: defaultWh }]);
    setPriceLevel(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // سعر الصرف التلقائي من جدول أسعار العملات
  useEffect(() => {
    if (!open) return;
    if (currency === mainCurrency) return setRate('1');
    const r = rateOn(rates, currency, date);
    if (r) setRate(String(r));
  }, [open, currency, date, rates, mainCurrency]);

  // خصم الطرف التجاري الافتراضي
  useEffect(() => {
    if (!open || !partyId || source || returnOf) return;
    const d = accountMeta[partyId]?.discountPct;
    if (d) setDiscountPct(String(d));
  }, [open, partyId, accountMeta, source, returnOf]);

  const parsed = lines.map(toLine);
  const totals = computeTotals(parsed, Number(discountPct) || 0, Number(vatPct) || 0);
  const r = Number(rate) || 1;

  const setLine = (i: number, patch: Partial<LineDraft>) =>
    setLines((ls) =>
      ls.map((l, j) => {
        if (j !== i) return l;
        const next = { ...l, ...patch };
        if (patch.itemId !== undefined && patch.itemId) {
          const it = items.find((x) => x.id === patch.itemId);
          const priceMain =
            side === 'sale'
              ? priceLevel === 0
                ? it?.price || 0
                : it?.prices?.[priceLevel - 1] || it?.price || 0
              : it?.cost || levels.of(next.warehouseId || defaultWh, patch.itemId).avgCost || 0;
          next.unitPrice = priceMain ? String(Number((priceMain * r).toFixed(4))) : next.unitPrice;
          next.description = it?.name || '';
          if (!next.warehouseId) next.warehouseId = defaultWh;
        }
        return next;
      }),
    );

  const party = accountsById[partyId];
  const creditLimit = accountMeta[partyId]?.creditLimit;
  const partyBalance = balances[partyId]?.total || 0;
  const overLimit =
    isInvoice && side === 'sale' && creditLimit && partyBalance + (totals.total - (Number(paid) || 0)) / r > creditLimit;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!party) return setErr(side === 'sale' ? 'اختر الزبون' : 'اختر المورد');
    if (!(r > 0)) return setErr('سعر الصرف غير صالح');
    setBusy(true);
    try {
      const common = {
        partyId,
        date: localIso(new Date(date)),
        currency,
        exchangeRate: r,
        lines: parsed,
        discountPct: Number(discountPct) || 0,
        vatPct: Number(vatPct) || 0,
        statement,
      };
      let id: string;
      if (mode.doc === 'invoice') {
        id = await ledger.createInvoice({
          ...common,
          kind: mode.kind,
          dueDate: dueDate || '',
          paid: Number(paid) || 0,
          cashboxId: Number(paid) > 0 ? cashboxId : null,
          refNumber,
          quoteId: source?.id || null,
        });
      } else {
        id = await ledger.saveQuote({
          ...common,
          id: editing?.id,
          kind: mode.kind,
          side: mode.side,
          status: editing?.status || 'open',
          validUntil: dueDate || '',
          invoiceId: editing?.invoiceId || null,
        });
      }
      onSaved?.(id);
      onClose();
    } catch (e: any) {
      setErr(e?.message || 'تعذّر الحفظ');
    } finally {
      setBusy(false);
    }
  };

  const title =
    mode.doc === 'invoice'
      ? INVOICE_LABELS[mode.kind]
      : `${editing ? 'تعديل ' : ''}${QUOTE_LABELS[mode.kind][mode.side]}`;

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="xl"
      title={title}
      subtitle={
        isInvoice
          ? 'الفاتورة تحدّث المخازن وتنشئ قيود الطرف والمبيعات/المخزون والضريبة والصندوق تلقائياً'
          : 'العرض أو الطلبية لا يؤثران على الحسابات حتى يُحوَّلا إلى فاتورة'
      }
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            إلغاء
          </Button>
          <Button type="submit" form="trade-form" disabled={busy}>
            {isInvoice ? 'حفظ وترحيل' : 'حفظ'}
          </Button>
        </>
      }
    >
      <form id="trade-form" onSubmit={submit} className="space-y-5">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Field label={side === 'sale' ? 'الزبون' : 'المورد'} className="lg:col-span-2">
            <SearchSelect value={partyId} onChange={setPartyId} options={options} placeholder="اختر الحساب" />
          </Field>
          <Field label="التاريخ">
            <Input type="datetime-local" value={date} onChange={(e) => setDate(e.target.value)} className="num" />
          </Field>
          <Field label={isInvoice ? 'تاريخ الاستحقاق' : 'صالح حتى'}>
            <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="num" />
          </Field>
          <Field label="العملة">
            <Select value={currency} onChange={(e) => setCurrency(e.target.value)}>
              {Array.from(new Set([mainCurrency, ...CURRENCIES])).map((c) => (
                <option key={c}>{c}</option>
              ))}
            </Select>
          </Field>
          <Field label="سعر الصرف" hint={currency !== mainCurrency ? `${currency} لكل 1 ${mainCurrency}` : undefined}>
            <Input inputMode="decimal" value={rate} disabled={currency === mainCurrency} onChange={(e) => setRate(num(e.target.value))} className="num" />
          </Field>
          {side === 'sale' && (
            <Field label="مستوى السعر">
              <Select value={priceLevel} onChange={(e) => setPriceLevel(Number(e.target.value))}>
                {PRICE_LEVELS.map((p, i) => (
                  <option key={p} value={i}>
                    {p}
                  </option>
                ))}
              </Select>
            </Field>
          )}
          {isInvoice && (mode.kind === 'saleReturn' || mode.kind === 'purchaseReturn') && (
            <Field label="رقم الفاتورة الأصلية">
              <Input value={refNumber} onChange={(e) => setRefNumber(e.target.value)} className="num" />
            </Field>
          )}
        </div>

        {party && (
          <div className="flex flex-wrap items-center gap-3 rounded-lg bg-slate-50 px-3 py-2 text-xs text-ink-subtle">
            <span>
              رصيد {party.name}: <b className={cx('num', partyBalance >= 0 ? 'text-success-700' : 'text-danger-700')}>{formatNumber(Math.abs(partyBalance))}</b>{' '}
              {partyBalance >= 0 ? 'لنا' : 'لهم'} {mainCurrency}
            </span>
            {creditLimit ? <span>حد الائتمان: <b className="num">{formatNumber(creditLimit)}</b></span> : null}
            {overLimit && (
              <span className="flex items-center gap-1 font-medium text-danger-700">
                <Icon name="alert" size={14} /> الفاتورة تتجاوز حد الائتمان
              </span>
            )}
          </div>
        )}

        {/* البنود */}
        <div className="overflow-x-auto rounded-xl border border-line">
          <table className="table-base min-w-[900px]">
            <thead>
              <tr>
                <th className="w-24">النوع</th>
                <th>الصنف / الحساب</th>
                <th className="w-36">المخزن</th>
                <th className="w-20 text-end">الكمية</th>
                <th className="w-20 text-end">بونص</th>
                <th className="w-28 text-end">السعر ({currency})</th>
                <th className="w-20 text-end">خصم %</th>
                <th className="w-28 text-end">الإجمالي</th>
                <th className="w-10" />
              </tr>
            </thead>
            <tbody>
              {lines.map((l, i) => {
                const lvl = l.mode === 'item' && l.itemId ? levels.of(l.warehouseId, l.itemId) : null;
                return (
                  <tr key={i} className="align-top hover:bg-transparent">
                    <td>
                      <select
                        value={l.mode}
                        onChange={(e) => setLine(i, { mode: e.target.value as LineDraft['mode'] })}
                        className="h-9 w-full rounded-lg border border-line-strong bg-surface px-2 text-xs"
                      >
                        <option value="item">صنف</option>
                        <option value="service">{side === 'sale' ? 'خدمة' : 'مصروف'}</option>
                      </select>
                    </td>
                    <td>
                      {l.mode === 'item' ? (
                        <SearchSelect
                          value={l.itemId}
                          onChange={(v) => setLine(i, { itemId: v })}
                          options={items.map((it) => ({ value: it.id, label: it.name, hint: it.code }))}
                          placeholder="اختر الصنف"
                        />
                      ) : (
                        <SearchSelect
                          value={l.accountId}
                          onChange={(v) => setLine(i, { accountId: v })}
                          options={options}
                          placeholder={side === 'sale' ? 'حساب الإيراد' : 'حساب المصروف'}
                        />
                      )}
                      <input
                        value={l.description}
                        onChange={(e) => setLine(i, { description: e.target.value })}
                        placeholder="الوصف"
                        className="mt-1 h-8 w-full rounded-md bg-slate-50 px-2 text-xs outline-none"
                      />
                      {lvl && (
                        <p className="mt-1 text-[11px] text-ink-subtle">
                          المتاح {formatNumber(lvl.qty, 2)} · التكلفة {formatNumber(lvl.avgCost)} {mainCurrency}
                        </p>
                      )}
                    </td>
                    <td>
                      {l.mode === 'item' ? (
                        <select
                          value={l.warehouseId}
                          onChange={(e) => setLine(i, { warehouseId: e.target.value })}
                          className="h-9 w-full rounded-lg border border-line-strong bg-surface px-2 text-xs"
                        >
                          <option value="">اختر...</option>
                          {warehouses.map((w) => (
                            <option key={w.id} value={w.id}>
                              {w.name}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <span className="text-xs text-ink-faint">—</span>
                      )}
                    </td>
                    {(['qty', 'bonusQty', 'unitPrice', 'discountPct'] as const).map((k) => (
                      <td key={k}>
                        <input
                          inputMode="decimal"
                          value={l[k]}
                          disabled={k === 'bonusQty' && l.mode !== 'item'}
                          onChange={(e) => setLine(i, { [k]: num(e.target.value) })}
                          className="num h-9 w-full rounded-lg border border-line-strong bg-surface px-2 text-end text-sm disabled:bg-slate-50"
                        />
                      </td>
                    ))}
                    <td className="text-end">
                      <span className="num font-medium">{formatNumber(lineNet(toLine(l)))}</span>
                    </td>
                    <td>
                      <button
                        type="button"
                        onClick={() => setLines((ls) => (ls.length > 1 ? ls.filter((_, j) => j !== i) : [{ ...emptyLine(), warehouseId: defaultWh }]))}
                        className="grid h-9 w-9 place-items-center rounded-md text-ink-subtle hover:bg-danger-50 hover:text-danger-600"
                        title="حذف البند"
                      >
                        <Icon name="trash" size={15} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div className="border-t border-line p-2">
            <Button type="button" variant="ghost" size="sm" icon="plus" onClick={() => setLines((ls) => [...ls, { ...emptyLine(), warehouseId: defaultWh }])}>
              إضافة بند
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="خصم على الفاتورة %">
              <Input inputMode="decimal" value={discountPct} onChange={(e) => setDiscountPct(num(e.target.value))} className="num" />
            </Field>
            <Field label="الضريبة المضافة %">
              <Input inputMode="decimal" value={vatPct} onChange={(e) => setVatPct(num(e.target.value))} className="num" />
            </Field>
            {isInvoice && (
              <>
                <Field
                  label={side === 'sale' ? (mode.kind === 'sale' ? 'المقبوض نقداً' : 'المردود نقداً') : mode.kind === 'purchase' ? 'المدفوع نقداً' : 'المستردّ نقداً'}
                  hint="الباقي يبقى على حساب الطرف (آجل)"
                >
                  <div className="flex gap-2">
                    <Input inputMode="decimal" value={paid} onChange={(e) => setPaid(num(e.target.value))} className="num" />
                    <Button type="button" variant="secondary" onClick={() => setPaid(String(totals.total))}>
                      الكل
                    </Button>
                  </div>
                </Field>
                <Field label="الصندوق">
                  <Select value={cashboxId} onChange={(e) => setCashboxId(e.target.value)} disabled={!(Number(paid) > 0)}>
                    <option value="">اختر...</option>
                    {cashboxes.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                  </Select>
                </Field>
              </>
            )}
            <Field label="البيان / ملاحظات" className="sm:col-span-2">
              <Textarea value={statement} onChange={(e) => setStatement(e.target.value)} />
            </Field>
          </div>
          <TotalsPanel totals={totals} currency={currency} paid={isInvoice ? Number(paid) || 0 : undefined} />
        </div>
      </form>
      <FormError message={err} />
    </Modal>
  );
};

export const TotalsPanel: React.FC<{ totals: ReturnType<typeof computeTotals>; currency: string; paid?: number }> = ({
  totals,
  currency,
  paid,
}) => {
  const row = (label: string, v: number, strong = false, tone?: string) => (
    <div className={cx('flex items-center justify-between py-1.5', strong && 'border-t border-line pt-2.5 text-base font-semibold')}>
      <span className="text-ink-muted">{label}</span>
      <span className={cx('num', tone)}>
        {formatNumber(v)} <span className="text-xs font-normal text-ink-subtle">{currency}</span>
      </span>
    </div>
  );
  return (
    <div className="h-fit rounded-xl bg-slate-50 p-4 text-sm">
      {row('الإجمالي قبل الخصم', totals.gross)}
      {totals.lineDiscounts > 0 && row('خصم البنود', -totals.lineDiscounts, false, 'text-danger-700')}
      {totals.invoiceDiscount > 0 && row('خصم الفاتورة', -totals.invoiceDiscount, false, 'text-danger-700')}
      {row('الصافي', totals.net)}
      {totals.vat > 0 && row('الضريبة المضافة', totals.vat)}
      {row('الإجمالي النهائي', totals.total, true)}
      {paid !== undefined && paid > 0 && (
        <>
          {row('نقداً', paid)}
          {row('الباقي على الحساب', totals.total - paid, false, 'text-warning-700')}
        </>
      )}
    </div>
  );
};

/** طباعة المستند (فاتورة/عرض/طلبية) بنفس قالب التقارير ← PDF */
export const printTradeDoc = (
  doc: (Invoice | Quote) & { kind: string },
  title: string,
  partyName: string,
  names: { item: (id: string) => string; account: (id: string) => string; warehouse: (id: string) => string },
  company: CompanyInfo,
) => {
  const t = doc.totals;
  const summary: Array<[string, string]> = [
    ['الطرف', partyName],
    ['التاريخ', formatDate(doc.date)],
    ['الإجمالي', `${formatNumber(t.total)} ${doc.currency}`],
  ];
  if ('paid' in doc) summary.push(['المتبقي على الحساب', `${formatNumber(t.total - (doc.paid || 0))} ${doc.currency}`]);
  printReport(
    {
      title: `${title} رقم ${doc.number}`,
      subtitle: [doc.statement, doc.currency !== 'USD' || doc.exchangeRate !== 1 ? `سعر الصرف ${doc.exchangeRate}` : ''].filter(Boolean).join(' · '),
      summary,
      columns: ['#', 'البند', 'المخزن', 'الكمية', 'السعر', 'خصم %', 'الإجمالي'],
      numericColumns: [3, 4, 5, 6],
      rows: doc.lines.map((l, i) => [
        String(i + 1),
        l.itemId ? names.item(l.itemId) + (l.description && l.description !== names.item(l.itemId) ? ` — ${l.description}` : '') : l.description || names.account(l.accountId || ''),
        l.warehouseId ? names.warehouse(l.warehouseId) : '',
        l.qty + (l.bonusQty ? ` (+${l.bonusQty})` : ''),
        l.unitPrice,
        l.discountPct || '',
        lineNet(l),
      ]),
      footer: [
        ['', 'الإجمالي قبل الخصم', '', '', '', '', t.gross],
        ...(t.lineDiscounts + t.invoiceDiscount > 0 ? [['', 'الخصومات', '', '', '', '', -(t.lineDiscounts + t.invoiceDiscount)]] : []),
        ...(t.vat > 0 ? [['', 'الضريبة المضافة', '', '', '', '', t.vat]] : []),
        ['', 'الإجمالي النهائي', '', '', '', '', t.total],
      ],
    },
    company,
  );
};
