import { ageBalance, computeTotals, lineShare, natureMismatch, payrollNet, rateOn } from './trade';

const line = (qty: number, unitPrice: number, discountPct = 0) => ({ description: '', qty, unitPrice, discountPct });

test('computeTotals applies line discount, invoice discount, then VAT', () => {
  const t = computeTotals([line(2, 100, 10), line(1, 50)], 10, 16);
  expect(t.gross).toBe(250);
  expect(t.lineDiscounts).toBe(20);
  expect(t.invoiceDiscount).toBe(23); // 10% of 230
  expect(t.net).toBe(207);
  expect(t.vat).toBeCloseTo(33.12, 6);
  expect(t.total).toBeCloseTo(240.12, 6);
});

test('line shares after invoice discount add up to the net', () => {
  const lines = [line(3, 33.33, 5), line(7, 12.5), line(1, 999, 12.5)];
  const t = computeTotals(lines, 7.5, 0);
  const sum = lines.reduce((s, l) => s + lineShare(l, 7.5), 0);
  expect(sum).toBeCloseTo(t.net, 4);
});

test('rateOn picks the latest rate on or before the date', () => {
  const rates = [
    { id: '1', currency: 'ILS', date: '2026-01-01T10:00:00.000', rate: 3.6, createdAt: '' },
    { id: '2', currency: 'ILS', date: '2026-03-01T10:00:00.000', rate: 3.7, createdAt: '' },
    { id: '3', currency: 'JOD', date: '2026-02-01T10:00:00.000', rate: 0.71, createdAt: '' },
  ];
  expect(rateOn(rates, 'ILS', '2026-02-15T00:00')).toBe(3.6);
  expect(rateOn(rates, 'ILS', '2026-04-01T00:00')).toBe(3.7);
  expect(rateOn(rates, 'ILS', '2025-12-01T00:00')).toBeNull();
  expect(rateOn(rates, 'EUR')).toBeNull();
});

test('payroll net = basic + allowances + overtime - deductions - advances', () => {
  expect(payrollNet({ employeeId: 'e', basic: 1000, allowances: 200, overtime: 50, deductions: 75, advances: 100 })).toBe(1075);
});

test('nature mismatch flags only the wrong side', () => {
  expect(natureMismatch('debit', -10)).toBe(true);
  expect(natureMismatch('debit', 10)).toBe(false);
  expect(natureMismatch('credit', 10)).toBe(true);
  expect(natureMismatch('both', -10)).toBe(false);
  expect(natureMismatch(undefined, -10)).toBe(false);
});

test('ageBalance settles the oldest debts first', () => {
  const asOf = new Date('2026-10-21T12:00:00');
  const ops = [
    { date: '2026-05-01T00:00:00', amountUSD: 100 }, // > 170 days
    { date: '2026-09-01T00:00:00', amountUSD: 50 }, // 50 days
    { date: '2026-10-15T00:00:00', amountUSD: 30 }, // 6 days
    { date: '2026-10-20T00:00:00', amountUSD: -120 }, // payment
  ];
  const b = ageBalance(ops, asOf);
  // 120 paid: clears the 100 and 20 of the 50
  expect(b).toEqual([30, 30, 0, 0, 0]);
});
