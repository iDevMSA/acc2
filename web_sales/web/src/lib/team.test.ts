import { areaOfWrite, assertCanWrite, canOpen, parseMember, ROLES } from './team';
import { describeWrite } from './audit';

const member = (role: keyof typeof ROLES, perms = {}) => parseMember('m1', { role, perms: { ...ROLES[role].perms, ...perms }, active: true });

test('an invoice write belongs to trade even though it also writes operations and stock', () => {
  expect(areaOfWrite(['erp/invoices/I1', 'operations/o1', 'operations/o2', 'erp/stockMoves/m1'])).toBe('trade');
  expect(areaOfWrite(['operations/o1'])).toBe('accounts');
  expect(areaOfWrite(['erp/vouchers/V1', 'operations/o1'])).toBe('cash');
  expect(areaOfWrite(['sales/products/p1'])).toBe('pos');
  expect(areaOfWrite(['companyInfo'])).toBe('settings');
});

test('permissions are enforced per area on save', () => {
  const viewer = member('viewer');
  expect(() => assertCanWrite(viewer, ['operations/o1'])).toThrow('الحسابات والقيود');
  expect(() => assertCanWrite(viewer, ['alerts/dismissed/x'])).not.toThrow();
  const acc = member('accountant');
  expect(() => assertCanWrite(acc, ['erp/invoices/I1', 'operations/o1'])).not.toThrow();
  expect(() => assertCanWrite(acc, ['erp/stockMoves/m1'])).toThrow('المخازن');
  expect(() => assertCanWrite(acc, ['companyInfo'])).toThrow('الإعدادات');
  expect(() => assertCanWrite(null, ['companyInfo'])).not.toThrow();
});

test('pages follow permissions; team and e-invoicing are owner-only', () => {
  const bm = member('branchManager');
  expect(canOpen(bm, '/pos-admin')).toBe(true);
  expect(canOpen(bm, '/taxes')).toBe(false);
  expect(canOpen(bm, '/accounts/12')).toBe(true);
  expect(canOpen(bm, '/team')).toBe(false);
  expect(canOpen(member('accountant'), '/einvoice')).toBe(false);
  expect(canOpen(null, '/team')).toBe(true);
  expect(canOpen(member('accountant', { reports: 'none' }), '/reports')).toBe(false);
});

test('audit description: verbs, grouping and before/after', () => {
  const before: Record<string, unknown> = { 'accounts/A1': { name: 'قديم' }, 'erp/invoices/I1': { number: 4, total: 100 } };
  const d = describeWrite(
    {
      'accounts/A1/name': 'جديد',
      'erp/invoices/I2': { number: 5 },
      'operations/o1': { amount: 5 },
      'operations/o2': { amount: -5 },
      'operations/o0/deletedAt': '2026-10-23',
      'erp/invoices/I1': null,
    },
    (p) => before[p],
  );
  expect(d.action).toBe('تعديل حساب، إضافة فاتورة، إضافة قيد (2)، حذف قيد، حذف فاتورة');
  expect(d.area).toBe('trade');
  const acc = d.changes.find((c) => c.path === 'accounts/A1')!;
  expect(JSON.parse(acc.before!)).toEqual({ name: 'قديم' });
  expect(JSON.parse(acc.after!)).toEqual({ name: 'جديد' });
});
