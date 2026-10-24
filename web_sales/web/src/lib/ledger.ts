// نموذج البيانات المحاسبي المشترك مع تطبيق الهاتف (Flutter).
//
// الهاتف يكتب:
//   users/{uid}/accounts/{id}     ← Account.toJson   (lib/main.dart)
//   users/{uid}/operations/{id}   ← Operation.toJson (lib/main.dart)
//   users/{uid}/clientOps/{accountId}/{opId} ← مرآة قيود الحسابات المفتوحة لبوابة العميل
//   users/{uid}/companyInfo       ← CompanyInfo.toJson
//   users/{uid}/cashboxes         ← قائمة صناديق الهاتف (lib/cashboxes.dart)
// والهاتف يستمع لـ accounts و operations لحظياً (onChildAdded/Changed/Removed)،
// فأي حساب أو قيد يكتبه الويب بنفس الشكل يظهر على الهاتف فوراً والعكس.
//
// كل ما يخص الويب وحده (صناديق الويب، المخازن، الشيكات، أدوار الحسابات...) يُحفظ تحت
// users/{uid}/erp/... ولا نكتب أبداً فوق عقدة يكتبها الهاتف بشكل كامل.

export type AccountCategory = 'asset' | 'liability' | 'equity' | 'revenue' | 'expense' | 'other';
export type AccountType = 'cash' | 'bank' | 'usdt' | 'other';
/** دور الحساب في الويب فقط (فهارس الزبائن والموردين والموظفين) */
export type AccountRole = 'customer' | 'supplier' | 'merchant' | 'employee' | 'bank' | 'cash' | 'general';

export interface Account {
  id: string;
  name: string;
  phone: string;
  address: string;
  type: AccountType | string;
  createdAt: string;
  code: string;
  category: AccountCategory | string;
  allowClientLogin: boolean;
  clientPhone: string;
  clientEmail: string;
  clientUid: string;
  /** مجموعة الحساب (users/{uid}/accountGroups) — يكتبها التطبيق */
  groupId: string;
  /** نوع الطرف في التطبيق: client = عميل، merchant = تاجر */
  entityType: string;
}

export interface AccountGroup {
  id: string;
  name: string;
  createdAt?: string;
}

export interface Operation {
  id: string;
  accountId: string;
  /** موجب = لنا (تحصيل) — سالب = لهم (صرف) */
  amount: number;
  exchangeRate: number;
  currency: string;
  /** المبلغ بالعملة الرئيسية (الاسم تاريخي من التطبيق) */
  amountUSD: number;
  statement: string;
  date: string;
  /** التطبيق يحذف القيد حذفاً ناعماً بوضع deletedAt — لا يدخل في أي رصيد */
  deletedAt?: string;
}

export interface CompanyInfo {
  name: string;
  phone: string;
  address: string;
  email: string;
}

export const CATEGORY_LABELS: Record<string, string> = {
  asset: 'أصول',
  liability: 'خصوم',
  equity: 'حقوق ملكية',
  revenue: 'إيرادات',
  expense: 'مصروفات',
  other: 'أخرى',
};

export const TYPE_LABELS: Record<string, string> = {
  cash: 'نقدي',
  bank: 'بنكي',
  usdt: 'USDT',
  other: 'أخرى',
};

export const ROLE_LABELS: Record<AccountRole, string> = {
  customer: 'زبون / عميل',
  merchant: 'تاجر',
  supplier: 'مورد',
  employee: 'موظف',
  bank: 'بنك',
  cash: 'صندوق / نقدية',
  general: 'حساب عام',
};

export const CURRENCIES = ['USD', 'SAR', 'AED', 'EUR', 'JOD', 'ILS', 'EGP', 'YER', 'KWD', 'QAR', 'OMR', 'BHD', 'TRY', 'GBP', 'USDT'];

const num = (v: unknown, fallback = 0) => (Number.isFinite(Number(v)) ? Number(v) : fallback);
const str = (v: unknown, fallback = '') => (typeof v === 'string' ? v : v == null ? fallback : String(v));

/** نفس Account.fromJson في التطبيق */
export const parseAccount = (key: string, j: any): Account => ({
  id: str(j?.id) || key,
  name: str(j?.name),
  phone: str(j?.phone),
  address: str(j?.address),
  type: str(j?.type, 'cash') || 'cash',
  createdAt: str(j?.createdAt),
  code: str(j?.code),
  category: str(j?.category, 'other') || 'other',
  allowClientLogin: j?.allowClientLogin === true,
  clientPhone: str(j?.clientPhone),
  clientEmail: str(j?.clientEmail),
  clientUid: str(j?.clientUid),
  groupId: str(j?.groupId),
  entityType: str(j?.entityType),
});

/** نفس Operation.fromJson في التطبيق */
export const parseOperation = (key: string, j: any): Operation => ({
  id: str(j?.id) || key,
  accountId: str(j?.accountId),
  amount: num(j?.amount),
  exchangeRate: num(j?.exchangeRate, 1) || 1,
  currency: str(j?.currency, 'USD') || 'USD',
  amountUSD: num(j?.amountUSD),
  statement: str(j?.statement),
  date: str(j?.date),
  deletedAt: j?.deletedAt ? str(j.deletedAt) : undefined,
});

/** نفس Account.toJson — كل الحقول، حتى لا يقرأ الهاتف قيمة ناقصة */
export const accountToJson = (a: Account) => ({
  id: a.id,
  name: a.name,
  phone: a.phone,
  address: a.address,
  type: a.type,
  createdAt: a.createdAt,
  code: a.code,
  category: a.category,
  allowClientLogin: a.allowClientLogin,
  clientPhone: a.clientPhone,
  clientEmail: a.clientEmail,
  clientUid: a.clientUid,
  groupId: a.groupId,
  ...(a.entityType ? { entityType: a.entityType } : {}),
});

export const operationToJson = (o: Operation) => ({
  id: o.id,
  accountId: o.accountId,
  amount: o.amount,
  exchangeRate: o.exchangeRate,
  currency: o.currency,
  amountUSD: o.amountUSD,
  statement: o.statement,
  date: o.date,
});

/** نفس حساب amountUSD في DataService.addOperation */
export const toMain = (amount: number, rate: number) => (rate !== 0 ? Number((amount / rate).toFixed(6)) : 0);

/** ترقيم الحسابات كالتطبيق: 0001، 0002 ... */
export const nextAccountId = (accounts: Account[]) => {
  const max = accounts.reduce((m, a) => Math.max(m, parseInt(a.id, 10) || 0), 0);
  return String(max + 1).padStart(4, '0');
};

/** معرّف القيد كالتطبيق: {millis}_{accountId} — مع إزاحة لتفادي التصادم في القيود المزدوجة */
let lastMillis = 0;
export const newOperationId = (accountId: string) => {
  let t = Date.now();
  if (t <= lastMillis) t = lastMillis + 1;
  lastMillis = t;
  return `${t}_${accountId}`;
};

/** تاريخ ISO محلي بدون منطقة زمنية (كما يكتبه Dart DateTime.toIso8601String) */
export const localIso = (d: Date = new Date()) => {
  const p = (n: number, w = 2) => String(n).padStart(w, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}:${p(
    d.getSeconds(),
  )}.${p(d.getMilliseconds(), 3)}`;
};

export const accountLabel = (a?: Pick<Account, 'code' | 'name' | 'id'> | null) =>
  a ? (a.code ? `${a.code} - ${a.name}` : a.name || a.id) : '—';

/* ───────── التجميع والأرصدة ───────── */

export interface Totals {
  /** مجموع القيود الموجبة (التحصيل / لنا) بالعملة الرئيسية */
  collected: number;
  /** مجموع القيود السالبة (المصروفات / لهم) كقيمة موجبة */
  spent: number;
  /** الفرق: موجب = صافي إيراد، سالب = صافي خسارة */
  net: number;
  count: number;
}

export const totalsOf = (ops: Operation[]): Totals => {
  let collected = 0;
  let spent = 0;
  for (const o of ops) {
    if (o.amountUSD >= 0) collected += o.amountUSD;
    else spent += -o.amountUSD;
  }
  return { collected, spent, net: collected - spent, count: ops.length };
};

export interface AccountBalance {
  total: number;
  byCurrency: Record<string, number>;
  count: number;
  lastDate: string | null;
}

export const balancesByAccount = (ops: Operation[]) => {
  const map: Record<string, AccountBalance> = {};
  for (const o of ops) {
    const b = (map[o.accountId] ??= { total: 0, byCurrency: {}, count: 0, lastDate: null });
    b.total += o.amountUSD;
    b.byCurrency[o.currency] = (b.byCurrency[o.currency] || 0) + o.amount;
    b.count += 1;
    if (!b.lastDate || o.date > b.lastDate) b.lastDate = o.date;
  }
  return map;
};

/* ───────── الفترات ───────── */

export type PeriodPreset = 'all' | 'today' | 'week' | 'month' | 'quarter' | 'year' | 'lastMonth' | 'custom';

export interface Period {
  preset: PeriodPreset;
  from: string; // yyyy-mm-dd
  to: string; // yyyy-mm-dd
}

const ymd = (d: Date) => localIso(d).slice(0, 10);

// شهر بداية السنة المالية (1..12) — يضبطه إعداد المنشأة (erp/profile) عند التحميل
let fiscalStartMonth = 1;
export const setFiscalStartMonth = (m: number) => {
  fiscalStartMonth = Number.isInteger(m) && m >= 1 && m <= 12 ? m : 1;
};
export const getFiscalStartMonth = () => fiscalStartMonth;

export const PERIOD_LABELS: Record<PeriodPreset, string> = {
  all: 'كل الفترات',
  today: 'اليوم',
  week: 'آخر 7 أيام',
  month: 'هذا الشهر',
  lastMonth: 'الشهر الماضي',
  quarter: 'آخر 3 أشهر',
  year: 'السنة المالية الحالية',
  custom: 'فترة مخصصة',
};

export const periodFromPreset = (preset: PeriodPreset, current?: Period): Period => {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  switch (preset) {
    case 'today':
      return { preset, from: ymd(now), to: ymd(now) };
    case 'week': {
      const f = new Date(now);
      f.setDate(f.getDate() - 6);
      return { preset, from: ymd(f), to: ymd(now) };
    }
    case 'month':
      return { preset, from: ymd(new Date(y, m, 1)), to: ymd(now) };
    case 'lastMonth':
      return { preset, from: ymd(new Date(y, m - 1, 1)), to: ymd(new Date(y, m, 0)) };
    case 'quarter':
      return { preset, from: ymd(new Date(y, m - 2, 1)), to: ymd(now) };
    case 'year': {
      const s = fiscalStartMonth - 1;
      return { preset, from: ymd(new Date(m >= s ? y : y - 1, s, 1)), to: ymd(now) };
    }
    case 'custom':
      return { preset, from: current?.from || ymd(new Date(y, 0, 1)), to: current?.to || ymd(now) };
    default:
      return { preset: 'all', from: '', to: '' };
  }
};

export const inPeriod = (date: string, p: Period) => {
  const d = (date || '').slice(0, 10);
  if (p.from && d < p.from) return false;
  if (p.to && d > p.to) return false;
  return true;
};

export const periodText = (p: Period) =>
  p.preset === 'all' ? 'كل الفترات' : `${p.from || '...'} ← ${p.to || '...'}`;

/** رصيد ما قبل بداية الفترة (رصيد افتتاحي لكشف الحساب) */
export const openingBalance = (ops: Operation[], p: Period) =>
  p.from ? ops.filter((o) => (o.date || '').slice(0, 10) < p.from).reduce((s, o) => s + o.amountUSD, 0) : 0;

export const sortByDate = <T extends { date: string }>(rows: T[], dir: 'asc' | 'desc' = 'asc') =>
  [...rows].sort((a, b) => (dir === 'asc' ? a.date.localeCompare(b.date) : b.date.localeCompare(a.date)));
