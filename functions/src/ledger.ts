// شكل القيود المشترك مع تطبيق الهاتف والويب (web_sales/web/src/lib/ledger.ts).
//
// البوت لا يعدّل أي عقدة موجودة: عند الاعتماد يضيف قيوداً جديدة فقط تحت
// users/{uid}/operations/{id} بمعرّف جديد وبنفس الحقول التي يكتبها الويب، فتظهر على الهاتف فوراً.
// كل ما يخص البوت نفسه (الربط، الجلسات، المسودات) يُحفظ تحت whatsappBot/... وحدها.

export interface Account {
  id: string;
  name: string;
  code: string;
  category: string;
  type: string;
  allowClientLogin: boolean;
}

export interface Cashbox {
  id: string;
  name: string;
  cashAccountId?: string | null;
  currency?: string | null;
}

/** بنود المسودة كما يقترحها Claude: مبلغ موجب + جهة مدين/دائن */
export interface DraftLeg {
  accountId: string;
  side: 'debit' | 'credit';
  amount: number;
  statement: string;
}

export interface Draft {
  summary: string;
  date: string; // YYYY-MM-DD
  currency: string;
  exchangeRate: number;
  legs: DraftLeg[];
}

export interface LedgerContext {
  accounts: Record<string, Account>;
  cashboxes: Cashbox[];
  mainCurrency: string;
  closedUntil?: string;
  frozen: Set<string>;
  rates: { currency: string; date: string; rate: number }[];
}

const str = (v: unknown, fallback = '') => (typeof v === 'string' ? v : v == null ? fallback : String(v));

export const parseAccounts = (raw: any): Record<string, Account> => {
  const out: Record<string, Account> = {};
  for (const [k, j] of Object.entries<any>(raw || {})) {
    if (!j || j.deletedAt) continue;
    const id = str(j.id) || k;
    out[id] = {
      id,
      name: str(j.name),
      code: str(j.code),
      category: str(j.category, 'other') || 'other',
      type: str(j.type, 'cash') || 'cash',
      allowClientLogin: j.allowClientLogin === true,
    };
  }
  return out;
};

/** نفس rateOn في الويب: آخر سعر مسجّل للعملة حتى التاريخ */
export const rateOn = (rates: LedgerContext['rates'], currency: string, date?: string): number | null => {
  const d = (date || '9999').slice(0, 16);
  let best: LedgerContext['rates'][number] | null = null;
  for (const r of rates) {
    if (r.currency !== currency || r.date.slice(0, 16) > d) continue;
    if (!best || r.date > best.date) best = r;
  }
  return best && best.rate > 0 ? best.rate : null;
};

export const r6 = (n: number) => Number(n.toFixed(6));

/** مدين = موجب (لنا)، دائن = سالب (لهم) — كما في سندات القبض والصرف في الويب */
export const signedAmount = (leg: DraftLeg) => (leg.side === 'debit' ? 1 : -1) * Math.abs(leg.amount);

/** يرجع قائمة أخطاء بالعربية؛ فارغة = المسودة صالحة للاعتماد */
export const validateDraft = (d: Draft, ctx: LedgerContext): string[] => {
  const errors: string[] = [];
  if (!d.legs.length) errors.push('لا توجد بنود في القيد');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d.date)) errors.push('التاريخ غير صالح');
  if (!(d.exchangeRate > 0)) errors.push('سعر الصرف غير صالح');
  if (ctx.closedUntil && d.date <= ctx.closedUntil) errors.push(`الفترة مُقفلة حتى ${ctx.closedUntil}`);
  for (const l of d.legs) {
    const a = ctx.accounts[l.accountId];
    if (!a) errors.push(`الحساب ${l.accountId} غير موجود`);
    else if (ctx.frozen.has(a.id)) errors.push(`الحساب "${a.name}" مجمّد`);
    if (!(Math.abs(l.amount) > 0)) errors.push('مبلغ أحد البنود صفر');
  }
  if (d.legs.length > 1) {
    const sum = d.legs.reduce((s, l) => s + signedAmount(l), 0);
    if (Math.abs(sum) > 0.005) errors.push('القيد غير متوازن: مجموع المدين لا يساوي مجموع الدائن');
  }
  return errors;
};

/** تاريخ ISO محلي بدون منطقة زمنية (كما يكتبه Dart DateTime.toIso8601String) */
export const localIsoFor = (date: string, now: Date = new Date()) => {
  const p = (n: number, w = 2) => String(n).padStart(w, '0');
  return `${date}T${p(now.getHours())}:${p(now.getMinutes())}:${p(now.getSeconds())}.${p(now.getMilliseconds(), 3)}`;
};

/**
 * يحوّل المسودة المعتمدة إلى تحديثات RTDB نسبية لـ users/{uid}.
 * كل المفاتيح جديدة: operations/{millis}_{accountId} و clientOps/... للحسابات المفتوحة للعملاء.
 */
export const buildOperationUpdates = (
  d: Draft,
  ctx: LedgerContext,
  meta: { uid: string; createdByName: string; now?: Date },
) => {
  const now = meta.now ?? new Date();
  let millis = now.getTime();
  const updates: Record<string, unknown> = {};
  const opIds: string[] = [];
  for (const l of d.legs) {
    const id = `${millis++}_${l.accountId}`;
    const amount = r6(signedAmount(l));
    const op = {
      id,
      accountId: l.accountId,
      amount,
      exchangeRate: d.exchangeRate,
      currency: d.currency,
      amountUSD: d.exchangeRate !== 0 ? r6(amount / d.exchangeRate) : 0,
      statement: l.statement,
      date: localIsoFor(d.date, now),
    };
    updates[`operations/${id}`] = {
      ...op,
      createdAt: now.toISOString(),
      createdByUid: meta.uid,
      createdByName: meta.createdByName,
      updatedByName: '',
      updatedByUid: '',
    };
    if (ctx.accounts[l.accountId]?.allowClientLogin) updates[`clientOps/${l.accountId}/${id}`] = op;
    opIds.push(id);
  }
  return { updates, opIds };
};

const fmt = (n: number) => Math.abs(n).toLocaleString('en-US', { maximumFractionDigits: 2 });

/** نص المعاينة الذي يُرسل للمستخدم قبل الاعتماد */
export const formatPreview = (d: Draft, ctx: LedgerContext): string => {
  const lines = [`📝 *هكذا سأسجّل العملية:*`, d.summary, '', `📅 ${d.date}   💱 ${d.currency}${d.currency !== ctx.mainCurrency ? ` (سعر ${d.exchangeRate})` : ''}`, ''];
  for (const l of d.legs) {
    const a = ctx.accounts[l.accountId];
    const name = a ? (a.code ? `${a.code} - ${a.name}` : a.name) : l.accountId;
    lines.push(`${l.side === 'debit' ? '⬅️ مدين (لنا)' : '➡️ دائن (لهم)'}: *${name}* — ${fmt(l.amount)} ${d.currency}`);
    if (l.statement) lines.push(`   البيان: ${l.statement}`);
  }
  if (d.legs.length === 1) lines.push('', 'ℹ️ قيد على طرف واحد (بدون صندوق مقابل).');
  return lines.join('\n');
};

/** قائمة مختصرة بالحسابات والصناديق تُعطى لـ Claude ليختار منها */
export const describeChart = (ctx: LedgerContext): string => {
  const accs = Object.values(ctx.accounts)
    .filter((a) => !ctx.frozen.has(a.id))
    .map((a) => `${a.id} | ${a.code || '-'} | ${a.name} | ${a.category} | ${a.type}`);
  const boxes = ctx.cashboxes
    .filter((b) => b.cashAccountId)
    .map((b) => `${b.name} → حساب النقدية ${b.cashAccountId}${b.currency ? ` (عملة ${b.currency})` : ''}`);
  return [
    `العملة الرئيسية: ${ctx.mainCurrency}`,
    'الحسابات (id | code | name | category | type):',
    ...accs,
    '',
    'الصناديق:',
    ...(boxes.length ? boxes : ['(لا توجد صناديق مربوطة بحساب نقدية)']),
  ].join('\n');
};
