import React, { useEffect, useMemo, useState } from 'react';
import Modal from '../ui/Modal';
import { Button } from '../ui/primitives';
import { Field, FormError, Input, SearchSelect, Segmented, Select } from '../ui/Form';
import Icon from '../ui/Icon';
import { useLedger } from '../../context/LedgerContext';
import { useAccountOptions } from '../ledger/LedgerForms';
import { CURRENCIES, localIso } from '../../lib/ledger';
import { AccountNature, NATURE_LABELS, NOTE_LABELS, NoteKind, PayrollLine, payrollNet, rateOn } from '../../lib/trade';
import { formatNumber } from '../../lib/format';

const num = (v: string) => v.replace(/[^0-9.]/g, '');

/* ───────── الإشعار المدين / الدائن ───────── */

export const NoteFormModal: React.FC<{ open: boolean; onClose: () => void; kind: NoteKind; partyId?: string }> = ({
  open,
  onClose,
  kind: initialKind,
  partyId,
}) => {
  const { createNote, mainCurrency, rates, settings, accountsById } = useLedger();
  const options = useAccountOptions();
  const [kind, setKind] = useState<NoteKind>(initialKind);
  const [party, setParty] = useState('');
  const [counter, setCounter] = useState('');
  const [amount, setAmount] = useState('');
  const [vat, setVat] = useState('');
  const [currency, setCurrency] = useState(mainCurrency);
  const [rate, setRate] = useState('1');
  const [date, setDate] = useState(localIso().slice(0, 16));
  const [statement, setStatement] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setErr(null);
    setKind(initialKind);
    setParty(partyId || '');
    setCounter(settings.salesAccountId || '');
    setAmount('');
    setVat('');
    setCurrency(mainCurrency);
    setRate('1');
    setStatement('');
    setDate(localIso().slice(0, 16));
  }, [open, initialKind, partyId, mainCurrency, settings.salesAccountId]);

  useEffect(() => {
    if (currency === mainCurrency) return setRate('1');
    const r = rateOn(rates, currency, date);
    if (r) setRate(String(r));
  }, [currency, date, rates, mainCurrency]);

  const a = Number(amount) || 0;
  const v = a * ((Number(vat) || 0) / 100);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (party && party === counter) return setErr('الطرف والحساب المقابل لا يمكن أن يكونا نفس الحساب');
    setBusy(true);
    try {
      await createNote({
        kind,
        partyId: party,
        counterAccountId: counter,
        amount: a,
        currency,
        exchangeRate: Number(rate) || 1,
        vatPct: Number(vat) || 0,
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

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title={NOTE_LABELS[kind]}
      subtitle="الإشعار المدين يزيد ما لنا على الطرف، والدائن يخفّضه (خصم مسموح به، تسوية، فرق سعر...)"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            إلغاء
          </Button>
          <Button type="submit" form="note-form" disabled={busy}>
            حفظ وترحيل
          </Button>
        </>
      }
    >
      <form id="note-form" onSubmit={submit} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Segmented
            value={kind}
            onChange={setKind}
            options={[
              { value: 'debit', label: 'إشعار مدين (لنا)', tone: 'success' },
              { value: 'credit', label: 'إشعار دائن (لهم)', tone: 'danger' },
            ]}
          />
        </div>
        <Field label="الطرف (زبون / مورد)">
          <SearchSelect value={party} onChange={setParty} options={options} placeholder="اختر الحساب" />
        </Field>
        <Field label="الحساب المقابل" hint="مثل: المبيعات، الخصم المسموح به، إيرادات متنوعة">
          <SearchSelect value={counter} onChange={setCounter} options={options} placeholder="اختر الحساب" />
        </Field>
        <Field label="المبلغ (قبل الضريبة)">
          <Input inputMode="decimal" value={amount} onChange={(e) => setAmount(num(e.target.value))} className="num" />
        </Field>
        <Field label="الضريبة المضافة %">
          <Input inputMode="decimal" value={vat} onChange={(e) => setVat(num(e.target.value))} className="num" />
        </Field>
        <Field label="العملة">
          <Select value={currency} onChange={(e) => setCurrency(e.target.value)}>
            {Array.from(new Set([mainCurrency, ...CURRENCIES])).map((c) => (
              <option key={c}>{c}</option>
            ))}
          </Select>
        </Field>
        <Field label="سعر الصرف">
          <Input inputMode="decimal" value={rate} disabled={currency === mainCurrency} onChange={(e) => setRate(num(e.target.value))} className="num" />
        </Field>
        <Field label="التاريخ">
          <Input type="datetime-local" value={date} onChange={(e) => setDate(e.target.value)} className="num" />
        </Field>
        <Field label="البيان">
          <Input value={statement} onChange={(e) => setStatement(e.target.value)} />
        </Field>
        {a > 0 && (
          <p className="flex items-start gap-2 rounded-lg bg-slate-50 px-3 py-2 text-xs text-ink-subtle sm:col-span-2">
            <Icon name="link" size={14} className="mt-0.5 shrink-0" />
            {kind === 'debit' ? '+' : '−'}
            {formatNumber(a + v)} على {accountsById[party]?.name || 'الطرف'} و {kind === 'debit' ? '−' : '+'}
            {formatNumber(a)} على {accountsById[counter]?.name || 'الحساب المقابل'}
            {v > 0 ? ` و ${kind === 'debit' ? '−' : '+'}${formatNumber(v)} ضريبة` : ''} ({currency})
          </p>
        )}
      </form>
      <FormError message={err} />
    </Modal>
  );
};

/* ───────── سعر عملة ───────── */

export const RateFormModal: React.FC<{ open: boolean; onClose: () => void; currency?: string }> = ({ open, onClose, currency: initial }) => {
  const { saveRate, mainCurrency } = useLedger();
  const [currency, setCurrency] = useState('');
  const [rate, setRate] = useState('');
  const [date, setDate] = useState(localIso().slice(0, 16));
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setErr(null);
    setCurrency(initial || CURRENCIES.find((c) => c !== mainCurrency) || 'USD');
    setRate('');
    setDate(localIso().slice(0, 16));
  }, [open, initial, mainCurrency]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (currency === mainCurrency) return setErr('سعر العملة الرئيسية ثابت = 1');
    try {
      await saveRate({ currency, rate: Number(rate), date: localIso(new Date(date)) });
      onClose();
    } catch (e: any) {
      setErr(e?.message || 'تعذّر الحفظ');
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="sm"
      title="تسجيل سعر عملة"
      subtitle="يُستخدم تلقائياً في الفواتير والإشعارات والكشوف حسب التاريخ والساعة"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            إلغاء
          </Button>
          <Button type="submit" form="rate-form">
            حفظ
          </Button>
        </>
      }
    >
      <form id="rate-form" onSubmit={submit} className="grid grid-cols-1 gap-4">
        <Field label="العملة">
          <Select value={currency} onChange={(e) => setCurrency(e.target.value)}>
            {CURRENCIES.filter((c) => c !== mainCurrency).map((c) => (
              <option key={c}>{c}</option>
            ))}
          </Select>
        </Field>
        <Field label={`السعر: كم ${currency} تساوي 1 ${mainCurrency}`}>
          <Input autoFocus inputMode="decimal" value={rate} onChange={(e) => setRate(num(e.target.value))} className="num" />
        </Field>
        <Field label="التاريخ والساعة">
          <Input type="datetime-local" value={date} onChange={(e) => setDate(e.target.value)} className="num" />
        </Field>
      </form>
      <FormError message={err} />
    </Modal>
  );
};

/* ───────── بيانات الحساب الإضافية (الموازنة، الطبيعة، التجميد، الخصم، حد الائتمان، بيانات الموظف) ───────── */

export const AccountExtraModal: React.FC<{ open: boolean; onClose: () => void; accountId: string }> = ({ open, onClose, accountId }) => {
  const { accountMeta, accountsById, saveAccountMeta, roleOf, mainCurrency } = useLedger();
  const options = useAccountOptions((a) => a.category === 'expense');
  const meta = accountMeta[accountId] || {};
  const isEmployee = roleOf(accountId) === 'employee';
  const [f, setF] = useState({
    budget: '',
    nature: 'both' as AccountNature,
    frozen: false,
    discountPct: '',
    creditLimit: '',
    note: '',
    jobTitle: '',
    hireDate: '',
    salary: '',
    allowances: '',
    deductions: '',
    children: '',
    nationalId: '',
    salaryAccountId: '',
  });
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setErr(null);
    const e = meta.employee || {};
    setF({
      budget: meta.budget ? String(meta.budget) : '',
      nature: meta.nature || 'both',
      frozen: !!meta.frozen,
      discountPct: meta.discountPct ? String(meta.discountPct) : '',
      creditLimit: meta.creditLimit ? String(meta.creditLimit) : '',
      note: meta.note || '',
      jobTitle: e.jobTitle || '',
      hireDate: e.hireDate || '',
      salary: e.salary ? String(e.salary) : '',
      allowances: e.allowances ? String(e.allowances) : '',
      deductions: e.deductions ? String(e.deductions) : '',
      children: e.children ? String(e.children) : '',
      nationalId: e.nationalId || '',
      salaryAccountId: e.salaryAccountId || '',
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, accountId]);

  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF((x) => ({ ...x, [k]: e.target.value }));
  const setNum = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF((x) => ({ ...x, [k]: num(e.target.value) }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await saveAccountMeta(accountId, {
        budget: Number(f.budget) || null,
        nature: f.nature === 'both' ? null : f.nature,
        frozen: f.frozen || null,
        discountPct: Number(f.discountPct) || null,
        creditLimit: Number(f.creditLimit) || null,
        note: f.note,
        ...(isEmployee
          ? {
              employee: {
                jobTitle: f.jobTitle,
                hireDate: f.hireDate,
                salary: Number(f.salary) || 0,
                allowances: Number(f.allowances) || 0,
                deductions: Number(f.deductions) || 0,
                children: Number(f.children) || 0,
                nationalId: f.nationalId,
                salaryAccountId: f.salaryAccountId || null,
              },
            }
          : {}),
      } as any);
      onClose();
    } catch (e: any) {
      setErr(e?.message || 'تعذّر الحفظ');
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title={`بيانات إضافية — ${accountsById[accountId]?.name || ''}`}
      subtitle="تُحفظ في المنصة فقط ولا تغيّر بيانات الحساب على الهاتف"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            إلغاء
          </Button>
          <Button type="submit" form="extra-form">
            حفظ
          </Button>
        </>
      }
    >
      <form id="extra-form" onSubmit={submit} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label={`الموازنة السنوية (${mainCurrency})`} hint="الرصيد التقديري — تقرير «الحسابات التي تعدّت الموازنة» ينبّهك">
          <Input inputMode="decimal" value={f.budget} onChange={setNum('budget')} className="num" />
        </Field>
        <Field label="طبيعة الحساب" hint="تقرير «حسابات اختلفت أرصدتها عن طبيعتها» يكشف المخالفات">
          <Select value={f.nature} onChange={(e) => setF((x) => ({ ...x, nature: e.target.value as AccountNature }))}>
            {(Object.keys(NATURE_LABELS) as AccountNature[]).map((n) => (
              <option key={n} value={n}>
                {NATURE_LABELS[n]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="خصم تجاري افتراضي %" hint="يُقترح تلقائياً في فواتير هذا الطرف">
          <Input inputMode="decimal" value={f.discountPct} onChange={setNum('discountPct')} className="num" />
        </Field>
        <Field label={`حد الائتمان (${mainCurrency})`} hint="تنبيه عند تجاوزه في فاتورة بيع">
          <Input inputMode="decimal" value={f.creditLimit} onChange={setNum('creditLimit')} className="num" />
        </Field>
        <label className="flex items-center gap-3 rounded-lg border border-line px-3 py-2.5 text-sm sm:col-span-2">
          <input type="checkbox" checked={f.frozen} onChange={(e) => setF((x) => ({ ...x, frozen: e.target.checked }))} className="h-4 w-4" />
          <span>
            <b>تجميد الحساب</b> — منع إدخال قيود أو سندات أو فواتير جديدة عليه من المنصة
          </span>
        </label>
        <Field label="ملاحظات الحساب" className="sm:col-span-2">
          <Input value={f.note} onChange={set('note')} />
        </Field>
        {isEmployee && (
          <>
            <p className="mt-2 text-sm font-semibold text-ink sm:col-span-2">بيانات الموظف</p>
            <Field label="الوظيفة">
              <Input value={f.jobTitle} onChange={set('jobTitle')} />
            </Field>
            <Field label="تاريخ التوظيف">
              <Input type="date" value={f.hireDate} onChange={set('hireDate')} className="num" />
            </Field>
            <Field label="الراتب الأساسي الشهري">
              <Input inputMode="decimal" value={f.salary} onChange={setNum('salary')} className="num" />
            </Field>
            <Field label="البدلات الشهرية">
              <Input inputMode="decimal" value={f.allowances} onChange={setNum('allowances')} className="num" />
            </Field>
            <Field label="الاستقطاعات الشهرية (ضمان، ضريبة دخل...)">
              <Input inputMode="decimal" value={f.deductions} onChange={setNum('deductions')} className="num" />
            </Field>
            <Field label="عدد الأبناء">
              <Input inputMode="numeric" value={f.children} onChange={setNum('children')} className="num" />
            </Field>
            <Field label="رقم الهوية">
              <Input value={f.nationalId} onChange={set('nationalId')} className="num" />
            </Field>
            <Field label="حساب مصروف رواتبه" hint="فارغ = حساب «الرواتب والأجور» العام">
              <SearchSelect value={f.salaryAccountId} onChange={(v) => setF((x) => ({ ...x, salaryAccountId: v }))} options={options} allowEmpty />
            </Field>
          </>
        )}
      </form>
      <FormError message={err} />
    </Modal>
  );
};

/* ───────── كشف رواتب شهري ───────── */

export const PayrollFormModal: React.FC<{ open: boolean; onClose: () => void }> = ({ open, onClose }) => {
  const { accounts, roleOf, accountMeta, cashboxes, createPayroll, mainCurrency } = useLedger();
  const employees = useMemo(() => accounts.filter((a) => roleOf(a.id) === 'employee'), [accounts, roleOf]);
  const [month, setMonth] = useState(localIso().slice(0, 7));
  const [payment, setPayment] = useState<'cash' | 'post'>('post');
  const [cashboxId, setCashboxId] = useState('');
  const [rows, setRows] = useState<Record<string, Record<string, string>>>({});
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setErr(null);
    setMonth(localIso().slice(0, 7));
    setCashboxId(cashboxes[0]?.id || '');
    const r: Record<string, Record<string, string>> = {};
    employees.forEach((e) => {
      const info = accountMeta[e.id]?.employee || {};
      r[e.id] = {
        basic: info.salary ? String(info.salary) : '',
        allowances: info.allowances ? String(info.allowances) : '',
        overtime: '',
        deductions: info.deductions ? String(info.deductions) : '',
        advances: '',
      };
    });
    setRows(r);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const lines: PayrollLine[] = employees.map((e) => {
    const r = rows[e.id] || {};
    const base = {
      employeeId: e.id,
      basic: Number(r.basic) || 0,
      allowances: Number(r.allowances) || 0,
      overtime: Number(r.overtime) || 0,
      deductions: Number(r.deductions) || 0,
      advances: Number(r.advances) || 0,
    };
    return { ...base, net: payrollNet(base) };
  });
  const total = lines.reduce((s, l) => s + l.net, 0);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await createPayroll({
        month,
        // آخر يوم في الشهر، أو الآن إن كان الشهر الحالي (لا قيود بتاريخ مستقبلي)
        date: (() => {
          const [y, m] = month.split('-').map(Number);
          const end = localIso(new Date(y, m, 0, 12));
          const now = localIso();
          return end < now ? end : now;
        })(),
        currency: mainCurrency,
        exchangeRate: 1,
        lines,
        payment,
        cashboxId: payment === 'cash' ? cashboxId : null,
        statement: '',
      });
      onClose();
    } catch (e: any) {
      setErr(e?.message || 'تعذّر الحفظ');
    } finally {
      setBusy(false);
    }
  };

  const cols: Array<[string, string]> = [
    ['basic', 'الأساسي'],
    ['allowances', 'البدلات'],
    ['overtime', 'إضافي'],
    ['deductions', 'استقطاعات'],
    ['advances', 'سلف'],
  ];

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="xl"
      title="كشف رواتب شهري"
      subtitle="يُرحَّل مصروف الرواتب على حسابه، والمستحق لحساب كل موظف، ويُصرف نقداً من الصندوق إن اخترت ذلك"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            إلغاء
          </Button>
          <Button type="submit" form="payroll-form" disabled={busy || !employees.length}>
            حفظ وترحيل
          </Button>
        </>
      }
    >
      {!employees.length ? (
        <p className="rounded-lg bg-warning-50 px-4 py-3 text-sm text-warning-700">
          لا يوجد موظفون. اجعل دور حساب «موظف» من نافذة الحسابات، ثم أدخل راتبه من «بيانات إضافية».
        </p>
      ) : (
        <form id="payroll-form" onSubmit={submit} className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Field label="الشهر">
              <Input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="num" />
            </Field>
            <div>
              <span className="field-label">طريقة الصرف</span>
              <Segmented
                value={payment}
                onChange={setPayment}
                options={[
                  { value: 'post', label: 'ترحيل لحساباتهم' },
                  { value: 'cash', label: 'صرف نقدي' },
                ]}
              />
            </div>
            {payment === 'cash' && (
              <Field label="الصندوق">
                <Select value={cashboxId} onChange={(e) => setCashboxId(e.target.value)}>
                  {cashboxes.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </Select>
              </Field>
            )}
          </div>
          <div className="overflow-x-auto rounded-xl border border-line">
            <table className="table-base min-w-[760px]">
              <thead>
                <tr>
                  <th>الموظف</th>
                  {cols.map(([, l]) => (
                    <th key={l} className="w-28 text-end">
                      {l}
                    </th>
                  ))}
                  <th className="w-28 text-end">الصافي</th>
                </tr>
              </thead>
              <tbody>
                {employees.map((e, i) => (
                  <tr key={e.id} className="hover:bg-transparent">
                    <td>
                      <p className="font-medium">{e.name}</p>
                      <p className="text-xs text-ink-subtle">{accountMeta[e.id]?.employee?.jobTitle || ''}</p>
                    </td>
                    {cols.map(([k]) => (
                      <td key={k}>
                        <input
                          inputMode="decimal"
                          value={rows[e.id]?.[k] || ''}
                          onChange={(ev) => setRows((r) => ({ ...r, [e.id]: { ...r[e.id], [k]: num(ev.target.value) } }))}
                          className="num h-9 w-full rounded-lg border border-line-strong bg-surface px-2 text-end text-sm"
                        />
                      </td>
                    ))}
                    <td className="text-end">
                      <span className="num font-semibold">{formatNumber(lines[i].net)}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={cols.length + 1}>إجمالي صافي الرواتب</td>
                  <td className="text-end">
                    <span className="num">{formatNumber(total)}</span> <span className="text-xs text-ink-subtle">{mainCurrency}</span>
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
          <p className="text-xs text-ink-subtle">
            السلف المصروفة سابقاً للموظف تبقى على حسابه (لنا)، وخصمها هنا يقلّل المبلغ المصروف نقداً فقط فيتسوّى رصيده تلقائياً.
          </p>
        </form>
      )}
      <FormError message={err} />
    </Modal>
  );
};

/* ───────── إقفال الفترة المالية ───────── */

export const ClosePeriodModal: React.FC<{ open: boolean; onClose: () => void }> = ({ open, onClose }) => {
  const { closePeriod, settings } = useLedger();
  const options = useAccountOptions((a) => a.category === 'equity' || a.category === 'liability' || a.category === 'other');
  const [until, setUntil] = useState(`${new Date().getFullYear() - 1}-12-31`);
  const [retained, setRetained] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setErr(null);
    setDone(null);
    setRetained(settings.retainedEarningsAccountId || '');
  }, [open, settings.retainedEarningsAccountId]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      setDone(await closePeriod(until, retained));
    } catch (e: any) {
      setErr(e?.message || 'تعذّر الإقفال');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="md"
      title="ترحيل وإقفال الفترة المالية"
      subtitle="يصفّر أرصدة الإيرادات والمصروفات حتى التاريخ بقيد إقفال، ويرحّل صافي الربح أو الخسارة لحساب الأرباح المدوّرة، ثم يمنع القيود بتاريخ سابق"
      footer={
        done !== null ? (
          <Button onClick={onClose}>تم</Button>
        ) : (
          <>
            <Button variant="ghost" onClick={onClose}>
              إلغاء
            </Button>
            <Button type="submit" form="close-form" variant="danger" disabled={busy}>
              إقفال الفترة
            </Button>
          </>
        )
      }
    >
      {done !== null ? (
        <p className="flex items-center gap-2 rounded-lg bg-success-50 px-3 py-3 text-sm text-success-700">
          <Icon name="check" size={16} /> تم الإقفال بـ {done} قيد. الفترة مُقفلة حتى {until}.
        </p>
      ) : (
        <form id="close-form" onSubmit={submit} className="grid grid-cols-1 gap-4">
          {settings.closedUntil && (
            <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-ink-subtle">آخر إقفال: حتى {settings.closedUntil}</p>
          )}
          <Field label="إقفال حتى تاريخ">
            <Input type="date" value={until} onChange={(e) => setUntil(e.target.value)} className="num" />
          </Field>
          <Field label="حساب الأرباح المدوّرة / رأس المال" hint="حساب من حقوق الملكية يستقبل نتيجة الفترة">
            <SearchSelect value={retained} onChange={setRetained} options={options} placeholder="اختر الحساب" />
          </Field>
          <p className="flex items-start gap-2 rounded-lg bg-warning-50 px-3 py-2 text-xs text-warning-700">
            <Icon name="alert" size={14} className="mt-0.5 shrink-0" />
            قيود الإقفال تظهر على الهاتف أيضاً. يمكن التراجع بحذفها من نافذة القيود، لكن لا تُقفل الفترة قبل مراجعة ميزان المراجعة.
          </p>
        </form>
      )}
      <FormError message={err} />
    </Modal>
  );
};
