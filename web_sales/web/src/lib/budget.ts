// الموازنة والارتباطات والمشتريات (المرحلة الثانية من ملاءمة القطاع الحكومي، وتصلح للخاص أيضاً).
//
// users/{owner}/erp/budgets/{fy}/{accountId} = { appropriation }  ← الاعتماد الأصلي لكل بند
// users/{owner}/erp/budgetTransfers/{id}                           ← المناقلات والاعتمادات الإضافية
// users/{owner}/erp/commitments/{id}                               ← طلب شراء ← اعتماد ← ارتباط ← أمر شراء ← استلام ← أمر صرف
// users/{owner}/erp/approvalLevels/{id}                             ← مستويات الاعتماد حسب المبلغ
//
// بنود الموازنة = حسابات المصروفات، مجمّعة حسب باب الموازنة (accountMeta.chapter).
// المصروف الفعلي = صافي القيود المدينة على الحساب داخل السنة المالية (ومنها أوامر الصرف نفسها).

import { Account, Operation } from './ledger';
import { AccountMeta } from './erp';
import { BudgetChapter, CHAPTER_LABELS } from './coaTemplates';
import { fiscalYearOf } from './localization';

export type CommitmentStatus = 'requested' | 'committed' | 'ordered' | 'received' | 'paid' | 'rejected' | 'cancelled';

export const COMMITMENT_STATUS: Record<CommitmentStatus, { label: string; tone: 'neutral' | 'info' | 'brand' | 'warning' | 'success' | 'danger' }> = {
  requested: { label: 'قيد الاعتماد', tone: 'warning' },
  committed: { label: 'مرتبط', tone: 'info' },
  ordered: { label: 'صدر أمر الشراء', tone: 'brand' },
  received: { label: 'تم الاستلام', tone: 'brand' },
  paid: { label: 'صُرف', tone: 'success' },
  rejected: { label: 'مرفوض', tone: 'danger' },
  cancelled: { label: 'ملغى', tone: 'neutral' },
};

/** الحالات التي تحجز مبلغها من البند */
export const ENCUMBERING: CommitmentStatus[] = ['committed', 'ordered', 'received'];

export interface ApprovalLevel {
  id: string;
  name: string;
  /** يعتمد حتى هذا المبلغ؛ null = بلا حد (آخر مستوى) */
  upTo: number | null;
  /** عضو الفريق المخوّل؛ فارغ = المالك أو أي عضو له صلاحية تعديل الموازنة */
  approverUid?: string | null;
  order: number;
}

export interface ApprovalStep {
  levelId: string;
  levelName: string;
  action: 'approve' | 'reject';
  by: string;
  byName: string;
  at: string;
  note?: string;
}

export interface Commitment {
  id: string;
  number: number;
  fy: string;
  date: string;
  /** بند الموازنة (حساب مصروف) */
  accountId: string;
  description: string;
  amount: number;
  status: CommitmentStatus;
  requestedBy: string;
  requestedByName: string;
  approvals: ApprovalStep[];
  supplierId?: string | null;
  poNumber?: number | null;
  poDate?: string | null;
  deliveryTerms?: string;
  receivedDate?: string | null;
  receivedNote?: string;
  paidAmount?: number | null;
  paidDate?: string | null;
  payAccountId?: string | null;
  payNumber?: number | null;
  opIds: string[];
  cancelReason?: string;
  createdAt: string;
}

export interface BudgetTransfer {
  id: string;
  number: number;
  fy: string;
  date: string;
  /** null = اعتماد إضافي من خارج الموازنة */
  fromAccountId: string | null;
  toAccountId: string;
  amount: number;
  note: string;
  by: string;
  byName: string;
  createdAt: string;
}

/** مفتاح السنة المالية في العقدة: "2026" أو "2026-2027" */
export const fyKeyOf = (date: Date | string, startMonth: number) => fiscalYearOf(date, startMonth).label.replace('/', '-');
export const fyRangeOfKey = (key: string, startMonth: number) => fiscalYearOf(`${key.slice(0, 4)}-${String(startMonth).padStart(2, '0')}-15`, startMonth);

const num = (v: unknown) => (Number.isFinite(Number(v)) ? Number(v) : 0);

export const parseCommitment = (id: string, j: any): Commitment => ({
  id,
  number: num(j?.number),
  fy: String(j?.fy || ''),
  date: String(j?.date || ''),
  accountId: String(j?.accountId || ''),
  description: String(j?.description || ''),
  amount: num(j?.amount),
  status: (Object.keys(COMMITMENT_STATUS) as CommitmentStatus[]).includes(j?.status) ? j.status : 'requested',
  requestedBy: String(j?.requestedBy || ''),
  requestedByName: String(j?.requestedByName || ''),
  approvals: Array.isArray(j?.approvals) ? j.approvals : j?.approvals && typeof j.approvals === 'object' ? Object.values(j.approvals) : [],
  supplierId: j?.supplierId || null,
  poNumber: j?.poNumber ?? null,
  poDate: j?.poDate || null,
  deliveryTerms: j?.deliveryTerms || '',
  receivedDate: j?.receivedDate || null,
  receivedNote: j?.receivedNote || '',
  paidAmount: j?.paidAmount ?? null,
  paidDate: j?.paidDate || null,
  payAccountId: j?.payAccountId || null,
  payNumber: j?.payNumber ?? null,
  opIds: Array.isArray(j?.opIds) ? j.opIds : [],
  cancelReason: j?.cancelReason || '',
  createdAt: String(j?.createdAt || ''),
});

export const parseTransfer = (id: string, j: any): BudgetTransfer => ({
  id,
  number: num(j?.number),
  fy: String(j?.fy || ''),
  date: String(j?.date || ''),
  fromAccountId: j?.fromAccountId || null,
  toAccountId: String(j?.toAccountId || ''),
  amount: num(j?.amount),
  note: String(j?.note || ''),
  by: String(j?.by || ''),
  byName: String(j?.byName || ''),
  createdAt: String(j?.createdAt || ''),
});

export const parseLevels = (raw: any): ApprovalLevel[] =>
  (raw && typeof raw === 'object' ? Object.entries(raw) : [])
    .map(([id, j]: [string, any]) => ({
      id,
      name: String(j?.name || ''),
      upTo: j?.upTo == null || j.upTo === '' ? null : num(j.upTo),
      approverUid: j?.approverUid || null,
      order: num(j?.order),
    }))
    .sort((a, b) => (a.upTo ?? Infinity) - (b.upTo ?? Infinity) || a.order - b.order);

/**
 * المستويات المطلوبة لمبلغ: الأول دائماً، وكل مستوى تالٍ إذا تجاوز المبلغ حدّ المستوى الذي قبله.
 * مثال: مدير الإدارة حتى 50,000 ثم المدير المالي بلا حد ← 30,000 يكفيه الأول، و80,000 يحتاج الاثنين.
 */
export const requiredLevels = (levels: ApprovalLevel[], amount: number): ApprovalLevel[] => {
  const out: ApprovalLevel[] = [];
  for (const l of levels) {
    out.push(l);
    if (l.upTo == null || amount <= l.upTo) break;
  }
  return out;
};

/** المستوى التالي المنتظر اعتماده (null = اكتملت الاعتمادات) */
export const nextLevel = (c: Commitment, levels: ApprovalLevel[]): ApprovalLevel | null => {
  const done = new Set(c.approvals.filter((a) => a.action === 'approve').map((a) => a.levelId));
  return requiredLevels(levels, c.amount).find((l) => !done.has(l.id)) || null;
};

/** المستوى الافتراضي حين لم يُعرّف المالك مستويات */
export const DEFAULT_LEVEL: ApprovalLevel = { id: 'default', name: 'الاعتماد', upTo: null, approverUid: null, order: 0 };

export interface BudgetLine {
  accountId: string;
  name: string;
  code: string;
  chapter: BudgetChapter | 'other';
  appropriation: number;
  transfersIn: number;
  transfersOut: number;
  /** الاعتماد بعد المناقلات */
  current: number;
  /** طلبات قيد الاعتماد (لا تحجز بعد) */
  pending: number;
  committed: number;
  spent: number;
  available: number;
}

export interface BudgetData {
  appropriations: Record<string, number>;
  transfers: BudgetTransfer[];
  commitments: Commitment[];
}

export const CHAPTER_ORDER: Array<BudgetChapter | 'other'> = ['1', '2', '3', '4', 'other'];
export const chapterLabel = (c: BudgetChapter | 'other') => (c === 'other' ? 'مصروفات غير مبوّبة' : CHAPTER_LABELS[c]);

/** تنفيذ الموازنة لكل بند في سنة مالية */
export const budgetLines = (
  accounts: Account[],
  meta: Record<string, AccountMeta>,
  data: BudgetData,
  opsByAccount: Record<string, Operation[]>,
  range: { from: string; to: string },
  fy: string,
): BudgetLine[] => {
  const tr = data.transfers.filter((t) => t.fy === fy);
  const cm = data.commitments.filter((c) => c.fy === fy);
  return accounts
    .filter((a) => a.category === 'expense')
    .map((a) => {
      const ch = meta[a.id]?.chapter;
      const appropriation = data.appropriations[a.id] || 0;
      const transfersIn = tr.filter((t) => t.toAccountId === a.id).reduce((s, t) => s + t.amount, 0);
      const transfersOut = tr.filter((t) => t.fromAccountId === a.id).reduce((s, t) => s + t.amount, 0);
      const mine = cm.filter((c) => c.accountId === a.id);
      const committed = mine.filter((c) => ENCUMBERING.includes(c.status)).reduce((s, c) => s + c.amount, 0);
      const pending = mine.filter((c) => c.status === 'requested').reduce((s, c) => s + c.amount, 0);
      const spent = (opsByAccount[a.id] || [])
        .filter((o) => o.date.slice(0, 10) >= range.from && o.date.slice(0, 10) <= range.to)
        .reduce((s, o) => s + o.amountUSD, 0);
      const current = appropriation + transfersIn - transfersOut;
      return {
        accountId: a.id,
        name: a.name,
        code: a.code,
        chapter: ch === '1' || ch === '2' || ch === '3' || ch === '4' ? ch : 'other',
        appropriation,
        transfersIn,
        transfersOut,
        current,
        pending,
        committed,
        spent,
        available: current - committed - spent,
      } as BudgetLine;
    })
    .sort((x, y) => CHAPTER_ORDER.indexOf(x.chapter) - CHAPTER_ORDER.indexOf(y.chapter) || (x.code || x.name).localeCompare(y.code || y.name));
};

export const sumLines = (lines: BudgetLine[]) =>
  lines.reduce(
    (s, l) => ({
      appropriation: s.appropriation + l.appropriation,
      current: s.current + l.current,
      pending: s.pending + l.pending,
      committed: s.committed + l.committed,
      spent: s.spent + l.spent,
      available: s.available + l.available,
    }),
    { appropriation: 0, current: 0, pending: 0, committed: 0, spent: 0, available: 0 },
  );

/** نسبة التنفيذ (مصروف + مرتبط) من الاعتماد الحالي */
export const executionPct = (l: { current: number; committed: number; spent: number }) =>
  l.current > 0 ? ((l.spent + l.committed) / l.current) * 100 : 0;
