// مركز التقارير: كل تقرير دالة تبني جدولاً موحّداً (ReportTable) يُعرض في الصفحة
// ويُصدَّر بنفسه إلى PDF و Excel — فما يراه المستخدم هو ما يُطبع حرفياً.

import { ReportTable } from './export';
import {
  Account,
  CATEGORY_LABELS,
  Operation,
  Period,
  inPeriod,
  periodText,
  sortByDate,
  totalsOf,
} from './ledger';
import { CHEQUE_STATUS, Cashbox, Cheque, MOVE_LABELS, StockItem, StockMove, Voucher, VOUCHER_LABELS, Warehouse, cashboxBalance, stockLevels } from './erp';
import { formatDate, formatNumber } from './format';
import type { AccountExtra, Invoice, Note, Payroll, RateEntry } from './trade';

export interface ReportContext {
  accounts: Account[];
  accountsById: Record<string, Account>;
  operations: Operation[];
  opsByAccount: Record<string, Operation[]>;
  roleOf: (id: string) => string;
  mainCurrency: string;
  cashboxes: Cashbox[];
  vouchers: Voucher[];
  warehouses: Warehouse[];
  items: StockItem[];
  moves: StockMove[];
  cheques: Cheque[];
  /** المستندات التجارية والإدارية (lib/trade.ts) */
  invoices?: Invoice[];
  notes?: Note[];
  payrolls?: Payroll[];
  rates?: RateEntry[];
  accountMeta?: Record<string, AccountExtra>;
  period: Period;
  /** معامل اختياري: الحساب (كشف حساب) أو التصنيف */
  accountId?: string;
  category?: string;
}

export type ReportParam = 'account' | 'category';

export interface ReportDef {
  id: string;
  group: string;
  title: string;
  description: string;
  /** هل تنطبق الفترة على التقرير؟ */
  usesPeriod?: boolean;
  params?: ReportParam[];
  build: (c: ReportContext) => ReportTable;
}

const label = (a?: Account) => (a ? (a.code ? `${a.code} - ${a.name}` : a.name) : '—');
const sum = (ops: Operation[]) => ops.reduce((s, o) => s + o.amountUSD, 0);
const lanaLahum = (v: number) => (v >= 0 ? 'لنا' : 'لهم');
const upTo = (ops: Operation[], p: Period) => (p.to ? ops.filter((o) => o.date.slice(0, 10) <= p.to) : ops);

const balancesInPeriod = (c: ReportContext) =>
  c.accounts.map((a) => {
    const ops = (c.opsByAccount[a.id] || []).filter((o) => inPeriod(o.date, c.period));
    const debit = ops.filter((o) => o.amountUSD >= 0).reduce((s, o) => s + o.amountUSD, 0);
    const credit = ops.filter((o) => o.amountUSD < 0).reduce((s, o) => s - o.amountUSD, 0);
    return { a, debit, credit, balance: debit - credit, count: ops.length };
  });

const roleBalances = (role: string, title: string): ReportDef['build'] => (c) => {
  const rows = c.accounts
    .filter((a) => c.roleOf(a.id) === role)
    .map((a) => ({ a, b: sum(upTo(c.opsByAccount[a.id] || [], c.period)) }));
  const total = rows.reduce((s, r) => s + r.b, 0);
  return {
    title,
    subtitle: `حتى ${c.period.to || 'اليوم'} · ${c.mainCurrency}`,
    columns: ['الرقم', 'الحساب', 'الهاتف', 'الرصيد', 'الحالة'],
    numericColumns: [3],
    rows: rows.map((r) => [r.a.id, r.a.name, r.a.phone, Math.abs(r.b), lanaLahum(r.b)]),
    footer: [['', 'الإجمالي', '', Math.abs(total), lanaLahum(total)]],
  };
};

const roleMovements = (role: string, title: string): ReportDef['build'] => (c) => {
  const ids = new Set(c.accounts.filter((a) => c.roleOf(a.id) === role).map((a) => a.id));
  const ops = sortByDate(c.operations.filter((o) => ids.has(o.accountId) && inPeriod(o.date, c.period)));
  const t = totalsOf(ops);
  return {
    title,
    subtitle: periodText(c.period),
    summary: [
      ['لنا', formatNumber(t.collected)],
      ['لهم', formatNumber(t.spent)],
      ['الصافي', formatNumber(t.net)],
    ],
    columns: ['التاريخ', 'الحساب', 'البيان', 'لنا', 'لهم', 'العملة'],
    numericColumns: [3, 4],
    rows: ops.map((o) => [
      formatDate(o.date),
      c.accountsById[o.accountId]?.name || o.accountId,
      o.statement,
      o.amount >= 0 ? o.amount : '',
      o.amount < 0 ? -o.amount : '',
      o.currency,
    ]),
  };
};

export const REPORTS: ReportDef[] = [
  /* ───── المحاسبة ───── */
  {
    id: 'income-expense',
    group: 'المحاسبة',
    title: 'الإيرادات والمصروفات',
    description: 'مجموع التحصيل (القيود الموجبة) والمصروفات (السالبة) والصافي شهرياً',
    usesPeriod: true,
    build: (c) => {
      const ops = c.operations.filter((o) => inPeriod(o.date, c.period));
      const t = totalsOf(ops);
      const months: Record<string, Operation[]> = {};
      ops.forEach((o) => (months[o.date.slice(0, 7)] ??= []).push(o));
      return {
        title: 'الإيرادات والمصروفات',
        subtitle: `${periodText(c.period)} · ${c.mainCurrency}`,
        summary: [
          ['مجموع التحصيل', formatNumber(t.collected)],
          ['مجموع المصروفات', formatNumber(t.spent)],
          [t.net >= 0 ? 'صافي الإيراد' : 'صافي الخسارة', formatNumber(Math.abs(t.net))],
        ],
        columns: ['الشهر', 'عدد القيود', 'التحصيل', 'المصروفات', 'الصافي', 'النتيجة'],
        numericColumns: [1, 2, 3, 4],
        rows: Object.keys(months)
          .sort()
          .map((m) => {
            const x = totalsOf(months[m]);
            return [m, String(x.count), x.collected, x.spent, x.net, x.net >= 0 ? 'إيراد' : 'خسارة'];
          }),
        footer: [['الإجمالي', String(t.count), t.collected, t.spent, t.net, t.net >= 0 ? 'صافي إيراد' : 'صافي خسارة']],
      };
    },
  },
  {
    id: 'trial-balance',
    group: 'المحاسبة',
    title: 'ميزان المراجعة',
    description: 'مجموع لنا (مدين) ولهم (دائن) والرصيد لكل حساب',
    usesPeriod: true,
    build: (c) => {
      const rows = balancesInPeriod(c).filter((r) => r.count > 0);
      const td = rows.reduce((s, r) => s + r.debit, 0);
      const tc = rows.reduce((s, r) => s + r.credit, 0);
      return {
        title: 'ميزان المراجعة',
        subtitle: `${periodText(c.period)} · ${c.mainCurrency}`,
        summary: [
          ['إجمالي لنا (مدين)', formatNumber(td)],
          ['إجمالي لهم (دائن)', formatNumber(tc)],
          ['الفرق', formatNumber(td - tc)],
        ],
        columns: ['الحساب', 'التصنيف', 'لنا (مدين)', 'لهم (دائن)', 'الرصيد'],
        numericColumns: [2, 3, 4],
        rows: rows.map((r) => [label(r.a), CATEGORY_LABELS[r.a.category] || 'أخرى', r.debit, r.credit, r.balance]),
        footer: [['الإجمالي', '', td, tc, td - tc]],
      };
    },
  },
  {
    id: 'income-statement',
    group: 'المحاسبة',
    title: 'قائمة الدخل',
    description: 'حسابات الإيرادات مقابل حسابات المصروفات وصافي الربح',
    usesPeriod: true,
    build: (c) => {
      const all = balancesInPeriod(c);
      const rev = all.filter((r) => r.a.category === 'revenue');
      const exp = all.filter((r) => r.a.category === 'expense');
      const tr = rev.reduce((s, r) => s + Math.abs(r.balance), 0);
      const te = exp.reduce((s, r) => s + Math.abs(r.balance), 0);
      return {
        title: 'قائمة الدخل',
        subtitle: `${periodText(c.period)} · ${c.mainCurrency}`,
        summary: [
          ['الإيرادات', formatNumber(tr)],
          ['المصروفات', formatNumber(te)],
          [tr - te >= 0 ? 'صافي الربح' : 'صافي الخسارة', formatNumber(Math.abs(tr - te))],
        ],
        columns: ['البيان', 'النوع', 'إيرادات', 'مصروفات'],
        numericColumns: [2, 3],
        rows: [],
        sections: [
          {
            heading: 'الإيرادات',
            rows: rev.map((r) => [label(r.a), 'إيرادات', Math.abs(r.balance), '']),
            footer: [['إجمالي الإيرادات', '', tr, '']],
          },
          {
            heading: 'المصروفات',
            rows: exp.map((r) => [label(r.a), 'مصروفات', '', Math.abs(r.balance)]),
            footer: [
              ['إجمالي المصروفات', '', '', te],
              [tr - te >= 0 ? 'صافي الربح' : 'صافي الخسارة', '', tr - te >= 0 ? tr - te : '', tr - te < 0 ? te - tr : ''],
            ],
          },
        ],
      };
    },
  },
  {
    id: 'balance-sheet',
    group: 'المحاسبة',
    title: 'الميزانية العمومية',
    description: 'الأصول والخصوم وحقوق الملكية حتى نهاية الفترة',
    usesPeriod: true,
    build: (c) => {
      const bal = (cat: string) =>
        c.accounts.filter((a) => a.category === cat).map((a) => ({ a, b: sum(upTo(c.opsByAccount[a.id] || [], c.period)) }));
      const groups: Array<[string, ReturnType<typeof bal>]> = [
        ['الأصول', bal('asset')],
        ['الخصوم', bal('liability')],
        ['حقوق الملكية', bal('equity')],
      ];
      const t = groups.map(([, rows]) => rows.reduce((s, r) => s + r.b, 0));
      return {
        title: 'الميزانية العمومية',
        subtitle: `حتى ${c.period.to || 'اليوم'} · ${c.mainCurrency}`,
        summary: [
          ['الأصول', formatNumber(t[0])],
          ['الخصوم', formatNumber(t[1])],
          ['حقوق الملكية', formatNumber(t[2])],
          ['الفرق', formatNumber(t[0] - (t[1] + t[2]))],
        ],
        columns: ['الفئة', 'الحساب', 'الرصيد'],
        numericColumns: [2],
        rows: [],
        sections: groups.map(([name, rows], i) => ({
          heading: name,
          rows: rows.map((r) => [name, label(r.a), r.b]),
          footer: [['', `إجمالي ${name}`, t[i]]],
        })),
      };
    },
  },
  {
    id: 'statement',
    group: 'المحاسبة',
    title: 'كشف حساب',
    description: 'حركة حساب محدد مع الرصيد التراكمي',
    usesPeriod: true,
    params: ['account'],
    build: (c) => {
      const a = c.accountId ? c.accountsById[c.accountId] : undefined;
      const all = sortByDate(c.opsByAccount[c.accountId || ''] || []);
      const opening = c.period.from ? all.filter((o) => o.date.slice(0, 10) < c.period.from).reduce((s, o) => s + o.amountUSD, 0) : 0;
      const ops = all.filter((o) => inPeriod(o.date, c.period));
      let r = opening;
      const t = totalsOf(ops);
      return {
        title: 'كشف حساب',
        subtitle: a ? `${label(a)} · ${periodText(c.period)}` : 'اختر الحساب',
        summary: a
          ? [
              ['رصيد افتتاحي', formatNumber(opening)],
              ['لنا', formatNumber(t.collected)],
              ['لهم', formatNumber(t.spent)],
              ['الرصيد الختامي', formatNumber(opening + t.net)],
            ]
          : [],
        columns: ['التاريخ', 'البيان', 'لنا', 'لهم', 'العملة', `المعادل ${c.mainCurrency}`, 'الرصيد'],
        numericColumns: [2, 3, 5, 6],
        rows: [
          ...(c.period.from && a ? [['', 'رصيد افتتاحي', '', '', '', '', opening] as Array<string | number>] : []),
          ...ops.map((o) => [
            formatDate(o.date),
            o.statement,
            o.amount >= 0 ? o.amount : '',
            o.amount < 0 ? -o.amount : '',
            o.currency,
            o.amountUSD,
            (r += o.amountUSD),
          ]),
        ],
      };
    },
  },
  {
    id: 'general-ledger',
    group: 'المحاسبة',
    title: 'حساب الأستاذ',
    description: 'كل الحركات مجمّعة حسب الحساب',
    usesPeriod: true,
    params: ['category'],
    build: (c) => {
      const accs = c.accounts.filter((a) => !c.category || a.category === c.category);
      const sections = accs
        .map((a) => {
          const ops = sortByDate((c.opsByAccount[a.id] || []).filter((o) => inPeriod(o.date, c.period)));
          let r = 0;
          return {
            heading: `${label(a)} — ${ops.length} حركة`,
            rows: ops.map((o) => [formatDate(o.date), o.statement, o.amountUSD >= 0 ? o.amountUSD : '', o.amountUSD < 0 ? -o.amountUSD : '', (r += o.amountUSD)] as Array<string | number>),
            footer: [['', 'الرصيد', '', '', r] as Array<string | number>],
          };
        })
        .filter((s) => s.rows.length);
      return {
        title: 'حساب الأستاذ العام',
        subtitle: `${periodText(c.period)}${c.category ? ` · ${CATEGORY_LABELS[c.category]}` : ''}`,
        columns: ['التاريخ', 'البيان', 'لنا', 'لهم', 'الرصيد'],
        numericColumns: [2, 3, 4],
        rows: [],
        sections,
      };
    },
  },
  {
    id: 'journal',
    group: 'المحاسبة',
    title: 'قيود المحاسبة',
    description: 'سجل يومي بكل القيود في الفترة',
    usesPeriod: true,
    build: (c) => {
      const ops = sortByDate(c.operations.filter((o) => inPeriod(o.date, c.period)));
      const t = totalsOf(ops);
      return {
        title: 'قيود المحاسبة',
        subtitle: periodText(c.period),
        summary: [
          ['عدد القيود', String(t.count)],
          ['لنا', formatNumber(t.collected)],
          ['لهم', formatNumber(t.spent)],
        ],
        columns: ['التاريخ', 'الحساب', 'البيان', 'المبلغ', 'العملة', 'سعر الصرف', `المعادل ${c.mainCurrency}`],
        numericColumns: [3, 5, 6],
        rows: ops.map((o) => [
          formatDate(o.date, { dateStyle: 'medium', timeStyle: 'short' }),
          label(c.accountsById[o.accountId]),
          o.statement,
          o.amount,
          o.currency,
          o.exchangeRate,
          o.amountUSD,
        ]),
        footer: [['الإجمالي', '', '', '', '', '', t.net]],
      };
    },
  },
  {
    id: 'balances',
    group: 'المحاسبة',
    title: 'أرصدة الحسابات',
    description: 'رصيد كل حساب حتى نهاية الفترة',
    usesPeriod: true,
    params: ['category'],
    build: (c) => {
      const rows = c.accounts
        .filter((a) => !c.category || a.category === c.category)
        .map((a) => ({ a, b: sum(upTo(c.opsByAccount[a.id] || [], c.period)) }));
      const total = rows.reduce((s, r) => s + r.b, 0);
      return {
        title: 'أرصدة الحسابات',
        subtitle: `حتى ${c.period.to || 'اليوم'}${c.category ? ` · ${CATEGORY_LABELS[c.category]}` : ''}`,
        columns: ['الرقم', 'الحساب', 'التصنيف', 'الرصيد', 'الحالة'],
        numericColumns: [3],
        rows: rows.map((r) => [r.a.id, label(r.a), CATEGORY_LABELS[r.a.category] || 'أخرى', Math.abs(r.b), lanaLahum(r.b)]),
        footer: [['', 'الإجمالي', '', Math.abs(total), lanaLahum(total)]],
      };
    },
  },
  {
    id: 'debtors',
    group: 'المحاسبة',
    title: 'الحسابات المدينة (لنا)',
    description: 'الحسابات التي لنا عندها أرصدة',
    build: (c) => {
      const rows = c.accounts.map((a) => ({ a, b: sum(c.opsByAccount[a.id] || []) })).filter((r) => r.b > 0.009).sort((x, y) => y.b - x.b);
      const total = rows.reduce((s, r) => s + r.b, 0);
      return {
        title: 'الحسابات المدينة',
        summary: [
          ['عدد الحسابات', String(rows.length)],
          ['إجمالي المديونية', formatNumber(total)],
        ],
        columns: ['الحساب', 'التصنيف', 'الهاتف', 'الرصيد المدين'],
        numericColumns: [3],
        rows: rows.map((r) => [label(r.a), CATEGORY_LABELS[r.a.category] || 'أخرى', r.a.phone, r.b]),
        footer: [['الإجمالي', '', '', total]],
      };
    },
  },
  {
    id: 'creditors',
    group: 'المحاسبة',
    title: 'الحسابات الدائنة (لهم)',
    description: 'الحسابات التي لها عندنا أرصدة',
    build: (c) => {
      const rows = c.accounts.map((a) => ({ a, b: -sum(c.opsByAccount[a.id] || []) })).filter((r) => r.b > 0.009).sort((x, y) => y.b - x.b);
      const total = rows.reduce((s, r) => s + r.b, 0);
      return {
        title: 'الحسابات الدائنة',
        summary: [
          ['عدد الحسابات', String(rows.length)],
          ['إجمالي الدائنية', formatNumber(total)],
        ],
        columns: ['الحساب', 'التصنيف', 'الهاتف', 'الرصيد الدائن'],
        numericColumns: [3],
        rows: rows.map((r) => [label(r.a), CATEGORY_LABELS[r.a.category] || 'أخرى', r.a.phone, r.b]),
        footer: [['الإجمالي', '', '', total]],
      };
    },
  },
  {
    id: 'monthly-balances',
    group: 'المحاسبة',
    title: 'أرصدة الحسابات شهرياً',
    description: 'صافي حركة كل حساب لكل شهر',
    usesPeriod: true,
    params: ['category'],
    build: (c) => {
      const ops = c.operations.filter((o) => inPeriod(o.date, c.period));
      const months = Array.from(new Set(ops.map((o) => o.date.slice(0, 7)))).sort().slice(-12);
      const accs = c.accounts.filter((a) => (!c.category || a.category === c.category) && (c.opsByAccount[a.id] || []).some((o) => inPeriod(o.date, c.period)));
      const cell = (id: string, m: string) => (c.opsByAccount[id] || []).filter((o) => o.date.startsWith(m)).reduce((s, o) => s + o.amountUSD, 0);
      return {
        title: 'أرصدة الحسابات شهرياً',
        subtitle: `${periodText(c.period)} · آخر ${months.length} شهر`,
        columns: ['الحساب', ...months, 'الإجمالي'],
        numericColumns: months.map((_, i) => i + 1).concat(months.length + 1),
        rows: accs.map((a) => {
          const vals = months.map((m) => cell(a.id, m));
          return [label(a), ...vals, vals.reduce((s, v) => s + v, 0)];
        }),
      };
    },
  },

  /* ───── الفهارس ───── */
  { id: 'customers', group: 'الفهارس', title: 'أرصدة الزبائن', description: 'كل الزبائن وأرصدتهم', usesPeriod: true, build: roleBalances('customer', 'أرصدة الزبائن') },
  { id: 'suppliers', group: 'الفهارس', title: 'أرصدة الموردين', description: 'كل الموردين وأرصدتهم', usesPeriod: true, build: roleBalances('supplier', 'أرصدة الموردين') },
  { id: 'employees', group: 'الفهارس', title: 'أرصدة الموظفين', description: 'كل الموظفين وأرصدتهم', usesPeriod: true, build: roleBalances('employee', 'أرصدة الموظفين') },
  { id: 'customers-moves', group: 'الفهارس', title: 'حركات الزبائن', description: 'قيود حسابات الزبائن في الفترة', usesPeriod: true, build: roleMovements('customer', 'حركات الزبائن') },
  { id: 'suppliers-moves', group: 'الفهارس', title: 'حركات الموردين', description: 'قيود حسابات الموردين في الفترة', usesPeriod: true, build: roleMovements('supplier', 'حركات الموردين') },
  { id: 'employees-moves', group: 'الفهارس', title: 'حركات الموظفين', description: 'قيود حسابات الموظفين في الفترة', usesPeriod: true, build: roleMovements('employee', 'حركات الموظفين') },

  /* ───── النقدية ───── */
  {
    id: 'cashbox-balances',
    group: 'النقدية',
    title: 'أرصدة الصناديق',
    description: 'رصيد كل صندوق مع الصناديق الفرعية',
    build: (c) => {
      const rows = c.cashboxes.map((b) => ({ b, bal: cashboxBalance(b, c.cashboxes, c.opsByAccount) }));
      const roots = rows.filter((r) => !r.b.parentId);
      return {
        title: 'أرصدة الصناديق',
        subtitle: c.mainCurrency,
        columns: ['الصندوق', 'الصندوق الأب', 'حساب النقدية', 'رصيده وحده', 'الرصيد الكلي'],
        numericColumns: [3, 4],
        rows: rows.map((r) => [
          r.b.name,
          c.cashboxes.find((x) => x.id === r.b.parentId)?.name || '—',
          label(c.accountsById[r.b.cashAccountId || '']),
          r.bal.own,
          r.bal.total,
        ]),
        footer: [['إجمالي الصناديق الرئيسية', '', '', '', roots.reduce((s, r) => s + r.bal.total, 0)]],
      };
    },
  },
  {
    id: 'vouchers',
    group: 'النقدية',
    title: 'إيصالات القبض والصرف',
    description: 'كل السندات في الفترة',
    usesPeriod: true,
    build: (c) => {
      const rows = c.vouchers.filter((v) => inPeriod(v.date, c.period));
      const total = (t: string) => rows.filter((v) => v.type === t).reduce((s, v) => s + v.amount / (v.exchangeRate || 1), 0);
      return {
        title: 'إيصالات القبض والصرف',
        subtitle: periodText(c.period),
        summary: [
          ['المقبوضات', formatNumber(total('receipt'))],
          ['المدفوعات', formatNumber(total('payment'))],
        ],
        columns: ['النوع', 'الرقم', 'التاريخ', 'الصندوق', 'الطرف', 'البيان', 'المبلغ', 'العملة'],
        numericColumns: [6],
        rows: rows.map((v) => [
          VOUCHER_LABELS[v.type],
          String(v.number),
          formatDate(v.date),
          c.cashboxes.find((b) => b.id === v.boxId)?.name || '',
          v.type === 'transfer' ? c.cashboxes.find((b) => b.id === v.toBoxId)?.name || '' : c.accountsById[v.partyId || '']?.name || '',
          v.statement,
          v.amount,
          v.currency,
        ]),
      };
    },
  },
  {
    id: 'bank-liquidity',
    group: 'النقدية',
    title: 'السيولة المالية للبنوك',
    description: 'أرصدة الحسابات البنكية',
    build: (c) => {
      const rows = c.accounts
        .filter((a) => a.type === 'bank' || c.roleOf(a.id) === 'bank')
        .map((a) => ({ a, b: sum(c.opsByAccount[a.id] || []) }));
      return {
        title: 'السيولة المالية للبنوك',
        columns: ['الحساب', 'عدد الحركات', 'الرصيد'],
        numericColumns: [1, 2],
        rows: rows.map((r) => [label(r.a), String((c.opsByAccount[r.a.id] || []).length), r.b]),
        footer: [['الإجمالي', '', rows.reduce((s, r) => s + r.b, 0)]],
      };
    },
  },
  {
    id: 'cheques-in',
    group: 'النقدية',
    title: 'الشيكات الواردة',
    description: 'كل الشيكات الواردة وحالاتها',
    build: (c) => chequeReport(c, 'in'),
  },
  {
    id: 'cheques-out',
    group: 'النقدية',
    title: 'الشيكات الصادرة',
    description: 'كل الشيكات الصادرة وحالاتها',
    build: (c) => chequeReport(c, 'out'),
  },

  /* ───── المخازن ───── */
  {
    id: 'stock-balances',
    group: 'المخازن',
    title: 'أرصدة المخازن',
    description: 'كميات كل صنف في كل مخزن',
    build: (c) => {
      const lv = stockLevels(c.moves);
      return {
        title: 'أرصدة المخازن',
        columns: ['الصنف', ...c.warehouses.map((w) => w.name), 'الإجمالي'],
        numericColumns: c.warehouses.map((_, i) => i + 1).concat(c.warehouses.length + 1),
        rows: c.items.map((i) => {
          const q = c.warehouses.map((w) => lv.of(w.id, i.id).qty);
          return [i.name, ...q, q.reduce((s, v) => s + v, 0)];
        }),
      };
    },
  },
  {
    id: 'stock-value',
    group: 'المخازن',
    title: 'قيمة البضاعة الموجودة',
    description: 'الكمية × متوسط التكلفة لكل صنف',
    build: (c) => {
      const lv = stockLevels(c.moves);
      const rows = c.items.map((i) => {
        const qty = c.warehouses.reduce((s, w) => s + lv.of(w.id, i.id).qty, 0);
        const value = c.warehouses.reduce((s, w) => s + lv.of(w.id, i.id).value, 0);
        return [i.name, i.unit || '', qty, qty > 0 ? value / qty : 0, value] as Array<string | number>;
      });
      const total = rows.reduce((s, r) => s + Number(r[4]), 0);
      return {
        title: 'قيمة البضاعة الموجودة',
        subtitle: c.mainCurrency,
        summary: [['القيمة الإجمالية', formatNumber(total)]],
        columns: ['الصنف', 'الوحدة', 'الكمية', 'متوسط التكلفة', 'القيمة'],
        numericColumns: [2, 3, 4],
        rows,
        footer: [['الإجمالي', '', '', '', total]],
      };
    },
  },
  {
    id: 'stock-moves',
    group: 'المخازن',
    title: 'حركات المخازن',
    description: 'الإدخال والإخراج والتحويل والتسوية',
    usesPeriod: true,
    build: (c) => {
      const wh = (id?: string | null) => c.warehouses.find((w) => w.id === id)?.name || '';
      const rows = c.moves.filter((m) => inPeriod(m.date, c.period));
      return {
        title: 'حركات المخازن',
        subtitle: periodText(c.period),
        columns: ['الرقم', 'الحركة', 'التاريخ', 'الصنف', 'المخزن', 'الكمية', 'التكلفة', 'البيع'],
        numericColumns: [5, 6, 7],
        rows: rows.map((m) => [
          String(m.number),
          MOVE_LABELS[m.type],
          formatDate(m.date),
          c.items.find((i) => i.id === m.itemId)?.name || '',
          m.type === 'transfer' ? `${wh(m.warehouseId)} ← ${wh(m.toWarehouseId)}` : wh(m.warehouseId),
          m.qty,
          Math.abs(m.qty) * m.unitCost,
          m.type === 'out' ? m.qty * (m.unitPrice || 0) : '',
        ]),
      };
    },
  },
  {
    id: 'stock-low',
    group: 'المخازن',
    title: 'أصناف دون الحد الأدنى',
    description: 'الأصناف التي تحتاج إعادة طلب',
    build: (c) => {
      const lv = stockLevels(c.moves);
      const rows = c.items
        .map((i) => ({ i, q: c.warehouses.reduce((s, w) => s + lv.of(w.id, i.id).qty, 0) }))
        .filter((r) => r.i.minQty && r.q < r.i.minQty);
      return {
        title: 'أصناف دون الحد الأدنى',
        columns: ['الصنف', 'الرصيد', 'الحد الأدنى', 'النقص'],
        numericColumns: [1, 2, 3],
        rows: rows.map((r) => [r.i.name, r.q, r.i.minQty || 0, (r.i.minQty || 0) - r.q]),
      };
    },
  },
  {
    id: 'monthly-sales',
    group: 'المخازن',
    title: 'صافي المبيعات الشهري',
    description: 'مبيعات المخازن وتكلفتها وربحها لكل شهر',
    usesPeriod: true,
    build: (c) => {
      const outs = c.moves.filter((m) => m.type === 'out' && inPeriod(m.date, c.period));
      const months: Record<string, { sale: number; cost: number; count: number }> = {};
      outs.forEach((m) => {
        const r = (months[m.date.slice(0, 7)] ??= { sale: 0, cost: 0, count: 0 });
        r.sale += m.qty * (m.unitPrice || 0);
        r.cost += m.qty * m.unitCost;
        r.count += 1;
      });
      const keys = Object.keys(months).sort();
      const ts = keys.reduce((s, k) => s + months[k].sale, 0);
      const tc = keys.reduce((s, k) => s + months[k].cost, 0);
      return {
        title: 'صافي المبيعات الشهري',
        subtitle: periodText(c.period),
        summary: [
          ['المبيعات', formatNumber(ts)],
          ['التكلفة', formatNumber(tc)],
          ['الربح', formatNumber(ts - tc)],
        ],
        columns: ['الشهر', 'عدد الحركات', 'المبيعات', 'التكلفة', 'الربح'],
        numericColumns: [1, 2, 3, 4],
        rows: keys.map((k) => [k, String(months[k].count), months[k].sale, months[k].cost, months[k].sale - months[k].cost]),
        footer: [['الإجمالي', String(outs.length), ts, tc, ts - tc]],
      };
    },
  },
];

function chequeReport(c: ReportContext, direction: 'in' | 'out'): ReportTable {
  const rows = c.cheques.filter((x) => x.direction === direction);
  return {
    title: direction === 'in' ? 'الشيكات الواردة' : 'الشيكات الصادرة',
    columns: ['رقم الشيك', 'البنك', direction === 'in' ? 'الساحب' : 'المستفيد', 'الاستحقاق', 'الحالة', 'المبلغ', 'العملة'],
    numericColumns: [5],
    rows: rows.map((x) => [x.number, x.bank, c.accountsById[x.partyId]?.name || '', x.dueDate, CHEQUE_STATUS[x.status].label, x.amount, x.currency]),
  };
}

export const REPORT_GROUPS = Array.from(new Set(REPORTS.map((r) => r.group)));
