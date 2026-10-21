import { describe, expect, it } from 'vitest';
import { buildOperationUpdates, Draft, formatPreview, LedgerContext, validateDraft } from '../src/ledger';

const ctx: LedgerContext = {
  accounts: {
    '0001': { id: '0001', name: 'الصندوق', code: '101', category: 'asset', type: 'cash', allowClientLogin: false },
    '0002': { id: '0002', name: 'أحمد', code: '', category: 'asset', type: 'other', allowClientLogin: true },
    '0003': { id: '0003', name: 'مجمّد', code: '', category: 'asset', type: 'other', allowClientLogin: false },
  },
  cashboxes: [],
  mainCurrency: 'USD',
  closedUntil: '2026-01-31',
  frozen: new Set(['0003']),
  rates: [],
};

const receipt: Draft = {
  summary: 'قبض من أحمد',
  date: '2026-10-21',
  currency: 'SAR',
  exchangeRate: 3.75,
  legs: [
    { accountId: '0001', side: 'debit', amount: 375, statement: 'قبض من أحمد' },
    { accountId: '0002', side: 'credit', amount: 375, statement: 'دفعة نقدية' },
  ],
};

describe('validateDraft', () => {
  it('accepts a balanced receipt', () => expect(validateDraft(receipt, ctx)).toEqual([]));
  it('rejects unbalanced, unknown, frozen and closed-period entries', () => {
    const bad: Draft = {
      ...receipt,
      date: '2026-01-15',
      legs: [
        { accountId: '0001', side: 'debit', amount: 10, statement: '' },
        { accountId: '0003', side: 'credit', amount: 5, statement: '' },
        { accountId: '9999', side: 'credit', amount: 1, statement: '' },
      ],
    };
    const errs = validateDraft(bad, ctx).join(' | ');
    expect(errs).toContain('مُقفلة');
    expect(errs).toContain('مجمّد');
    expect(errs).toContain('9999');
    expect(errs).toContain('غير متوازن');
  });
  it('allows a single-sided entry', () => {
    expect(validateDraft({ ...receipt, legs: [receipt.legs[1]] }, ctx)).toEqual([]);
  });
});

describe('buildOperationUpdates', () => {
  it('writes new operations in the app shape, mirrored to clientOps for client accounts', () => {
    const now = new Date('2026-10-21T10:00:00Z');
    const { updates, opIds } = buildOperationUpdates(receipt, ctx, { uid: 'u1', createdByName: 'واتساب', now });
    expect(opIds).toEqual([`${now.getTime()}_0001`, `${now.getTime() + 1}_0002`]);
    const cash: any = updates[`operations/${opIds[0]}`];
    expect(cash).toMatchObject({ accountId: '0001', amount: 375, currency: 'SAR', exchangeRate: 3.75, amountUSD: 100, createdByUid: 'u1' });
    expect(cash.date.startsWith('2026-10-21T')).toBe(true);
    expect((updates[`operations/${opIds[1]}`] as any).amount).toBe(-375);
    expect(updates[`clientOps/0002/${opIds[1]}`]).toBeDefined();
    expect(updates[`clientOps/0001/${opIds[0]}`]).toBeUndefined();
    expect(Object.keys(updates).every((k) => k.startsWith('operations/') || k.startsWith('clientOps/'))).toBe(true);
  });
});

it('formatPreview names the accounts and sides', () => {
  const p = formatPreview(receipt, ctx);
  expect(p).toContain('101 - الصندوق');
  expect(p).toContain('مدين');
  expect(p).toContain('دائن');
  expect(p).toContain('375');
});
