import React, { useEffect, useMemo, useState } from 'react';
import Modal from '../ui/Modal';
import { Button } from '../ui/primitives';
import { Field, FormError, Input, SearchSelect, Segmented, Select } from '../ui/Form';
import Icon from '../ui/Icon';
import { useLedger, OpDraft } from '../../context/LedgerContext';
import { useAccountOptions } from './LedgerForms';
import { localIso } from '../../lib/ledger';
import { StockItem, StockMoveType, Warehouse, MOVE_LABELS, stockLevels } from '../../lib/erp';
import { formatNumber } from '../../lib/format';

/* ───────── مخزن ───────── */

export const WarehouseFormModal: React.FC<{ open: boolean; onClose: () => void; warehouse?: Warehouse | null }> = ({
  open,
  onClose,
  warehouse,
}) => {
  const { cashboxes, saveWarehouse, saveAccount } = useLedger();
  const options = useAccountOptions();
  const [name, setName] = useState('');
  const [location, setLocation] = useState('');
  const [cashboxId, setCashboxId] = useState('');
  const [invMode, setInvMode] = useState<'new' | 'existing'>('new');
  const [invId, setInvId] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setErr(null);
    setName(warehouse?.name || '');
    setLocation(warehouse?.location || '');
    setCashboxId(warehouse?.cashboxId || cashboxes[0]?.id || '');
    setInvMode(warehouse?.inventoryAccountId ? 'existing' : 'new');
    setInvId(warehouse?.inventoryAccountId || '');
  }, [open, warehouse, cashboxes]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return setErr('اسم المخزن مطلوب');
    if (invMode === 'existing' && !invId) return setErr('اختر حساب المخزون');
    setBusy(true);
    try {
      const inv = invMode === 'new' ? await saveAccount({ name: `مخزون ${name.trim()}`, category: 'asset', type: 'other' }, 'general') : invId;
      await saveWarehouse({ id: warehouse?.id, name, location, cashboxId: cashboxId || null, inventoryAccountId: inv });
      onClose();
    } catch (e: any) {
      setErr(e?.message || 'تعذّر الحفظ');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={warehouse ? `تعديل ${warehouse.name}` : 'مخزن جديد'}
      subtitle="المخزن مرتبط بصندوق للدفع والقبض النقدي، وبحساب مخزون يحمل قيمة البضاعة"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            إلغاء
          </Button>
          <Button type="submit" form="wh-form" disabled={busy}>
            حفظ
          </Button>
        </>
      }
    >
      <form id="wh-form" onSubmit={submit} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="اسم المخزن">
          <Input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="مثال: المستودع الرئيسي" />
        </Field>
        <Field label="الموقع">
          <Input value={location} onChange={(e) => setLocation(e.target.value)} />
        </Field>
        <Field
          label="الصندوق المرتبط"
          className="sm:col-span-2"
          hint="ثمن المشتريات النقدية يُدفع منه، وثمن المبيعات النقدية يُقبض فيه"
        >
          <Select value={cashboxId} onChange={(e) => setCashboxId(e.target.value)}>
            <option value="">— بدون صندوق (حركات آجلة فقط) —</option>
            {cashboxes.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </Select>
        </Field>
        <div className="sm:col-span-2">
          <span className="field-label">حساب المخزون</span>
          <Segmented
            value={invMode}
            onChange={setInvMode}
            options={[
              { value: 'new', label: 'إنشاء حساب مخزون جديد' },
              { value: 'existing', label: 'حساب موجود' },
            ]}
          />
          <div className="mt-2">
            {invMode === 'existing' ? (
              <SearchSelect value={invId} onChange={setInvId} options={options} placeholder="اختر حساب المخزون" />
            ) : (
              <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-ink-subtle">
                سيُنشأ حساب "مخزون {name || '...'}" (أصول) ويظهر على الهاتف بقيمة البضاعة الموجودة.
              </p>
            )}
          </div>
        </div>
      </form>
      <FormError message={err} />
    </Modal>
  );
};

/* ───────── صنف ───────── */

export const ItemFormModal: React.FC<{ open: boolean; onClose: () => void; item?: StockItem | null }> = ({ open, onClose, item }) => {
  const { saveItem } = useLedger();
  const [f, setF] = useState({ name: '', code: '', unit: 'قطعة', category: '', price: '', minQty: '' });
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setErr(null);
    setF({
      name: item?.name || '',
      code: item?.code || '',
      unit: item?.unit || 'قطعة',
      category: item?.category || '',
      price: item?.price ? String(item.price) : '',
      minQty: item?.minQty ? String(item.minQty) : '',
    });
  }, [open, item]);

  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF((x) => ({ ...x, [k]: e.target.value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!f.name.trim()) return setErr('اسم الصنف مطلوب');
    try {
      await saveItem({ id: item?.id, ...f, price: Number(f.price) || 0, minQty: Number(f.minQty) || 0 });
      onClose();
    } catch (e: any) {
      setErr(e?.message || 'تعذّر الحفظ');
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={item ? 'تعديل صنف' : 'صنف جديد'}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            إلغاء
          </Button>
          <Button type="submit" form="item-form">
            حفظ
          </Button>
        </>
      }
    >
      <form id="item-form" onSubmit={submit} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="اسم الصنف" className="sm:col-span-2">
          <Input autoFocus value={f.name} onChange={set('name')} />
        </Field>
        <Field label="رمز / باركود">
          <Input value={f.code} onChange={set('code')} className="num" />
        </Field>
        <Field label="الوحدة">
          <Input value={f.unit} onChange={set('unit')} />
        </Field>
        <Field label="المجموعة">
          <Input value={f.category} onChange={set('category')} />
        </Field>
        <Field label="سعر البيع الافتراضي">
          <Input inputMode="decimal" value={f.price} onChange={set('price')} className="num" />
        </Field>
        <Field label="الحد الأدنى للتنبيه">
          <Input inputMode="decimal" value={f.minQty} onChange={set('minQty')} className="num" />
        </Field>
      </form>
      <FormError message={err} />
    </Modal>
  );
};

/* ───────── حركة مخزن ───────── */

export const StockMoveModal: React.FC<{
  open: boolean;
  onClose: () => void;
  type: StockMoveType;
  warehouseId?: string;
  itemId?: string;
}> = ({ open, onClose, type: initialType, warehouseId, itemId }) => {
  const { warehouses, items, moves, cashboxes, accountsById, createMove, mainCurrency } = useLedger();
  const options = useAccountOptions();
  const levels = useMemo(() => stockLevels(moves), [moves]);
  const [type, setType] = useState<StockMoveType>(initialType);
  const [wh, setWh] = useState('');
  const [toWh, setToWh] = useState('');
  const [item, setItem] = useState('');
  const [qty, setQty] = useState('');
  const [cost, setCost] = useState('');
  const [price, setPrice] = useState('');
  const [payment, setPayment] = useState<'cash' | 'credit'>('cash');
  const [party, setParty] = useState('');
  const [date, setDate] = useState(localIso().slice(0, 16));
  const [statement, setStatement] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setErr(null);
    setType(initialType);
    setWh(warehouseId || warehouses[0]?.id || '');
    setToWh('');
    setItem(itemId || '');
    setQty('');
    setCost('');
    setPrice('');
    setPayment('cash');
    setParty('');
    setStatement('');
    setDate(localIso().slice(0, 16));
  }, [open, initialType, warehouseId, itemId, warehouses]);

  const warehouse = warehouses.find((w) => w.id === wh);
  const target = warehouses.find((w) => w.id === toWh);
  const stockItem = items.find((i) => i.id === item);
  const level = levels.of(wh, item);
  const box = cashboxes.find((b) => b.id === warehouse?.cashboxId);

  useEffect(() => {
    if (type === 'out' && stockItem?.price && !price) setPrice(String(stockItem.price));
  }, [type, stockItem, price]);

  const q = Number(qty) || 0;
  const unitCost = type === 'in' ? Number(cost) || 0 : type === 'adjust' && q > level.qty && !level.avgCost ? Number(cost) || 0 : level.avgCost;
  const unitPrice = Number(price) || 0;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!warehouse) return setErr('اختر المخزن');
    if (!stockItem) return setErr('اختر الصنف');
    if (!warehouse.inventoryAccountId) return setErr('المخزن بلا حساب مخزون — عدّله أولاً');
    if (type !== 'adjust' && !(q > 0)) return setErr('أدخل كمية أكبر من صفر');
    if (type === 'adjust' && !(q >= 0)) return setErr('أدخل الكمية الفعلية بعد الجرد');
    if ((type === 'out' || type === 'transfer') && q > level.qty + 1e-9)
      return setErr(`الكمية المتاحة ${formatNumber(level.qty, 2)} فقط`);
    if (type === 'in' && !(unitCost > 0)) return setErr('أدخل تكلفة الوحدة');
    if (type === 'out' && !(unitPrice >= 0)) return setErr('سعر البيع غير صالح');
    if (type === 'transfer' && !target) return setErr('اختر المخزن المستلم');
    if ((type === 'in' || type === 'out') && payment === 'cash' && !box?.cashAccountId)
      return setErr('المخزن غير مرتبط بصندوق له حساب نقدية — اختر "آجل" أو اربط صندوقاً');
    if ((type === 'in' || type === 'out') && payment === 'credit' && !party) return setErr('اختر الطرف (مورد أو زبون)');

    const inv = warehouse.inventoryAccountId;
    const base = { currency: mainCurrency, exchangeRate: 1, date: localIso(new Date(date)) };
    const label = `${MOVE_LABELS[type]}: ${stockItem.name}`;
    const extra = statement ? ` — ${statement}` : '';
    const drafts: OpDraft[] = [];
    let moveQty = q;

    if (type === 'in') {
      const value = q * unitCost;
      drafts.push({ ...base, accountId: inv, amount: value, statement: `${label} × ${q} (${warehouse.name})${extra}` });
      drafts.push({
        ...base,
        accountId: payment === 'cash' ? box!.cashAccountId! : party,
        amount: -value,
        statement: `ثمن شراء ${stockItem.name} × ${q} إلى ${warehouse.name}${extra}`,
      });
    } else if (type === 'out') {
      const costValue = q * unitCost;
      const saleValue = q * unitPrice;
      drafts.push({ ...base, accountId: inv, amount: -costValue, statement: `${label} × ${q} بالتكلفة (${warehouse.name})${extra}` });
      drafts.push({
        ...base,
        accountId: payment === 'cash' ? box!.cashAccountId! : party,
        amount: saleValue,
        statement: `ثمن بيع ${stockItem.name} × ${q} من ${warehouse.name}${extra}`,
      });
    } else if (type === 'transfer') {
      const value = q * unitCost;
      if (target!.inventoryAccountId && target!.inventoryAccountId !== inv) {
        drafts.push({ ...base, accountId: inv, amount: -value, statement: `تحويل ${stockItem.name} × ${q} إلى ${target!.name}${extra}` });
        drafts.push({
          ...base,
          accountId: target!.inventoryAccountId,
          amount: value,
          statement: `تحويل ${stockItem.name} × ${q} من ${warehouse.name}${extra}`,
        });
      }
    } else {
      moveQty = q - level.qty;
      if (Math.abs(moveQty) < 1e-9) return setErr('الكمية الفعلية تساوي الرصيد الحالي — لا تسوية');
      drafts.push({
        ...base,
        accountId: inv,
        amount: moveQty * unitCost,
        statement: `تسوية جرد ${stockItem.name}: ${moveQty > 0 ? 'زيادة' : 'عجز'} ${Math.abs(moveQty)} (${warehouse.name})${extra}`,
      });
    }

    setBusy(true);
    try {
      await createMove(
        {
          type,
          warehouseId: wh,
          toWarehouseId: type === 'transfer' ? toWh : null,
          itemId: item,
          qty: moveQty,
          unitCost,
          unitPrice: type === 'out' ? unitPrice : 0,
          payment: type === 'in' || type === 'out' ? payment : null,
          partyId: payment === 'credit' ? party : null,
          statement,
          date: base.date,
        },
        drafts,
      );
      onClose();
    } catch (e: any) {
      setErr(e?.message || 'تعذّر الحفظ');
    } finally {
      setBusy(false);
    }
  };

  const preview = (() => {
    if (!warehouse || !stockItem) return null;
    const invName = accountsById[warehouse.inventoryAccountId || '']?.name || 'حساب المخزون';
    const payName = payment === 'cash' ? box?.name || 'الصندوق' : accountsById[party]?.name || 'الطرف';
    if (type === 'in') return `+${formatNumber(q * unitCost)} على ${invName} و −${formatNumber(q * unitCost)} على ${payName}`;
    if (type === 'out')
      return `−${formatNumber(q * unitCost)} على ${invName} (التكلفة) و +${formatNumber(q * unitPrice)} على ${payName} (البيع) · الربح ${formatNumber(
        q * (unitPrice - unitCost),
      )}`;
    if (type === 'transfer')
      return target?.inventoryAccountId && target.inventoryAccountId !== warehouse.inventoryAccountId
        ? `نقل ${formatNumber(q * unitCost)} من ${invName} إلى ${accountsById[target.inventoryAccountId]?.name}`
        : 'نفس حساب المخزون — لا أثر محاسبي، تتغير الكميات فقط';
    const d = q - level.qty;
    return `${d >= 0 ? '+' : '−'}${formatNumber(Math.abs(d * unitCost))} على ${invName}`;
  })();

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title={MOVE_LABELS[type]}
      subtitle="الحركة تحدّث الكميات، وتنشئ قيوداً على حساب المخزون والصندوق أو الطرف المقابل"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            إلغاء
          </Button>
          <Button type="submit" form="move-form" disabled={busy || !warehouses.length || !items.length}>
            حفظ الحركة
          </Button>
        </>
      }
    >
      {!warehouses.length || !items.length ? (
        <p className="rounded-lg bg-warning-50 px-4 py-3 text-sm text-warning-700">
          أضف مخزناً وصنفاً واحداً على الأقل قبل تسجيل الحركات.
        </p>
      ) : (
        <form id="move-form" onSubmit={submit} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Segmented
              value={type}
              onChange={setType}
              options={[
                { value: 'in', label: 'إدخال / شراء', tone: 'success' },
                { value: 'out', label: 'إخراج / بيع', tone: 'danger' },
                { value: 'transfer', label: 'تحويل' },
                { value: 'adjust', label: 'تسوية جرد' },
              ]}
            />
          </div>
          <Field label={type === 'transfer' ? 'من مخزن' : 'المخزن'}>
            <Select value={wh} onChange={(e) => setWh(e.target.value)}>
              {warehouses.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                </option>
              ))}
            </Select>
          </Field>
          {type === 'transfer' ? (
            <Field label="إلى مخزن">
              <Select value={toWh} onChange={(e) => setToWh(e.target.value)}>
                <option value="">اختر...</option>
                {warehouses
                  .filter((w) => w.id !== wh)
                  .map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name}
                    </option>
                  ))}
              </Select>
            </Field>
          ) : (
            <div />
          )}
          <Field label="الصنف" hint={stockItem ? `المتاح: ${formatNumber(level.qty, 2)} ${stockItem.unit || ''} · متوسط التكلفة ${formatNumber(level.avgCost)}` : undefined}>
            <SearchSelect
              value={item}
              onChange={setItem}
              options={items.map((i) => ({ value: i.id, label: i.name, hint: i.code }))}
              placeholder="اختر الصنف"
            />
          </Field>
          <Field label={type === 'adjust' ? 'الكمية الفعلية بعد الجرد' : 'الكمية'}>
            <Input inputMode="decimal" value={qty} onChange={(e) => setQty(e.target.value.replace(/[^0-9.]/g, ''))} className="num" />
          </Field>
          {(type === 'in' || (type === 'adjust' && q > level.qty && !level.avgCost)) && (
            <Field label={`تكلفة الوحدة (${mainCurrency})`}>
              <Input inputMode="decimal" value={cost} onChange={(e) => setCost(e.target.value.replace(/[^0-9.]/g, ''))} className="num" />
            </Field>
          )}
          {type === 'out' && (
            <Field label={`سعر بيع الوحدة (${mainCurrency})`}>
              <Input inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value.replace(/[^0-9.]/g, ''))} className="num" />
            </Field>
          )}
          {(type === 'in' || type === 'out') && (
            <>
              <div>
                <span className="field-label">طريقة الدفع</span>
                <Segmented
                  value={payment}
                  onChange={setPayment}
                  options={[
                    { value: 'cash', label: box ? `نقدي (${box.name})` : 'نقدي' },
                    { value: 'credit', label: 'آجل' },
                  ]}
                />
              </div>
              {payment === 'credit' && (
                <Field label={type === 'in' ? 'المورد' : 'الزبون'}>
                  <SearchSelect value={party} onChange={setParty} options={options} placeholder="اختر الحساب" />
                </Field>
              )}
            </>
          )}
          <Field label="التاريخ">
            <Input type="datetime-local" value={date} onChange={(e) => setDate(e.target.value)} className="num" />
          </Field>
          <Field label="البيان">
            <Input value={statement} onChange={(e) => setStatement(e.target.value)} />
          </Field>
          {preview && (
            <p className="flex items-start gap-2 rounded-lg bg-slate-50 px-3 py-2 text-xs text-ink-subtle sm:col-span-2">
              <Icon name="link" size={14} className="mt-0.5 shrink-0" /> الأثر المحاسبي: {preview}
            </p>
          )}
        </form>
      )}
      <FormError message={err} />
    </Modal>
  );
};
