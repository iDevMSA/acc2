import { TaxCountry } from './countries';

// إعدادات الضريبة المحفوظة في sales/{uid}/taxSettings (عقدة جديدة، لا يقرؤها تطبيق الهاتف)
// كل حساب يمكنه تعديل قيم دولته؛ الحقول الاختيارية غير المحفوظة تأخذ قيمة الدولة الافتراضية
export interface TaxSettings {
  countryCode: string;
  trn: string;
  standardRate: number;
  reducedRates?: number[];
  hasVat?: boolean;
  taxName?: string;
  filing?: TaxCountry['filing'];
}

// ملف الدولة بعد تطبيق تعديلات الحساب
export const effectiveCountry = (country: TaxCountry, settings?: Partial<TaxSettings> | null): TaxCountry => {
  if (!settings) return country;
  return {
    ...country,
    taxName: settings.taxName?.trim() || country.taxName,
    standardRate: settings.standardRate ?? country.standardRate,
    reducedRates: settings.reducedRates ?? country.reducedRates,
    hasVat: settings.hasVat ?? country.hasVat,
    filing: settings.filing ?? country.filing,
  };
};

// "5، 10 ,0" ← [10, 5, 0]؛ يرجع null إذا كانت هناك قيمة غير صالحة
export const parseRates = (text: string): number[] | null => {
  const parts = text.split(/[,،\s]+/).filter(Boolean);
  const rates = parts.map(Number);
  if (rates.some((r) => isNaN(r) || r < 0 || r > 100)) return null;
  return Array.from(new Set(rates)).sort((a, b) => b - a);
};

// نفس بنية الفاتورة التي يكتبها تطبيق Flutter في sales/{uid}/invoices
export interface SalesInvoiceItem {
  productName?: string;
  quantity: number;
  unitPrice: number;
  vatRate?: number;
}

export interface SalesInvoice {
  number?: string;
  status?: string;
  createdAt?: string;
  discount?: number;
  items?: SalesInvoiceItem[];
}

export interface RateLine {
  rate: number;
  taxable: number;
  tax: number;
}

export interface InvoiceTax {
  subtotal: number;
  tax: number;
  discount: number;
  total: number;
  byRate: RateLine[];
}

const round2 = (n: number) => Math.round(n * 100) / 100;

// مطابق لحساب Invoice في lib/sales_sys/smain.dart: الضريبة على (الكمية × السعر) لكل بند، والخصم بعد الضريبة
export const computeInvoiceTax = (inv: SalesInvoice): InvoiceTax => {
  const rates = new Map<number, RateLine>();
  let subtotal = 0;
  let tax = 0;
  for (const item of inv.items || []) {
    const base = (Number(item.quantity) || 0) * (Number(item.unitPrice) || 0);
    const rate = Number(item.vatRate) || 0;
    const itemTax = (base * rate) / 100;
    subtotal += base;
    tax += itemTax;
    const line = rates.get(rate) || { rate, taxable: 0, tax: 0 };
    line.taxable += base;
    line.tax += itemTax;
    rates.set(rate, line);
  }
  const discount = Number(inv.discount) || 0;
  return {
    subtotal: round2(subtotal),
    tax: round2(tax),
    discount: round2(discount),
    total: round2(subtotal + tax - discount),
    byRate: Array.from(rates.values())
      .map((l) => ({ rate: l.rate, taxable: round2(l.taxable), tax: round2(l.tax) }))
      .sort((a, b) => b.rate - a.rate),
  };
};

export interface TaxReport {
  invoiceCount: number;
  taxableSales: number;
  zeroRatedSales: number;
  outputTax: number;
  byRate: RateLine[];
  // بنود بمعدل غير معروف في ملف الدولة — غالباً خطأ في إعداد المنتج
  invalidRateInvoices: string[];
}

export const allowedRates = (country: TaxCountry, settings?: Partial<TaxSettings>): number[] => {
  const c = effectiveCountry(country, settings);
  if (!c.hasVat) return [0];
  return Array.from(new Set([c.standardRate, ...c.reducedRates, 0]));
};

const inPeriod = (createdAt: string | undefined, from?: Date, to?: Date) => {
  if (!from && !to) return true;
  const d = createdAt ? new Date(createdAt) : null;
  if (!d || isNaN(d.getTime())) return false;
  if (from && d < from) return false;
  if (to && d > to) return false;
  return true;
};

export const buildTaxReport = (
  invoices: Record<string, SalesInvoice>,
  country: TaxCountry,
  settings?: Partial<TaxSettings>,
  from?: Date,
  to?: Date,
): TaxReport => {
  const allowed = allowedRates(country, settings);
  const rates = new Map<number, RateLine>();
  const invalid: string[] = [];
  let count = 0;

  for (const [id, inv] of Object.entries(invoices || {})) {
    // الفواتير الملغاة/المعلقة لا تدخل الإقرار
    if (inv.status && inv.status !== 'closed') continue;
    if (!inPeriod(inv.createdAt, from, to)) continue;
    count++;
    const t = computeInvoiceTax(inv);
    for (const l of t.byRate) {
      const line = rates.get(l.rate) || { rate: l.rate, taxable: 0, tax: 0 };
      line.taxable += l.taxable;
      line.tax += l.tax;
      rates.set(l.rate, line);
      if (!allowed.includes(l.rate) && !invalid.includes(id)) invalid.push(id);
    }
  }

  const byRate = Array.from(rates.values())
    .map((l) => ({ rate: l.rate, taxable: round2(l.taxable), tax: round2(l.tax) }))
    .sort((a, b) => b.rate - a.rate);

  return {
    invoiceCount: count,
    taxableSales: round2(byRate.filter((l) => l.rate > 0).reduce((s, l) => s + l.taxable, 0)),
    zeroRatedSales: round2(byRate.filter((l) => l.rate === 0).reduce((s, l) => s + l.taxable, 0)),
    outputTax: round2(byRate.reduce((s, l) => s + l.tax, 0)),
    byRate,
    invalidRateInvoices: invalid,
  };
};

export const validateTrn = (country: TaxCountry, trn: string): boolean => {
  if (!trn) return !country.hasVat;
  return country.trnPattern ? country.trnPattern.test(trn.trim()) : trn.trim().length > 0;
};

// UTF-8 بدون TextEncoder (غير متوفر في بيئة اختبارات jsdom)
const utf8Bytes = (s: string): number[] =>
  Array.from(encodeURIComponent(s).replace(/%([0-9A-F]{2})/g, (_, h) => String.fromCharCode(parseInt(h, 16))))
    .map((c) => c.charCodeAt(0));

// رمز QR للفاتورة المبسطة في السعودية (ZATCA المرحلة الأولى): TLV ثم Base64
// الحقول: 1 اسم البائع، 2 الرقم الضريبي، 3 وقت الفاتورة، 4 الإجمالي شامل الضريبة، 5 مبلغ الضريبة
export const zatcaQrBase64 = (
  sellerName: string,
  vatNumber: string,
  timestamp: string,
  total: number,
  vatTotal: number,
): string => {
  const fields = [sellerName, vatNumber, timestamp, total.toFixed(2), vatTotal.toFixed(2)];
  const bytes: number[] = [];
  fields.forEach((value, i) => {
    const v = utf8Bytes(value);
    if (v.length > 255) throw new Error('ZATCA TLV field too long');
    bytes.push(i + 1, v.length, ...v);
  });
  let bin = '';
  bytes.forEach((b) => (bin += String.fromCharCode(b)));
  return btoa(bin);
};

/* ───────── الإقرار الكامل: ضريبة المخرجات − ضريبة المدخلات ───────── */

// فاتورة أو إشعار من الويب (users/{uid}/erp) بالحقول التي يحتاجها الإقرار
export interface TradeTaxDoc {
  id: string;
  number: string;
  /** sale / saleReturn / purchase / purchaseReturn، أو إشعار (debit/credit) مع جهة الطرف */
  kind: 'sale' | 'saleReturn' | 'purchase' | 'purchaseReturn';
  date: string;
  party: string;
  /** الصافي قبل الضريبة والضريبة، بعملة الفاتورة */
  net: number;
  vat: number;
  vatPct: number;
  /** عدد وحدات عملة الفاتورة مقابل وحدة من العملة الرئيسية (المبلغ الرئيسي = المبلغ ÷ السعر) */
  exchangeRate: number;
}

export interface VatSection {
  count: number;
  taxable: number;
  zeroRated: number;
  tax: number;
  byRate: RateLine[];
}

export interface VatReturn {
  /** فواتير نقاط البيع + فواتير البيع والإشعارات المدينة للعملاء */
  sales: VatSection;
  /** مرتجعات البيع والإشعارات الدائنة للعملاء (تُطرح) */
  salesReturns: VatSection;
  /** فواتير الشراء والإشعارات الدائنة من الموردين */
  purchases: VatSection;
  /** مرتجعات الشراء والإشعارات المدينة للموردين (تُطرح) */
  purchaseReturns: VatSection;
  outputTax: number;
  inputTax: number;
  /** موجب = مستحق للجهة الضريبية، سالب = رصيد مسترد */
  net: number;
  /** المستندات التي دخلت الإقرار (للعرض والتصدير) */
  docs: (TradeTaxDoc & { source: 'pos' | 'trade' })[];
  invalidRateInvoices: string[];
}

const emptySection = (): VatSection => ({ count: 0, taxable: 0, zeroRated: 0, tax: 0, byRate: [] });

const addTo = (s: VatSection, rate: number, taxable: number, tax: number) => {
  let line = s.byRate.find((l) => l.rate === rate);
  if (!line) s.byRate.push((line = { rate, taxable: 0, tax: 0 }));
  line.taxable += taxable;
  line.tax += tax;
};

const finish = (s: VatSection): VatSection => {
  const byRate = s.byRate.map((l) => ({ rate: l.rate, taxable: round2(l.taxable), tax: round2(l.tax) })).sort((a, b) => b.rate - a.rate);
  return {
    count: s.count,
    byRate,
    taxable: round2(byRate.filter((l) => l.rate > 0).reduce((t, l) => t + l.taxable, 0)),
    zeroRated: round2(byRate.filter((l) => l.rate === 0).reduce((t, l) => t + l.taxable, 0)),
    tax: round2(byRate.reduce((t, l) => t + l.tax, 0)),
  };
};

const inDateRange = (date: string, from?: Date, to?: Date) => inPeriod(date && date.length === 10 ? `${date}T12:00:00` : date, from, to);

export const buildVatReturn = (
  posInvoices: Record<string, SalesInvoice>,
  tradeDocs: TradeTaxDoc[],
  country: TaxCountry,
  settings?: Partial<TaxSettings>,
  from?: Date,
  to?: Date,
): VatReturn => {
  const pos = buildTaxReport(posInvoices, country, settings, from, to);
  const sections = { sales: emptySection(), salesReturns: emptySection(), purchases: emptySection(), purchaseReturns: emptySection() };
  pos.byRate.forEach((l) => addTo(sections.sales, l.rate, l.taxable, l.tax));
  sections.sales.count = pos.invoiceCount;

  const allowed = allowedRates(country, settings);
  const invalid = [...pos.invalidRateInvoices];
  const docs: VatReturn['docs'] = [];
  const target: Record<TradeTaxDoc['kind'], VatSection> = {
    sale: sections.sales,
    saleReturn: sections.salesReturns,
    purchase: sections.purchases,
    purchaseReturn: sections.purchaseReturns,
  };
  for (const d of tradeDocs) {
    if (!inDateRange(d.date, from, to)) continue;
    const rate = d.exchangeRate > 0 ? d.exchangeRate : 1;
    const s = target[d.kind];
    s.count++;
    addTo(s, d.vatPct, d.net / rate, d.vat / rate);
    docs.push({ ...d, source: 'trade' });
    if ((d.kind === 'sale' || d.kind === 'saleReturn') && !allowed.includes(d.vatPct)) invalid.push(d.number);
  }

  const done = {
    sales: finish(sections.sales),
    salesReturns: finish(sections.salesReturns),
    purchases: finish(sections.purchases),
    purchaseReturns: finish(sections.purchaseReturns),
  };
  const outputTax = round2(done.sales.tax - done.salesReturns.tax);
  const inputTax = round2(done.purchases.tax - done.purchaseReturns.tax);
  return { ...done, outputTax, inputTax, net: round2(outputTax - inputTax), docs, invalidRateInvoices: invalid };
};
