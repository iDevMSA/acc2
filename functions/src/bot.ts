// منطق المحادثة: ربط الرقم بالحساب، فهم العملية، المعاينة، ثم الاعتماد أو التعديل أو الرفض.
//
// العقد التي يكتبها البوت:
//   whatsappBot/links/{waId}            ← ربط رقم واتساب بمستخدم منصتي
//   whatsappBot/linkCodes/{code}        ← رمز ربط مؤقت (يُنشأ من الويب أو من سكربت linkPhone)
//   whatsappBot/sessions/{waId}         ← حالة المحادثة الجارية
//   whatsappBot/drafts/{uid}/{draftId}  ← المسودات وسجلّ ما اعتُمد أو رُفض
// ولا يكتب في بيانات المستخدم إلا بعد ضغط "اعتماد": قيود جديدة في users/{uid}/operations (و clientOps).
import { randomBytes } from 'crypto';
import {
  buildOperationUpdates,
  describeChart,
  Draft,
  formatPreview,
  LedgerContext,
  parseAccounts,
  validateDraft,
} from './ledger';
import type { Reply, Turn } from './parser';
import type { Button, Incoming } from './whatsapp';

export interface Store {
  get(path: string): Promise<any>;
  /** تحديث متعدد المسارات من الجذر (مسار → قيمة، و null للحذف) */
  update(updates: Record<string, unknown>): Promise<void>;
  /** يبدّل حالة المسودة من pending إلى posting مرة واحدة فقط (يمنع الاعتماد المزدوج) */
  claimDraft(uid: string, draftId: string): Promise<boolean>;
}

export interface Messenger {
  sendText(to: string, body: string): Promise<void>;
  sendButtons(to: string, body: string, buttons: Button[]): Promise<void>;
  downloadMedia(mediaId: string): Promise<{ data: Buffer; mimeType: string }>;
}

export interface Parser {
  parse(input: {
    chart: string;
    today: string;
    history: Turn[];
    text: string;
    image?: { data: Buffer; mimeType: string };
    currentDraft?: Draft | null;
  }): Promise<Reply>;
}

export type SessionState = 'idle' | 'awaiting_answer' | 'awaiting_approval' | 'awaiting_edit';

export interface Session {
  uid: string;
  state: SessionState;
  draftId?: string | null;
  history?: Turn[];
  updatedAt?: string;
}

export interface Deps {
  store: Store;
  wa: Messenger;
  parser: Parser;
  timeZone: string;
  now?: () => Date;
}

const MAX_HISTORY = 12;
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

const APPROVE_WORDS = ['اعتماد', 'اعتمد', 'موافق', 'موافقة', 'نعم', 'تمام', 'اوكي', 'أوكي', 'ok', 'yes', 'سجل', 'سجّل', '✅'];
const REJECT_WORDS = ['رفض', 'ارفض', 'الغاء', 'إلغاء', 'الغ', 'ألغ', 'لا', 'cancel', 'no', '❌'];
const CANCEL_WORDS = ['الغاء', 'إلغاء', 'cancel', 'stop'];
const EDIT_WORDS = ['تعديل', 'عدل', 'عدّل', 'edit', '✏️'];

const normalize = (s: string) =>
  s
    .trim()
    .toLowerCase()
    .replace(/[أإآ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/[ً-ْ]/g, '')
    .replace(/[.!؟?،,]+$/g, '');

const matchesAny = (text: string, words: string[]) => {
  const t = normalize(text);
  return words.some((w) => normalize(w) === t);
};

/** يفهم رد المستخدم على المعاينة: زر أو كلمة واحدة */
export const intentOf = (msg: Pick<Incoming, 'kind' | 'buttonId' | 'text'>): { kind: 'approve' | 'reject' | 'edit'; draftId?: string } | null => {
  if (msg.kind === 'button' && msg.buttonId) {
    const [kind, draftId] = msg.buttonId.split(':');
    if (kind === 'approve' || kind === 'reject' || kind === 'edit') return { kind, draftId };
  }
  if (msg.kind === 'text' && msg.text) {
    if (matchesAny(msg.text, APPROVE_WORDS)) return { kind: 'approve' };
    if (matchesAny(msg.text, REJECT_WORDS)) return { kind: 'reject' };
    if (matchesAny(msg.text, EDIT_WORDS)) return { kind: 'edit' };
  }
  return null;
};

export const todayIn = (timeZone: string, d: Date = new Date()) =>
  new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);

const HELP = [
  'أهلاً 👋 أنا بوت منصتي لتسجيل العمليات.',
  'أرسل لي العملية نصاً، مثل: "قبضت من أحمد 250 دولار نقداً في الصندوق الرئيسي"، أو أرسل صورة الإيصال.',
  'سأعرض عليك كيف سأسجّلها، ولن أسجّل شيئاً قبل أن تضغط "اعتماد".',
  'للإلغاء في أي وقت اكتب: إلغاء',
].join('\n');

export const loadContext = async (store: Store, uid: string): Promise<LedgerContext> => {
  const [accounts, cashboxes, settings, meta, rates] = await Promise.all([
    store.get(`users/${uid}/accounts`),
    store.get(`users/${uid}/erp/cashboxes`),
    store.get(`users/${uid}/erp/settings`),
    store.get(`users/${uid}/erp/accountMeta`),
    store.get(`users/${uid}/erp/rates`),
  ]);
  return {
    accounts: parseAccounts(accounts),
    cashboxes: Object.entries<any>(cashboxes || {}).map(([k, v]) => ({
      id: v?.id || k,
      name: String(v?.name || ''),
      cashAccountId: v?.cashAccountId || null,
      currency: v?.currency || null,
    })),
    mainCurrency: settings?.mainCurrency || 'USD',
    closedUntil: settings?.closedUntil || undefined,
    frozen: new Set(Object.entries<any>(meta || {}).filter(([, m]) => m?.frozen).map(([k]) => k)),
    rates: Object.values<any>(rates || {}).map((r) => ({ currency: String(r?.currency || ''), date: String(r?.date || ''), rate: Number(r?.rate) || 0 })),
  };
};

const draftButtons = (draftId: string): Button[] => [
  { id: `approve:${draftId}`, title: '✅ اعتماد' },
  { id: `edit:${draftId}`, title: '✏️ تعديل' },
  { id: `reject:${draftId}`, title: '❌ رفض' },
];

export class Bot {
  constructor(private d: Deps) {}

  private now() {
    return this.d.now ? this.d.now() : new Date();
  }

  private sessionPath(waId: string) {
    return `whatsappBot/sessions/${waId}`;
  }

  private async saveSession(waId: string, s: Session | null) {
    await this.d.store.update({
      [this.sessionPath(waId)]: s ? { ...s, history: (s.history || []).slice(-MAX_HISTORY), updatedAt: this.now().toISOString() } : null,
    });
  }

  async handle(msg: Incoming): Promise<void> {
    const { store, wa } = this.d;
    const link = await store.get(`whatsappBot/links/${msg.from}`);
    if (!link?.uid) return this.handleUnlinked(msg);
    const uid: string = link.uid;

    if (msg.kind === 'text' && ['مساعدة', 'help', 'ابدأ', 'start'].some((w) => normalize(w) === normalize(msg.text || ''))) {
      return wa.sendText(msg.from, HELP);
    }

    const session: Session = (await store.get(this.sessionPath(msg.from))) || { uid, state: 'idle' };
    if (session.uid !== uid) Object.assign(session, { uid, state: 'idle', draftId: null, history: [] });

    const intent = intentOf(msg);
    const draftId = intent?.draftId || session.draftId || undefined;
    if (intent && draftId && (intent.draftId || session.state === 'awaiting_approval')) {
      if (intent.kind === 'approve') return this.approve(msg, uid, draftId);
      if (intent.kind === 'reject') return this.reject(msg, uid, draftId);
      await this.saveSession(msg.from, { ...session, state: 'awaiting_edit', draftId });
      return wa.sendText(msg.from, 'اكتب ما تريد تعديله، مثل: "المبلغ 300" أو "من صندوق البنك" أو "التاريخ أمس".');
    }
    if (msg.kind === 'text' && matchesAny(msg.text || '', CANCEL_WORDS)) {
      await this.saveSession(msg.from, null);
      return wa.sendText(msg.from, 'تم الإلغاء. أرسل عملية جديدة متى شئت.');
    }

    if (msg.kind === 'document') return wa.sendText(msg.from, 'أرسل الإيصال كصورة من فضلك (لا أقرأ ملفات PDF بعد).');
    if (msg.kind === 'other' || (msg.kind === 'button' && !intent)) return wa.sendText(msg.from, HELP);

    return this.understand(msg, uid, session);
  }

  private async handleUnlinked(msg: Incoming) {
    const { store, wa } = this.d;
    const m = (msg.text || '').match(/(\d{6})/);
    if (msg.kind === 'text' && m) {
      const code = await store.get(`whatsappBot/linkCodes/${m[1]}`);
      if (code?.uid && (!code.expiresAt || Date.parse(code.expiresAt) > this.now().getTime())) {
        await store.update({
          [`whatsappBot/links/${msg.from}`]: { uid: code.uid, name: msg.name, linkedAt: this.now().toISOString() },
          [`whatsappBot/linkCodes/${m[1]}`]: null,
        });
        return wa.sendText(msg.from, `✅ تم ربط هذا الرقم بحسابك في منصتي.\n\n${HELP}`);
      }
      return wa.sendText(msg.from, 'رمز الربط غير صحيح أو انتهت صلاحيته. أنشئ رمزاً جديداً من إعدادات منصتي.');
    }
    return wa.sendText(
      msg.from,
      'هذا الرقم غير مربوط بحساب في منصتي بعد. افتح منصتي ← الإعدادات ← واتساب، وأنشئ رمز ربط، ثم أرسل لي الرمز المكوّن من 6 أرقام.',
    );
  }

  private async understand(msg: Incoming, uid: string, session: Session) {
    const { store, wa, parser } = this.d;
    const ctx = await loadContext(store, uid);
    if (!Object.keys(ctx.accounts).length) {
      return wa.sendText(msg.from, 'لا توجد حسابات في دفترك بعد. أضف حساباتك من التطبيق أولاً ثم أرسل العملية.');
    }

    const continuing = session.state !== 'idle';
    const history: Turn[] = continuing ? [...(session.history || [])] : [];
    const currentDraft: Draft | null =
      continuing && session.draftId ? (await store.get(`whatsappBot/drafts/${uid}/${session.draftId}`))?.draft || null : null;

    let image: { data: Buffer; mimeType: string } | undefined;
    if (msg.kind === 'image' && msg.mediaId) {
      image = await wa.downloadMedia(msg.mediaId);
      if (image.data.length > MAX_IMAGE_BYTES) return wa.sendText(msg.from, 'الصورة كبيرة جداً. أرسلها بحجم أصغر من فضلك.');
    }

    const userText = msg.text || '';
    const reply = await parser.parse({
      chart: describeChart(ctx),
      today: todayIn(this.d.timeZone, this.now()),
      history: [...history],
      text: userText,
      image,
      currentDraft,
    });
    history.push({ role: 'user', text: userText || '(صورة إيصال)' });

    if (reply.action !== 'draft' || !reply.draft) {
      const text = reply.message || 'لم أفهم العملية، هل توضّحها أكثر؟';
      history.push({ role: 'assistant', text });
      await this.saveSession(msg.from, {
        uid,
        state: reply.action === 'ask' ? 'awaiting_answer' : session.state === 'awaiting_approval' ? 'awaiting_approval' : 'idle',
        draftId: session.draftId || null,
        history: reply.action === 'ask' || session.draftId ? history : [],
      });
      return wa.sendText(msg.from, text);
    }

    const draft: Draft = { ...reply.draft, currency: reply.draft.currency || ctx.mainCurrency };
    if (draft.currency === ctx.mainCurrency) draft.exchangeRate = 1;
    const errors = validateDraft(draft, ctx);
    const id = session.draftId && currentDraft ? session.draftId : `${this.now().getTime()}_${randomBytes(3).toString('hex')}`;
    await store.update({
      [`whatsappBot/drafts/${uid}/${id}`]: {
        status: 'pending',
        draft,
        source: { waId: msg.from, messageId: msg.id, kind: msg.kind, text: userText },
        createdAt: this.now().toISOString(),
      },
    });

    if (errors.length) {
      const text = `لم أستطع تجهيز القيد:\n• ${errors.join('\n• ')}\n\nصحّح لي المعلومة وسأعيد المحاولة.`;
      history.push({ role: 'assistant', text });
      await this.saveSession(msg.from, { uid, state: 'awaiting_answer', draftId: id, history });
      return wa.sendText(msg.from, text);
    }

    const preview = formatPreview(draft, ctx);
    history.push({ role: 'assistant', text: preview });
    await this.saveSession(msg.from, { uid, state: 'awaiting_approval', draftId: id, history });
    const prefix = reply.message ? `${reply.message}\n\n` : '';
    await wa.sendButtons(msg.from, `${prefix}${preview}\n\nهل أعتمد التسجيل؟`, draftButtons(id));
  }

  private async approve(msg: Incoming, uid: string, draftId: string) {
    const { store, wa } = this.d;
    const rec = await store.get(`whatsappBot/drafts/${uid}/${draftId}`);
    if (!rec?.draft) return wa.sendText(msg.from, 'لم أجد هذه المسودة. أرسل العملية من جديد.');
    if (rec.status === 'approved') return wa.sendText(msg.from, 'هذه العملية مسجّلة مسبقاً ✅');
    if (rec.status === 'rejected') return wa.sendText(msg.from, 'هذه المسودة مرفوضة. أرسل العملية من جديد إن أردت تسجيلها.');

    const ctx = await loadContext(store, uid);
    const errors = validateDraft(rec.draft, ctx);
    if (errors.length) return wa.sendText(msg.from, `لا يمكن اعتماد القيد الآن:\n• ${errors.join('\n• ')}`);
    if (!(await store.claimDraft(uid, draftId))) return wa.sendText(msg.from, 'هذه العملية قيد التسجيل أو سُجّلت مسبقاً.');

    const now = this.now();
    const { updates, opIds } = buildOperationUpdates(rec.draft, ctx, {
      uid,
      createdByName: `واتساب${msg.name ? ` (${msg.name})` : ''}`,
      now,
    });
    const all: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(updates)) all[`users/${uid}/${k}`] = v;
    all[`whatsappBot/drafts/${uid}/${draftId}/status`] = 'approved';
    all[`whatsappBot/drafts/${uid}/${draftId}/opIds`] = opIds;
    all[`whatsappBot/drafts/${uid}/${draftId}/approvedAt`] = now.toISOString();
    all[this.sessionPath(msg.from)] = null;
    await store.update(all);
    await wa.sendText(msg.from, `✅ تم تسجيل العملية (${opIds.length} ${opIds.length === 1 ? 'قيد' : 'قيود'}). ستظهر في التطبيق والويب الآن.`);
  }

  private async reject(msg: Incoming, uid: string, draftId: string) {
    const { store, wa } = this.d;
    const rec = await store.get(`whatsappBot/drafts/${uid}/${draftId}`);
    if (rec?.status === 'approved') return wa.sendText(msg.from, 'هذه العملية سُجّلت مسبقاً، ويمكن حذفها من التطبيق.');
    await store.update({
      [`whatsappBot/drafts/${uid}/${draftId}/status`]: 'rejected',
      [`whatsappBot/drafts/${uid}/${draftId}/rejectedAt`]: this.now().toISOString(),
      [this.sessionPath(msg.from)]: null,
    });
    await wa.sendText(msg.from, '❌ تم رفض المسودة ولم يُسجَّل شيء.');
  }
}
