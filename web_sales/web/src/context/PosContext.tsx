import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { increment, onChildAdded, push, ref, remove, update } from 'firebase/database';
import { createUserWithEmailAndPassword, signOut, updateProfile } from 'firebase/auth';
import { db, secondaryAuth } from '../config/firebase';
import { watchValue } from '../lib/offlineStore';
import { assertCanWrite } from '../lib/team';
import { logAudit, valueAt } from '../lib/audit';
import { useApp } from './AppContext';
import {
  CashRegister,
  CatalogEntry,
  PayMethod,
  PosBranch,
  PosEmployee,
  PosInvoiceItem,
  PosInvoiceJson,
  PosProduct,
  PosSession,
  PosWarehouse,
  ProductMeta,
  WarehouseLinks,
  BusinessType,
  cartTotals,
  makeInvoiceNumber,
  parseBranch,
  parseEmployee,
  parseProduct,
  parseRegister,
  parseWarehouse,
  productToJson,
} from '../lib/pos';
import { catalogToJson, lookupBarcode } from '../lib/productLookup';

// بيانات نقطة البيع تحت sales/{ownerUid} — يعمل للمالك (لوحة التحكم) وللكاشير (واجهة البيع)،
// والكتابة بنفس أشكال تطبيق الهاتف حتى تبقى المزامنة في الاتجاهين.

type Updates = Record<string, unknown>;

const list = <T,>(v: any, parse: (k: string, j: any) => T): T[] =>
  v && typeof v === 'object' ? Object.entries(v).map(([k, j]) => parse(k, j)) : [];

const nowIso = () => {
  // نفس DateTime.toIso8601String في Dart (بدون منطقة زمنية)
  const d = new Date();
  const p = (x: number, w = 2) => String(x).padStart(w, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}.${p(d.getMilliseconds(), 3)}`;
};

export interface CheckoutInput {
  items: PosInvoiceItem[];
  method: PayMethod;
  paid: number;
  discount: number;
  customerName?: string;
  customerPhone?: string;
  bankName?: string;
}

interface PosContextType {
  ready: boolean;
  ownerUid: string;
  isCashier: boolean;
  /** سجل الكاشير الحالي (للكاشير فقط) */
  me: PosEmployee | null;
  branches: PosBranch[];
  warehouses: PosWarehouse[];
  products: PosProduct[];
  registers: CashRegister[];
  employees: PosEmployee[];
  sessions: PosSession[];
  links: WarehouseLinks;
  productMeta: Record<string, ProductMeta>;
  catalog: Record<string, CatalogEntry>;
  currency: string;

  saveBranch: (b: { id?: string; name: string; address?: string; phone?: string; type?: BusinessType }) => Promise<string>;
  deleteBranch: (id: string) => Promise<void>;
  saveWarehouse: (w: { id?: string; name: string; branchId: string }) => Promise<string>;
  deleteWarehouse: (id: string) => Promise<void>;
  setWarehouseLinks: (id: string, linked: string[]) => Promise<void>;
  saveRegister: (r: { id?: string; name: string; branchId: string }) => Promise<string>;
  deleteRegister: (id: string) => Promise<void>;
  createCashier: (c: { name: string; email: string; password: string; phone?: string; role: 'cashier' | 'manager'; branchId: string; cashRegisterId: string }) => Promise<string>;
  updateEmployee: (uid: string, data: Partial<Pick<PosEmployee, 'name' | 'phone' | 'role' | 'branchId' | 'cashRegisterId'>>) => Promise<void>;
  removeEmployee: (uid: string) => Promise<void>;
  saveProduct: (p: Partial<PosProduct> & { name: string; warehouseId: string }, meta?: ProductMeta) => Promise<string>;
  deleteProduct: (id: string) => Promise<void>;
  transferStock: (productId: string, toWarehouseId: string, qty: number) => Promise<void>;
  /** يبحث في دليل الشركة ثم في قواعد المنتجات العالمية ويحفظ النتيجة */
  resolveBarcode: (code: string) => Promise<CatalogEntry | null>;

  openSession: (registerId: string, openingCash: number) => Promise<string>;
  closeSession: (session: PosSession, countedCash: number, note?: string) => Promise<void>;
  checkout: (registerId: string, input: CheckoutInput) => Promise<{ number: string; change: number }>;
  relayScan: (registerId: string, code: string) => Promise<void>;
}

const PosContext = createContext<PosContextType | undefined>(undefined);

export const PosProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, ownerUid: owner, isCashier, currency, member, actor } = useApp();
  const ownerUid = owner || '';
  const [raw, setRaw] = useState<Record<string, any>>({});
  const [loaded, setLoaded] = useState<Set<string>>(new Set());
  const rawRef = useRef<Record<string, any>>({});
  rawRef.current = raw;

  useEffect(() => {
    if (!ownerUid) return;
    const nodes = ['branches', 'warehouses', 'products', 'cashRegisters', 'employees', 'invoiceSequence', 'posSessions', 'warehouseLinks', 'productMeta', 'barcodeCatalog'];
    const subs = nodes.map((n) =>
      watchValue(`sales/${ownerUid}/${n}`, (v) => {
        setRaw((r) => ({ ...r, [n]: v }));
        setLoaded((l) => (l.has(n) ? l : new Set(l).add(n)));
      }),
    );
    return () => subs.forEach((u) => u());
  }, [ownerUid]);

  const branches = useMemo(() => list(raw.branches, parseBranch).sort((a, b) => a.createdAt.localeCompare(b.createdAt)), [raw.branches]);
  const warehouses = useMemo(() => list(raw.warehouses, parseWarehouse), [raw.warehouses]);
  const products = useMemo(() => list(raw.products, parseProduct).sort((a, b) => a.name.localeCompare(b.name)), [raw.products]);
  const registers = useMemo(() => list(raw.cashRegisters, parseRegister), [raw.cashRegisters]);
  const employees = useMemo(() => list(raw.employees, parseEmployee), [raw.employees]);
  const sessions = useMemo(
    () => list<PosSession>(raw.posSessions, (k, j) => ({ ...j, id: k })).sort((a, b) => (b.openedAt || '').localeCompare(a.openedAt || '')),
    [raw.posSessions],
  );
  const links: WarehouseLinks = useMemo(() => {
    const out: WarehouseLinks = {};
    Object.entries(raw.warehouseLinks || {}).forEach(([k, v]) => (out[k] = Array.isArray(v) ? v.filter(Boolean) : Object.values(v as any).map(String)));
    return out;
  }, [raw.warehouseLinks]);
  const productMeta: Record<string, ProductMeta> = useMemo(() => raw.productMeta || {}, [raw.productMeta]);
  const catalog: Record<string, CatalogEntry> = useMemo(() => raw.barcodeCatalog || {}, [raw.barcodeCatalog]);
  const me = useMemo(() => (isCashier && user ? employees.find((e) => e.uid === user.uid) || null : null), [isCashier, user, employees]);

  const write = useCallback(
    (updates: Updates) => {
      if (!ownerUid) return Promise.reject(new Error('لم يتم تسجيل الدخول'));
      const prevRaw = rawRef.current;
      const prefixed = Object.fromEntries(Object.entries(updates).map(([k, v]) => [`sales/${k}`, v]));
      try {
        assertCanWrite(member, Object.keys(prefixed));
      } catch (e) {
        return Promise.reject(e);
      }
      return update(ref(db, `sales/${ownerUid}`), updates).then(() => {
        if (actor) logAudit(ownerUid, actor, prefixed, (p) => valueAt(prevRaw, p.slice('sales/'.length)));
      });
    },
    [ownerUid, member, actor],
  );
  const newKey = useCallback((node: string) => push(ref(db, `sales/${ownerUid}/${node}`)).key!, [ownerUid]);

  /* ───────── المالك: الفروع والمخازن والصناديق ───────── */

  const saveBranch = useCallback<PosContextType['saveBranch']>(
    async (b) => {
      const id = b.id || newKey('branches');
      const prev = branches.find((x) => x.id === id);
      // نفس Branch.toJson
      await write({
        [`branches/${id}`]: {
          name: b.name.trim(),
          ownerUid,
          address: b.address ?? prev?.address ?? null,
          phone: b.phone ?? prev?.phone ?? null,
          type: b.type || prev?.type || 'store',
          createdAt: prev?.createdAt || nowIso(),
        },
      });
      return id;
    },
    [branches, newKey, ownerUid, write],
  );

  const deleteBranch = useCallback<PosContextType['deleteBranch']>(
    async (id) => {
      if (warehouses.some((w) => w.branchId === id) || registers.some((r) => r.branchId === id))
        throw new Error('احذف مخازن وصناديق الفرع أو انقلها لفرع آخر أولاً');
      await write({ [`branches/${id}`]: null });
    },
    [warehouses, registers, write],
  );

  const saveWarehouse = useCallback<PosContextType['saveWarehouse']>(
    async (w) => {
      const id = w.id || newKey('warehouses');
      await write({ [`warehouses/${id}`]: { name: w.name.trim(), branchId: w.branchId, ownerUid } });
      return id;
    },
    [newKey, ownerUid, write],
  );

  const deleteWarehouse = useCallback<PosContextType['deleteWarehouse']>(
    async (id) => {
      if (products.some((p) => p.warehouseId === id)) throw new Error('المخزن فيه منتجات — انقلها أو احذفها أولاً');
      const u: Updates = { [`warehouses/${id}`]: null, [`warehouseLinks/${id}`]: null };
      Object.entries(links).forEach(([k, v]) => v.includes(id) && (u[`warehouseLinks/${k}`] = v.filter((x) => x !== id)));
      await write(u);
    },
    [products, links, write],
  );

  /** الربط متبادل: إذا رُبط أ بـ ب يُربط ب بـ أ */
  const setWarehouseLinks = useCallback<PosContextType['setWarehouseLinks']>(
    async (id, linked) => {
      const u: Updates = { [`warehouseLinks/${id}`]: linked };
      warehouses.forEach((w) => {
        if (w.id === id) return;
        const cur = new Set(links[w.id] || []);
        const want = linked.includes(w.id);
        if (want === cur.has(id)) return;
        want ? cur.add(id) : cur.delete(id);
        u[`warehouseLinks/${w.id}`] = Array.from(cur);
      });
      await write(u);
    },
    [warehouses, links, write],
  );

  const saveRegister = useCallback<PosContextType['saveRegister']>(
    async (r) => {
      const id = r.id || newKey('cashRegisters');
      const prev = registers.find((x) => x.id === id);
      await write({ [`cashRegisters/${id}`]: { name: r.name.trim(), branchId: r.branchId, ownerUid, sessionOpen: prev?.sessionOpen ?? false } });
      return id;
    },
    [registers, newKey, ownerUid, write],
  );

  const deleteRegister = useCallback<PosContextType['deleteRegister']>(
    async (id) => {
      if (registers.find((r) => r.id === id)?.sessionOpen) throw new Error('الصندوق عليه جلسة مفتوحة — أغلقها أولاً');
      const u: Updates = { [`cashRegisters/${id}`]: null };
      employees.filter((e) => e.cashRegisterId === id).forEach((e) => (u[`employees/${e.uid}/cashRegisterId`] = null));
      await write(u);
    },
    [registers, employees, write],
  );

  /* ───────── المالك: حسابات الكاشير ───────── */

  const createCashier = useCallback<PosContextType['createCashier']>(
    async (c) => {
      if (isCashier) throw new Error('صلاحية المالك فقط');
      const a = secondaryAuth();
      let uid: string;
      try {
        const cred = await createUserWithEmailAndPassword(a, c.email.trim(), c.password);
        await updateProfile(cred.user, { displayName: c.name.trim() });
        uid = cred.user.uid;
      } catch (e: any) {
        const code = e?.code || '';
        throw new Error(
          code === 'auth/email-already-in-use'
            ? 'الإيميل مستخدم مسبقاً'
            : code === 'auth/weak-password'
              ? 'كلمة المرور ضعيفة (6 أحرف على الأقل)'
              : code === 'auth/invalid-email'
                ? 'إيميل غير صحيح'
                : e?.message || 'تعذّر إنشاء الحساب',
        );
      } finally {
        await signOut(a).catch(() => undefined);
      }
      // نفس ما يكتبه تطبيق الهاتف: سجل الموظف + خريطة الموظف ← المالك (تعطيه صلاحية بيانات المبيعات)
      await update(ref(db), {
        [`sales/${ownerUid}/employees/${uid}`]: {
          uid,
          name: c.name.trim(),
          email: c.email.trim(),
          role: c.role,
          branchId: c.branchId || null,
          cashRegisterId: c.cashRegisterId || null,
          ownerUid,
          phone: c.phone?.trim() || null,
        },
        [`employeeOwnerMap/${uid}`]: ownerUid,
      });
      return uid;
    },
    [isCashier, ownerUid],
  );

  const updateEmployee = useCallback<PosContextType['updateEmployee']>(
    (uid, data) => write(Object.fromEntries(Object.entries(data).map(([k, v]) => [`employees/${uid}/${k}`, v ?? null]))),
    [write],
  );

  /** كما في الهاتف: يُحذف سجل الموظف فيفقد الوصول لواجهة البيع (حساب الدخول نفسه يبقى في Firebase Auth) */
  const removeEmployee = useCallback<PosContextType['removeEmployee']>((uid) => write({ [`employees/${uid}`]: null }), [write]);

  /* ───────── المنتجات ───────── */

  const saveProduct = useCallback<PosContextType['saveProduct']>(
    async (p, meta) => {
      const id = p.id || newKey('products');
      const prev = products.find((x) => x.id === id);
      if (p.barcode && products.some((x) => x.id !== id && x.barcode === p.barcode && x.warehouseId === p.warehouseId))
        throw new Error('الباركود مستخدم لمنتج آخر في نفس المخزن');
      const full: PosProduct = {
        id,
        ownerUid,
        name: p.name.trim(),
        warehouseId: p.warehouseId,
        barcode: p.barcode ?? prev?.barcode ?? null,
        category: p.category ?? prev?.category ?? null,
        description: p.description ?? prev?.description ?? null,
        costPrice: Number(p.costPrice ?? prev?.costPrice ?? 0) || 0,
        sellPrice: Number(p.sellPrice ?? prev?.sellPrice ?? 0) || 0,
        quantity: Number(p.quantity ?? prev?.quantity ?? 0) || 0,
        vatRate: Number(p.vatRate ?? prev?.vatRate ?? 0) || 0,
        branchPrices: p.branchPrices ?? prev?.branchPrices ?? {},
        expiryDate: p.expiryDate ?? prev?.expiryDate ?? null,
        productionDate: p.productionDate ?? prev?.productionDate ?? null,
        trackExpiry: p.trackExpiry ?? prev?.trackExpiry ?? false,
      };
      const u: Updates = prev
        ? Object.fromEntries(Object.entries(productToJson(full)).map(([k, v]) => [`products/${id}/${k}`, v]))
        : { [`products/${id}`]: productToJson(full) };
      if (meta) u[`productMeta/${id}`] = Object.fromEntries(Object.entries(meta).filter(([, v]) => v));
      await write(u);
      return id;
    },
    [products, newKey, ownerUid, write],
  );

  const deleteProduct = useCallback<PosContextType['deleteProduct']>((id) => write({ [`products/${id}`]: null, [`productMeta/${id}`]: null }), [write]);

  /** تحويل كمية بين مخزنين مرتبطين: ينقص من المنتج ويزيد نفس الباركود في المخزن الآخر (أو يُنشأ) */
  const transferStock = useCallback<PosContextType['transferStock']>(
    async (productId, toWarehouseId, qty) => {
      const p = products.find((x) => x.id === productId);
      if (!p) throw new Error('المنتج غير موجود');
      if (!(qty > 0) || qty > p.quantity) throw new Error(`الكمية المتاحة ${p.quantity}`);
      if (!(links[p.warehouseId] || []).includes(toWarehouseId)) throw new Error('المخزنان غير مرتبطين — اربطهما من تبويب المخازن');
      const target = products.find((x) => x.warehouseId === toWarehouseId && ((p.barcode && x.barcode === p.barcode) || x.name === p.name));
      const u: Updates = { [`products/${p.id}/quantity`]: increment(-qty) };
      if (target) u[`products/${target.id}/quantity`] = increment(qty);
      else {
        const id = newKey('products');
        u[`products/${id}`] = productToJson({ ...p, id, warehouseId: toWarehouseId, quantity: qty });
        if (productMeta[p.id]) u[`productMeta/${id}`] = productMeta[p.id];
      }
      u[`stockTransfers/${newKey('stockTransfers')}`] = {
        productId,
        name: p.name,
        from: p.warehouseId,
        to: toWarehouseId,
        qty,
        byUid: user?.uid || '',
        at: nowIso(),
      };
      await write(u);
    },
    [products, links, productMeta, newKey, user, write],
  );

  const resolveBarcode = useCallback<PosContextType['resolveBarcode']>(
    async (code) => {
      const c = code.trim();
      if (!c) return null;
      if (catalog[c]) return catalog[c];
      const found = await lookupBarcode(c);
      if (found) await write({ [`barcodeCatalog/${c}`]: catalogToJson(found) }).catch(() => undefined);
      return found;
    },
    [catalog, write],
  );

  /* ───────── الكاشير: الجلسات والبيع ───────── */

  const openSession = useCallback<PosContextType['openSession']>(
    async (registerId, openingCash) => {
      const reg = registers.find((r) => r.id === registerId);
      if (!reg) throw new Error('الصندوق غير موجود');
      if (sessions.some((s) => s.registerId === registerId && !s.closedAt)) throw new Error('على هذا الصندوق جلسة مفتوحة بالفعل');
      const id = newKey('posSessions');
      await write({
        [`posSessions/${id}`]: {
          registerId,
          branchId: reg.branchId,
          cashierUid: user?.uid || '',
          cashierName: me?.name || user?.displayName || user?.email || '',
          openedAt: nowIso(),
          openingCash: openingCash || 0,
          running: { count: 0, cash: 0, card: 0, transfer: 0, total: 0 },
        },
        // نفس الحقل الذي يقرأه تطبيق الهاتف لحالة الصندوق
        [`cashRegisters/${registerId}/sessionOpen`]: true,
      });
      return id;
    },
    [registers, sessions, newKey, user, me, write],
  );

  const closeSession = useCallback<PosContextType['closeSession']>(
    async (session, countedCash, note) => {
      const r = (session as any).running || {};
      await write({
        [`posSessions/${session.id}/closedAt`]: nowIso(),
        [`posSessions/${session.id}/countedCash`]: countedCash,
        [`posSessions/${session.id}/note`]: note || '',
        [`posSessions/${session.id}/totals`]: {
          count: r.count || 0,
          cash: r.cash || 0,
          card: r.card || 0,
          transfer: r.transfer || 0,
          total: r.total || 0,
        },
        [`cashRegisters/${session.registerId}/sessionOpen`]: false,
      });
    },
    [write],
  );

  const checkout = useCallback<PosContextType['checkout']>(
    async (registerId, input) => {
      const reg = registers.find((r) => r.id === registerId);
      if (!reg) throw new Error('لا يوجد صندوق مرتبط بحسابك');
      const session = sessions.find((s) => s.registerId === registerId && !s.closedAt);
      if (!session || !reg.sessionOpen) throw new Error('افتح الجلسة أولاً');
      if (!input.items.length) throw new Error('السلة فارغة');
      const t = cartTotals(input.items, input.discount);
      if (input.method === 'cash' && input.paid + 1e-9 < t.rounded) throw new Error('المبلغ المدفوع أقل من الإجمالي');
      const seq = (Number(raw.invoiceSequence) || 0) + 1;
      const number = makeInvoiceNumber(seq, registerId, reg.branchId);
      const inv: PosInvoiceJson = {
        number,
        cashRegisterId: registerId,
        branchId: reg.branchId,
        ownerUid,
        createdByUid: user?.uid || '',
        items: input.items.map((i) => ({ ...i, barcode: i.barcode || null })),
        paymentMethod: input.method,
        status: 'closed',
        amountPaid: input.method === 'cash' ? input.paid : t.rounded,
        discount: input.discount || 0,
        customerPhone: input.customerPhone?.trim() || null,
        customerName: input.customerName?.trim() || null,
        bankName: input.bankName?.trim() || null,
        transferAccountName: null,
        createdAt: nowIso(),
        createdByName: me?.name || user?.displayName || user?.email || null,
      };
      // كتابة واحدة ذرّية تعمل بدون اتصال أيضاً (تُرسل عند عودة الشبكة)
      const u: Updates = {
        [`invoices/${newKey('invoices')}`]: inv,
        invoiceSequence: increment(1),
        [`posSessions/${session.id}/running/count`]: increment(1),
        [`posSessions/${session.id}/running/${input.method}`]: increment(t.rounded),
        [`posSessions/${session.id}/running/total`]: increment(t.rounded),
      };
      const byProduct = new Map<string, number>();
      input.items.forEach((i) => byProduct.set(i.productId, (byProduct.get(i.productId) || 0) + i.quantity));
      byProduct.forEach((q, id) => (u[`products/${id}/quantity`] = increment(-q)));
      await write(u);
      return { number, change: input.method === 'cash' ? input.paid - t.rounded : 0 };
    },
    [registers, sessions, raw.invoiceSequence, ownerUid, user, me, newKey, write],
  );

  const relayScan = useCallback<PosContextType['relayScan']>(
    (registerId, code) => write({ [`scanRelay/${registerId}/${newKey(`scanRelay/${registerId}`)}`]: { code, byUid: user?.uid || '', at: Date.now() } }),
    [newKey, user, write],
  );

  const value: PosContextType = {
    ready: ['branches', 'warehouses', 'products', 'cashRegisters', 'employees'].every((n) => loaded.has(n)),
    ownerUid,
    isCashier,
    me,
    branches,
    warehouses,
    products,
    registers,
    employees,
    sessions,
    links,
    productMeta,
    catalog,
    currency,
    saveBranch,
    deleteBranch,
    saveWarehouse,
    deleteWarehouse,
    setWarehouseLinks,
    saveRegister,
    deleteRegister,
    createCashier,
    updateEmployee,
    removeEmployee,
    saveProduct,
    deleteProduct,
    transferStock,
    resolveBarcode,
    openSession,
    closeSession,
    checkout,
    relayScan,
  };

  return <PosContext.Provider value={value}>{children}</PosContext.Provider>;
};

export const usePos = () => {
  const ctx = useContext(PosContext);
  if (!ctx) throw new Error('usePos must be used within PosProvider');
  return ctx;
};

/** يستقبل الأكواد التي يرسلها هاتف الكاشير (وضع الماسح) ويحذفها بعد الاستلام */
export const useScanRelay = (registerId: string | null | undefined, onCode: (code: string) => void) => {
  const { ownerUid } = usePos();
  const cb = React.useRef(onCode);
  cb.current = onCode;
  useEffect(() => {
    if (!ownerUid || !registerId) return;
    const path = `sales/${ownerUid}/scanRelay/${registerId}`;
    return onChildAdded(ref(db, path), (snap) => {
      const v = snap.val();
      remove(snap.ref).catch(() => undefined);
      // تجاهل الأكواد القديمة (أُرسلت قبل فتح الشاشة بأكثر من دقيقتين)
      if (v?.code && Date.now() - (Number(v.at) || 0) < 120000) cb.current(String(v.code));
    });
  }, [ownerUid, registerId]);
};
