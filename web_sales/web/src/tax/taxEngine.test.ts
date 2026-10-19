import { findTaxCountry } from './countries';
import { buildTaxReport, computeInvoiceTax, validateTrn, zatcaQrBase64 } from './taxEngine';

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
