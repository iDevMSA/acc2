import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { ref, remove, update } from 'firebase/database';
import { db } from '../config/firebase';
import { watchValue } from '../lib/offlineStore';
import { useApp } from './AppContext';
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
} from '../lib/erp';

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
}

const LedgerContext = createContext<LedgerContextType | undefined>(undefined);

const randomId = (prefix: string) => `${prefix}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

export const LedgerProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useApp();
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
      const updates: Updates = {};
      const ops: Operation[] = drafts
        .filter((d) => d.accountId && Number.isFinite(d.amount) && d.amount !== 0)
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
    [accountsById, mainCurrency, uid, company.name],
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
    [accounts, accountsById, write],
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
    (s) => write(Object.fromEntries(Object.entries(s).map(([k, v]) => [`erp/settings/${k}`, v ?? null]))),
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
  };

  return <LedgerContext.Provider value={value}>{children}</LedgerContext.Provider>;
};

export const useLedger = () => {
  const ctx = useContext(LedgerContext);
  if (!ctx) throw new Error('useLedger must be used within LedgerProvider');
  return ctx;
};
