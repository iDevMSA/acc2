import { ApprovalLevel, budgetLines, fyKeyOf, fyRangeOfKey, nextLevel, parseCommitment, parseLevels, requiredLevels, sumLines } from './budget';
import { parseAccount, parseOperation } from './ledger';

const levels: ApprovalLevel[] = parseLevels({
  b: { name: 'المدير المالي', upTo: null, order: 1 },
  a: { name: 'مدير الإدارة', upTo: 50000, order: 0 },
});

test('approval levels by amount', () => {
  expect(levels.map((l) => l.name)).toEqual(['مدير الإدارة', 'المدير المالي']);
  expect(requiredLevels(levels, 30000).map((l) => l.id)).toEqual(['a']);
  expect(requiredLevels(levels, 50000).map((l) => l.id)).toEqual(['a']);
  expect(requiredLevels(levels, 80000).map((l) => l.id)).toEqual(['a', 'b']);
  const c = parseCommitment('x', { amount: 80000, status: 'requested', approvals: { 0: { levelId: 'a', action: 'approve' } } });
  expect(nextLevel(c, levels)?.id).toBe('b');
  expect(nextLevel({ ...c, approvals: [...c.approvals, { levelId: 'b', action: 'approve' } as any] }, levels)).toBeNull();
});

test('fiscal year keys', () => {
  expect(fyKeyOf('2026-10-24', 7)).toBe('2026-2027');
  expect(fyKeyOf('2026-03-01', 4)).toBe('2025-2026');
  expect(fyKeyOf('2026-10-24', 1)).toBe('2026');
  expect(fyRangeOfKey('2026-2027', 7)).toMatchObject({ from: '2026-07-01', to: '2027-06-30' });
  expect(fyRangeOfKey('2026', 1)).toMatchObject({ from: '2026-01-01', to: '2026-12-31' });
});

test('budget execution: appropriation, transfers, commitments and actual spending', () => {
  const accounts = [
    parseAccount('0001', { name: 'الرواتب الأساسية', category: 'expense', code: '5101' }),
    parseAccount('0002', { name: 'الصيانة والتشغيل', category: 'expense', code: '5204' }),
    parseAccount('0003', { name: 'البنك', category: 'asset' }),
  ];
  const meta = { '0001': { chapter: '1' }, '0002': { chapter: '2' } };
  const op = (id: string, acc: string, amount: number, date: string) => parseOperation(id, { accountId: acc, amount, amountUSD: amount, exchangeRate: 1, currency: 'EGP', date });
  const opsByAccount = {
    '0002': [op('o1', '0002', 12000, '2026-08-10'), op('o2', '0002', 5000, '2026-05-01')], // الثاني خارج السنة
  };
  const lines = budgetLines(
    accounts,
    meta,
    {
      appropriations: { '0001': 500000, '0002': 100000 },
      transfers: [{ id: 't', number: 1, fy: '2026-2027', date: '2026-09-01', fromAccountId: '0001', toAccountId: '0002', amount: 20000, note: '', by: '', byName: '', createdAt: '' }],
      commitments: [
        parseCommitment('c1', { fy: '2026-2027', accountId: '0002', amount: 30000, status: 'ordered' }),
        parseCommitment('c2', { fy: '2026-2027', accountId: '0002', amount: 7000, status: 'requested' }),
        parseCommitment('c3', { fy: '2026-2027', accountId: '0002', amount: 9000, status: 'cancelled' }),
        parseCommitment('c4', { fy: '2025-2026', accountId: '0002', amount: 9000, status: 'committed' }),
      ],
    },
    opsByAccount,
    { from: '2026-07-01', to: '2027-06-30' },
    '2026-2027',
  );
  expect(lines.map((l) => l.accountId)).toEqual(['0001', '0002']);
  const m = lines[1];
  expect(m).toMatchObject({ chapter: '2', current: 120000, committed: 30000, pending: 7000, spent: 12000, available: 78000 });
  expect(lines[0]).toMatchObject({ current: 480000, available: 480000 });
  expect(sumLines(lines)).toMatchObject({ current: 600000, available: 558000 });
});
