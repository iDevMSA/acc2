// تحويل مستندات المنصة إلى النموذج الموحّد (EDoc):
//   pos_{id}   فاتورة نقطة البيع من تطبيق الهاتف (sales/{uid}/invoices) — قراءة فقط
//   trade_{id} فاتورة بيع أو مرتجع بيع من الويب (users/{uid}/erp/invoices)
//   note_{id}  إشعار مدين/دائن من الويب (users/{uid}/erp/notes)
import { EDoc, inclusiveDiscountToAllowances, Line, lineNet, Party, PaymentMeans, round2 } from './model';
import { Store } from './store';

export type SourceType = 'pos' | 'trade' | 'note';

export interface PartyTax extends Partial<Party> {}

export interface ItemCode {
  itemType?: 'EGS' | 'GS1';
  itemCode?: string;
  unitType?: string;
}

/** تعديلات يدخلها المستخدم عند الإرسال (رقم الفاتورة الأصلية وسبب الإشعار) */
export interface Override {
  billingRef?: string;
  billingRefUuid?: string;
  reason?: string;
}

export class SourceError extends Error {}

const num = (v: unknown) => (Number.isFinite(Number(v)) ? Number(v) : 0);

export const parseKey = (key: string): { type: SourceType; id: string } => {
  const m = /^(pos|trade|note)_(.+)$/.exec(key);
  if (!m) throw new SourceError('مفتاح مستند غير صالح');
  return { type: m[1] as SourceType, id: m[2] };
};

/** يدمج تاريخ المستند (yyyy-mm-dd) مع وقت إنشائه */
const issuedAt = (date: string | undefined, createdAt: string | undefined) => {
  const created = createdAt && !isNaN(Date.parse(createdAt)) ? new Date(createdAt) : null;
  if (!date) return (created || new Date()).toISOString();
  if (created && created.toISOString().slice(0, 10) === date) return created.toISOString();
  return new Date(`${date}T09:00:00Z`).toISOString();
};

export const mainCurrencyOf = async (store: Store, uid: string) =>
  (await store.get<string>(`users/${uid}/erp/settings/mainCurrency`)) || (await store.get<string>(`sales/${uid}/settings/currency`)) || '';

const buyerOf = async (store: Store, uid: string, accountId: string | undefined | null): Promise<Party | undefined> => {
  if (!accountId) return undefined;
  const [acc, tax] = await Promise.all([
    store.get<any>(`users/${uid}/accounts/${accountId}`),
    store.get<PartyTax>(`users/${uid}/einvoice/parties/${accountId}`),
  ]);
  if (!acc && !tax) return undefined;
  return { ...(tax || {}), name: tax?.name || acc?.name || '-' };
};

const withCodes = async (store: Store, uid: string, lines: (Line & { itemId?: string | null })[]) => {
  const codes = (await store.get<Record<string, ItemCode>>(`users/${uid}/einvoice/itemCodes`)) || {};
  return lines.map(({ itemId, ...l }) => ({ ...l, ...(itemId && codes[itemId] ? codes[itemId] : {}) }));
};

export const loadDoc = async (store: Store, uid: string, key: string): Promise<EDoc> => {
  const { type, id } = parseKey(key);
  const override = (await store.get<Override>(`users/${uid}/einvoice/overrides/${key}`)) || {};
  const main = await mainCurrencyOf(store, uid);

  if (type === 'pos') {
    const inv = await store.get<any>(`sales/${uid}/invoices/${id}`);
    if (!inv) throw new SourceError('الفاتورة غير موجودة');
    if (inv.status && inv.status !== 'closed') throw new SourceError('لا تُرسل إلا الفواتير المغلقة');
    const items: any[] = Array.isArray(inv.items) ? inv.items : Object.values(inv.items || {});
    const lines: (Line & { itemId?: string | null })[] = items.map((i) => ({
      name: i.productName || '-',
      qty: num(i.quantity ?? 1),
      unitPrice: num(i.unitPrice),
      discountPct: 0,
      vatRate: num(i.vatRate),
      itemId: i.productId || null,
    }));
    if (!lines.length) throw new SourceError('الفاتورة بلا بنود');
    const pm: Record<string, PaymentMeans> = { cash: 'cash', card: 'card', transfer: 'transfer' };
    return {
      key,
      kind: 'invoice',
      number: String(inv.number || id),
      issuedAt: issuedAt(undefined, inv.createdAt || inv.date),
      currency: main,
      rateToTaxCurrency: 1,
      lines: await withCodes(store, uid, lines),
      allowances: inclusiveDiscountToAllowances(lines, num(inv.discount)),
      buyer: inv.customerName ? { name: String(inv.customerName) } : undefined,
      payment: pm[inv.paymentMethod] || 'cash',
    };
  }

  if (type === 'trade') {
    const inv = await store.get<any>(`users/${uid}/erp/invoices/${id}`);
    if (!inv) throw new SourceError('الفاتورة غير موجودة');
    if (inv.kind !== 'sale' && inv.kind !== 'saleReturn') throw new SourceError('الفوترة الإلكترونية لفواتير البيع ومرتجعاتها فقط');
    const items = (await store.get<Record<string, any>>(`users/${uid}/erp/items`)) || {};
    const raw: any[] = Array.isArray(inv.lines) ? inv.lines : Object.values(inv.lines || {});
    const vat = num(inv.vatPct);
    const lines: (Line & { itemId?: string | null })[] = raw
      .filter((l) => num(l.qty) > 0)
      .map((l) => ({
        name: l.description || items[l.itemId]?.name || '-',
        qty: num(l.qty),
        unitPrice: num(l.unitPrice),
        discountPct: num(l.discountPct),
        vatRate: vat,
        itemId: l.itemId || null,
      }));
    if (!lines.length) throw new SourceError('الفاتورة بلا بنود');
    const net = lines.reduce((s, l) => s + lineNet(l), 0);
    const allowance = round2((net * num(inv.discountPct)) / 100);
    const total = num(inv.totals?.total);
    return {
      key,
      kind: inv.kind === 'sale' ? 'invoice' : 'credit',
      number: `${inv.kind === 'sale' ? 'S' : 'SR'}-${inv.number}`,
      issuedAt: issuedAt(inv.date, inv.createdAt),
      currency: inv.currency || main,
      rateToTaxCurrency: (inv.currency || main) === main ? 1 : num(inv.exchangeRate) || 1,
      lines: await withCodes(store, uid, lines),
      allowances: allowance > 0 ? [{ rate: vat, amount: allowance }] : [],
      buyer: await buyerOf(store, uid, inv.partyId),
      billingRef: override.billingRef || inv.refNumber || undefined,
      billingRefUuid: override.billingRefUuid,
      reason: override.reason || inv.statement || undefined,
      payment: total > 0 && num(inv.paid) >= total - 0.005 ? 'cash' : 'credit',
    };
  }

  const note = await store.get<any>(`users/${uid}/erp/notes/${id}`);
  if (!note) throw new SourceError('الإشعار غير موجود');
  const currency = note.currency || main;
  return {
    key,
    kind: note.kind === 'debit' ? 'debit' : 'credit',
    number: `${note.kind === 'debit' ? 'DN' : 'CN'}-${note.number}`,
    issuedAt: issuedAt(note.date, note.createdAt),
    currency,
    rateToTaxCurrency: currency === main ? 1 : num(note.exchangeRate) || 1,
    lines: [{ name: note.statement || (note.kind === 'debit' ? 'إشعار مدين' : 'إشعار دائن'), qty: 1, unitPrice: num(note.amount), discountPct: 0, vatRate: num(note.vatPct) }],
    allowances: [],
    buyer: await buyerOf(store, uid, note.partyId),
    billingRef: override.billingRef,
    billingRefUuid: override.billingRefUuid,
    reason: override.reason || note.statement || undefined,
    payment: 'credit',
  };
};
