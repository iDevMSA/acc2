import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { Db, dkey, localHour, runDigest, Senders } from '../src/digest';

const memDb = (data: Record<string, any>): Db & { data: Record<string, any> } => {
  const at = (path: string) => path.split('/').reduce((o, k) => (o == null ? undefined : o[k]), data as any);
  return {
    data,
    get: async (path) => at(path) ?? null,
    update: async (updates) => {
      for (const [path, v] of Object.entries(updates)) {
        const keys = path.split('/');
        let o = data;
        keys.slice(0, -1).forEach((k) => (o = o[k] ??= {}));
        if (v === null) delete o[keys.at(-1)!];
        else o[keys.at(-1)!] = v;
      }
    },
  };
};

const fakeSenders = (gone = false) => {
  const log = { emails: [] as any[], pushes: [] as any[] };
  const s: Senders = {
    email: async (to, subject, html) => void log.emails.push({ to, subject, html }),
    push: async (sub, payload) => {
      log.pushes.push({ sub, payload });
      return gone ? 'gone' : 'ok';
    },
  };
  return { s, log };
};

const seed = () =>
  memDb({
    users: {
      U: {
        companyInfo: { name: 'شركة الاختبار' },
        accounts: { a: { id: 'C1', name: 'زبون أ', entityType: 'client' } },
        operations: { o1: { accountId: 'C1', amountUSD: 500, date: '2026-05-01' } },
        erp: {
          settings: { mainCurrency: 'SAR' },
          items: { I1: { name: 'سكر', minQty: 10 } },
          stockMoves: { m: { type: 'in', itemId: 'I1', qty: 2 } },
        },
        alerts: {
          settings: { hour: 8, timeZone: 'Asia/Riyadh', email: { enabled: true, to: ['o@example.com'] }, push: { enabled: true } },
          push: { d1: { subscription: { endpoint: 'https://push.example/1', keys: { p256dh: 'x', auth: 'y' } } } },
        },
      },
    },
  });

// 08:30 بتوقيت الرياض
const at8 = new Date('2026-10-23T05:30:00Z');

describe('alerts digest', () => {
  it('shared engine is identical to the web copy', () => {
    const web = readFileSync(join(__dirname, '../../web_sales/web/src/lib/alerts.ts'), 'utf8');
    const here = readFileSync(join(__dirname, '../src/shared/alerts.ts'), 'utf8');
    expect(here).toBe(web);
  });

  it('local hour', () => {
    expect(localHour('Asia/Riyadh', at8)).toBe(8);
    expect(localHour('Africa/Cairo', at8)).toBe(8);
  });

  it('sends once a day at the chosen hour, only new alerts', async () => {
    const db = seed();
    const { s, log } = fakeSenders();
    expect((await runDigest(db, s, 'U', new Date('2026-10-23T03:00:00Z'), { appUrl: 'https://x' })).skipped).toBe('not-now');

    const r = await runDigest(db, s, 'U', at8, { appUrl: 'https://x' });
    expect(r).toMatchObject({ alerts: 2, fresh: 2, email: 1, push: 1, error: null });
    expect(log.emails[0].subject).toContain('2 تنبيه جديد');
    expect(log.emails[0].html).toContain('دين متأخر: زبون أ');
    expect(log.pushes[0].payload.title).toBe('2 تنبيه جديد');
    expect(db.data.users.U.alerts.sent[dkey('stock:I1')]).toBe('2026-10-23');

    // نفس اليوم: لا شيء
    expect((await runDigest(db, s, 'U', new Date('2026-10-23T05:50:00Z'), { appUrl: 'https://x' })).skipped).toBe('not-now');
    // اليوم التالي بلا جديد: لا رسالة
    const r2 = await runDigest(db, s, 'U', new Date('2026-10-24T05:10:00Z'), { appUrl: 'https://x' });
    expect(r2).toMatchObject({ fresh: 0, email: 0, push: 0 });
    expect(log.emails).toHaveLength(1);
  });

  it('dismissed alerts are not sent; test mode does not touch the sent list', async () => {
    const db = seed();
    db.data.users.U.alerts.dismissed = { [dkey('debt:C1')]: true };
    const { s, log } = fakeSenders();
    const r = await runDigest(db, s, 'U', new Date('2026-10-23T12:00:00Z'), { test: true, appUrl: 'https://x' });
    expect(r).toMatchObject({ alerts: 1, email: 1, push: 1 });
    expect(log.emails[0].html).not.toContain('دين متأخر');
    expect(db.data.users.U.alerts.sent).toBeUndefined();
  });

  it('removes expired push subscriptions and reports missing SMTP', async () => {
    const db = seed();
    const { s } = fakeSenders(true);
    const r = await runDigest(db, { ...s, email: null }, 'U', at8, { appUrl: 'https://x' });
    expect(r.push).toBe(0);
    expect(r.error).toContain('SMTP_URL');
    expect(db.data.users.U.alerts.push.d1).toBeUndefined();
    // لم يصل شيء ⇒ تبقى جديدة للغد
    expect(db.data.users.U.alerts.sent).toBeUndefined();
  });

  it('skips accounts without channels', async () => {
    const db = seed();
    db.data.users.U.alerts.settings = { hour: 8 };
    const { s } = fakeSenders();
    expect((await runDigest(db, s, 'U', at8, { appUrl: 'https://x' })).skipped).toBe('no-channels');
  });
});
