import {
  ADMIN_UID,
  FREE_MAX_ACCOUNTS,
  FREE_MAX_OPERATIONS,
  accountLimitError,
  newUserRecord,
  operationLimitError,
  parseSubscription,
  webAccessOf,
} from './subscription';

const NOW = Date.parse('2026-10-23T12:00:00Z');
const future = '2026-12-01T00:00:00.000Z';
const past = '2026-10-01T00:00:00.000Z';

describe('webAccessOf', () => {
  it('free account is limited on the web', () => {
    const a = webAccessOf('u1', parseSubscription({ plan: 'free' }), null, NOW);
    expect(a.unlimited).toBe(false);
    expect(operationLimitError(a, FREE_MAX_OPERATIONS - 1)).toBeNull();
    expect(operationLimitError(a, FREE_MAX_OPERATIONS)).toMatch('100 قيد');
    expect(operationLimitError(a, FREE_MAX_OPERATIONS - 1, 2)).not.toBeNull();
    expect(accountLimitError(a, FREE_MAX_ACCOUNTS)).toMatch('15 حساب');
  });

  it('mobile-only plan does not unlock the web', () => {
    const a = webAccessOf('u1', parseSubscription({ plan: 'yearly', kind: 'mobile', expiresAt: future }), null, NOW);
    expect(a.unlimited).toBe(false);
  });

  it('legacy paid mobile plan (no kind) unlocks the web until it expires', () => {
    expect(webAccessOf('u1', parseSubscription({ plan: 'monthly', expiresAt: future }), null, NOW).kind).toBe('bundle');
    expect(webAccessOf('u1', parseSubscription({ plan: 'monthly', expiresAt: past }), null, NOW).unlimited).toBe(false);
  });

  it('bundle on the mobile node unlocks both', () => {
    const a = webAccessOf('u1', parseSubscription({ plan: 'lifetime', kind: 'bundle', lifetimeGranted: true }), null, NOW);
    expect(a).toMatchObject({ unlimited: true, kind: 'bundle' });
  });

  it('web plan unlocks the web; expired web plan is reported', () => {
    const mobile = parseSubscription({ plan: 'free' });
    expect(webAccessOf('u1', mobile, parseSubscription({ plan: 'monthly', expiresAt: future }), NOW).kind).toBe('web');
    const exp = webAccessOf('u1', mobile, parseSubscription({ plan: 'monthly', expiresAt: past }), NOW);
    expect(exp.unlimited).toBe(false);
    expect(exp.expired?.plan).toBe('monthly');
  });

  it('admin is never limited', () => {
    expect(webAccessOf(ADMIN_UID, null, null, NOW).unlimited).toBe(true);
  });
});

it('new user record matches the app shape', () => {
  const r = newUserRecord('u1', 'a@b.c', { name: 'شركتي', phone: '', email: '', address: '' }, new Date(NOW));
  expect(r).toEqual({
    uid: 'u1',
    email: 'a@b.c',
    createdAt: '2026-10-23T12:00:00.000Z',
    companyInfo: { name: 'شركتي', phone: '', email: '', address: '' },
    subscription: { plan: 'free', lifetimeGranted: false },
  });
});
