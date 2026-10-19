import React, { useEffect, useMemo, useState } from 'react';
import Modal from '../ui/Modal';
import { Button, cx } from '../ui/primitives';
import { Field, FormError, Input, SearchSelect, Segmented, Select } from '../ui/Form';
import Icon from '../ui/Icon';
import { useLedger } from '../../context/LedgerContext';
import { useAccountOptions } from './LedgerForms';
import { CURRENCIES, accountLabel, localIso } from '../../lib/ledger';
import { Cashbox, VoucherType, VOUCHER_LABELS, isDescendant } from '../../lib/erp';
import { formatNumber } from '../../lib/format';

/* ───────── صندوق جديد / تعديل ───────── */

export const CashboxFormModal: React.FC<{
  open: boolean;
  onClose: () => void;
  box?: Cashbox | null;
  /** لنسخ صندوق من الهاتف إلى المنصة */
  template?: Cashbox | null;
  onSaved?: (id: string) => void;
}> = ({ open, onClose, box, template, onSaved }) => {
  const { cashboxes, accounts, balances, saveCashbox, saveAccount, mainCurrency } = useLedger();
  const [name, setName] = useState('');
  const [parentId, setParentId] = useState('');
  const [currency, setCurrency] = useState('');
  const [rate, setRate] = useState('');
  const [cashMode, setCashMode] = useState<'new' | 'existing'>('new');
  const [cashAccountId, setCashAccountId] = useState('');
  const [linked, setLinked] = useState<string[]>([]);
  const [q, setQ] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const options = useAccountOptions();

  useEffect(() => {
    if (!open) return;
    const src = box || template;
    setErr(null);
    setQ('');
    setName(src?.name || '');
    setParentId(box?.parentId || '');
    setCurrency(src?.currency || '');
    setRate(src?.exchangeRate ? String(src.exchangeRate) : '');
    setCashMode(box?.cashAccountId ? 'existing' : 'new');
    setCashAccountId(box?.cashAccountId || '');
    setLinked(src?.linkedAccountIds || []);
  }, [open, box, template]);

  const parents = cashboxes.filter((b) => !box || (b.id !== box.id && !isDescendant(cashboxes, box.id, b.id)));
  const visible = useMemo(() => {
    const s = q.trim();
    return accounts.filter((a) => !s || a.name.includes(s) || a.id.includes(s) || a.code.includes(s));
  }, [accounts, q]);

  const toggle = (id: string) => setLinked((l) => (l.includes(id) ? l.filter((x) => x !== id) : [...l, id]));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return setErr('اسم الصندوق مطلوب');
    if (cashMode === 'existing' && !cashAccountId) return setErr('اختر حساب النقدية للصندوق');
    const r = Number(rate);
    if (rate && !(r > 0)) return setErr('سعر الصرف غير صالح');
    setBusy(true);
    try {
      let cashId = cashAccountId;
      if (cashMode === 'new') {
        cashId = await saveAccount({ name: `نقدية ${name.trim()}`, category: 'asset', type: 'cash' }, 'cash');
      }
      const id = await saveCashbox({
        id: box?.id,
        name,
        parentId: parentId || null,
        currency: currency || null,
        exchangeRate: rate ? r : null,
        cashAccountId: cashId,
        linkedAccountIds: linked.filter((x) => x !== cashId),
      });
      onSaved?.(id);
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
      size="lg"
      title={box ? `تعديل ${box.name}` : template ? `نسخ "${template.name}" من الهاتف` : 'صندوق جديد'}
      subtitle="رصيد الصندوق = رصيد حساب النقدية + أرصدة الحسابات المرتبطة + أرصدة الصناديق الفرعية"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            إلغاء
          </Button>
          <Button type="submit" form="box-form" disabled={busy}>
            {box ? 'حفظ' : 'إنشاء الصندوق'}
          </Button>
        </>
      }
    >
      <form id="box-form" onSubmit={submit} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="اسم الصندوق">
          <Input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="مثال: الصندوق الرئيسي" />
        </Field>
        <Field label="الصندوق الأب" hint="لبناء شجرة صناديق (فرع ← صندوق رئيسي)">
          <Select value={parentId} onChange={(e) => setParentId(e.target.value)}>
            <option value="">— صندوق رئيسي (جذر) —</option>
            {parents.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="عملة ثابتة" hint="تُقفل العملة في قيود الحسابات المرتبطة">
          <Select value={currency} onChange={(e) => setCurrency(e.target.value)}>
            <option value="">حرة</option>
            {Array.from(new Set([mainCurrency, ...CURRENCIES])).map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="سعر صرف ثابت" hint={`مقابل 1 ${mainCurrency} — فارغ = حر`}>
          <Input inputMode="decimal" value={rate} onChange={(e) => setRate(e.target.value.replace(/[^0-9.]/g, ''))} className="num" />
        </Field>

        <div className="sm:col-span-2">
          <span className="field-label">حساب النقدية</span>
          <Segmented
            value={cashMode}
            onChange={setCashMode}
            options={[
              { value: 'new', label: 'إنشاء حساب نقدية جديد' },
              { value: 'existing', label: 'استخدام حساب موجود' },
            ]}
          />
          <div className="mt-2">
            {cashMode === 'existing' ? (
              <SearchSelect value={cashAccountId} onChange={setCashAccountId} options={options} placeholder="اختر حساب النقدية" />
            ) : (
              <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-ink-subtle">
                سيُنشأ حساب "نقدية {name || '...'}" (أصول · نقدي) ويظهر على الهاتف. سندات القبض والصرف تُسجَّل عليه.
              </p>
            )}
          </div>
        </div>

        <div className="sm:col-span-2">
          <div className="mb-1.5 flex items-center justify-between">
            <span className="field-label mb-0">الحسابات المرتبطة ({formatNumber(linked.length, 0)})</span>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="بحث..."
              className="h-8 w-48 rounded-lg border border-line-strong px-3 text-xs"
            />
          </div>
          <div className="max-h-56 overflow-y-auto rounded-xl border border-line">
            {visible.map((a) => {
              const on = linked.includes(a.id);
              return (
                <button
                  type="button"
                  key={a.id}
                  onClick={() => toggle(a.id)}
                  className={cx(
                    'flex w-full items-center justify-between gap-3 border-b border-line px-3 py-2 text-start text-sm last:border-0',
                    on ? 'bg-brand-50' : 'hover:bg-slate-50',
                  )}
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <span
                      className={cx(
                        'grid h-4 w-4 shrink-0 place-items-center rounded border',
                        on ? 'border-brand-600 bg-brand-600 text-white' : 'border-line-strong',
                      )}
                    >
                      {on && <Icon name="check" size={12} />}
                    </span>
                    <span className="truncate">{accountLabel(a)}</span>
                  </span>
                  <span className="num shrink-0 text-xs text-ink-subtle">{formatNumber(balances[a.id]?.total || 0)}</span>
                </button>
              );
            })}
            {visible.length === 0 && <p className="px-3 py-6 text-center text-xs text-ink-subtle">لا توجد حسابات</p>}
          </div>
        </div>
      </form>
      <FormError message={err} />
    </Modal>
  );
};

/* ───────── سند قبض / صرف / تحويل ───────── */

export const VoucherFormModal: React.FC<{
  open: boolean;
  onClose: () => void;
  type: VoucherType;
  boxId?: string;
  partyId?: string;
}> = ({ open, onClose, type: initialType, boxId, partyId }) => {
  const { cashboxes, createVoucher, mainCurrency, accountsById } = useLedger();
  const options = useAccountOptions();
  const [type, setType] = useState<VoucherType>(initialType);
  const [box, setBox] = useState('');
  const [toBox, setToBox] = useState('');
  const [party, setParty] = useState('');
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState(mainCurrency);
  const [rate, setRate] = useState('1');
  const [date, setDate] = useState(localIso().slice(0, 16));
  const [statement, setStatement] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setErr(null);
    setType(initialType);
    setBox(boxId || cashboxes[0]?.id || '');
    setToBox('');
    setParty(partyId || '');
    setAmount('');
    setStatement('');
    setDate(localIso().slice(0, 16));
  }, [open, initialType, boxId, partyId, cashboxes]);

  const selectedBox = cashboxes.find((b) => b.id === box);
  useEffect(() => {
    setCurrency(selectedBox?.currency || mainCurrency);
    setRate(String(selectedBox?.exchangeRate || 1));
  }, [selectedBox, mainCurrency]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const value = Number(amount);
    const r = Number(rate);
    if (!selectedBox) return setErr('اختر الصندوق');
    if (!selectedBox.cashAccountId) return setErr('هذا الصندوق بلا حساب نقدية — عدّله وحدد حساب النقدية');
    if (type === 'transfer' && !toBox) return setErr('اختر الصندوق المستلم');
    if (type !== 'transfer' && !party) return setErr('اختر الطرف المقابل');
    if (type !== 'transfer' && party === selectedBox.cashAccountId) return setErr('الطرف المقابل هو حساب نقدية الصندوق نفسه');
    if (!(value > 0)) return setErr('أدخل مبلغاً أكبر من صفر');
    if (!(r > 0)) return setErr('سعر الصرف غير صالح');
    setBusy(true);
    try {
      await createVoucher({
        type,
        boxId: box,
        toBoxId: type === 'transfer' ? toBox : null,
        partyId: type === 'transfer' ? null : party,
        amount: value,
        currency,
        exchangeRate: r,
        statement,
        date: localIso(new Date(date)),
      });
      onClose();
    } catch (e: any) {
      setErr(e?.message || 'تعذّر الحفظ');
    } finally {
      setBusy(false);
    }
  };

  const effect =
    type === 'receipt'
      ? `+ على ${selectedBox?.name || 'الصندوق'} (لنا) و − على ${accountsById[party]?.name || 'الطرف'} (تخفيض ما عليه)`
      : type === 'payment'
        ? `− على ${selectedBox?.name || 'الصندوق'} و + على ${accountsById[party]?.name || 'الطرف'} (تخفيض ما له)`
        : `− على ${selectedBox?.name || 'الصندوق المرسل'} و + على ${cashboxes.find((b) => b.id === toBox)?.name || 'الصندوق المستلم'}`;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={VOUCHER_LABELS[type]}
      subtitle="ينشئ قيدين متقابلين يظهران على الهاتف فوراً"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            إلغاء
          </Button>
          <Button type="submit" form="voucher-form" disabled={busy || cashboxes.length === 0}>
            حفظ السند
          </Button>
        </>
      }
    >
      {cashboxes.length === 0 ? (
        <p className="rounded-lg bg-warning-50 px-4 py-3 text-sm text-warning-700">
          أنشئ صندوقاً أولاً من صفحة الصناديق، ثم سجّل السندات عليه.
        </p>
      ) : (
        <form id="voucher-form" onSubmit={submit} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Segmented
              value={type}
              onChange={setType}
              options={[
                { value: 'receipt', label: 'قبض', tone: 'success' },
                { value: 'payment', label: 'صرف', tone: 'danger' },
                { value: 'transfer', label: 'تحويل' },
              ]}
            />
          </div>
          <Field label={type === 'transfer' ? 'من صندوق' : 'الصندوق'}>
            <Select value={box} onChange={(e) => setBox(e.target.value)}>
              {cashboxes.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </Select>
          </Field>
          {type === 'transfer' ? (
            <Field label="إلى صندوق">
              <Select value={toBox} onChange={(e) => setToBox(e.target.value)}>
                <option value="">اختر...</option>
                {cashboxes
                  .filter((b) => b.id !== box)
                  .map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
              </Select>
            </Field>
          ) : (
            <Field label={type === 'receipt' ? 'مقبوض من' : 'مدفوع إلى'}>
              <SearchSelect value={party} onChange={setParty} options={options} placeholder="زبون، مورد، موظف، حساب..." />
            </Field>
          )}
          <Field label="المبلغ">
            <Input
              autoFocus
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ''))}
              className="num text-lg font-semibold"
              placeholder="0.00"
            />
          </Field>
          <Field label="العملة">
            <Select value={currency} onChange={(e) => setCurrency(e.target.value)} disabled={!!selectedBox?.currency}>
              {Array.from(new Set([mainCurrency, ...CURRENCIES, currency])).map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={`سعر الصرف مقابل 1 ${mainCurrency}`}>
            <Input
              inputMode="decimal"
              value={rate}
              disabled={!!selectedBox?.exchangeRate || currency === mainCurrency}
              onChange={(e) => setRate(e.target.value.replace(/[^0-9.]/g, ''))}
              className="num"
            />
          </Field>
          <Field label="التاريخ">
            <Input type="datetime-local" value={date} onChange={(e) => setDate(e.target.value)} className="num" />
          </Field>
          <Field label="البيان" className="sm:col-span-2">
            <Input value={statement} onChange={(e) => setStatement(e.target.value)} placeholder="مثال: دفعة من الحساب" />
          </Field>
          <p className="flex items-start gap-2 rounded-lg bg-slate-50 px-3 py-2 text-xs text-ink-subtle sm:col-span-2">
            <Icon name="link" size={14} className="mt-0.5 shrink-0" /> الأثر المحاسبي: {effect}
          </p>
        </form>
      )}
      <FormError message={err} />
    </Modal>
  );
};
