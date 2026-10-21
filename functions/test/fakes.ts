import type { Messenger, Parser, Store } from '../src/bot';
import type { Reply } from '../src/parser';

/** RTDB في الذاكرة: get بالمسار و update متعدد المسارات */
export class MemoryStore implements Store {
  root: any = {};
  constructor(seed: any = {}) {
    this.root = structuredClone(seed);
  }
  private parts = (p: string) => p.split('/').filter(Boolean);
  async get(path: string) {
    let n = this.root;
    for (const k of this.parts(path)) n = n?.[k];
    return n === undefined ? null : structuredClone(n);
  }
  async update(updates: Record<string, unknown>) {
    for (const [path, value] of Object.entries(updates)) {
      const ks = this.parts(path);
      let n = this.root;
      for (const k of ks.slice(0, -1)) n = n[k] ??= {};
      if (value === null) delete n[ks[ks.length - 1]];
      else n[ks[ks.length - 1]] = structuredClone(value);
    }
  }
  async claimDraft(uid: string, id: string) {
    const d = this.root.whatsappBot?.drafts?.[uid]?.[id];
    if (d?.status !== 'pending') return false;
    d.status = 'posting';
    return true;
  }
}

export class FakeWa implements Messenger {
  sent: { to: string; body: string; buttons?: string[] }[] = [];
  async sendText(to: string, body: string) {
    this.sent.push({ to, body });
  }
  async sendButtons(to: string, body: string, buttons: { id: string }[]) {
    this.sent.push({ to, body, buttons: buttons.map((b) => b.id) });
  }
  async downloadMedia() {
    return { data: Buffer.from('img'), mimeType: 'image/jpeg' };
  }
  get last() {
    return this.sent[this.sent.length - 1];
  }
}

export class FakeParser implements Parser {
  calls: any[] = [];
  constructor(public replies: Reply[]) {}
  async parse(input: any) {
    this.calls.push(input);
    const r = this.replies.shift();
    if (!r) throw new Error('no scripted reply');
    return r;
  }
}
