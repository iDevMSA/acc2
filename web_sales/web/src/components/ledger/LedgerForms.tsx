import React, { useEffect, useMemo, useState } from 'react';
import Modal from '../ui/Modal';
import { Button } from '../ui/primitives';
import { Field, FormError, Input, PickerOption, SearchSelect, Segmented, Select } from '../ui/Form';
import { useLedger } from '../../context/LedgerContext';
import {
  Account,
  CATEGORY_LABELS,
  CURRENCIES,
  Operation,
  ROLE_LABELS,
  TYPE_LABELS,
  accountLabel,
  localIso,
} from '../../lib/ledger';

export const useAccountOptions = (filter?: (a: Account) => boolean): PickerOption[] => {
  const { accounts } = useLedger();
  return useMemo(
    () =>
      accounts
        .filter((a) => !filter || filter(a))
        .map((a) => ({ value: a.id, label: accountLabel(a), hint: a.id })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [accounts],
  );
};

/* ───────── حساب جديد / تعديل حساب ───────── */

export const AccountFormModal: React.FC<{
  open: boolean;
  onClose: () => void;
  account?: Account | null;
  defaultRole?: string;
  onSaved?: (id: string) => void;
}> = ({ open, onClose, account, defaultRole, onSaved }) => {
  const { saveAccount, roleOf } = useLedger();
  const [form, setForm] = useState({
    name: '',
    code: '',
    phone: '',
    address: '',
    type: 'cash',
    category: 'other',
    role: 'general',
  });
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setErr(null);
    setForm({
      name: account?.name || '',
      code: account?.code || '',
      phone: account?.phone || '',
      address: account?.address || '',
      type: account?.type || (defaultRole === 'bank' ? 'bank' : 'cash'),
      category:
        account?.category ||
        (defaultRole === 'customer' || defaultRole === 'cash' || defaultRole === 'bank'
          ? 'asset'
          : defaultRole === 'supplier' || defaultRole === 'employee'
            ? 'liability'
            : 'other'),
      role: account ? roleOf(account.id) : defaultRole || 'general',
    });
  }, [open, account, defaultRole, roleOf]);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return setErr('اسم الحساب مطلوب');
    setBusy(true);
    try {
      const id = await saveAccount({ ...account, ...form, id: account?.id }, form.role);
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
      title={account ? 'تعديل الحساب' : 'حساب جديد'}
      subtitle={account ? `رقم الحساب ${account.id}` : 'يظهر على تطبيق الهاتف فور الحفظ'}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            إلغاء
          </Button>
          <Button type="submit" form="account-form" disabled={busy}>
            {account ? 'حفظ التعديلات' : 'إضافة الحساب'}
          </Button>
        </>
      }
    >
      <form id="account-form" onSubmit={submit} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="اسم الحساب" className="sm:col-span-2">
          <Input autoFocus value={form.name} onChange={set('name')} placeholder="مثال: محمد أحمد" />
        </Field>
        <Field label="رمز الحساب" hint="اختياري، مثل 1101">
          <Input value={form.code} onChange={set('code')} className="num" />
        </Field>
        <Field label="رقم الهاتف">
          <Input value={form.phone} onChange={set('phone')} className="num" dir="ltr" />
        </Field>
        <Field label="التصنيف المحاسبي">
          <Select value={form.category} onChange={set('category')}>
            {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="نوع الحساب">
          <Select value={form.type} onChange={set('type')}>
            {Object.entries(TYPE_LABELS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="الفهرس" hint="يحدد ظهوره في فهارس الزبائن والموردين والموظفين (في المنصة فقط)">
          <Select value={form.role} onChange={set('role')}>
            {Object.entries(ROLE_LABELS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="العنوان">
          <Input value={form.address} onChange={set('address')} />
        </Field>
      </form>
      <FormError message={err} />
    </Modal>
  );
};

/* ───────── قيد جديد / تعديل قيد ───────── */

const toInputDate = (iso?: string) => (iso ? iso.slice(0, 16) : localIso().slice(0, 16));

export const OperationFormModal: React.FC<{
  open: boolean;
  onClose: () => void;
  accountId?: string;
  operation?: Operation | null;
}> = ({ open, onClose, accountId, operation }) => {
  const { addOperations, updateOperation, mainCurrency, cashboxes, phoneCashboxes, accountsById } = useLedger();
  const options = useAccountOptions();
  const [acc, setAcc] = useState('');
  const [dir, setDir] = useState<'in' | 'out'>('in');
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState(mainCurrency);
  const [rate, setRate] = useState('1');
  const [statement, setStatement] = useState('');
  const [date, setDate] = useState(toInputDate());
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setErr(null);
    setAcc(operation?.accountId || accountId || '');
    setDir(operation && operation.amount < 0 ? 'out' : 'in');
    setAmount(operation ? String(Math.abs(operation.amount)) : '');
    setCurrency(operation?.currency || mainCurrency);
    setRate(String(operation?.exchangeRate ?? 1));
    setStatement(operation?.statement || '');
    setDate(toInputDate(operation?.date));
  }, [open, operation, accountId, mainCurrency]);

  // صندوق مرتبط بعملة/سعر ثابت يقفل الحقلين (نفس سلوك الهاتف)
  const lockedBox = useMemo(
    () =>
      [...cashboxes, ...phoneCashboxes].find(
        (b) => (b.linkedAccountIds.includes(acc) || b.cashAccountId === acc) && (b.currency || b.exchangeRate),
      ),
    [acc, cashboxes, phoneCashboxes],
  );
  useEffect(() => {
    if (!lockedBox || operation) return;
    if (lockedBox.currency) setCurrency(lockedBox.currency);
    if (lockedBox.exchangeRate) setRate(String(lockedBox.exchangeRate));
  }, [lockedBox, operation]);

  useEffect(() => {
    if (currency === mainCurrency && !lockedBox?.exchangeRate) setRate('1');
  }, [currency, mainCurrency, lockedBox]);

  const value = Number(amount) || 0;
  const r = Number(rate) || 0;
  const converted = r ? value / r : 0;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!acc) return setErr('اختر الحساب');
    if (!(value > 0)) return setErr('أدخل مبلغاً أكبر من صفر');
    if (!(r > 0)) return setErr('سعر الصرف غير صالح');
    const signed = dir === 'in' ? value : -value;
    const iso = localIso(new Date(date));
    try {
      if (operation) {
        await updateOperation({ ...operation, amount: signed, currency, exchangeRate: r, statement, date: iso });
      } else {
        await addOperations([{ accountId: acc, amount: signed, currency, exchangeRate: r, statement, date: iso }]);
      }
      onClose();
    } catch (e: any) {
      setErr(e?.message || 'تعذّر الحفظ');
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={operation ? 'تعديل القيد' : 'قيد جديد'}
      subtitle={acc ? accountLabel(accountsById[acc]) : 'يظهر على تطبيق الهاتف فور الحفظ'}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            إلغاء
          </Button>
          <Button type="submit" form="op-form">
            {operation ? 'حفظ التعديل' : 'إضافة القيد'}
          </Button>
        </>
      }
    >
      <form id="op-form" onSubmit={submit} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {!accountId && !operation && (
          <Field label="الحساب" className="sm:col-span-2">
            <SearchSelect value={acc} onChange={setAcc} options={options} placeholder="اختر الحساب" />
          </Field>
        )}
        <div className="sm:col-span-2">
          <Segmented
            value={dir}
            onChange={setDir}
            options={[
              { value: 'in', label: 'لنا (تحصيل +)', tone: 'success' },
              { value: 'out', label: 'لهم (صرف −)', tone: 'danger' },
            ]}
          />
        </div>
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
        <Field label="العملة" hint={lockedBox?.currency ? `مثبّتة من صندوق ${lockedBox.name}` : undefined}>
          <Select value={currency} onChange={(e) => setCurrency(e.target.value)} disabled={!!lockedBox?.currency}>
            {Array.from(new Set([mainCurrency, ...CURRENCIES, currency])).map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </Select>
        </Field>
        <Field
          label={`سعر الصرف (${currency} مقابل 1 ${mainCurrency})`}
          hint={`= ${converted.toFixed(2)} ${mainCurrency}`}
        >
          <Input
            inputMode="decimal"
            value={rate}
            disabled={!!lockedBox?.exchangeRate || currency === mainCurrency}
            onChange={(e) => setRate(e.target.value.replace(/[^0-9.]/g, ''))}
            className="num"
          />
        </Field>
        <Field label="التاريخ">
          <Input type="datetime-local" value={date} onChange={(e) => setDate(e.target.value)} className="num" />
        </Field>
        <Field label="البيان" className="sm:col-span-2">
          <Input value={statement} onChange={(e) => setStatement(e.target.value)} placeholder="وصف مختصر للقيد" />
        </Field>
      </form>
      <FormError message={err} />
    </Modal>
  );
};
