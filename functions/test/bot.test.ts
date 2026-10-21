import { describe, expect, it } from 'vitest';
import { Bot, intentOf } from '../src/bot';
import type { Incoming } from '../src/whatsapp';
import { FakeParser, FakeWa, MemoryStore } from './fakes';

const WA = '966500000000';
const seed = {
  whatsappBot: { links: { [WA]: { uid: 'u1' } }, linkCodes: { '123456': { uid: 'u2', expiresAt: '2999-01-01T00:00:00Z' } } },
  users: {
    u1: {
      accounts: {
        '0001': { id: '0001', name: 'الصندوق', code: '101', category: 'asset', type: 'cash' },
        '0002': { id: '0002', name: 'أحمد', category: 'asset', type: 'other' },
      },
      operations: { old_0001: { id: 'old_0001', accountId: '0001', amount: 5 } },
    },
  },
};

let n = 0;
const text = (t: string, from = WA): Incoming => ({ id: `m${++n}`, from, name: 'موسى', kind: 'text', text: t, timestamp: 0 });
const button = (id: string): Incoming => ({ id: `m${++n}`, from: WA, name: 'موسى', kind: 'button', buttonId: id, timestamp: 0 });

const draftReply = (amount = 200) => ({
  action: 'draft' as const,
  message: '',
  draft: {
    summary: 'قبض من أحمد نقداً',
    date: '2026-10-21',
    currency: 'USD',
    exchangeRate: 1,
    legs: [
      { accountId: '0001', side: 'debit' as const, amount, statement: 'قبض من أحمد' },
      { accountId: '0002', side: 'credit' as const, amount, statement: 'دفعة نقدية' },
    ],
  },
});

const setup = (replies: any[]) => {
  const store = new MemoryStore(seed);
  const wa = new FakeWa();
  const parser = new FakeParser(replies);
  const bot = new Bot({ store, wa, parser, timeZone: 'UTC', now: () => new Date('2026-10-21T09:00:00Z') });
  return { store, wa, parser, bot };
};

describe('Bot', () => {
  it('drafts, previews with buttons, and writes only after approval', async () => {
    const { store, wa, bot } = setup([draftReply()]);
    await bot.handle(text('قبضت من أحمد 200 دولار'));
    expect(wa.last.buttons?.[0]).toMatch(/^approve:/);
    expect(wa.last.body).toContain('أحمد');
    expect(Object.keys(store.root.users.u1.operations)).toEqual(['old_0001']);

    await bot.handle(button(wa.last.buttons![0]));
    const ops = store.root.users.u1.operations;
    expect(Object.keys(ops)).toHaveLength(3);
    expect(ops.old_0001).toEqual(seed.users.u1.operations.old_0001);
    expect(wa.last.body).toContain('تم تسجيل');
    expect(store.root.whatsappBot.sessions?.[WA]).toBeUndefined();
  });

  it('does not post twice when approve is pressed again', async () => {
    const { store, wa, bot } = setup([draftReply()]);
    await bot.handle(text('قبضت 200'));
    const approve = wa.last.buttons![0];
    await bot.handle(button(approve));
    await bot.handle(button(approve));
    expect(Object.keys(store.root.users.u1.operations)).toHaveLength(3);
    expect(wa.last.body).toContain('مسبقاً');
  });

  it('asks a question, then drafts using the answer', async () => {
    const { wa, parser, bot } = setup([{ action: 'ask', message: 'من أي صندوق؟', draft: null }, draftReply()]);
    await bot.handle(text('قبضت من أحمد 200'));
    expect(wa.last.body).toBe('من أي صندوق؟');
    await bot.handle(text('الصندوق'));
    expect(parser.calls[1].history.map((t: any) => t.text)).toEqual(['قبضت من أحمد 200', 'من أي صندوق؟']);
    expect(wa.last.buttons).toBeDefined();
  });

  it('edits the pending draft in place', async () => {
    const { store, wa, parser, bot } = setup([draftReply(200), draftReply(300)]);
    await bot.handle(text('قبضت 200'));
    const firstId = wa.last.buttons![0].split(':')[1];
    await bot.handle(button(`edit:${firstId}`));
    expect(wa.last.body).toContain('اكتب');
    await bot.handle(text('المبلغ 300'));
    expect(parser.calls[1].currentDraft.legs[0].amount).toBe(200);
    expect(wa.last.buttons![0]).toBe(`approve:${firstId}`);
    expect(store.root.whatsappBot.drafts.u1[firstId].draft.legs[0].amount).toBe(300);
  });

  it('rejects without writing', async () => {
    const { store, wa, bot } = setup([draftReply()]);
    await bot.handle(text('قبضت 200'));
    await bot.handle(text('رفض'));
    expect(Object.keys(store.root.users.u1.operations)).toEqual(['old_0001']);
    expect(wa.last.body).toContain('رفض');
  });

  it('reports validation errors instead of offering approval', async () => {
    const bad = draftReply();
    bad.draft.legs[1].accountId = '9999';
    const { wa, bot } = setup([bad]);
    await bot.handle(text('قبضت 200'));
    expect(wa.last.buttons).toBeUndefined();
    expect(wa.last.body).toContain('9999');
  });

  it('links an unknown number with a valid code', async () => {
    const { store, wa, bot } = setup([]);
    const other = '201000000000';
    await bot.handle(text('مرحبا', other));
    expect(wa.last.body).toContain('غير مربوط');
    await bot.handle(text('123456', other));
    expect(store.root.whatsappBot.links[other].uid).toBe('u2');
    expect(store.root.whatsappBot.linkCodes['123456']).toBeUndefined();
  });
});

it('intentOf understands buttons and single words', () => {
  expect(intentOf({ kind: 'button', buttonId: 'approve:x' })).toEqual({ kind: 'approve', draftId: 'x' });
  expect(intentOf({ kind: 'text', text: 'موافق' })?.kind).toBe('approve');
  expect(intentOf({ kind: 'text', text: 'أوكي' })?.kind).toBe('approve');
  expect(intentOf({ kind: 'text', text: 'قبضت من أحمد' })).toBeNull();
});
