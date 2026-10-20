import React, { useEffect, useState } from 'react';
import { useLedger } from '../context/LedgerContext';
import { useApp } from '../context/AppContext';
import { Badge, Button, Card, CardHeader, PageHeader } from '../components/ui/primitives';
import { Field, FormError, Input, Select } from '../components/ui/Form';
import { ConfirmModal } from '../components/ui/Modal';
import Icon from '../components/ui/Icon';
import { CURRENCIES, totalsOf } from '../lib/ledger';
import { formatDate, formatNumber } from '../lib/format';
import { onLastSync } from '../lib/offlineStore';

const Settings: React.FC = () => {
  const { user } = useApp();
  const {
    company,
    saveCompany,
    mainCurrency,
    saveSettings,
    accounts,
    operations,
    orphanOperations,
    deleteOperations,
    ready,
  } = useLedger();
  const [form, setForm] = useState(company);
  const [currency, setCurrency] = useState(mainCurrency);
  const [saved, setSaved] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [confirmClean, setConfirmClean] = useState(false);
  const [lastSync, setLastSync] = useState<number | null>(null);

  useEffect(() => onLastSync(setLastSync), []);
  useEffect(() => setForm(company), [company.name, company.phone, company.address, company.email]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => setCurrency(mainCurrency), [mainCurrency]);

  const flash = (m: string) => {
    setSaved(m);
    setTimeout(() => setSaved(null), 2500);
  };

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const saveCo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return setErr('اسم الشركة مطلوب');
    setErr(null);
    try {
      await saveCompany(form);
      flash('تم حفظ معلومات الشركة — ستظهر على الهاتف عند المزامنة التالية');
    } catch (e: any) {
      setErr(e?.message || 'تعذّر الحفظ');
    }
  };

  const totals = totalsOf(operations);
  const orphanTotal = orphanOperations.reduce((s, o) => s + o.amountUSD, 0);

  return (
    <>
      <PageHeader title="الإعدادات" description="معلومات الشركة والعملة الرئيسية وحالة المزامنة مع تطبيق الهاتف" />

      {saved && (
        <p className="mb-4 flex items-center gap-2 rounded-lg bg-success-50 px-4 py-3 text-sm text-success-700">
          <Icon name="check" size={16} /> {saved}
        </p>
      )}

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader title="معلومات الشركة" subtitle="تظهر في ترويسة التقارير وكشوف الحساب، وتتزامن مع التطبيق" />
          <form onSubmit={saveCo} className="grid grid-cols-1 gap-4 p-5 sm:grid-cols-2">
            <Field label="اسم الشركة" className="sm:col-span-2">
              <Input value={form.name} onChange={set('name')} />
            </Field>
            <Field label="الهاتف">
              <Input value={form.phone} onChange={set('phone')} dir="ltr" className="num" />
            </Field>
            <Field label="البريد الإلكتروني">
              <Input value={form.email} onChange={set('email')} dir="ltr" />
            </Field>
            <Field label="العنوان" className="sm:col-span-2">
              <Input value={form.address} onChange={set('address')} />
            </Field>
            <div className="sm:col-span-2">
              <FormError message={err} />
              <Button type="submit" className="mt-1">
                حفظ معلومات الشركة
              </Button>
            </div>
          </form>
        </Card>

        <Card>
          <CardHeader
            title="العملة الرئيسية"
            subtitle="العملة التي تُحسب بها الأرصدة والتقارير. يجب أن تطابق العملة الرئيسية في تطبيق الهاتف"
          />
          <div className="space-y-4 p-5">
            <Field
              label="العملة الرئيسية"
              hint="سعر الصرف في كل قيد = كم وحدة من عملة القيد تساوي 1 من العملة الرئيسية (كما في التطبيق)"
            >
              <Select value={currency} onChange={(e) => setCurrency(e.target.value)}>
                {Array.from(new Set([mainCurrency, ...CURRENCIES])).map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </Select>
            </Field>
            <Button
              disabled={currency === mainCurrency}
              onClick={() => saveSettings({ mainCurrency: currency }).then(() => flash('تم تغيير العملة الرئيسية'))}
            >
              حفظ العملة
            </Button>
          </div>
        </Card>

        <Card className="xl:col-span-2">
          <CardHeader
            title="حالة المزامنة مع التطبيق"
            subtitle="البيانات تُقرأ مباشرة من السحابة (users/{uid}/accounts و operations) التي يرفع إليها التطبيق"
            actions={ready ? <Badge tone="success">متصل</Badge> : <Badge tone="warning">جاري التحميل</Badge>}
          />
          <div className="grid grid-cols-2 gap-4 p-5 md:grid-cols-4">
            <Info label="الحسابات في السحابة" value={formatNumber(accounts.length, 0)} />
            <Info label="القيود المحتسبة" value={formatNumber(operations.length, 0)} />
            <Info
              label={`الرصيد الصافي (${mainCurrency})`}
              value={formatNumber(totals.net)}
              hint="يجب أن يساوي الرصيد الإجمالي في التطبيق"
            />
            <Info label="آخر تحديث من السحابة" value={lastSync ? formatDate(lastSync, { timeStyle: 'medium' }) : '—'} />
          </div>
          {orphanOperations.length > 0 && (
            <div className="mx-5 mb-5 rounded-xl border border-warning-100 bg-warning-50 p-4 text-sm text-warning-700">
              <p className="font-semibold">
                {formatNumber(orphanOperations.length, 0)} قيد في السحابة لحسابات محذوفة (مجموعها{' '}
                <span className="num">{formatNumber(orphanTotal)}</span> {mainCurrency})
              </p>
              <p className="mt-1 text-xs leading-5">
                حذفها التطبيق من الهاتف مع حساباتها لكنها بقيت في السحابة، لذلك لا تدخل في الأرصدة هنا حتى تطابق الهاتف.
                يمكنك حذفها من السحابة نهائياً.
              </p>
              <Button size="sm" variant="secondary" className="mt-3" onClick={() => setConfirmClean(true)}>
                حذفها من السحابة
              </Button>
            </div>
          )}
          <p className="px-5 pb-5 text-xs text-ink-subtle">
            رقم الحساب في السحابة: <span className="num">{user?.uid}</span> · {user?.email}
          </p>
        </Card>
      </div>

      <ConfirmModal
        open={confirmClean}
        onClose={() => setConfirmClean(false)}
        title="حذف قيود الحسابات المحذوفة"
        message={`سيُحذف ${orphanOperations.length} قيد من السحابة نهائياً. هذه القيود لا تظهر في التطبيق أصلاً.`}
        onConfirm={() => deleteOperations(orphanOperations.map((o) => o.id)).then(() => flash('تم التنظيف'))}
      />
    </>
  );
};

const Info: React.FC<{ label: string; value: string; hint?: string }> = ({ label, value, hint }) => (
  <div className="rounded-xl bg-slate-50 px-4 py-3">
    <p className="text-xs text-ink-subtle">{label}</p>
    <p className="num mt-1 text-lg font-semibold text-ink">{value}</p>
    {hint && <p className="mt-0.5 text-[11px] text-ink-subtle">{hint}</p>}
  </div>
);

export default Settings;
