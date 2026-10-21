import React, { useEffect, useState } from 'react';
import Modal from '../ui/Modal';
import { Button } from '../ui/primitives';
import { Field, FormError, Input, Select } from '../ui/Form';
import Icon from '../ui/Icon';
import BarcodeScanner from './BarcodeScanner';
import { usePos } from '../../context/PosContext';
import { BUSINESS_LABELS, BusinessType, CatalogEntry, PosBranch, PosEmployee, PosProduct, CashRegister, PosWarehouse } from '../../lib/pos';

const num = (v: string) => v.replace(/[^0-9.]/g, '');

const Footer: React.FC<{ onClose: () => void; form: string; busy?: boolean; label?: string }> = ({ onClose, form, busy, label = 'حفظ' }) => (
  <>
    <Button variant="ghost" onClick={onClose}>
      إلغاء
    </Button>
    <Button type="submit" form={form} disabled={busy}>
      {label}
    </Button>
  </>
);

const useSubmit = (onClose: () => void) => {
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setErr(null);
    try {
      await fn();
      onClose();
    } catch (e: any) {
      setErr(e?.message || 'تعذّر الحفظ');
    } finally {
      setBusy(false);
    }
  };
  return { err, setErr, busy, run };
};

/* ───────── فرع ───────── */

export const BranchModal: React.FC<{ open: boolean; onClose: () => void; branch?: PosBranch | null }> = ({ open, onClose, branch }) => {
  const { saveBranch } = usePos();
  const [f, setF] = useState({ name: '', address: '', phone: '', type: 'store' as BusinessType });
  const { err, busy, run, setErr } = useSubmit(onClose);
  useEffect(() => {
    if (!open) return;
    setErr(null);
    setF({ name: branch?.name || '', address: branch?.address || '', phone: branch?.phone || '', type: branch?.type || 'store' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, branch]);
  return (
    <Modal open={open} onClose={onClose} size="sm" title={branch ? 'تعديل الفرع' : 'فرع جديد'} footer={<Footer onClose={onClose} form="branch-form" busy={busy} />}>
      <form
        id="branch-form"
        className="grid gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (!f.name.trim()) return setErr('اسم الفرع مطلوب');
          run(() => saveBranch({ id: branch?.id, ...f }));
        }}
      >
        <Field label="اسم الفرع">
          <Input autoFocus value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
        </Field>
        <Field label="نوع النشاط">
          <Select value={f.type} onChange={(e) => setF({ ...f, type: e.target.value as BusinessType })}>
            {(Object.keys(BUSINESS_LABELS) as BusinessType[]).map((t) => (
              <option key={t} value={t}>
                {BUSINESS_LABELS[t]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="العنوان">
          <Input value={f.address} onChange={(e) => setF({ ...f, address: e.target.value })} />
        </Field>
        <Field label="الهاتف">
          <Input value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} className="num" />
        </Field>
      </form>
      <FormError message={err} />
    </Modal>
  );
};

/* ───────── مخزن ───────── */

export const WarehouseModal: React.FC<{ open: boolean; onClose: () => void; warehouse?: PosWarehouse | null }> = ({ open, onClose, warehouse }) => {
  const { branches, warehouses, links, saveWarehouse, setWarehouseLinks } = usePos();
  const [name, setName] = useState('');
  const [branchId, setBranchId] = useState('');
  const [linked, setLinked] = useState<string[]>([]);
  const { err, busy, run, setErr } = useSubmit(onClose);
  useEffect(() => {
    if (!open) return;
    setErr(null);
    setName(warehouse?.name || '');
    setBranchId(warehouse?.branchId || branches[0]?.id || '');
    setLinked(warehouse ? links[warehouse.id] || [] : []);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, warehouse]);
  return (
    <Modal open={open} onClose={onClose} size="md" title={warehouse ? 'تعديل المخزن' : 'مخزن جديد'} footer={<Footer onClose={onClose} form="pwh-form" busy={busy} />}>
      <form
        id="pwh-form"
        className="grid gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (!name.trim()) return setErr('اسم المخزن مطلوب');
          if (!branchId) return setErr('اختر الفرع');
          run(async () => {
            const id = await saveWarehouse({ id: warehouse?.id, name, branchId });
            await setWarehouseLinks(id, linked.filter((x) => x !== id));
          });
        }}
      >
        <Field label="اسم المخزن">
          <Input autoFocus value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label="الفرع التابع له" hint="منتجات هذا المخزن تظهر لكاشير هذا الفرع">
          <Select value={branchId} onChange={(e) => setBranchId(e.target.value)}>
            <option value="">اختر...</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </Select>
        </Field>
        <div>
          <span className="field-label">مخازن مرتبطة (يُسمح بالتحويل بينها)</span>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {warehouses
              .filter((w) => w.id !== warehouse?.id)
              .map((w) => (
                <label key={w.id} className="flex items-center gap-2 rounded-lg border border-line px-3 py-2 text-sm">
                  <input
                    type="checkbox"
                    checked={linked.includes(w.id)}
                    onChange={(e) => setLinked((l) => (e.target.checked ? [...l, w.id] : l.filter((x) => x !== w.id)))}
                  />
                  {w.name}
                  <span className="ms-auto text-xs text-ink-subtle">{branches.find((b) => b.id === w.branchId)?.name}</span>
                </label>
              ))}
            {warehouses.length <= (warehouse ? 1 : 0) && <p className="text-xs text-ink-subtle">لا توجد مخازن أخرى بعد.</p>}
          </div>
        </div>
      </form>
      <FormError message={err} />
    </Modal>
  );
};

/* ───────── صندوق كاشير ───────── */

export const RegisterModal: React.FC<{ open: boolean; onClose: () => void; register?: CashRegister | null }> = ({ open, onClose, register }) => {
  const { branches, saveRegister } = usePos();
  const [name, setName] = useState('');
  const [branchId, setBranchId] = useState('');
  const { err, busy, run, setErr } = useSubmit(onClose);
  useEffect(() => {
    if (!open) return;
    setErr(null);
    setName(register?.name || '');
    setBranchId(register?.branchId || branches[0]?.id || '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, register]);
  return (
    <Modal open={open} onClose={onClose} size="sm" title={register ? 'تعديل الصندوق' : 'صندوق كاشير جديد'} footer={<Footer onClose={onClose} form="reg-form" busy={busy} />}>
      <form
        id="reg-form"
        className="grid gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (!name.trim() || !branchId) return setErr('الاسم والفرع مطلوبان');
          run(() => saveRegister({ id: register?.id, name, branchId }));
        }}
      >
        <Field label="اسم الصندوق">
          <Input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="مثال: كاشير 1" />
        </Field>
        <Field label="الفرع">
          <Select value={branchId} onChange={(e) => setBranchId(e.target.value)}>
            <option value="">اختر...</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </Select>
        </Field>
      </form>
      <FormError message={err} />
    </Modal>
  );
};

/* ───────── حساب كاشير ───────── */

export const CashierModal: React.FC<{ open: boolean; onClose: () => void; employee?: PosEmployee | null }> = ({ open, onClose, employee }) => {
  const { branches, registers, employees, createCashier, updateEmployee } = usePos();
  const [f, setF] = useState({ name: '', email: '', password: '', phone: '', role: 'cashier' as 'cashier' | 'manager', branchId: '', cashRegisterId: '' });
  const { err, busy, run, setErr } = useSubmit(onClose);
  useEffect(() => {
    if (!open) return;
    setErr(null);
    setF({
      name: employee?.name || '',
      email: employee?.email || '',
      password: '',
      phone: employee?.phone || '',
      role: employee?.role === 'manager' ? 'manager' : 'cashier',
      branchId: employee?.branchId || branches[0]?.id || '',
      cashRegisterId: employee?.cashRegisterId || '',
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, employee]);
  const regs = registers.filter((r) => !f.branchId || r.branchId === f.branchId);
  const takenBy = (rid: string) => employees.find((e) => e.cashRegisterId === rid && e.uid !== employee?.uid);
  return (
    <Modal
      open={open}
      onClose={onClose}
      size="md"
      title={employee ? `تعديل ${employee.name}` : 'حساب كاشير جديد'}
      subtitle="الكاشير يسجّل الدخول بهذا الإيميل وكلمة المرور من متصفح هاتفه، فتفتح له واجهة نقطة البيع على صندوقه فقط"
      footer={<Footer onClose={onClose} form="cashier-form" busy={busy} label={employee ? 'حفظ' : 'إنشاء الحساب'} />}
    >
      <form
        id="cashier-form"
        className="grid grid-cols-1 gap-4 sm:grid-cols-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (!f.name.trim()) return setErr('الاسم مطلوب');
          if (!employee && (!f.email.trim() || f.password.length < 6)) return setErr('الإيميل وكلمة مرور من 6 أحرف على الأقل مطلوبة');
          if (!f.cashRegisterId) return setErr('اربط الكاشير بصندوق');
          run(() =>
            employee
              ? updateEmployee(employee.uid, { name: f.name.trim(), phone: f.phone, role: f.role, branchId: f.branchId, cashRegisterId: f.cashRegisterId })
              : createCashier(f),
          );
        }}
      >
        <Field label="الاسم">
          <Input autoFocus value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
        </Field>
        <Field label="الجوال">
          <Input inputMode="tel" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} className="num" />
        </Field>
        {!employee && (
          <>
            <Field label="إيميل الدخول">
              <Input type="email" dir="ltr" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />
            </Field>
            <Field label="كلمة المرور" hint="أعطها للكاشير — لا تُحفظ في المنصة">
              <Input type="text" dir="ltr" autoComplete="new-password" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} />
            </Field>
          </>
        )}
        <Field label="الصلاحية">
          <Select value={f.role} onChange={(e) => setF({ ...f, role: e.target.value as 'cashier' | 'manager' })}>
            <option value="cashier">كاشير (بيع فقط)</option>
            <option value="manager">مدير فرع (بيع + إضافة منتجات)</option>
          </Select>
        </Field>
        <Field label="الفرع">
          <Select value={f.branchId} onChange={(e) => setF({ ...f, branchId: e.target.value, cashRegisterId: '' })}>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="صندوق الكاشير" className="sm:col-span-2">
          <Select value={f.cashRegisterId} onChange={(e) => setF({ ...f, cashRegisterId: e.target.value })}>
            <option value="">اختر...</option>
            {regs.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
                {takenBy(r.id) ? ` — مرتبط بـ ${takenBy(r.id)!.name}` : ''}
              </option>
            ))}
          </Select>
        </Field>
      </form>
      <FormError message={err} />
    </Modal>
  );
};

/* ───────── منتج (مع البحث بالباركود في قاعدة المنتجات العالمية) ───────── */

export const ProductModal: React.FC<{
  open: boolean;
  onClose: () => void;
  product?: PosProduct | null;
  barcode?: string;
  entry?: CatalogEntry | null;
  defaultWarehouseId?: string;
  onSaved?: (p: PosProduct) => void;
}> = ({ open, onClose, product, barcode, entry, defaultWarehouseId, onSaved }) => {
  const { warehouses, branches, productMeta, saveProduct, resolveBarcode, ownerUid } = usePos();
  const [f, setF] = useState({ name: '', barcode: '', category: '', warehouseId: '', costPrice: '', sellPrice: '', quantity: '', vatRate: '', imageUrl: '', brand: '' });
  const [scan, setScan] = useState(false);
  const [looking, setLooking] = useState(false);
  const [hint, setHint] = useState<string | null>(null);
  const { err, busy, run, setErr } = useSubmit(onClose);

  const apply = (e: CatalogEntry | null, code: string) => {
    setHint(e ? `وُجد في ${e.source}` : 'غير موجود في القواعد العالمية — أدخل الاسم يدوياً');
    if (e) setF((x) => ({ ...x, barcode: code, name: x.name || e.name, imageUrl: e.imageUrl || x.imageUrl, brand: e.brand || x.brand, category: x.category || e.category || '' }));
    else setF((x) => ({ ...x, barcode: code }));
  };

  useEffect(() => {
    if (!open) return;
    setErr(null);
    setHint(null);
    const m = product ? productMeta[product.id] : undefined;
    setF({
      name: product?.name || '',
      barcode: product?.barcode || barcode || '',
      category: product?.category || '',
      warehouseId: product?.warehouseId || defaultWarehouseId || warehouses[0]?.id || '',
      costPrice: product ? String(product.costPrice || '') : '',
      sellPrice: product ? String(product.sellPrice || '') : '',
      quantity: product ? String(product.quantity || '') : '',
      vatRate: product ? String(product.vatRate || '') : '',
      imageUrl: m?.imageUrl || '',
      brand: m?.brand || '',
    });
    if (!product && barcode) apply(entry || null, barcode);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, product]);

  const lookup = async (code: string) => {
    if (!code.trim()) return;
    setLooking(true);
    apply(await resolveBarcode(code).catch(() => null), code.trim());
    setLooking(false);
  };

  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });
  const setN = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: num(e.target.value) });

  return (
    <Modal open={open} onClose={onClose} size="lg" title={product ? 'تعديل منتج' : 'منتج جديد'} footer={<Footer onClose={onClose} form="pprod-form" busy={busy} />}>
      <form
        id="pprod-form"
        className="grid grid-cols-1 gap-4 sm:grid-cols-[140px_minmax(0,1fr)]"
        onSubmit={(e) => {
          e.preventDefault();
          if (!f.name.trim()) return setErr('اسم المنتج مطلوب');
          if (!f.warehouseId) return setErr('اختر المخزن');
          run(async () => {
            const data = {
              id: product?.id,
              name: f.name,
              barcode: f.barcode.trim() || null,
              category: f.category || null,
              warehouseId: f.warehouseId,
              costPrice: Number(f.costPrice) || 0,
              sellPrice: Number(f.sellPrice) || 0,
              quantity: Number(f.quantity) || 0,
              vatRate: Number(f.vatRate) || 0,
            };
            const id = await saveProduct(data, { imageUrl: f.imageUrl, brand: f.brand, source: hint || undefined });
            onSaved?.({
              ...data,
              id,
              ownerUid,
              branchPrices: product?.branchPrices || {},
              trackExpiry: product?.trackExpiry || false,
              description: product?.description || null,
            } as PosProduct);
          });
        }}
      >
        <div className="grid h-36 place-items-center overflow-hidden rounded-xl border border-line bg-slate-50">
          {f.imageUrl ? <img src={f.imageUrl} alt="" className="h-full w-full object-contain p-1" /> : <Icon name="box" size={36} className="text-ink-faint" />}
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="الباركود" className="sm:col-span-2" hint={looking ? 'نبحث في قاعدة المنتجات العالمية...' : hint || 'امسح أو اكتب الباركود ليُعبّأ الاسم والصورة تلقائياً'}>
            <div className="flex gap-2">
              <Input value={f.barcode} onChange={set('barcode')} onBlur={() => !product && f.barcode && !f.name && lookup(f.barcode)} className="num" dir="ltr" />
              <Button type="button" variant="secondary" icon="search" onClick={() => lookup(f.barcode)} disabled={!f.barcode || looking}>
                بحث
              </Button>
              <Button type="button" variant="secondary" onClick={() => setScan(true)} title="مسح بالكاميرا">
                <Icon name="camera" size={16} />
              </Button>
            </div>
          </Field>
          <Field label="اسم المنتج" className="sm:col-span-2">
            <Input value={f.name} onChange={set('name')} />
          </Field>
        </div>
        <Field label="المخزن">
          <Select value={f.warehouseId} onChange={(e) => setF({ ...f, warehouseId: e.target.value })}>
            {warehouses.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name} — {branches.find((b) => b.id === w.branchId)?.name || ''}
              </option>
            ))}
          </Select>
        </Field>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Field label="سعر البيع">
            <Input inputMode="decimal" value={f.sellPrice} onChange={setN('sellPrice')} className="num" />
          </Field>
          <Field label="التكلفة">
            <Input inputMode="decimal" value={f.costPrice} onChange={setN('costPrice')} className="num" />
          </Field>
          <Field label="الكمية">
            <Input inputMode="decimal" value={f.quantity} onChange={setN('quantity')} className="num" />
          </Field>
          <Field label="الضريبة %">
            <Input inputMode="decimal" value={f.vatRate} onChange={setN('vatRate')} className="num" />
          </Field>
        </div>
        <Field label="التصنيف">
          <Input value={f.category} onChange={set('category')} />
        </Field>
        <Field label="رابط الصورة" hint="يُعبّأ تلقائياً من قاعدة المنتجات العالمية، ويمكن تغييره">
          <Input value={f.imageUrl} onChange={set('imageUrl')} dir="ltr" />
        </Field>
      </form>
      <FormError message={err} />
      <BarcodeScanner
        open={scan}
        onClose={() => setScan(false)}
        onDetected={(code) => {
          setF((x) => ({ ...x, barcode: code }));
          lookup(code);
        }}
      />
    </Modal>
  );
};

/** إضافة سريعة لمنتج مسحه الكاشير ولم يكن في المخزن */
export const ProductQuickAdd: React.FC<{
  open: boolean;
  onClose: () => void;
  barcode: string;
  entry: CatalogEntry | null;
  defaultWarehouseId: string;
  onSaved: (p: PosProduct) => void;
}> = (props) => <ProductModal {...props} />;
