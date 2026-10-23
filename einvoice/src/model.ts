// نموذج موحّد للمستند قبل تحويله إلى UBL (ZATCA) أو JSON (ETA)، مع حساب المبالغ بقواعد التقريب المعتمدة.

export type DocKind = 'invoice' | 'credit' | 'debit';
export type PaymentMeans = 'cash' | 'card' | 'transfer' | 'credit';

export interface Party {
  name: string;
  /** الرقم الضريبي (VAT في السعودية، رقم التسجيل الضريبي في مصر) */
  vatNumber?: string;
  /** السجل التجاري أو معرّف آخر (CRN في ZATCA) */
  crn?: string;
  /** رقم قومي / هوية لشخص طبيعي (ETA: النوع P) */
  nationalId?: string;
  street?: string;
  building?: string;
  district?: string;
  city?: string;
  postalCode?: string;
  /** المحافظة (ETA) */
  governate?: string;
  /** ISO alpha-2 */
  country?: string;
  /** ETA: B شركة، P شخص، F أجنبي */
  type?: 'B' | 'P' | 'F';
}

export interface Line {
  name: string;
  qty: number;
  unitPrice: number;
  discountPct: number;
  vatRate: number;
  /** ETA: نوع الترميز ورمز الصنف ووحدة القياس */
  itemType?: 'EGS' | 'GS1';
  itemCode?: string;
  unitType?: string;
}

export interface EDoc {
  /** مفتاح ثابت للمستند: pos_{id} أو trade_{id} أو note_{id} */
  key: string;
  kind: DocKind;
  number: string;
  /** وقت الإصدار ISO */
  issuedAt: string;
  currency: string;
  /** سعر الصرف إلى عملة الضريبة (SAR/EGP) — 1 إذا كانت نفسها */
  rateToTaxCurrency: number;
  lines: Line[];
  /** خصومات على مستوى المستند، قبل الضريبة، لكل نسبة ضريبة */
  allowances: { rate: number; amount: number }[];
  buyer?: Party;
  /** رقم الفاتورة الأصلية للإشعار الدائن/المدين */
  billingRef?: string;
  /** معرّف ETA للفاتورة الأصلية (إلزامي في الإشعارات) */
  billingRefUuid?: string;
  /** سبب الإشعار */
  reason?: string;
  payment: PaymentMeans;
}

export const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
export const round5 = (n: number) => Math.round((n + Number.EPSILON) * 1e5) / 1e5;

export const lineNet = (l: Line) => round2(l.qty * l.unitPrice * (1 - (l.discountPct || 0) / 100));
export const lineGross = (l: Line) => round2(l.qty * l.unitPrice);

export interface RateTotal {
  rate: number;
  taxable: number;
  tax: number;
}

export interface Totals {
  lineExtension: number;
  allowance: number;
  taxExclusive: number;
  tax: number;
  taxInclusive: number;
  byRate: RateTotal[];
}

export const computeTotals = (doc: Pick<EDoc, 'lines' | 'allowances'>): Totals => {
  const rates = new Map<number, RateTotal>();
  for (const l of doc.lines) {
    const r = rates.get(l.vatRate) || { rate: l.vatRate, taxable: 0, tax: 0 };
    r.taxable = round2(r.taxable + lineNet(l));
    rates.set(l.vatRate, r);
  }
  for (const a of doc.allowances) {
    const r = rates.get(a.rate) || { rate: a.rate, taxable: 0, tax: 0 };
    r.taxable = round2(r.taxable - a.amount);
    rates.set(a.rate, r);
  }
  const byRate = [...rates.values()]
    .map((r) => ({ ...r, tax: round2((r.taxable * r.rate) / 100) }))
    .sort((a, b) => b.rate - a.rate);
  const lineExtension = round2(doc.lines.reduce((s, l) => s + lineNet(l), 0));
  const allowance = round2(doc.allowances.reduce((s, a) => s + a.amount, 0));
  const taxExclusive = round2(lineExtension - allowance);
  const tax = round2(byRate.reduce((s, r) => s + r.tax, 0));
  return { lineExtension, allowance, taxExclusive, tax, taxInclusive: round2(taxExclusive + tax), byRate };
};

/**
 * خصم بعد الضريبة (كما في فواتير نقاط البيع في تطبيق الهاتف) ← خصومات قبل الضريبة لكل نسبة،
 * موزّعة حسب نصيب كل نسبة من الإجمالي شامل الضريبة.
 */
export const inclusiveDiscountToAllowances = (lines: Line[], discount: number): EDoc['allowances'] => {
  if (!(discount > 0)) return [];
  const incl = new Map<number, number>();
  for (const l of lines) incl.set(l.vatRate, (incl.get(l.vatRate) || 0) + lineNet(l) * (1 + l.vatRate / 100));
  const total = [...incl.values()].reduce((s, v) => s + v, 0);
  if (total <= 0) return [];
  return [...incl.entries()]
    .map(([rate, v]) => ({ rate, amount: round2((discount * (v / total)) / (1 + rate / 100)) }))
    .filter((a) => a.amount > 0);
};
