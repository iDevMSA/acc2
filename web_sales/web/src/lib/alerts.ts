// محرك التنبيهات: مخزون منخفض، صلاحية قريبة، فواتير مستحقة ومتأخرة، ديون متأخرة، شيكات مستحقة.
//
// الملف مستقل تماماً (بلا استيراد) لأن خدمة السحابة alerts/ تنسخه كما هو وتحسب به نفس التنبيهات
// لترسلها بالبريد وإشعارات الهاتف. أي تعديل هنا يُنسخ إلى alerts/src/shared/alerts.ts
// (npm run sync في alerts/، واختبار هناك يتأكد أن النسختين متطابقتان).

export type AlertKind = 'lowStock' | 'expiry' | 'invoiceOverdue' | 'invoiceDue' | 'debtOverdue' | 'chequeDue';
export type AlertSeverity = 'danger' | 'warning' | 'info';

export interface Alert {
  /** ثابت لنفس الحالة حتى نعرف ما أُرسل من قبل وما أخفاه المستخدم */
  id: string;
  kind: AlertKind;
  severity: AlertSeverity;
  title: string;
  detail: string;
  amount?: number;
  /** تاريخ الاستحقاق أو الانتهاء (yyyy-mm-dd) */
  date?: string;
  link: string;
}

export interface AlertSettings {
  lowStock?: boolean;
  /** حد التنبيه لمنتجات نقطة البيع (لا يوجد لها حد أدنى في التطبيق). 0 = بلا تنبيه */
  posMinQty?: number;
  expiry?: boolean;
  expiryDays?: number;
  invoices?: boolean;
  /** التنبيه قبل الاستحقاق بكم يوم */
  dueSoonDays?: number;
  /** مدة السداد الافتراضية لفاتورة آجلة بلا تاريخ استحقاق */
  termsDays?: number;
  debts?: boolean;
  /** الدين المتأخر = جزء من الرصيد عمره أكثر من كذا يوماً */
  debtDays?: number;
  minDebt?: number;
  cheques?: boolean;
  chequeDays?: number;
  email?: { enabled?: boolean; to?: string[] };
  push?: { enabled?: boolean };
  /** ساعة إرسال الملخص اليومي (0-23) بتوقيت timeZone */
  hour?: number;
  timeZone?: string;
}

export const ALERT_DEFAULTS: Required<Omit<AlertSettings, 'email' | 'push'>> = {
  lowStock: true,
  posMinQty: 5,
  expiry: true,
  expiryDays: 30,
  invoices: true,
  dueSoonDays: 3,
  termsDays: 30,
  debts: true,
  debtDays: 60,
  minDebt: 0,
  cheques: true,
  chequeDays: 3,
  hour: 8,
  timeZone: 'Asia/Riyadh',
};

export const withDefaults = (s?: AlertSettings | null) => ({ ...ALERT_DEFAULTS, ...(s || {}) });

export const KIND_LABELS: Record<AlertKind, string> = {
  lowStock: 'مخزون منخفض',
  expiry: 'صلاحية قريبة',
  invoiceOverdue: 'فاتورة متأخرة',
  invoiceDue: 'فاتورة تستحق قريباً',
  debtOverdue: 'دين متأخر',
  chequeDue: 'شيك مستحق',
};

/* ───────── المدخلات ───────── */

export interface AlertInput {
  mainCurrency: string;
  accounts: { id: string; name: string; type?: string; category?: string; entityType?: string }[];
  /** القيود غير المحذوفة لكل حساب (amountUSD = بالعملة الرئيسية، موجب = مدين لنا) */
  opsByAccount: Record<string, { date: string; amountUSD: number }[]>;
  /** دور الحساب المحدد في الويب (erp/accountMeta) */
  roles: Record<string, string | undefined>;
  /** حسابات الصناديق والمخازن (ليست ذمماً) */
  systemAccountIds: string[];
  items: { id: string; name: string; minQty?: number; reorderQty?: number }[];
  /** الكمية الإجمالية لكل صنف في كل المخازن */
  stockQty: Record<string, number>;
  posProducts: { id: string; name: string; quantity: number; trackExpiry?: boolean; expiryDate?: string | null }[];
  invoices: {
    id: string;
    number: number;
    kind: string;
    partyId: string;
    date: string;
    dueDate?: string;
    exchangeRate: number;
    paid: number;
    totals: { total: number };
  }[];
  cheques: {
    id: string;
    number: string;
    direction: string;
    dueDate: string;
    amount: number;
    currency: string;
    status: string;
    partyId: string;
  }[];
}

/* ───────── أدوات ───────── */

const DAY = 86400000;
const dayNum = (ymd: string) => Math.floor(Date.parse(ymd.slice(0, 10) + 'T00:00:00Z') / DAY);
const addDays = (ymd: string, n: number) => new Date((dayNum(ymd) + n) * DAY).toISOString().slice(0, 10);
const fmt = (n: number) => n.toLocaleString('en-US', { maximumFractionDigits: 2 });
const daysWord = (n: number) => (n === 1 ? 'يوم' : n === 2 ? 'يومين' : n <= 10 ? `${n} أيام` : `${n} يوماً`);
const num = (v: unknown) => (Number.isFinite(Number(v)) ? Number(v) : 0);

/** تاريخ اليوم (yyyy-mm-dd) في منطقة زمنية */
export const todayIn = (timeZone: string, now = new Date()) => {
  try {
    return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
  } catch {
    return now.toISOString().slice(0, 10);
  }
};

const roleOf = (input: AlertInput, a: AlertInput['accounts'][number]) => {
  const r = input.roles[a.id];
  if (r) return r;
  if (a.entityType === 'client') return 'customer';
  if (a.entityType === 'merchant') return 'merchant';
  if (a.type === 'bank') return 'bank';
  return 'general';
};

/** نفس شرط تقرير أعمار الديون: الزبائن والتجار والحسابات العامة التي ليست صندوقاً أو بنكاً أو مخزوناً */
const isDebtor = (input: AlertInput, system: Set<string>, a: AlertInput['accounts'][number]) => {
  const role = roleOf(input, a);
  if (role === 'customer' || role === 'merchant') return true;
  return role === 'general' && (a.category === 'asset' || a.category === 'other') && a.type !== 'bank' && !system.has(a.id);
};

/** القيود المدينة التي لم يغطّها السداد بعد (الأقدم يُسدَّد أولاً) */
const unpaidDebits = (ops: { date: string; amountUSD: number }[]) => {
  const debits = ops
    .filter((o) => o.amountUSD > 0)
    .map((o) => ({ date: o.date.slice(0, 10), left: o.amountUSD }))
    .sort((a, b) => a.date.localeCompare(b.date));
  let credit = ops.filter((o) => o.amountUSD < 0).reduce((s, o) => s - o.amountUSD, 0);
  for (const d of debits) {
    const take = Math.min(d.left, credit);
    d.left -= take;
    credit -= take;
    if (credit <= 0) break;
  }
  return debits.filter((d) => d.left > 0.005);
};

const SEVERITY_ORDER: Record<AlertSeverity, number> = { danger: 0, warning: 1, info: 2 };

/* ───────── الحساب ───────── */

export const buildAlerts = (input: AlertInput, rawSettings: AlertSettings | null | undefined, today: string): Alert[] => {
  const s = withDefaults(rawSettings);
  const cur = input.mainCurrency;
  const out: Alert[] = [];
  const accountsById = Object.fromEntries(input.accounts.map((a) => [a.id, a]));
  const balanceOf = (id: string) => (input.opsByAccount[id] || []).reduce((t, o) => t + o.amountUSD, 0);
  const nameOf = (id: string) => accountsById[id]?.name || id;

  if (s.lowStock) {
    for (const i of input.items) {
      const limit = Math.max(num(i.minQty), num(i.reorderQty));
      if (!limit) continue;
      const q = num(input.stockQty[i.id]);
      if (q > limit) continue;
      out.push({
        id: `stock:${i.id}`,
        kind: 'lowStock',
        severity: q <= 0 ? 'danger' : 'warning',
        title: q <= 0 ? `نفد الصنف: ${i.name}` : `مخزون منخفض: ${i.name}`,
        detail: `الكمية ${fmt(q)} والحد ${fmt(limit)}`,
        link: '/warehouses',
      });
    }
    if (s.posMinQty > 0)
      for (const p of input.posProducts) {
        if (p.quantity > s.posMinQty) continue;
        out.push({
          id: `pos:${p.id}`,
          kind: 'lowStock',
          severity: p.quantity <= 0 ? 'danger' : 'warning',
          title: p.quantity <= 0 ? `نفد المنتج: ${p.name}` : `مخزون منخفض: ${p.name}`,
          detail: `نقطة البيع · الكمية ${fmt(p.quantity)} والحد ${fmt(s.posMinQty)}`,
          link: '/pos-admin',
        });
      }
  }

  if (s.expiry) {
    const until = addDays(today, s.expiryDays);
    for (const p of input.posProducts) {
      const d = (p.expiryDate || '').slice(0, 10);
      if (!p.trackExpiry || !d || d > until || p.quantity <= 0) continue;
      const left = dayNum(d) - dayNum(today);
      out.push({
        id: `expiry:${p.id}:${d}`,
        kind: 'expiry',
        severity: left < 0 ? 'danger' : 'warning',
        title: left < 0 ? `منتهي الصلاحية: ${p.name}` : `تنتهي صلاحيته قريباً: ${p.name}`,
        detail: left < 0 ? `انتهى منذ ${daysWord(-left)} · الكمية ${fmt(p.quantity)}` : `بعد ${left === 0 ? 'اليوم' : daysWord(left)} · الكمية ${fmt(p.quantity)}`,
        date: d,
        link: '/pos-admin',
      });
    }
  }

  if (s.invoices) {
    // رصيد الزبون يُوزَّع على فواتيره الآجلة من الأحدث للأقدم: ما لم يُغطَّ منها اعتُبر مسدداً
    const byParty: Record<string, AlertInput['invoices']> = {};
    input.invoices
      .filter((i) => i.kind === 'sale' && i.partyId && num(i.totals?.total) - num(i.paid) > 0.005)
      .forEach((i) => (byParty[i.partyId] ??= []).push(i));
    const soon = addDays(today, s.dueSoonDays);
    for (const [partyId, list] of Object.entries(byParty)) {
      let budget = Math.max(balanceOf(partyId), 0);
      list.sort((a, b) => b.date.localeCompare(a.date) || b.number - a.number);
      for (const inv of list) {
        if (budget <= 0.005) break;
        const owed = (num(inv.totals.total) - num(inv.paid)) / (num(inv.exchangeRate) || 1);
        const rem = Math.min(owed, budget);
        budget -= rem;
        const due = (inv.dueDate || addDays(inv.date, s.termsDays)).slice(0, 10);
        if (due > soon) continue;
        const late = dayNum(today) - dayNum(due);
        out.push({
          id: `inv:${inv.id}:${due}`,
          kind: late > 0 ? 'invoiceOverdue' : 'invoiceDue',
          severity: late > 0 ? 'danger' : 'warning',
          title: `${late > 0 ? 'فاتورة متأخرة' : 'فاتورة تستحق'} رقم ${inv.number} · ${nameOf(partyId)}`,
          detail:
            (late > 0 ? `متأخرة ${daysWord(late)}` : late === 0 ? 'تستحق اليوم' : `تستحق بعد ${daysWord(-late)}`) +
            ` · المتبقي ${fmt(rem)} ${cur}`,
          amount: rem,
          date: due,
          link: '/trade',
        });
      }
    }
  }

  if (s.debts) {
    const system = new Set(input.systemAccountIds);
    const t = dayNum(today);
    for (const a of input.accounts) {
      if (!isDebtor(input, system, a)) continue;
      const bal = balanceOf(a.id);
      if (bal <= Math.max(s.minDebt, 0.005)) continue;
      const late = unpaidDebits(input.opsByAccount[a.id] || []).filter((d) => t - dayNum(d.date) > s.debtDays);
      if (!late.length) continue;
      const amount = late.reduce((x, d) => x + d.left, 0);
      const oldest = t - dayNum(late[0].date);
      out.push({
        id: `debt:${a.id}`,
        kind: 'debtOverdue',
        severity: oldest > s.debtDays * 2 ? 'danger' : 'warning',
        title: `دين متأخر: ${a.name}`,
        detail: `${fmt(amount)} ${cur} عمرها أكثر من ${daysWord(s.debtDays)} (أقدمها ${daysWord(oldest)}) · الرصيد ${fmt(bal)} ${cur}`,
        amount,
        date: late[0].date,
        link: `/accounts/${encodeURIComponent(a.id)}`,
      });
    }
  }

  if (s.cheques) {
    const until = addDays(today, s.chequeDays);
    for (const c of input.cheques) {
      const open = c.direction === 'in' ? c.status === 'portfolio' || c.status === 'collecting' : c.status === 'issued';
      const d = (c.dueDate || '').slice(0, 10);
      if (!open || !d || d > until) continue;
      const left = dayNum(d) - dayNum(today);
      out.push({
        id: `cheque:${c.id}:${d}`,
        kind: 'chequeDue',
        severity: left < 0 ? 'danger' : 'warning',
        title: `${c.direction === 'in' ? 'شيك وارد' : 'شيك صادر'} رقم ${c.number} · ${nameOf(c.partyId)}`,
        detail: `${fmt(c.amount)} ${c.currency} · ${left < 0 ? `استحق منذ ${daysWord(-left)}` : left === 0 ? 'يستحق اليوم' : `يستحق بعد ${daysWord(left)}`}`,
        amount: c.amount,
        date: d,
        link: '/cheques',
      });
    }
  }

  return out.sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity] || (a.date || '').localeCompare(b.date || ''));
};

/* ───────── من بيانات Firebase الخام (للخادم) ───────── */

const list = (o: unknown): [string, any][] => (o && typeof o === 'object' ? Object.entries(o as Record<string, any>) : []).filter(([, v]) => v && typeof v === 'object');
const str = (v: unknown) => (typeof v === 'string' ? v : v == null ? '' : String(v));
const ids = (v: unknown): string[] => (Array.isArray(v) ? v : v && typeof v === 'object' ? Object.values(v) : []).filter(Boolean).map(String);

/**
 * نفس ما يقرأه الويب: users/{uid}/accounts و operations (بلا المحذوفة ولا قيود الحسابات المحذوفة)،
 * و users/{uid}/erp، و sales/{uid}/products، والعملة الرئيسية.
 */
export const inputFromRaw = (raw: { accounts?: unknown; operations?: unknown; erp?: any; products?: unknown; mainCurrency: string }): AlertInput => {
  const erp = raw.erp || {};
  const accounts = list(raw.accounts).map(([k, a]) => ({
    id: str(a.id) || k,
    name: str(a.name),
    type: str(a.type),
    category: str(a.category),
    entityType: str(a.entityType),
  }));
  const known = new Set(accounts.map((a) => a.id));
  const opsByAccount: AlertInput['opsByAccount'] = {};
  list(raw.operations).forEach(([, o]) => {
    const accountId = str(o.accountId);
    if (o.deletedAt || o.deleted === true || !known.has(accountId)) return;
    (opsByAccount[accountId] ??= []).push({ date: str(o.date), amountUSD: num(o.amountUSD) });
  });
  const roles: AlertInput['roles'] = {};
  list(erp.accountMeta).forEach(([k, m]) => m.role && (roles[k] = str(m.role)));
  const systemAccountIds = [
    ...list(erp.cashboxes).flatMap(([, b]) => [...ids(b.linkedAccountIds), str(b.cashAccountId)]),
    ...list(erp.warehouses).map(([, w]) => str(w.inventoryAccountId)),
  ].filter(Boolean);
  const stockQty: Record<string, number> = {};
  list(erp.stockMoves).forEach(([, m]) => {
    const q = num(m.qty);
    const id = str(m.itemId);
    if (m.type === 'in' || m.type === 'adjust') stockQty[id] = (stockQty[id] || 0) + q;
    else if (m.type === 'out') stockQty[id] = (stockQty[id] || 0) - Math.abs(q);
  });
  return {
    mainCurrency: raw.mainCurrency,
    accounts,
    opsByAccount,
    roles,
    systemAccountIds,
    items: list(erp.items).map(([k, i]) => ({ id: k, name: str(i.name), minQty: num(i.minQty), reorderQty: num(i.reorderQty) })),
    stockQty,
    posProducts: list(raw.products).map(([k, p]) => ({
      id: k,
      name: str(p.name),
      quantity: num(p.quantity),
      trackExpiry: p.trackExpiry === true,
      expiryDate: p.expiryDate ? str(p.expiryDate) : null,
    })),
    invoices: list(erp.invoices).map(([k, i]) => ({
      id: k,
      number: num(i.number),
      kind: str(i.kind),
      partyId: str(i.partyId),
      date: str(i.date),
      dueDate: i.dueDate ? str(i.dueDate) : undefined,
      exchangeRate: num(i.exchangeRate) || 1,
      paid: num(i.paid),
      totals: { total: num(i.totals?.total) },
    })),
    cheques: list(erp.cheques).map(([k, c]) => ({
      id: k,
      number: str(c.number),
      direction: str(c.direction),
      dueDate: str(c.dueDate),
      amount: num(c.amount),
      currency: str(c.currency),
      status: str(c.status),
      partyId: str(c.partyId),
    })),
  };
};
