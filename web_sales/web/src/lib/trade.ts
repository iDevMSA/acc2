// المستندات التجارية والإدارية للويب وحده (الفواتير متعددة الأصناف ومرتجعاتها، العروض والطلبيات،
// الإشعارات المدينة والدائنة، كشوف الرواتب، أسعار العملات) — تُحفظ تحت users/{uid}/erp/...
// وكل مستند يُترجم إلى قيود عادية (Operation) على حسابات الهاتف، كما في erp.ts.

/* ───────── الفواتير ───────── */

export type InvoiceKind = 'sale' | 'purchase' | 'saleReturn' | 'purchaseReturn';
export type QuoteKind = 'quote' | 'order';
export type TradeSide = 'sale' | 'purchase';

export const INVOICE_LABELS: Record<InvoiceKind, string> = {
  sale: 'فاتورة بيع',
  purchase: 'فاتورة شراء',
  saleReturn: 'مرتجع بيع',
  purchaseReturn: 'مرتجع شراء',
};

export const INVOICE_TONE: Record<InvoiceKind, 'success' | 'danger' | 'warning' | 'info'> = {
  sale: 'success',
  purchase: 'info',
  saleReturn: 'warning',
  purchaseReturn: 'danger',
};

/** جهة الفاتورة: البيع ومرتجعه مع الزبائن، والشراء ومرتجعه مع الموردين */
export const sideOf = (k: InvoiceKind): TradeSide => (k === 'sale' || k === 'saleReturn' ? 'sale' : 'purchase');
/** هل تُدخل الفاتورة بضاعة للمخزن؟ */
export const stockInOf = (k: InvoiceKind) => k === 'purchase' || k === 'saleReturn';

export const QUOTE_LABELS: Record<QuoteKind, Record<TradeSide, string>> = {
  quote: { sale: 'عرض سعر لزبون', purchase: 'عرض سعر من مورد' },
  order: { sale: 'طلبية من زبون', purchase: 'طلبية لمورد' },
};

export interface TradeLine {
  /** صنف من المخزن — أو فارغ لبند خدمة / مصروف يُرحّل على حساب */
  itemId?: string | null;
  /** لبند الخدمة: الحساب (إيراد للبيع، مصروف للشراء) */
  accountId?: string | null;
  warehouseId?: string | null;
  description: string;
  qty: number;
  unitPrice: number;
  /** خصم البند بالنسبة المئوية */
  discountPct: number;
  /** كمية إضافية مجانية (بونص) — تدخل المخزن/تخرج منه دون قيمة */
  bonusQty?: number;
}

export interface TradeTotals {
  gross: number;
  lineDiscounts: number;
  invoiceDiscount: number;
  net: number;
  vat: number;
  total: number;
}

export interface TradeDocBase {
  id: string;
  number: number;
  partyId: string;
  date: string;
  dueDate?: string;
  currency: string;
  exchangeRate: number;
  lines: TradeLine[];
  /** خصم إجمالي على الفاتورة بالنسبة المئوية */
  discountPct: number;
  vatPct: number;
  statement: string;
  createdAt: string;
}

export interface Invoice extends TradeDocBase {
  kind: InvoiceKind;
  /** المبلغ المقبوض/المدفوع نقداً مع الفاتورة (بعملة الفاتورة) */
  paid: number;
  cashboxId?: string | null;
  /** رقم فاتورة المقاصة/الأصلية (للمرتجعات) */
  refNumber?: string;
  /** المصدر إن حُوِّلت من عرض أو طلبية */
  quoteId?: string | null;
  totals: TradeTotals;
  /** حركات المخزن الناتجة (erp/stockMoves) */
  moveIds: string[];
  opIds: string[];
}

export type QuoteStatus = 'open' | 'converted' | 'cancelled';

export interface Quote extends TradeDocBase {
  kind: QuoteKind;
  side: TradeSide;
  status: QuoteStatus;
  /** صلاحية العرض */
  validUntil?: string;
  invoiceId?: string | null;
  totals: TradeTotals;
}

const r6 = (n: number) => Math.round(n * 1e6) / 1e6;

export const lineNet = (l: TradeLine) => r6((Number(l.qty) || 0) * (Number(l.unitPrice) || 0) * (1 - (Number(l.discountPct) || 0) / 100));

export const computeTotals = (lines: TradeLine[], discountPct: number, vatPct: number): TradeTotals => {
  const gross = lines.reduce((s, l) => s + (Number(l.qty) || 0) * (Number(l.unitPrice) || 0), 0);
  const afterLines = lines.reduce((s, l) => s + lineNet(l), 0);
  const invoiceDiscount = afterLines * ((Number(discountPct) || 0) / 100);
  const net = afterLines - invoiceDiscount;
  const vat = net * ((Number(vatPct) || 0) / 100);
  return {
    gross: r6(gross),
    lineDiscounts: r6(gross - afterLines),
    invoiceDiscount: r6(invoiceDiscount),
    net: r6(net),
    vat: r6(vat),
    total: r6(net + vat),
  };
};

/** صافي البند بعد توزيع خصم الفاتورة عليه (لترحيل كل بند على حسابه) */
export const lineShare = (l: TradeLine, discountPct: number) => r6(lineNet(l) * (1 - (Number(discountPct) || 0) / 100));

export const parseLines = (v: any): TradeLine[] =>
  (Array.isArray(v) ? v : v && typeof v === 'object' ? Object.values(v) : []).map((l: any) => ({
    itemId: l?.itemId || null,
    accountId: l?.accountId || null,
    warehouseId: l?.warehouseId || null,
    description: l?.description || '',
    qty: Number(l?.qty) || 0,
    unitPrice: Number(l?.unitPrice) || 0,
    discountPct: Number(l?.discountPct) || 0,
    bonusQty: Number(l?.bonusQty) || 0,
  }));

/** المتبقي على الطرف من الفاتورة (بعملتها) */
export const invoiceDue = (inv: Invoice) => r6((inv.totals?.total || 0) - (inv.paid || 0));

/* ───────── الإشعارات المدينة والدائنة ───────── */

export type NoteKind = 'debit' | 'credit';

export const NOTE_LABELS: Record<NoteKind, string> = {
  debit: 'إشعار مدين',
  credit: 'إشعار دائن',
};

/** إشعار مدين: يزيد ما لنا على الطرف (مثل فرق سعر أو مصاريف محمّلة عليه)
 *  إشعار دائن: يخفّض ما لنا عليه (خصم مسموح به، تعويض، تسوية لصالحه) */
export interface Note {
  id: string;
  number: number;
  kind: NoteKind;
  partyId: string;
  /** الحساب المقابل (إيراد/مصروف/خصم مسموح به ...) */
  counterAccountId: string;
  amount: number;
  currency: string;
  exchangeRate: number;
  vatPct: number;
  statement: string;
  date: string;
  opIds: string[];
  createdAt: string;
}

/* ───────── الموظفون والرواتب ───────── */

export interface EmployeeInfo {
  jobTitle?: string;
  hireDate?: string;
  salary?: number;
  allowances?: number;
  deductions?: number;
  currency?: string;
  children?: number;
  /** حساب مصروف الرواتب الخاص بالموظف (فارغ = الحساب العام في الإعدادات) */
  salaryAccountId?: string | null;
  nationalId?: string;
}

export interface PayrollLine {
  employeeId: string;
  basic: number;
  allowances: number;
  overtime: number;
  deductions: number;
  advances: number;
  net: number;
  note?: string;
}

export interface Payroll {
  id: string;
  number: number;
  /** yyyy-mm */
  month: string;
  date: string;
  currency: string;
  exchangeRate: number;
  lines: PayrollLine[];
  /** cash = يُصرف نقداً من الصندوق، post = يُرحَّل لحسابات الموظفين فقط */
  payment: 'cash' | 'post';
  cashboxId?: string | null;
  statement: string;
  opIds: string[];
  createdAt: string;
}

export const payrollNet = (l: Omit<PayrollLine, 'net'>) =>
  r6((Number(l.basic) || 0) + (Number(l.allowances) || 0) + (Number(l.overtime) || 0) - (Number(l.deductions) || 0) - (Number(l.advances) || 0));

export const payrollGross = (l: PayrollLine) => r6((l.basic || 0) + (l.allowances || 0) + (l.overtime || 0));

/* ───────── أسعار العملات ───────── */

/** سعر عملة في تاريخ: كم وحدة منها تساوي 1 من العملة الرئيسية (نفس تعريف exchangeRate في القيود) */
export interface RateEntry {
  id: string;
  currency: string;
  date: string;
  rate: number;
  createdAt: string;
}

/** آخر سعر مسجّل للعملة حتى التاريخ المحدد */
export const rateOn = (rates: RateEntry[], currency: string, date?: string): number | null => {
  const d = (date || '9999').slice(0, 16);
  let best: RateEntry | null = null;
  for (const r of rates) {
    if (r.currency !== currency || r.date.slice(0, 16) > d) continue;
    if (!best || r.date > best.date) best = r;
  }
  return best ? best.rate : null;
};

/* ───────── بيانات الحسابات الإضافية (الموازنة والطبيعة والتجميد) ───────── */

export type AccountNature = 'debit' | 'credit' | 'both';

export const NATURE_LABELS: Record<AccountNature, string> = {
  debit: 'مدين فقط (لنا)',
  credit: 'دائن فقط (لهم)',
  both: 'مدين / دائن',
};

export interface AccountExtra {
  role?: string;
  note?: string;
  /** الموازنة السنوية (الرصيد التقديري) بالعملة الرئيسية — قيمة مطلقة */
  budget?: number;
  nature?: AccountNature;
  /** حساب مجمّد: يُمنع إدخال قيود جديدة عليه من المنصة */
  frozen?: boolean;
  /** نسبة الخصم التجاري الافتراضية في الفواتير */
  discountPct?: number;
  /** حد الائتمان: تنبيه عند تجاوز رصيد الزبون له */
  creditLimit?: number;
  employee?: EmployeeInfo;
}

/** هل يخالف الرصيد طبيعة الحساب؟ */
export const natureMismatch = (nature: AccountNature | undefined, balance: number) =>
  (nature === 'debit' && balance < -0.005) || (nature === 'credit' && balance > 0.005);

/* ───────── أعمار الديون ───────── */

export const AGE_BUCKETS = ['0-30', '31-60', '61-90', '91-180', '+180'] as const;

/** توزيع رصيد مدين على أعمار حسب أقدم القيود غير المسددة (الوارد أولاً يُسدَّد أولاً) */
export const ageBalance = (ops: Array<{ date: string; amountUSD: number }>, asOf: Date) => {
  const debits = ops
    .filter((o) => o.amountUSD > 0)
    .map((o) => ({ date: o.date, left: o.amountUSD }))
    .sort((a, b) => a.date.localeCompare(b.date));
  let credit = ops.filter((o) => o.amountUSD < 0).reduce((s, o) => s - o.amountUSD, 0);
  for (const d of debits) {
    const take = Math.min(d.left, credit);
    d.left -= take;
    credit -= take;
    if (credit <= 0) break;
  }
  const buckets = [0, 0, 0, 0, 0];
  debits.forEach((d) => {
    if (d.left <= 0.0001) return;
    const days = Math.floor((asOf.getTime() - new Date(d.date).getTime()) / 86400000);
    const i = days <= 30 ? 0 : days <= 60 ? 1 : days <= 90 ? 2 : days <= 180 ? 3 : 4;
    buckets[i] += d.left;
  });
  return buckets;
};
