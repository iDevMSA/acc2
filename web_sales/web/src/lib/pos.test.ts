import { cartTotals, isValidGtin, makeInvoiceNumber, priceForBranch, parseProduct } from './pos';

test('invoice number matches the phone app format', () => {
  expect(makeInvoiceNumber(7, '-abcdefg', 'br12345', new Date(2026, 9, 5))).toBe('05/10-0007--ABC-BR12');
});

test('cart totals add VAT, subtract discount and round like the phone app', () => {
  const t = cartTotals(
    [
      { productId: 'a', productName: 'A', quantity: 2, unitPrice: 10, vatRate: 15 },
      { productId: 'b', productName: 'B', quantity: 1, unitPrice: 4.4, vatRate: 0 },
    ],
    1,
  );
  expect(t.subtotal).toBeCloseTo(24.4);
  expect(t.vat).toBeCloseTo(3);
  expect(t.total).toBeCloseTo(26.4);
  expect(t.rounded).toBe(26);
});

test('branch price overrides the default sell price', () => {
  const p = parseProduct('p', { name: 'x', sellPrice: 10, branchPrices: { b1: 8 } });
  expect(priceForBranch(p, 'b1')).toBe(8);
  expect(priceForBranch(p, 'b2')).toBe(10);
});

test('GTIN check digit validation', () => {
  expect(isValidGtin('3017620422003')).toBe(true);
  expect(isValidGtin('5449000000996')).toBe(true);
  expect(isValidGtin('5449000000997')).toBe(false);
  expect(isValidGtin('abc')).toBe(false);
});
