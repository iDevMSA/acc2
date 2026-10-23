import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { ref, remove, update } from 'firebase/database';
import { db } from '../config/firebase';
import { watchValue } from '../lib/offlineStore';
import { useApp } from './AppContext';
import { accountLimitError, operationLimitError } from '../lib/subscription';
import {
  Account,
  AccountBalance,
  AccountGroup,
  CompanyInfo,
  Operation,
  accountToJson,
  balancesByAccount,
  localIso,
  newOperationId,
  nextAccountId,
  operationToJson,
  parseAccount,
  parseOperation,
  toMain,
} from '../lib/ledger';
import {
  AccountMeta,
  Cashbox,
  Cheque,
  ChequeEvent,
  ChequeStatus,
  ErpSettings,
  StockItem,
  StockMove,
  Voucher,
  Warehouse,
  nextNumber,
  objToList,
  parseCashbox,
  stockLevels,
} from '../lib/erp';
import {
  AccountExtra,
  Invoice,
  Note,
  Payroll,
  Quote,
  QuoteStatus,
  RateEntry,
  INVOICE_LABELS,
  NOTE_LABELS,
  computeTotals,
  lineShare,
  parseLines,
  payrollGross,
  sideOf,
  stockInOf,
} from '../lib/trade';

// مصدر واحد لكل بيانات المحاسبة في الويب: يستمع مرة واحدة لعقد الهاتف وعقد الويب،
// ويقدّم دوال الكتابة التي تحافظ على شكل بيانات التطبيق حرفياً حتى تتزامن في الاتجاهين.

export interface OpDraft {
  accountId: string;
  amount: number;
  currency: string;
  exchangeRate: number;
  statement: string;
  date?: string;
}

type Updates = Record<string, unknown>;

interface LedgerContextType {
  ready: boolean;
  accounts: Account[];
  accountsById: Record<string, Account>;
  /** مجموعات الحسابات كما في التطبيق */
  groups: AccountGroup[];
  operations: Operation[];
  /** قيود في السحابة لحسابات محذوفة (لا تدخل في الأرصدة) */
  orphanOperations: Operation[];
  saveCompany: (c: CompanyInfo) => Promise<void>;
  opsByAccount: Record<string, Operation[]>;
  balances: Record<string, AccountBalance>;
  company: CompanyInfo;
  mainCurrency: string;
  settings: ErpSettings;
  accountMeta: Record<string, AccountMeta>;
  roleOf: (accountId: string) => string;
  phoneCashboxes: Cashbox[];
  cashboxes: Cashbox[];
  vouchers: Voucher[];
  warehouses: Warehouse[];
  items: StockItem[];
  moves: StockMove[];
  cheques: Cheque[];
  invoices: Invoice[];
  quotes: Quote[];
  notes: Note[];
  payrolls: Payroll[];
  rates: RateEntry[];
  error: string | null;
  clearError: () => void;

  // الحسابات والقيود (تتزامن مع الهاتف)
  saveAccount: (a: Partial<Account> & { name: string }, role?: string) => Promise<string>;
  deleteAccount: (id: string) => Promise<void>;
  /** يبني القيود ويرجعها مع مسارات الكتابة دون حفظ — لتجميعها في كتابة ذرّية واحدة */
  buildOps: (drafts: OpDraft[]) => { ops: Operation[]; updates: Updates };
  addOperations: (drafts: OpDraft[]) => Promise<string[]>;
  updateOperation: (op: Operation) => Promise<void>;
  deleteOperations: (ids: string[]) => Promise<void>;
  ensureAccount: (name: string, category: string, type?: string, role?: string) => Promise<string>;

  // الويب فقط
  saveSettings: (s: Partial<ErpSettings>) => Promise<void>;
  setAccountRole: (accountId: string, role: string) => Promise<void>;
  saveCashbox: (b: Partial<Cashbox> & { name: string }) => Promise<string>;
  deleteCashbox: (id: string) => Promise<void>;
  createVoucher: (v: Omit<Voucher, 'id' | 'number' | 'opIds' | 'createdAt'>) => Promise<string>;
  deleteVoucher: (id: string) => Promise<void>;
  saveWarehouse: (w: Partial<Warehouse> & { name: string }) => Promise<string>;
  deleteWarehouse: (id: string) => Promise<void>;
  saveItem: (i: Partial<StockItem> & { name: string }) => Promise<string>;
  deleteItem: (id: string) => Promise<void>;
  createMove: (m: Omit<StockMove, 'id' | 'number' | 'opIds' | 'createdAt'>, drafts: OpDraft[]) => Promise<string>;
  deleteMove: (id: string) => Promise<void>;
  createCheque: (c: Omit<Cheque, 'id' | 'history' | 'createdAt'>, drafts: OpDraft[]) => Promise<string>;
  changeChequeStatus: (
    c: Cheque,
    status: ChequeStatus,
    drafts: OpDraft[],
    extra?: { bankAccountId?: string | null; endorsedToId?: string | null; note?: string },
  ) => Promise<void>;
  deleteCheque: (c: Cheque) => Promise<void>;

  // المستندات التجارية والإدارية (الويب فقط، وأثرها المالي قيود عادية)
  saveAccountMeta: (accountId: string, meta: Partial<AccountExtra>) => Promise<void>;
  createInvoice: (inv: InvoiceInput) => Promise<string>;
  deleteInvoice: (id: string) => Promise<void>;
  saveQuote: (q: QuoteInput & { id?: string }) => Promise<string>;
  setQuoteStatus: (id: string, status: QuoteStatus, invoiceId?: string | null) => Promise<void>;
  deleteQuote: (id: string) => Promise<void>;
  createNote: (n: Omit<Note, 'id' | 'number' | 'opIds' | 'createdAt'>) => Promise<string>;
  deleteNote: (id: string) => Promise<void>;
  createPayroll: (p: Omit<Payroll, 'id' | 'number' | 'opIds' | 'createdAt'>) => Promise<string>;
  deletePayroll: (id: string) => Promise<void>;
  saveRate: (r: Omit<RateEntry, 'id' | 'createdAt'> & { id?: string }) => Promise<string>;
  deleteRate: (id: string) => Promise<void>;
  /** قيد إقفال الإيرادات والمصروفات في حساب الأرباح المدوّرة حتى تاريخ */
  closePeriod: (until: string, retainedAccountId: string) => Promise<number>;
}

export type InvoiceInput = Omit<Invoice, 'id' | 'number' | 'totals' | 'moveIds' | 'opIds' | 'createdAt'>;
export type QuoteInput = Omit<Quote, 'id' | 'number' | 'totals' | 'createdAt'>;

const LedgerContext = createContext<LedgerContextType | undefined>(undefined);

const r2 = (n: number) => Math.round(n * 1e6) / 1e6;

const randomId = (prefix: string) => `${prefix}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

export const LedgerProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, webAccess } = useApp();
  const uid = user?.uid || null;

  const [accountsRaw, setAccountsRaw] = useState<any>(undefined);
  const [opsRaw, setOpsRaw] = useState<any>(undefined);
  const [companyRaw, setCompanyRaw] = useState<any>(null);
  const [phoneBoxesRaw, setPhoneBoxesRaw] = useState<any>(null);
  const [erpRaw, setErpRaw] = useState<any>(null);
  const [groupsRaw, setGroupsRaw] = useState<any>(null);
  const [salesCurrency, setSalesCurrency] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!uid) return;
    const subs = [
      watchValue(`users/${uid}/accounts`, setAccountsRaw),
      watchValue(`users/${uid}/operations`, setOpsRaw),
      watchValue(`users/${uid}/companyInfo`, setCompanyRaw),
      watchValue(`users/${uid}/cashboxes`, setPhoneBoxesRaw),
      watchValue(`users/${uid}/erp`, setErpRaw),
      watchValue(`users/${uid}/accountGroups`, setGroupsRaw),
      watchValue(`sales/${uid}/settings/currency`, (v) => setSalesCurrency(typeof v === 'string' ? v : null)),
    ];
    return () => subs.forEach((u) => u());
  }, [uid]);

  const accounts = useMemo(
    () => objToList(accountsRaw, parseAccount).sort((a, b) => a.id.localeCompare(b.id)),
    [accountsRaw],
  );
  const accountsById = useMemo(() => Object.fromEntries(accounts.map((a) => [a.id, a])), [accounts]);
  const allOperations = useMemo(
    () => objToList(opsRaw, parseOperation).sort((a, b) => a.date.localeCompare(b.date)),
    [opsRaw],
  );
  // التطبيق يحذف القيود حذفاً ناعماً (deletedAt) فتبقى في السحابة لكنها لا تدخل في رصيده.
  // والهاتف عند حذف حساب يحذف قيوده محلياً فقط وتبقى في السحابة (DataService.deleteAccount)،
  // فلا يحسبها في رصيده. نتجاهلها هنا أيضاً حتى يطابق الرصيد الهاتف، ونعرضها في الإعدادات للتنظيف.
  const { operations, orphanOperations } = useMemo(() => {
    if (accountsRaw === undefined)
      return { operations: allOperations.filter((o) => !o.deletedAt), orphanOperations: [] as Operation[] };
    const ok: Operation[] = [];
    const orphan: Operation[] = [];
    allOperations.forEach((o) => {
      if (o.deletedAt) return;
      (accountsById[o.accountId] ? ok : orphan).push(o);
    });
    return { operations: ok, orphanOperations: orphan };
  }, [allOperations, accountsById, accountsRaw]);
  const opsByAccount = useMemo(() => {
    const m: Record<string, Operation[]> = {};
    operations.forEach((o) => (m[o.accountId] ??= []).push(o));
    return m;
  }, [operations]);
  const balances = useMemo(() => balancesByAccount(operations), [operations]);

  const erp = useMemo(() => erpRaw || {}, [erpRaw]);
  const settings: ErpSettings = useMemo(() => erp.settings || {}, [erp]);
  const accountMeta: Record<string, AccountMeta> = useMemo(() => erp.accountMeta || {}, [erp]);
  const mainCurrency = settings.mainCurrency || salesCurrency || 'USD';

  const company: CompanyInfo = {
    name: companyRaw?.name || '',
    phone: companyRaw?.phone || '',
    address: companyRaw?.address || '',
    email: companyRaw?.email || '',
  };

  const phoneCashboxes = useMemo(
    () => objToList(phoneBoxesRaw, (k, v) => parseCashbox(k, v, true)).filter((b) => b.name),
    [phoneBoxesRaw],
  );
  const cashboxes = useMemo(() => objToList(erp.cashboxes, (k, v) => parseCashbox(k, v)), [erp.cashboxes]);
  const vouchers = useMemo(
    () =>
      objToList<Voucher>(erp.vouchers, (k, v) => ({ ...v, id: k, opIds: v?.opIds || [] })).sort((a, b) =>
        b.date.localeCompare(a.date),
      ),
    [erp.vouchers],
  );
  const warehouses = useMemo(() => objToList<Warehouse>(erp.warehouses, (k, v) => ({ ...v, id: k })), [erp.warehouses]);
  const items = useMemo(
    () => objToList<StockItem>(erp.items, (k, v) => ({ ...v, id: k })).sort((a, b) => a.name.localeCompare(b.name)),
    [erp.items],
  );
  const moves = useMemo(
    () =>
      objToList<StockMove>(erp.stockMoves, (k, v) => ({ ...v, id: k, opIds: v?.opIds || [] })).sort((a, b) =>
        b.date.localeCompare(a.date),
      ),
    [erp.stockMoves],
  );
  const cheques = useMemo(
    () =>
      objToList<Cheque>(erp.cheques, (k, v) => ({ ...v, id: k, history: v?.history || [] })).sort((a, b) =>
        (a.dueDate || '').localeCompare(b.dueDate || ''),
      ),
    [erp.cheques],
  );

  const invoices = useMemo(
    () =>
      objToList<Invoice>(erp.invoices, (k, v) => ({
        ...v,
        id: k,
        lines: parseLines(v?.lines),
        moveIds: v?.moveIds || [],
        opIds: v?.opIds || [],
        totals: v?.totals || computeTotals(parseLines(v?.lines), v?.discountPct || 0, v?.vatPct || 0),
      })).sort((a, b) => b.date.localeCompare(a.date) || b.number - a.number),
    [erp.invoices],
  );
  const quotes = useMemo(
    () =>
      objToList<Quote>(erp.quotes, (k, v) => ({
        ...v,
        id: k,
        lines: parseLines(v?.lines),
        status: v?.status || 'open',
        totals: v?.totals || computeTotals(parseLines(v?.lines), v?.discountPct || 0, v?.vatPct || 0),
      })).sort((a, b) => b.date.localeCompare(a.date)),
    [erp.quotes],
  );
  const notes = useMemo(
    () => objToList<Note>(erp.notes, (k, v) => ({ ...v, id: k, opIds: v?.opIds || [] })).sort((a, b) => b.date.localeCompare(a.date)),
    [erp.notes],
  );
  const payrolls = useMemo(
    () =>
      objToList<Payroll>(erp.payrolls, (k, v) => ({
        ...v,
        id: k,
        opIds: v?.opIds || [],
        lines: Array.isArray(v?.lines) ? v.lines : v?.lines ? Object.values(v.lines) : [],
      })).sort((a, b) => b.month.localeCompare(a.month)),
    [erp.payrolls],
  );
  const rates = useMemo(
    () =>
      objToList<RateEntry>(erp.rates, (k, v) => ({ ...v, id: k, rate: Number(v?.rate) || 0 })).sort((a, b) =>
        b.date.localeCompare(a.date),
      ),
    [erp.rates],
  );

  const groups = useMemo(
    () =>
      objToList<AccountGroup>(groupsRaw, (k, v) => ({ id: v?.id || k, name: v?.name || '', createdAt: v?.createdAt || '' })).sort(
        (a, b) => (a.createdAt || '').localeCompare(b.createdAt || ''),
      ),
    [groupsRaw],
  );

  const roleOf = useCallback(
    (accountId: string) => {
      const r = accountMeta[accountId]?.role;
      if (r) return r;
      const a = accountsById[accountId];
      if (a?.entityType === 'client') return 'customer';
      if (a?.entityType === 'merchant') return 'merchant';
      if (a?.type === 'bank') return 'bank';
      return 'general';
    },
    [accountMeta, accountsById],
  );

  // الحسابات المضافة في نفس الجلسة قبل أن يصل تحديث Firebase — لتفادي تكرار الترقيم
  const pendingIds = useRef<Set<string>>(new Set());

  const write = useCallback(
    async (updates: Updates) => {
      if (!uid) throw new Error('لم يتم تسجيل الدخول');
      try {
        await update(ref(db, `users/${uid}`), updates);
      } catch (e: any) {
        setError(e?.message || 'تعذّر حفظ التغييرات');
        throw e;
      }
    },
    [uid],
  );

  const buildOps = useCallback(
    (drafts: OpDraft[]) => {
      // تجميد الحسابات وإقفال الفترة (كما في الأصيل): لا قيود جديدة على حساب مجمّد أو بتاريخ مُقفل
      for (const d of drafts) {
        if (accountMeta[d.accountId]?.frozen) {
          throw new Error(`الحساب "${accountsById[d.accountId]?.name || d.accountId}" مجمّد — ألغِ التجميد من نافذة الحساب أولاً`);
        }
        const closed = settings.closedUntil;
        if (closed && (d.date || localIso()).slice(0, 10) <= closed) {
          throw new Error(`الفترة مُقفلة حتى ${closed} — لا يمكن إدخال قيود بتاريخ سابق`);
        }
      }
      const valid = drafts.filter((d) => d.accountId && Number.isFinite(d.amount) && d.amount !== 0);
      // حدود خطة المتصفح المجانية (نفس DataService.canAddOperation في التطبيق)
      const limit = valid.length ? operationLimitError(webAccess, operations.length, valid.length) : null;
      if (limit) throw new Error(limit);
      const updates: Updates = {};
      const ops: Operation[] = valid
        .map((d) => {
          const rate = d.exchangeRate || 1;
          const op: Operation = {
            id: newOperationId(d.accountId),
            accountId: d.accountId,
            amount: Number(d.amount.toFixed(6)),
            exchangeRate: rate,
            currency: d.currency || mainCurrency,
            amountUSD: toMain(d.amount, rate),
            statement: d.statement || '',
            date: d.date || localIso(),
          };
          // نفس حقول التتبع التي يكتبها التطبيق مع كل قيد
          updates[`operations/${op.id}`] = {
            ...operationToJson(op),
            createdAt: new Date().toISOString(),
            createdByUid: uid,
            createdByName: company.name,
            updatedByName: '',
            updatedByUid: '',
          };
          if (accountsById[op.accountId]?.allowClientLogin) {
            updates[`clientOps/${op.accountId}/${op.id}`] = operationToJson(op);
          }
          return op;
        });
      return { ops, updates };
    },
    [accountsById, accountMeta, settings.closedUntil, mainCurrency, uid, company.name, webAccess, operations.length],
  );

  const opRemovals = useCallback(
    (ids: string[]) => {
      const updates: Updates = {};
      const byId = Object.fromEntries(operations.map((o) => [o.id, o]));
      ids.forEach((id) => {
        // حذف ناعم كما يفعل التطبيق: القيد يبقى في السحابة بعلامة deletedAt
        updates[`operations/${id}/deletedAt`] = new Date().toISOString();
        updates[`operations/${id}/updatedByUid`] = uid;
        updates[`operations/${id}/updatedByName`] = company.name;
        const op = byId[id];
        if (op && accountsById[op.accountId]?.allowClientLogin) updates[`clientOps/${op.accountId}/${id}`] = null;
      });
      return updates;
    },
    [operations, accountsById, uid, company.name],
  );

  const saveAccount = useCallback<LedgerContextType['saveAccount']>(
    async (a, role) => {
      const existing = a.id ? accountsById[a.id] : undefined;
      let id = a.id || '';
      if (!existing) {
        const limit = accountLimitError(
          webAccess,
          new Set([...accounts.map((x) => x.id), ...Array.from(pendingIds.current)]).size,
        );
        if (limit) throw new Error(limit);
        const taken = [...accounts, ...Array.from(pendingIds.current).map((pid) => ({ id: pid }) as Account)];
        id = nextAccountId(taken);
        pendingIds.current.add(id);
      }
      const full: Account = {
        id,
        name: a.name.trim(),
        phone: a.phone ?? existing?.phone ?? '',
        address: a.address ?? existing?.address ?? '',
        type: a.type ?? existing?.type ?? 'cash',
        createdAt: existing?.createdAt || localIso(),
        code: a.code ?? existing?.code ?? '',
        category: a.category ?? existing?.category ?? 'other',
        allowClientLogin: existing?.allowClientLogin ?? false,
        clientPhone: existing?.clientPhone ?? '',
        clientEmail: existing?.clientEmail ?? '',
        clientUid: existing?.clientUid ?? '',
        groupId: a.groupId ?? existing?.groupId ?? '',
        // دور "زبون" و"تاجر" له مقابل في التطبيق (entityType) فنكتبه ليظهر هناك أيضاً
        entityType: role === 'customer' ? 'client' : role === 'merchant' ? 'merchant' : existing?.entityType ?? '',
      };
      const updates: Updates = existing
        ? Object.fromEntries(Object.entries(accountToJson(full)).map(([k, v]) => [`accounts/${id}/${k}`, v]))
        : { [`accounts/${id}`]: accountToJson(full) };
      if (role) updates[`erp/accountMeta/${id}/role`] = role;
      await write(updates);
      return id;
    },
    [accounts, accountsById, write, webAccess],
  );

  const deleteAccount = useCallback<LedgerContextType['deleteAccount']>(
    async (id) => {
      const acc = accountsById[id];
      const updates: Updates = {
        [`accounts/${id}`]: null,
        [`clientOps/${id}`]: null,
        [`erp/accountMeta/${id}`]: null,
      };
      const now = new Date().toISOString();
      (opsByAccount[id] || []).forEach((o) => (updates[`operations/${o.id}/deletedAt`] = now));
      await write(updates);
      if (acc?.clientUid) await remove(ref(db, `clientAccountMap/${acc.clientUid}`)).catch(() => undefined);
    },
    [accountsById, opsByAccount, write],
  );

  const addOperations = useCallback<LedgerContextType['addOperations']>(
    async (drafts) => {
      const { ops, updates } = buildOps(drafts);
      if (ops.length) await write(updates);
      return ops.map((o) => o.id);
    },
    [buildOps, write],
  );

  const updateOperation = useCallback<LedgerContextType['updateOperation']>(
    async (op) => {
      const fixed: Operation = { ...op, amountUSD: toMain(op.amount, op.exchangeRate || 1) };
      // تحديث حقل بحقل حتى لا تضيع حقول التطبيق الإضافية (createdBy..., receiptId ...)
      const updates: Updates = Object.fromEntries(
        Object.entries(operationToJson(fixed)).map(([k, v]) => [`operations/${op.id}/${k}`, v]),
      );
      updates[`operations/${op.id}/updatedAt`] = localIso();
      updates[`operations/${op.id}/updatedByUid`] = uid;
      updates[`operations/${op.id}/updatedByName`] = company.name;
      if (accountsById[op.accountId]?.allowClientLogin) updates[`clientOps/${op.accountId}/${op.id}`] = operationToJson(fixed);
      await write(updates);
    },
    [accountsById, write, uid, company.name],
  );

  const deleteOperations = useCallback<LedgerContextType['deleteOperations']>(
    async (ids) => {
      if (ids.length) await write(opRemovals(ids));
    },
    [opRemovals, write],
  );

  const ensureAccount = useCallback<LedgerContextType['ensureAccount']>(
    async (name, category, type = 'other', role) => {
      const found = accounts.find((a) => a.name.trim() === name.trim());
      if (found) return found.id;
      return saveAccount({ name, category, type }, role);
    },
    [accounts, saveAccount],
  );

  // نفس شكل CompanyInfo.toJson — الهاتف يقرأها عبر syncCompanyFromCloud
  const saveCompany = useCallback<LedgerContextType['saveCompany']>(
    (c) =>
      write({
        companyInfo: { name: c.name.trim(), phone: c.phone.trim(), address: c.address.trim(), email: c.email.trim() },
      }),
    [write],
  );

  const saveSettings = useCallback<LedgerContextType['saveSettings']>(
    (s) => {
      const updates: Record<string, unknown> = Object.fromEntries(
        Object.entries(s).map(([k, v]) => [`erp/settings/${k}`, v ?? null]),
      );
      // تطبيق الهاتف يقرأ نفس العقدة ويأخذ القيمة الأحدث حسب هذا الوقت
      if ('mainCurrency' in s) updates['erp/settings/mainCurrencyUpdatedAt'] = Date.now();
      return write(updates);
    },
    [write],
  );

  const setAccountRole = useCallback<LedgerContextType['setAccountRole']>(
    (accountId, role) => write({ [`erp/accountMeta/${accountId}/role`]: role }),
    [write],
  );

  const saveCashbox = useCallback<LedgerContextType['saveCashbox']>(
    async (b) => {
      const id = b.id || randomId('BOX');
      const prev = cashboxes.find((x) => x.id === id);
      await write({
        [`erp/cashboxes/${id}`]: {
          id,
          name: b.name.trim(),
          parentId: b.parentId || null,
          currency: b.currency || null,
          exchangeRate: b.exchangeRate && b.exchangeRate > 0 ? b.exchangeRate : null,
          linkedAccountIds: b.linkedAccountIds ?? prev?.linkedAccountIds ?? [],
          cashAccountId: b.cashAccountId ?? prev?.cashAccountId ?? null,
          note: b.note ?? prev?.note ?? '',
          createdAt: prev?.createdAt || localIso(),
        },
      });
      return id;
    },
    [cashboxes, write],
  );

  const deleteCashbox = useCallback<LedgerContextType['deleteCashbox']>(
    async (id) => {
      const updates: Updates = { [`erp/cashboxes/${id}`]: null };
      // الأبناء يصبحون جذراً (كما في الهاتف)
      cashboxes.filter((b) => b.parentId === id).forEach((b) => (updates[`erp/cashboxes/${b.id}/parentId`] = null));
      warehouses.filter((w) => w.cashboxId === id).forEach((w) => (updates[`erp/warehouses/${w.id}/cashboxId`] = null));
      await write(updates);
    },
    [cashboxes, warehouses, write],
  );

  const createVoucher = useCallback<LedgerContextType['createVoucher']>(
    async (v) => {
      const box = cashboxes.find((b) => b.id === v.boxId);
      const toBox = v.toBoxId ? cashboxes.find((b) => b.id === v.toBoxId) : undefined;
      const cashId = box?.cashAccountId;
      if (!cashId) throw new Error('حدّد حساب النقدية للصندوق أولاً');
      const party = v.partyId ? accountsById[v.partyId] : undefined;
      const base = { currency: v.currency, exchangeRate: v.exchangeRate, date: v.date };
      const number = nextNumber(vouchers.filter((x) => x.type === v.type));
      const tag = `${v.type === 'receipt' ? 'سند قبض' : v.type === 'payment' ? 'سند صرف' : 'تحويل'} رقم ${number}`;
      const note = v.statement ? ` — ${v.statement}` : '';
      let drafts: OpDraft[] = [];
      if (v.type === 'receipt' && party) {
        drafts = [
          { ...base, accountId: cashId, amount: v.amount, statement: `${tag}: من ${party.name}${note}` },
          { ...base, accountId: party.id, amount: -v.amount, statement: `${tag}: دفعة نقدية إلى ${box!.name}${note}` },
        ];
      } else if (v.type === 'payment' && party) {
        drafts = [
          { ...base, accountId: cashId, amount: -v.amount, statement: `${tag}: إلى ${party.name}${note}` },
          { ...base, accountId: party.id, amount: v.amount, statement: `${tag}: مدفوع من ${box!.name}${note}` },
        ];
      } else if (v.type === 'transfer' && toBox?.cashAccountId) {
        drafts = [
          { ...base, accountId: cashId, amount: -v.amount, statement: `${tag}: إلى ${toBox.name}${note}` },
          { ...base, accountId: toBox.cashAccountId, amount: v.amount, statement: `${tag}: من ${box!.name}${note}` },
        ];
      } else {
        throw new Error('بيانات السند غير مكتملة');
      }
      const { ops, updates } = buildOps(drafts);
      const id = randomId('V');
      updates[`erp/vouchers/${id}`] = { ...v, id, number, opIds: ops.map((o) => o.id), createdAt: localIso() };
      await write(updates);
      return id;
    },
    [accountsById, buildOps, cashboxes, vouchers, write],
  );

  const deleteVoucher = useCallback<LedgerContextType['deleteVoucher']>(
    async (id) => {
      const v = vouchers.find((x) => x.id === id);
      await write({ ...opRemovals(v?.opIds || []), [`erp/vouchers/${id}`]: null });
    },
    [opRemovals, vouchers, write],
  );

  const saveWarehouse = useCallback<LedgerContextType['saveWarehouse']>(
    async (w) => {
      const id = w.id || randomId('WH');
      const prev = warehouses.find((x) => x.id === id);
      await write({
        [`erp/warehouses/${id}`]: {
          id,
          name: w.name.trim(),
          location: w.location ?? prev?.location ?? '',
          cashboxId: w.cashboxId ?? prev?.cashboxId ?? null,
          inventoryAccountId: w.inventoryAccountId ?? prev?.inventoryAccountId ?? null,
          note: w.note ?? prev?.note ?? '',
          createdAt: prev?.createdAt || localIso(),
        },
      });
      return id;
    },
    [warehouses, write],
  );

  const deleteWarehouse = useCallback<LedgerContextType['deleteWarehouse']>(
    async (id) => {
      if (moves.some((m) => m.warehouseId === id || m.toWarehouseId === id)) {
        throw new Error('لا يمكن حذف مخزن عليه حركات. احذف الحركات أولاً.');
      }
      await write({ [`erp/warehouses/${id}`]: null });
    },
    [moves, write],
  );

  const saveItem = useCallback<LedgerContextType['saveItem']>(
    async (i) => {
      const id = i.id || randomId('IT');
      const prev = items.find((x) => x.id === id);
      await write({
        [`erp/items/${id}`]: {
          id,
          name: i.name.trim(),
          code: i.code ?? prev?.code ?? '',
          unit: i.unit ?? prev?.unit ?? 'قطعة',
          category: i.category ?? prev?.category ?? '',
          price: Number(i.price ?? prev?.price ?? 0) || 0,
          minQty: Number(i.minQty ?? prev?.minQty ?? 0) || 0,
          reorderQty: Number(i.reorderQty ?? prev?.reorderQty ?? 0) || 0,
          maxQty: Number(i.maxQty ?? prev?.maxQty ?? 0) || 0,
          cost: Number(i.cost ?? prev?.cost ?? 0) || 0,
          prices: (i.prices ?? prev?.prices ?? []).map((p) => Number(p) || 0),
          barcode: i.barcode ?? prev?.barcode ?? '',
          vatPct: Number(i.vatPct ?? prev?.vatPct ?? 0) || 0,
          note: i.note ?? prev?.note ?? '',
          createdAt: prev?.createdAt || localIso(),
        },
      });
      return id;
    },
    [items, write],
  );

  const deleteItem = useCallback<LedgerContextType['deleteItem']>(
    async (id) => {
      if (moves.some((m) => m.itemId === id)) throw new Error('لا يمكن حذف صنف عليه حركات.');
      await write({ [`erp/items/${id}`]: null });
    },
    [moves, write],
  );

  const createMove = useCallback<LedgerContextType['createMove']>(
    async (m, drafts) => {
      const { ops, updates } = buildOps(drafts);
      const id = randomId('MV');
      const number = nextNumber(moves);
      updates[`erp/stockMoves/${id}`] = { ...m, id, number, opIds: ops.map((o) => o.id), createdAt: localIso() };
      await write(updates);
      return id;
    },
    [buildOps, moves, write],
  );

  const deleteMove = useCallback<LedgerContextType['deleteMove']>(
    async (id) => {
      const m = moves.find((x) => x.id === id);
      if (m?.invoiceId) throw new Error('هذه الحركة ناتجة عن فاتورة — احذف الفاتورة نفسها من نافذة الفواتير');
      await write({ ...opRemovals(m?.opIds || []), [`erp/stockMoves/${id}`]: null });
    },
    [moves, opRemovals, write],
  );

  const createCheque = useCallback<LedgerContextType['createCheque']>(
    async (c, drafts) => {
      const { ops, updates } = buildOps(drafts);
      const id = randomId('CH');
      const event: ChequeEvent = { status: c.status, date: localIso(), opIds: ops.map((o) => o.id) };
      updates[`erp/cheques/${id}`] = { ...c, id, history: [event], createdAt: localIso() };
      await write(updates);
      return id;
    },
    [buildOps, write],
  );

  const changeChequeStatus = useCallback<LedgerContextType['changeChequeStatus']>(
    async (c, status, drafts, extra) => {
      const { ops, updates } = buildOps(drafts);
      const event: ChequeEvent = {
        status,
        date: localIso(),
        opIds: ops.map((o) => o.id),
        note: extra?.note || '',
        accountId: extra?.bankAccountId || extra?.endorsedToId || null,
      };
      updates[`erp/cheques/${c.id}/status`] = status;
      updates[`erp/cheques/${c.id}/history`] = [...c.history, event];
      if (extra?.bankAccountId !== undefined) updates[`erp/cheques/${c.id}/bankAccountId`] = extra.bankAccountId;
      if (extra?.endorsedToId !== undefined) updates[`erp/cheques/${c.id}/endorsedToId`] = extra.endorsedToId;
      await write(updates);
    },
    [buildOps, write],
  );

  const deleteCheque = useCallback<LedgerContextType['deleteCheque']>(
    async (c) => {
      const ids = c.history.flatMap((h) => h.opIds || []);
      await write({ ...opRemovals(ids), [`erp/cheques/${c.id}`]: null });
    },
    [opRemovals, write],
  );

  /* ───────── المستندات التجارية ───────── */

  const saveAccountMeta = useCallback<LedgerContextType['saveAccountMeta']>(
    (accountId, meta) => {
      const updates: Updates = {};
      Object.entries(meta).forEach(([k, v]) => {
        if (k === 'employee' && v && typeof v === 'object') {
          Object.entries(v).forEach(([ek, ev]) => (updates[`erp/accountMeta/${accountId}/employee/${ek}`] = ev ?? null));
        } else updates[`erp/accountMeta/${accountId}/${k}`] = v ?? null;
      });
      return write(updates);
    },
    [write],
  );

  /** حساب من الإعدادات، أو إنشاؤه بالاسم المعتاد وحفظ رقمه في الإعدادات */
  const settingAccount = useCallback(
    async (key: keyof ErpSettings, name: string, category: string): Promise<string> => {
      const cur = settings[key] as string | undefined;
      if (cur && accountsById[cur]) return cur;
      const id = await ensureAccount(name, category, 'other', 'general');
      await write({ [`erp/settings/${key}`]: id });
      return id;
    },
    [settings, accountsById, ensureAccount, write],
  );

  const createInvoice = useCallback<LedgerContextType['createInvoice']>(
    async (inv) => {
      const party = accountsById[inv.partyId];
      if (!party) throw new Error('اختر الزبون أو المورد');
      const lines = inv.lines.filter((l) => (l.itemId || l.accountId) && Number(l.qty) > 0);
      if (!lines.length) throw new Error('أضف بنداً واحداً على الأقل');
      if (lines.some((l) => !l.itemId && !accountsById[l.accountId || ''])) throw new Error('اختر حساباً لكل بند خدمة');
      const side = sideOf(inv.kind);
      const isIn = stockInOf(inv.kind);
      // إشارة الطرف: البيع ومرتجع الشراء = لنا عليه، الشراء ومرتجع البيع = له علينا
      const sign = inv.kind === 'sale' || inv.kind === 'purchaseReturn' ? 1 : -1;
      const rate = inv.exchangeRate || 1;
      const totals = computeTotals(lines, inv.discountPct, inv.vatPct);
      const number = nextNumber(invoices.filter((x) => x.kind === inv.kind));
      const tag = `${INVOICE_LABELS[inv.kind]} رقم ${number}`;
      const levels = stockLevels(moves);
      const box = inv.paid > 0 ? cashboxes.find((b) => b.id === inv.cashboxId) : undefined;
      if (inv.paid > 0 && !box?.cashAccountId) throw new Error('اختر صندوقاً له حساب نقدية للمبلغ المدفوع');
      if (inv.paid > totals.total + 0.005) throw new Error('المبلغ المدفوع أكبر من إجمالي الفاتورة');

      // فحص المخزون قبل إنشاء أي حساب
      const outNeed = new Map<string, number>();
      for (const l of lines) {
        if (!l.itemId) continue;
        const wh = warehouses.find((w) => w.id === l.warehouseId);
        if (!wh?.inventoryAccountId) throw new Error('اختر لكل صنف مخزناً له حساب مخزون');
        if (isIn) continue;
        const k = `${wh.id}::${l.itemId}`;
        outNeed.set(k, (outNeed.get(k) || 0) + Number(l.qty) + (Number(l.bonusQty) || 0));
        const avail = levels.of(wh.id, l.itemId).qty;
        if ((outNeed.get(k) || 0) > avail + 1e-9) {
          const item = items.find((i) => i.id === l.itemId);
          throw new Error(`الكمية المتاحة من "${item?.name}" في ${wh.name} هي ${avail} فقط`);
        }
      }

      const hasItems = lines.some((l) => l.itemId);
      const salesId = side === 'sale' && hasItems ? await settingAccount('salesAccountId', 'المبيعات', 'revenue') : '';
      const cogsId = hasItems && inv.kind !== 'purchase' ? await settingAccount('cogsAccountId', 'تكلفة البضاعة المباعة', 'expense') : '';
      const vatId = totals.vat ? await settingAccount('vatAccountId', 'ضريبة القيمة المضافة', 'liability') : '';

      // تجميع القيود حسب الحساب والعملة والبيان حتى يبقى القيد مختصراً مهما كثرت البنود
      const agg = new Map<string, OpDraft>();
      const add = (accountId: string, amount: number, statement: string, inMain = false) => {
        if (!accountId || Math.abs(amount) < 1e-9) return;
        const cur = inMain ? mainCurrency : inv.currency;
        const r = inMain ? 1 : rate;
        const k = `${accountId}|${cur}|${statement}`;
        const prev = agg.get(k);
        if (prev) prev.amount = r2(prev.amount + amount);
        else agg.set(k, { accountId, amount: r2(amount), currency: cur, exchangeRate: r, statement, date: inv.date });
      };
      const extra = inv.statement ? ` — ${inv.statement}` : '';

      add(party.id, sign * totals.total, `${tag}${extra}`);
      if (totals.vat) add(vatId, -sign * totals.vat, `ضريبة ${tag} (${party.name})`);

      const moveRecords: Array<Record<string, any>> = [];
      let moveNo = nextNumber(moves);
      for (const l of lines) {
        const share = lineShare(l, inv.discountPct);
        if (!l.itemId) {
          add(l.accountId!, -sign * share, `${tag}: ${l.description || 'خدمة'} (${party.name})`);
          continue;
        }
        const wh = warehouses.find((w) => w.id === l.warehouseId)!;
        const inventoryId = wh.inventoryAccountId!;
        const item = items.find((i) => i.id === l.itemId);
        const q = Number(l.qty) + (Number(l.bonusQty) || 0);
        const lvl = levels.of(wh.id, l.itemId);
        const shareMain = share / rate;
        const avg = lvl.avgCost || item?.cost || (q ? shareMain / q : 0);
        const unitCost = inv.kind === 'purchase' ? (q ? shareMain / q : 0) : avg;
        const costValue = r2(q * unitCost);
        const label = `${tag}: ${item?.name || ''} × ${q}`;
        if (side === 'sale') {
          add(salesId, -sign * share, `${tag} (${party.name})`);
          add(inventoryId, -sign * costValue, `${label} بالتكلفة (${wh.name})`, true);
          add(cogsId, sign * costValue, `تكلفة ${tag}`, true);
        } else if (inv.kind === 'purchase') {
          add(inventoryId, share, `${label} (${wh.name})`);
        } else {
          // مرتجع شراء: يخرج بمتوسط التكلفة، والفرق عن سعر الإرجاع يُسوّى على تكلفة المبيعات
          add(inventoryId, -costValue, `${label} بالتكلفة (${wh.name})`, true);
          add(cogsId, -r2(shareMain - costValue), `فرق تكلفة ${tag}`, true);
        }
        moveRecords.push({
          id: randomId('MV'),
          number: moveNo++,
          type: isIn ? 'in' : 'out',
          warehouseId: wh.id,
          toWarehouseId: null,
          itemId: l.itemId,
          qty: q,
          unitCost,
          // سعر البيع يُسجَّل لفواتير البيع فقط (تقرير صافي المبيعات يقرأه من حركات الإخراج)
          unitPrice: inv.kind === 'sale' && q ? shareMain / q : 0,
          payment: null,
          partyId: party.id,
          statement: `${tag} — ${party.name}`,
          date: inv.date,
          opIds: [],
          createdAt: localIso(),
        });
      }
      if (inv.paid > 0) {
        const verb = side === 'sale' ? (sign > 0 ? 'مقبوض' : 'مردود') : sign < 0 ? 'مدفوع' : 'مستردّ';
        add(box!.cashAccountId!, sign * inv.paid, `${verb} نقداً — ${tag} (${party.name})`);
        add(party.id, -sign * inv.paid, `${verb} نقداً — ${tag} (${box!.name})`);
      }

      const { ops, updates } = buildOps(Array.from(agg.values()));
      const id = randomId('INV');
      moveRecords.forEach((m) => (updates[`erp/stockMoves/${m.id}`] = { ...m, invoiceId: id }));
      updates[`erp/invoices/${id}`] = {
        ...inv,
        lines,
        id,
        number,
        totals,
        moveIds: moveRecords.map((m) => m.id),
        opIds: ops.map((o) => o.id),
        createdAt: localIso(),
      };
      if (inv.quoteId) {
        updates[`erp/quotes/${inv.quoteId}/status`] = 'converted';
        updates[`erp/quotes/${inv.quoteId}/invoiceId`] = id;
      }
      await write(updates);
      return id;
    },
    [accountsById, invoices, moves, settingAccount, cashboxes, warehouses, items, mainCurrency, buildOps, write],
  );

  const deleteInvoice = useCallback<LedgerContextType['deleteInvoice']>(
    async (id) => {
      const inv = invoices.find((x) => x.id === id);
      if (!inv) return;
      const updates: Updates = { ...opRemovals(inv.opIds), [`erp/invoices/${id}`]: null };
      inv.moveIds.forEach((m) => (updates[`erp/stockMoves/${m}`] = null));
      if (inv.quoteId && quotes.some((q) => q.id === inv.quoteId)) {
        updates[`erp/quotes/${inv.quoteId}/status`] = 'open';
        updates[`erp/quotes/${inv.quoteId}/invoiceId`] = null;
      }
      await write(updates);
    },
    [invoices, quotes, opRemovals, write],
  );

  const saveQuote = useCallback<LedgerContextType['saveQuote']>(
    async (q) => {
      const id = q.id || randomId('Q');
      const prev = quotes.find((x) => x.id === id);
      const lines = q.lines.filter((l) => (l.itemId || l.accountId || l.description) && Number(l.qty) > 0);
      if (!lines.length) throw new Error('أضف بنداً واحداً على الأقل');
      await write({
        [`erp/quotes/${id}`]: {
          ...q,
          lines,
          id,
          number: prev?.number || nextNumber(quotes.filter((x) => x.kind === q.kind && x.side === q.side)),
          totals: computeTotals(lines, q.discountPct, q.vatPct),
          createdAt: prev?.createdAt || localIso(),
        },
      });
      return id;
    },
    [quotes, write],
  );

  const setQuoteStatus = useCallback<LedgerContextType['setQuoteStatus']>(
    (id, status, invoiceId) =>
      write({
        [`erp/quotes/${id}/status`]: status,
        ...(invoiceId !== undefined ? { [`erp/quotes/${id}/invoiceId`]: invoiceId } : {}),
      }),
    [write],
  );

  const deleteQuote = useCallback<LedgerContextType['deleteQuote']>((id) => write({ [`erp/quotes/${id}`]: null }), [write]);

  const createNote = useCallback<LedgerContextType['createNote']>(
    async (n) => {
      const party = accountsById[n.partyId];
      if (!party || !accountsById[n.counterAccountId]) throw new Error('اختر الطرف والحساب المقابل');
      if (!(n.amount > 0)) throw new Error('أدخل مبلغاً أكبر من صفر');
      const number = nextNumber(notes.filter((x) => x.kind === n.kind));
      const tag = `${NOTE_LABELS[n.kind]} رقم ${number}`;
      const sign = n.kind === 'debit' ? 1 : -1;
      const vat = r2(n.amount * ((n.vatPct || 0) / 100));
      const vatId = vat ? await settingAccount('vatAccountId', 'ضريبة القيمة المضافة', 'liability') : '';
      const base = { currency: n.currency, exchangeRate: n.exchangeRate || 1, date: n.date };
      const st = n.statement ? ` — ${n.statement}` : '';
      const drafts: OpDraft[] = [
        { ...base, accountId: party.id, amount: sign * (n.amount + vat), statement: `${tag}${st}` },
        { ...base, accountId: n.counterAccountId, amount: -sign * n.amount, statement: `${tag}: ${party.name}${st}` },
      ];
      if (vat) drafts.push({ ...base, accountId: vatId, amount: -sign * vat, statement: `ضريبة ${tag} (${party.name})` });
      const { ops, updates } = buildOps(drafts);
      const id = randomId('NT');
      updates[`erp/notes/${id}`] = { ...n, id, number, opIds: ops.map((o) => o.id), createdAt: localIso() };
      await write(updates);
      return id;
    },
    [accountsById, notes, settingAccount, buildOps, write],
  );

  const deleteNote = useCallback<LedgerContextType['deleteNote']>(
    async (id) => {
      const n = notes.find((x) => x.id === id);
      await write({ ...opRemovals(n?.opIds || []), [`erp/notes/${id}`]: null });
    },
    [notes, opRemovals, write],
  );

  const createPayroll = useCallback<LedgerContextType['createPayroll']>(
    async (p) => {
      const lines = p.lines.filter((l) => accountsById[l.employeeId] && payrollGross(l) > 0);
      if (!lines.length) throw new Error('لا يوجد موظفون برواتب في الكشف');
      if (payrolls.some((x) => x.month === p.month)) throw new Error(`يوجد كشف رواتب لشهر ${p.month} مسبقاً`);
      const box = p.payment === 'cash' ? cashboxes.find((b) => b.id === p.cashboxId) : undefined;
      if (p.payment === 'cash' && !box?.cashAccountId) throw new Error('اختر صندوقاً له حساب نقدية لصرف الرواتب');
      const general = await settingAccount('salariesAccountId', 'الرواتب والأجور', 'expense');
      const dedTotal = lines.reduce((s, l) => s + (l.deductions || 0), 0);
      const dedId = dedTotal ? await settingAccount('payrollDeductionsAccountId', 'استقطاعات الرواتب', 'liability') : '';
      const number = nextNumber(payrolls);
      const tag = `كشف رواتب ${p.month}`;
      const base = { currency: p.currency, exchangeRate: p.exchangeRate || 1, date: p.date };
      const drafts: OpDraft[] = [];
      const expense = new Map<string, number>();
      for (const l of lines) {
        const emp = accountsById[l.employeeId];
        const own = accountMeta[l.employeeId]?.employee?.salaryAccountId;
        const expId = own && accountsById[own] ? own : general;
        expense.set(expId, (expense.get(expId) || 0) + payrollGross(l));
        // الراتب المستحق (بعد الاستقطاعات) لحساب الموظف — السلف السابقة على حسابه تُخصم تلقائياً من رصيده
        drafts.push({ ...base, accountId: emp.id, amount: -r2(payrollGross(l) - (l.deductions || 0)), statement: `راتب ${p.month} مستحق` });
        if (p.payment === 'cash' && l.net > 0) {
          drafts.push({ ...base, accountId: emp.id, amount: l.net, statement: `صرف راتب ${p.month} نقداً من ${box!.name}` });
          drafts.push({ ...base, accountId: box!.cashAccountId!, amount: -l.net, statement: `صرف راتب ${p.month} — ${emp.name}` });
        }
      }
      expense.forEach((v, k) =>
        drafts.push({ ...base, accountId: k, amount: r2(v), statement: `${tag}${p.statement ? ` — ${p.statement}` : ''}` }),
      );
      if (dedTotal) drafts.push({ ...base, accountId: dedId, amount: -r2(dedTotal), statement: `استقطاعات ${tag}` });
      const { ops, updates } = buildOps(drafts);
      const id = randomId('PR');
      updates[`erp/payrolls/${id}`] = { ...p, lines, id, number, opIds: ops.map((o) => o.id), createdAt: localIso() };
      await write(updates);
      return id;
    },
    [accountsById, accountMeta, payrolls, cashboxes, settingAccount, buildOps, write],
  );

  const deletePayroll = useCallback<LedgerContextType['deletePayroll']>(
    async (id) => {
      const p = payrolls.find((x) => x.id === id);
      await write({ ...opRemovals(p?.opIds || []), [`erp/payrolls/${id}`]: null });
    },
    [payrolls, opRemovals, write],
  );

  const saveRate = useCallback<LedgerContextType['saveRate']>(
    async (r) => {
      if (!(r.rate > 0)) throw new Error('أدخل سعراً أكبر من صفر');
      const id = r.id || randomId('RT');
      const prev = rates.find((x) => x.id === id);
      await write({
        [`erp/rates/${id}`]: { id, currency: r.currency, date: r.date, rate: r.rate, createdAt: prev?.createdAt || localIso() },
      });
      return id;
    },
    [rates, write],
  );

  const deleteRate = useCallback<LedgerContextType['deleteRate']>((id) => write({ [`erp/rates/${id}`]: null }), [write]);

  const closePeriod = useCallback<LedgerContextType['closePeriod']>(
    async (until, retainedAccountId) => {
      if (!accountsById[retainedAccountId]) throw new Error('اختر حساب الأرباح المدوّرة');
      if (settings.closedUntil && until <= settings.closedUntil) throw new Error(`الفترة مُقفلة مسبقاً حتى ${settings.closedUntil}`);
      const date = `${until}T23:59:59.000`;
      const drafts: OpDraft[] = [];
      let net = 0;
      accounts
        .filter((a) => (a.category === 'revenue' || a.category === 'expense') && a.id !== retainedAccountId)
        .forEach((a) => {
          const b = r2((opsByAccount[a.id] || []).filter((o) => o.date.slice(0, 10) <= until).reduce((s, o) => s + o.amountUSD, 0));
          if (Math.abs(b) < 0.005) return;
          net += b;
          drafts.push({ accountId: a.id, amount: -b, currency: mainCurrency, exchangeRate: 1, date, statement: `قيد إقفال حتى ${until}` });
        });
      if (!drafts.length) throw new Error('لا توجد أرصدة إيرادات أو مصروفات لإقفالها');
      drafts.push({
        accountId: retainedAccountId,
        amount: r2(net),
        currency: mainCurrency,
        exchangeRate: 1,
        date,
        statement: `نتيجة الفترة حتى ${until} (${net <= 0 ? 'ربح' : 'خسارة'})`,
      });
      const { ops, updates } = buildOps(drafts);
      updates['erp/settings/closedUntil'] = until;
      updates['erp/settings/retainedEarningsAccountId'] = retainedAccountId;
      updates[`erp/closings/${randomId('CL')}`] = {
        until,
        retainedAccountId,
        opIds: ops.map((o) => o.id),
        net: r2(net),
        createdAt: localIso(),
      };
      await write(updates);
      return ops.length;
    },
    [accounts, accountsById, opsByAccount, settings.closedUntil, mainCurrency, buildOps, write],
  );


  const value: LedgerContextType = {
    ready: accountsRaw !== undefined && opsRaw !== undefined,
    accounts,
    accountsById,
    groups,
    operations,
    orphanOperations,
    saveCompany,
    opsByAccount,
    balances,
    company,
    mainCurrency,
    settings,
    accountMeta,
    roleOf,
    phoneCashboxes,
    cashboxes,
    vouchers,
    warehouses,
    items,
    moves,
    cheques,
    invoices,
    quotes,
    notes,
    payrolls,
    rates,
    error,
    clearError: () => setError(null),
    saveAccount,
    deleteAccount,
    buildOps,
    addOperations,
    updateOperation,
    deleteOperations,
    ensureAccount,
    saveSettings,
    setAccountRole,
    saveCashbox,
    deleteCashbox,
    createVoucher,
    deleteVoucher,
    saveWarehouse,
    deleteWarehouse,
    saveItem,
    deleteItem,
    createMove,
    deleteMove,
    createCheque,
    changeChequeStatus,
    deleteCheque,
    saveAccountMeta,
    createInvoice,
    deleteInvoice,
    saveQuote,
    setQuoteStatus,
    deleteQuote,
    createNote,
    deleteNote,
    createPayroll,
    deletePayroll,
    saveRate,
    deleteRate,
    closePeriod,
  };

  return <LedgerContext.Provider value={value}>{children}</LedgerContext.Provider>;
};

export const useLedger = () => {
  const ctx = useContext(LedgerContext);
  if (!ctx) throw new Error('useLedger must be used within LedgerProvider');
  return ctx;
};
