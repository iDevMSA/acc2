import { buildAlerts, inputFromRaw, AlertInput } from './alerts';

const base = (): AlertInput => ({
  mainCurrency: 'SAR',
  accounts: [
    { id: 'C1', name: 'زبون أ', entityType: 'client', category: 'asset' },
    { id: 'C2', name: 'زبون ب', entityType: 'client', category: 'asset' },
    { id: 'BOX', name: 'الصندوق', category: 'asset' },
  ],
  opsByAccount: {},
  roles: {},
  systemAccountIds: ['BOX'],
  items: [],
  stockQty: {},
  posProducts: [],
  invoices: [],
  cheques: [],
});

const inv = (id: string, number: number, date: string, total: number, extra: Partial<AlertInput['invoices'][number]> = {}) => ({
  id,
  number,
  kind: 'sale',
  partyId: 'C1',
  date,
  exchangeRate: 1,
  paid: 0,
  totals: { total },
  ...extra,
});

test('low stock for items and POS products', () => {
  const input = base();
  input.items = [
    { id: 'I1', name: 'سكر', minQty: 10 },
    { id: 'I2', name: 'رز', reorderQty: 5 },
    { id: 'I3', name: 'بلا حد' },
  ];
  input.stockQty = { I1: 4, I2: 0, I3: 0 };
  input.posProducts = [
    { id: 'P1', name: 'ماء', quantity: 3 },
    { id: 'P2', name: 'عصير', quantity: 50 },
  ];
  const a = buildAlerts(input, null, '2026-10-23');
  expect(a.map((x) => x.id).sort()).toEqual(['pos:P1', 'stock:I1', 'stock:I2']);
  expect(a.find((x) => x.id === 'stock:I2')?.severity).toBe('danger');
  expect(buildAlerts(input, { posMinQty: 0 }, '2026-10-23').some((x) => x.id === 'pos:P1')).toBe(false);
});

test('invoices: balance covers newest invoices first', () => {
  const input = base();
  // فاتورتان 100 + 200، ثم دفعة 150 ⇒ الرصيد 150: الأقدم مسددة، والأحدث متبقٍ منها 150
  input.opsByAccount.C1 = [
    { date: '2026-08-01', amountUSD: 100 },
    { date: '2026-09-01', amountUSD: 200 },
    { date: '2026-09-15', amountUSD: -150 },
  ];
  input.invoices = [inv('A', 1, '2026-08-01', 100, { dueDate: '2026-08-15' }), inv('B', 2, '2026-09-01', 200, { dueDate: '2026-10-20' })];
  const a = buildAlerts(input, { debts: false }, '2026-10-23');
  expect(a).toHaveLength(1);
  expect(a[0]).toMatchObject({ id: 'inv:B:2026-10-20', kind: 'invoiceOverdue', amount: 150 });
  expect(a[0].detail).toContain('متأخرة 3 أيام');
});

test('invoice due soon uses default terms when there is no due date', () => {
  const input = base();
  input.opsByAccount.C1 = [{ date: '2026-09-25', amountUSD: 80 }];
  input.invoices = [inv('A', 7, '2026-09-25', 100, { paid: 20 })];
  const a = buildAlerts(input, { debts: false, termsDays: 30, dueSoonDays: 3 }, '2026-10-23');
  expect(a[0]).toMatchObject({ kind: 'invoiceDue', date: '2026-10-25', amount: 80 });
});

test('overdue debts by FIFO age, ignoring cash accounts', () => {
  const input = base();
  input.opsByAccount = {
    C1: [
      { date: '2026-06-01', amountUSD: 300 },
      { date: '2026-10-01', amountUSD: 100 },
      { date: '2026-07-01', amountUSD: -100 },
    ],
    C2: [{ date: '2026-10-10', amountUSD: 500 }],
    BOX: [{ date: '2026-01-01', amountUSD: 9999 }],
  };
  const a = buildAlerts(input, { invoices: false }, '2026-10-23');
  expect(a).toHaveLength(1);
  expect(a[0]).toMatchObject({ id: 'debt:C1', amount: 200, date: '2026-06-01', severity: 'danger' });
});

test('cheques and expiry', () => {
  const input = base();
  input.cheques = [
    { id: 'Q1', number: '11', direction: 'in', dueDate: '2026-10-24', amount: 50, currency: 'SAR', status: 'portfolio', partyId: 'C1' },
    { id: 'Q2', number: '12', direction: 'in', dueDate: '2026-10-24', amount: 50, currency: 'SAR', status: 'cleared', partyId: 'C1' },
    { id: 'Q3', number: '13', direction: 'out', dueDate: '2026-11-30', amount: 50, currency: 'SAR', status: 'issued', partyId: 'C2' },
  ];
  input.posProducts = [
    { id: 'P1', name: 'حليب', quantity: 10, trackExpiry: true, expiryDate: '2026-10-20' },
    { id: 'P2', name: 'جبن', quantity: 10, trackExpiry: true, expiryDate: '2027-05-01' },
  ];
  const a = buildAlerts(input, { posMinQty: 0 }, '2026-10-23');
  expect(a.map((x) => x.id)).toEqual(['expiry:P1:2026-10-20', 'cheque:Q1:2026-10-24']);
});

test('inputFromRaw skips deleted operations and orphans', () => {
  const input = inputFromRaw({
    mainCurrency: 'SAR',
    accounts: { a: { id: 'C1', name: 'زبون', entityType: 'client' } },
    operations: {
      o1: { accountId: 'C1', amountUSD: 10, date: '2026-01-01' },
      o2: { accountId: 'C1', amountUSD: 99, date: '2026-01-01', deletedAt: '2026-02-01' },
      o3: { accountId: 'GONE', amountUSD: 5, date: '2026-01-01' },
    },
    erp: {
      stockMoves: {
        m1: { type: 'in', itemId: 'I', qty: 10 },
        m2: { type: 'out', itemId: 'I', qty: 3 },
        m3: { type: 'transfer', itemId: 'I', qty: 2 },
        m4: { type: 'adjust', itemId: 'I', qty: -1 },
      },
      cashboxes: { b: { linkedAccountIds: ['X'], cashAccountId: 'Y' } },
    },
  });
  expect(input.opsByAccount).toEqual({ C1: [{ date: '2026-01-01', amountUSD: 10 }] });
  expect(input.stockQty.I).toBe(6);
  expect(input.systemAccountIds).toEqual(['X', 'Y']);
});
