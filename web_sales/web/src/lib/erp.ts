// نماذج الويب وحده (الصناديق، المخازن، السندات، الشيكات) — تُحفظ تحت users/{uid}/erp.
// كل حركة منها تُترجم إلى قيود عادية (Operation) على حسابات الهاتف، فيرى الهاتف أثرها
// المالي مباشرة في أرصدة الحسابات، بينما تبقى تفاصيل المخزون والشيكات على الويب.

import { Operation } from './ledger';
import { AccountExtra } from './trade';

/* ───────── الإعدادات ───────── */

export interface ErpSettings {
  mainCurrency?: string;
  /** نص رسالة مطابقة الرصيد المخصص (يتزامن مع تطبيق الهاتف) */
  reconciliationTemplate?: string | null;
  /** إظهار تفاصيل العملات في المطابقة وكشف الحساب (الهاتف) */
  showCurrencyBreakdown?: boolean;
  /** ترتيب تصنيفات الحسابات (الهاتف) */
  categoryOrder?: string[];
  /** أصوات العمليات في الهاتف */
  soundsEnabled?: boolean;
  /** وقت آخر تغيير للعملة (ms) — الهاتف والويب يأخذان الأحدث */
  mainCurrencyUpdatedAt?: number;
  /** حساب "شيكات واردة / أوراق قبض" */
  chequesInAccountId?: string;
  /** حساب "شيكات صادرة / أوراق دفع" */
  chequesOutAccountId?: string;
  /** حسابات الفواتير (تُنشأ تلقائياً عند أول فاتورة إن لم تُحدَّد) */
  salesAccountId?: string;
  purchasesAccountId?: string;
  cogsAccountId?: string;
  vatAccountId?: string;
  /** نسبة الضريبة المضافة الافتراضية في الفواتير */
  defaultVatPct?: number;
  /** حساب مصروف الرواتب العام وحساب الاستقطاعات */
  salariesAccountId?: string;
  payrollDeductionsAccountId?: string;
  /** حساب الأرباح المحتجزة / المدوّرة لقيد الإقفال */
  retainedEarningsAccountId?: string;
  /** آخر تاريخ أُقفلت حتى نهايته الفترة المالية */
  closedUntil?: string;
  /** اختصارات لوحة المفاتيح التي غيّرها المستخدم: id → اختصار ("" = بلا اختصار) */
  shortcuts?: Record<string, string>;
}

export type AccountMeta = AccountExtra;

/* ───────── الصناديق ───────── */

export interface Cashbox {
  id: string;
  name: string;
  parentId?: string | null;
  /** عملة ثابتة للصندوق (فارغة = حرة) */
  currency?: string | null;
  /** سعر صرف ثابت للصندوق (فارغ = حر) */
  exchangeRate?: number | null;
  /** الحسابات المرتبطة: رصيد الصندوق = مجموع قيودها (كما في الهاتف) */
  linkedAccountIds: string[];
  /** حساب النقدية الذي تُسجَّل عليه سندات القبض والصرف لهذا الصندوق */
  cashAccountId?: string | null;
  note?: string;
  createdAt: string;
  /** صندوق مصدره تطبيق الهاتف (للعرض فقط) */
  fromPhone?: boolean;
}

export const parseCashbox = (key: string, j: any, fromPhone = false): Cashbox => ({
  id: j?.id || key,
  name: j?.name || '',
  parentId: j?.parentId || null,
  currency: j?.currency || null,
  exchangeRate: j?.exchangeRate != null && Number(j.exchangeRate) > 0 ? Number(j.exchangeRate) : null,
  linkedAccountIds: Array.isArray(j?.linkedAccountIds)
    ? j.linkedAccountIds.filter(Boolean)
    : j?.linkedAccountIds && typeof j.linkedAccountIds === 'object'
      ? Object.values(j.linkedAccountIds).filter(Boolean).map(String)
      : [],
  cashAccountId: j?.cashAccountId || null,
  note: j?.note || '',
  createdAt: j?.createdAt || '',
  fromPhone,
});

export interface CashboxBalance {
  total: number;
  byCurrency: Record<string, number>;
  /** رصيد الصندوق وحده بدون الأبناء */
  own: number;
}

/** نفس CashboxService.computeBalance في الهاتف: قيود الحسابات المرتبطة + أرصدة الأبناء */
export const cashboxBalance = (
  box: Cashbox,
  all: Cashbox[],
  opsByAccount: Record<string, Operation[]>,
  visited = new Set<string>(),
): CashboxBalance => {
  if (visited.has(box.id)) return { total: 0, byCurrency: {}, own: 0 };
  visited.add(box.id);
  let own = 0;
  const byCurrency: Record<string, number> = {};
  const accountIds = new Set([...box.linkedAccountIds, ...(box.cashAccountId ? [box.cashAccountId] : [])]);
  accountIds.forEach((id) => {
    for (const op of opsByAccount[id] || []) {
      own += op.amountUSD;
      byCurrency[op.currency] = (byCurrency[op.currency] || 0) + op.amount;
    }
  });
  let total = own;
  for (const child of all.filter((b) => b.parentId === box.id)) {
    const c = cashboxBalance(child, all, opsByAccount, visited);
    total += c.total;
    Object.entries(c.byCurrency).forEach(([k, v]) => (byCurrency[k] = (byCurrency[k] || 0) + v));
  }
  return { total, byCurrency, own };
};

/** هل يصبح parentId جداً لـ boxId؟ (منع الحلقات في الشجرة) */
export const isDescendant = (all: Cashbox[], ancestorId: string, candidateId: string): boolean => {
  const byId = new Map(all.map((b) => [b.id, b]));
  let cur = byId.get(candidateId);
  const seen = new Set<string>();
  while (cur?.parentId && !seen.has(cur.id)) {
    if (cur.parentId === ancestorId) return true;
    seen.add(cur.id);
    cur = byId.get(cur.parentId);
  }
  return false;
};

/* ───────── السندات (قبض / صرف / تحويل) ───────── */

export type VoucherType = 'receipt' | 'payment' | 'transfer';

export interface Voucher {
  id: string;
  number: number;
  type: VoucherType;
  boxId: string;
  /** للتحويل: الصندوق المستلم */
  toBoxId?: string | null;
  /** الطرف المقابل (زبون، مورد، موظف، حساب) */
  partyId?: string | null;
  amount: number;
  currency: string;
  exchangeRate: number;
  statement: string;
  date: string;
  opIds: string[];
  createdAt: string;
}

export const VOUCHER_LABELS: Record<VoucherType, string> = {
  receipt: 'سند قبض',
  payment: 'سند صرف',
  transfer: 'تحويل بين صناديق',
};

/* ───────── المخازن ───────── */

export interface Warehouse {
  id: string;
  name: string;
  location?: string;
  /** الصندوق الذي يُدفع منه ثمن المشتريات النقدية ويُقبض فيه ثمن المبيعات النقدية */
  cashboxId?: string | null;
  /** حساب المخزون (قيمة البضاعة) — قيود الشراء والبيع والتسوية تُسجَّل عليه */
  inventoryAccountId?: string | null;
  note?: string;
  createdAt: string;
}

export interface StockItem {
  id: string;
  name: string;
  code?: string;
  unit?: string;
  category?: string;
  /** سعر البيع الافتراضي */
  price?: number;
  /** حد أدنى للتنبيه */
  minQty?: number;
  /** حد إعادة الطلب والحد الأقصى للرصيد */
  reorderQty?: number;
  maxQty?: number;
  /** سعر الشراء الافتراضي */
  cost?: number;
  /** أسعار بيع إضافية (جملة، موزعين، ...) */
  prices?: number[];
  /** باركود ثانٍ (رقمي / حرفي) */
  barcode?: string;
  vatPct?: number;
  note?: string;
  createdAt: string;
}

export const PRICE_LEVELS = ['سعر البيع', 'سعر الجملة', 'سعر الموزّع', 'سعر خاص', 'سعر 5'];

export type StockMoveType = 'in' | 'out' | 'transfer' | 'adjust';

export interface StockMove {
  id: string;
  number: number;
  type: StockMoveType;
  warehouseId: string;
  toWarehouseId?: string | null;
  itemId: string;
  /** للتسوية: قد تكون سالبة */
  qty: number;
  /** تكلفة الوحدة وقت الحركة (متوسط مرجّح للصرف والتحويل) */
  unitCost: number;
  /** سعر بيع الوحدة (للصرف) */
  unitPrice?: number;
  payment?: 'cash' | 'credit' | null;
  partyId?: string | null;
  statement: string;
  date: string;
  opIds: string[];
  createdAt: string;
  /** حركة ناتجة عن فاتورة (لا تُحذف منفردة) */
  invoiceId?: string | null;
}

export const MOVE_LABELS: Record<StockMoveType, string> = {
  in: 'إدخال / شراء',
  out: 'إخراج / بيع',
  transfer: 'تحويل بين مخازن',
  adjust: 'تسوية جرد',
};

export interface StockLevel {
  qty: number;
  value: number;
  avgCost: number;
}

const key = (w: string, i: string) => `${w}::${i}`;

/** أرصدة الكميات والقيمة بالمتوسط المرجّح لكل (مخزن، صنف) */
export const stockLevels = (moves: StockMove[]) => {
  const levels: Record<string, StockLevel> = {};
  const get = (w: string, i: string) => (levels[key(w, i)] ??= { qty: 0, value: 0, avgCost: 0 });
  const sorted = [...moves].sort((a, b) => a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt));
  for (const m of sorted) {
    const from = get(m.warehouseId, m.itemId);
    if (m.type === 'in' || (m.type === 'adjust' && m.qty > 0)) {
      from.qty += m.qty;
      from.value += m.qty * m.unitCost;
    } else if (m.type === 'out' || m.type === 'adjust') {
      const q = Math.abs(m.qty);
      from.qty -= q;
      from.value -= q * m.unitCost;
    } else if (m.type === 'transfer' && m.toWarehouseId) {
      from.qty -= m.qty;
      from.value -= m.qty * m.unitCost;
      const to = get(m.toWarehouseId, m.itemId);
      to.qty += m.qty;
      to.value += m.qty * m.unitCost;
    }
  }
  Object.values(levels).forEach((l) => {
    if (Math.abs(l.qty) < 1e-9) {
      l.qty = 0;
      l.value = 0;
    }
    l.avgCost = l.qty > 0 ? l.value / l.qty : 0;
  });
  return {
    levels,
    of: (w: string, i: string): StockLevel => levels[key(w, i)] || { qty: 0, value: 0, avgCost: 0 },
  };
};

/* ───────── الشيكات ───────── */

export type ChequeDirection = 'in' | 'out';
export type ChequeStatus = 'portfolio' | 'collecting' | 'cleared' | 'returned' | 'endorsed' | 'issued';

export interface ChequeEvent {
  status: ChequeStatus;
  date: string;
  opIds: string[];
  note?: string;
  accountId?: string | null;
}

export interface Cheque {
  id: string;
  direction: ChequeDirection;
  number: string;
  bank: string;
  dueDate: string;
  amount: number;
  currency: string;
  exchangeRate: number;
  partyId: string;
  status: ChequeStatus;
  /** حساب البنك الذي أُودع فيه الشيك أو سُحب منه */
  bankAccountId?: string | null;
  /** لمن جُيّر الشيك الوارد */
  endorsedToId?: string | null;
  statement: string;
  history: ChequeEvent[];
  createdAt: string;
}

export const CHEQUE_STATUS: Record<ChequeStatus, { label: string; tone: 'info' | 'warning' | 'success' | 'danger' | 'neutral' | 'brand' }> = {
  portfolio: { label: 'في الحافظة', tone: 'info' },
  collecting: { label: 'تحت التحصيل', tone: 'warning' },
  cleared: { label: 'مصروفة', tone: 'success' },
  returned: { label: 'مرجعة', tone: 'danger' },
  endorsed: { label: 'مجيّرة للغير', tone: 'brand' },
  issued: { label: 'غير مصروفة', tone: 'warning' },
};

/** الانتقالات المسموحة لكل حالة */
export const CHEQUE_TRANSITIONS: Record<ChequeDirection, Partial<Record<ChequeStatus, ChequeStatus[]>>> = {
  in: {
    portfolio: ['collecting', 'cleared', 'endorsed', 'returned'],
    collecting: ['cleared', 'returned'],
    returned: ['portfolio'],
  },
  out: {
    issued: ['cleared', 'returned'],
    returned: ['issued'],
  },
};

export const nextNumber = (rows: Array<{ number: number }>) => rows.reduce((m, r) => Math.max(m, r.number || 0), 0) + 1;

export const objToList = <T>(value: any, parse: (key: string, v: any) => T): T[] =>
  value && typeof value === 'object' ? Object.entries(value).map(([k, v]) => parse(k, v)) : [];
