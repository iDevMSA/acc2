import { TaxCountry } from './countries';

// إعدادات الضريبة المحفوظة في sales/{uid}/taxSettings (عقدة جديدة، لا يقرؤها تطبيق الهاتف)
export interface TaxSettings {
  countryCode: string;
  trn: string;
  standardRate: number; // يسمح بتعديل المعدل الافتراضي للدولة
}

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
  if (!country.hasVat) return [0];
  const standard = settings?.standardRate ?? country.standardRate;
  return Array.from(new Set([standard, ...country.reducedRates, 0]));
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
