import { TAX_COUNTRIES, findTaxCountry } from './countries';
import {
  allowedRates,
  buildTaxReport,
  buildVatReturn,
  computeInvoiceTax,
  effectiveCountry,
  parseRates,
  validateTrn,
  zatcaQrBase64,
} from './taxEngine';

const SA = findTaxCountry('SA')!;
const EG = findTaxCountry('EG')!;
const KW = findTaxCountry('KW')!;

test('computeInvoiceTax matches Flutter invoice math', () => {
  const t = computeInvoiceTax({
    discount: 5,
    items: [
      { quantity: 2, unitPrice: 50, vatRate: 15 },
      { quantity: 1, unitPrice: 20, vatRate: 0 },
    ],
  });
  expect(t.subtotal).toBe(120);
  expect(t.tax).toBe(15);
  expect(t.total).toBe(130);
  expect(t.byRate).toEqual([
    { rate: 15, taxable: 100, tax: 15 },
    { rate: 0, taxable: 20, tax: 0 },
  ]);
});

test('buildTaxReport filters by status and period, flags unknown rates', () => {
  const invoices = {
    a: { status: 'closed', createdAt: '2026-07-10T10:00:00', items: [{ quantity: 1, unitPrice: 100, vatRate: 15 }] },
    b: { status: 'closed', createdAt: '2026-08-01T10:00:00', items: [{ quantity: 1, unitPrice: 50, vatRate: 5 }] },
    c: { status: 'cancelled', createdAt: '2026-07-11T10:00:00', items: [{ quantity: 1, unitPrice: 999, vatRate: 15 }] },
    d: { status: 'closed', createdAt: '2026-10-05T10:00:00', items: [{ quantity: 1, unitPrice: 100, vatRate: 15 }] },
  };
  const r = buildTaxReport(invoices, SA, undefined, new Date('2026-07-01'), new Date('2026-09-30T23:59:59'));
  expect(r.invoiceCount).toBe(2);
  expect(r.taxableSales).toBe(150);
  expect(r.outputTax).toBe(17.5);
  expect(r.invalidRateInvoices).toEqual(['b']);
});

test('reduced rates are allowed per country', () => {
  const r = buildTaxReport(
    { x: { items: [{ quantity: 1, unitPrice: 100, vatRate: 5 }] } },
    EG,
  );
  expect(r.invalidRateInvoices).toEqual([]);
  expect(r.outputTax).toBe(5);
});

test('countries without VAT flag any taxed item', () => {
  const r = buildTaxReport({ x: { items: [{ quantity: 1, unitPrice: 10, vatRate: 5 }] } }, KW);
  expect(r.invalidRateInvoices).toEqual(['x']);
});

test('validateTrn', () => {
  expect(validateTrn(SA, '300000000000003')).toBe(true);
  expect(validateTrn(SA, '123456789012345')).toBe(false);
  expect(validateTrn(KW, '')).toBe(true);
});

test('zatcaQrBase64 encodes TLV fields', () => {
  // المثال المنشور في دليل ZATCA
  const qr = zatcaQrBase64('Bobs Records', '310122393500003', '2022-04-25T15:30:00Z', 1000, 150);
  expect(qr).toBe(
    'AQxCb2JzIFJlY29yZHMCDzMxMDEyMjM5MzUwMDAwMwMUMjAyMi0wNC0yNVQxNTozMDowMFoEBzEwMDAuMDAFBjE1MC4wMA==',
  );
  const bytes = Buffer.from(qr, 'base64');
  expect(bytes[0]).toBe(1);
  expect(bytes[1]).toBe('Bobs Records'.length);
});

test('country list matches the countries chosen for the ERP', () => {
  expect(TAX_COUNTRIES.map((c) => c.code).sort()).toEqual(
    ['AE', 'BH', 'EG', 'IQ', 'JO', 'KW', 'LB', 'OM', 'PS', 'QA', 'SA', 'SY', 'YE'],
  );
});

test('account overrides replace country defaults', () => {
  const c = effectiveCountry(SA, { standardRate: 12, reducedRates: [5], taxName: 'ضريبة مخصصة' });
  expect(c.standardRate).toBe(12);
  expect(c.taxName).toBe('ضريبة مخصصة');
  expect(c.filing).toBe(SA.filing);
  expect(allowedRates(SA, { standardRate: 12, reducedRates: [5] }).sort()).toEqual([0, 12, 5].sort());
  // تعطيل الضريبة لحساب غير مسجل
  expect(allowedRates(SA, { hasVat: false })).toEqual([0]);
  // تفعيل الضريبة لدولة بلا ضريبة عامة
  expect(allowedRates(KW, { hasVat: true, standardRate: 5 })).toContain(5);
});

test('parseRates accepts Arabic and Latin separators', () => {
  expect(parseRates('5، 10 ,0')).toEqual([10, 5, 0]);
  expect(parseRates('')).toEqual([]);
  expect(parseRates('5, abc')).toBeNull();
  expect(parseRates('150')).toBeNull();
});

test('VAT return deducts input tax from purchases and nets returns', () => {
  const pos = { p1: { status: 'closed', createdAt: '2026-10-05T10:00:00Z', items: [{ quantity: 2, unitPrice: 100, vatRate: 15 }] } };
  const doc = (kind: any, net: number, vatPct = 15, extra: object = {}) => ({
    id: kind, number: kind, kind, date: '2026-10-10', party: 'x', net, vat: (net * vatPct) / 100, vatPct, exchangeRate: 1, ...extra,
  });
  const r = buildVatReturn(
    pos,
    [
      doc('sale', 1000),
      doc('saleReturn', 100),
      doc('purchase', 600),
      doc('purchaseReturn', 50),
      // فاتورة شراء بالدولار: 100 دولار بسعر 0.2667 دولار لكل ريال ← 375 ريال
      { ...doc('purchase', 100), id: 'usd', exchangeRate: 0.26666667 },
      // خارج الفترة
      { ...doc('purchase', 9999), date: '2026-12-01' },
    ],
    SA,
    undefined,
    new Date('2026-10-01T00:00:00'),
    new Date('2026-10-31T23:59:59'),
  );
  expect(r.sales.tax).toBe(180); // 30 من نقاط البيع + 150
  expect(r.salesReturns.tax).toBe(15);
  expect(r.outputTax).toBe(165);
  expect(r.purchases.count).toBe(2);
  expect(r.purchases.tax).toBe(146.25); // 90 + 56.25
  expect(r.purchaseReturns.tax).toBe(7.5);
  expect(r.inputTax).toBe(138.75);
  expect(r.net).toBe(26.25);
});
