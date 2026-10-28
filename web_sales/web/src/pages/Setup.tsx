import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Badge, Button, Card, CardHeader, PageHeader, cx } from '../components/ui/primitives';
import { Field, FormError, Input, Segmented, Select } from '../components/ui/Form';
import DataTable, { Column } from '../components/ui/DataTable';
import Icon from '../components/ui/Icon';
import { useApp } from '../context/AppContext';
import { useLedger } from '../context/LedgerContext';
import { useTaxSettings } from '../hooks/useTaxSettings';
import { CATEGORY_LABELS } from '../lib/ledger';
import { formatPercent } from '../lib/format';
import { buildChartTemplate, CHAPTER_LABELS, ChartPlanRow, planChart, SettingKey } from '../lib/coaTemplates';
import {
  Activity,
  ACTIVITY_LABELS,
  amountInWords,
  BusinessProfile,
  CalendarMode,
  COUNTRY_PROFILES,
  findCountryProfile,
  fiscalYearOf,
  formatOfficialDate,
  MONTHS_AR,
  Sector,
  SECTOR_LABELS,
  suggestedProfile,
} from '../lib/localization';
import { findTaxCountry } from '../tax/countries';
import { accountLimitError } from '../lib/subscription';

const SETTING_LABELS: Record<SettingKey, string> = {
  salesAccountId: 'حساب المبيعات في الفواتير',
  purchasesAccountId: 'حساب المشتريات في الفواتير',
  cogsAccountId: 'حساب تكلفة البضاعة المباعة',
  vatAccountId: 'حساب الضريبة في الفواتير',
  salariesAccountId: 'حساب الرواتب في المسيرات',
  payrollDeductionsAccountId: 'حساب استقطاعات الرواتب',
  retainedEarningsAccountId: 'حساب قيد الإقفال السنوي',
  chequesInAccountId: 'حساب الشيكات الواردة',
  chequesOutAccountId: 'حساب الشيكات الصادرة',
};

// معالج إعداد المنشأة: الدولة والقطاع والنشاط ← السنة المالية والتقويم والضريبة ودليل الحسابات
const Setup: React.FC = () => {
  const { ownerUid, webAccess } = useApp();
  const { accounts, operations, profile, applySetup, mainCurrency, settings, ready } = useLedger();
  const tax = useTaxSettings(ownerUid);
  const [draft, setDraft] = useState<BusinessProfile>(() => profile || suggestedProfile('SA', 'private'));
  const [unchecked, setUnchecked] = useState<Set<string>>(new Set());
  const [applyTax, setApplyTax] = useState(true);
  const [applyCurrency, setApplyCurrency] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  // أول تحميل للإعداد المحفوظ
  const savedAt = profile?.setupAt;
  useEffect(() => {
    if (profile) setDraft(profile);
  }, [savedAt]); // eslint-disable-line react-hooks/exhaustive-deps

  const country = findCountryProfile(draft.country);
  const taxCountry = findTaxCountry(draft.country);
  const fy = fiscalYearOf(new Date(), draft.fiscalYearStartMonth);
  const template = useMemo(() => buildChartTemplate(draft), [draft]);
  const plan = useMemo(() => planChart(template, accounts), [template, accounts]);
  const chosen = plan.filter((r) => r.existing || !unchecked.has(r.tpl.code));
  const toCreate = chosen.filter((r) => !r.existing).length;
  const limitMsg = accountLimitError(webAccess, accounts.length, toCreate);
  const taxDiffers = tax.settings?.countryCode !== draft.country;
  const canChangeCurrency = !operations.length && !!country && country.currency !== mainCurrency;

  const pick = (country: string, sector: Sector, activity: Activity = draft.activity) => {
    const s = suggestedProfile(country, sector, activity);
    setDraft((d) => ({ ...s, crNumber: d.crNumber }));
    setUnchecked(new Set());
    setDone(null);
  };

  const run = async () => {
    setBusy(true);
    setErr(null);
    setDone(null);
    try {
      const res = await applySetup({
        profile: draft,
        rows: chosen,
        mainCurrency: canChangeCurrency && applyCurrency ? country!.currency : undefined,
      });
      if (applyTax && taxDiffers && taxCountry) {
        await tax.save({
          countryCode: taxCountry.code,
          trn: tax.settings?.trn || '',
          standardRate: taxCountry.standardRate,
          reducedRates: taxCountry.reducedRates,
          hasVat: taxCountry.hasVat,
          taxName: taxCountry.taxName,
          filing: taxCountry.filing,
        });
      }
      setDone(
        `حُفظ إعداد المنشأة. أُنشئ ${res.created} حساباً${res.linked ? `، ورُبط ${res.linked} من حسابات الإعدادات` : ''}${applyTax && taxDiffers ? '، وضُبطت الضريبة' : ''}.`,
      );
    } catch (e: any) {
      setErr(e?.message || 'تعذّر تطبيق الإعداد');
    } finally {
      setBusy(false);
    }
  };

  const columns: Column<ChartPlanRow>[] = [
    {
      key: 'c',
      header: '',
      render: (r) =>
        r.existing ? (
          <Icon name="check" size={16} className="text-success-600" />
        ) : (
          <input
            type="checkbox"
            aria-label={`إنشاء ${r.tpl.name}`}
            className="h-4 w-4 accent-brand-600"
            checked={!unchecked.has(r.tpl.code)}
            onChange={(e) =>
              setUnchecked((s) => {
                const n = new Set(s);
                if (e.target.checked) n.delete(r.tpl.code);
                else n.add(r.tpl.code);
                return n;
              })
            }
          />
        ),
    },
    {
      key: 'k',
      header: 'الكود',
      render: (r) => <span className="num text-xs text-ink-subtle">{r.codeTaken ? '—' : r.tpl.code}</span>,
    },
    {
      key: 'n',
      header: 'الحساب',
      className: 'min-w-[12rem]',
      render: (r) => (
        <div>
          <p className="text-sm text-ink">{r.tpl.name}</p>
          {r.tpl.chapter && <p className="text-xs text-ink-subtle">{CHAPTER_LABELS[r.tpl.chapter]}</p>}
        </div>
      ),
    },
    {
      key: 't',
      header: 'التصنيف',
      render: (r) => <Badge>{CATEGORY_LABELS[r.tpl.category]}</Badge>,
    },
    {
      key: 's',
      header: 'الحالة',
      className: 'min-w-[11rem]',
      render: (r) => {
        const linkable = r.tpl.setting && (!settings[r.tpl.setting] || settings[r.tpl.setting] === r.existing?.id);
        return (
          <div className="space-y-0.5 text-xs">
            {r.existing ? (
              <p className="text-success-700">موجود: {r.existing.name}</p>
            ) : (
              <p className="text-ink-subtle">
                {unchecked.has(r.tpl.code) ? 'لن يُنشأ' : 'سيُنشأ'}
                {r.codeTaken ? ' بلا كود (الكود مستخدم)' : ''}
              </p>
            )}
            {linkable && (
              <p className="text-brand-700">
                {r.existing && settings[r.tpl.setting!] === r.existing.id ? 'مربوط بـ' : 'يُربط بـ'}
                {SETTING_LABELS[r.tpl.setting!]}
              </p>
            )}
          </div>
        );
      },
    },
  ];

  return (
    <>
      <PageHeader
        title="إعداد المنشأة"
        description="اختر الدولة والقطاع والنشاط، فنضبط السنة المالية والتقويم والضريبة ودليل الحسابات المناسب. الإعداد يضيف ولا يعدّل أي حساب أو قيد موجود."
      />

      {profile && (
        <Card className="mb-6 flex flex-wrap items-center gap-x-6 gap-y-1 p-4 text-sm">
          <span className="font-medium text-ink">الإعداد الحالي:</span>
          <span>{findCountryProfile(profile.country)?.name || profile.country}</span>
          <span>{SECTOR_LABELS[profile.sector]}</span>
          {profile.sector === 'private' && <span>{ACTIVITY_LABELS[profile.activity]}</span>}
          <span className="text-ink-subtle">السنة المالية تبدأ في {MONTHS_AR[profile.fiscalYearStartMonth - 1]}</span>
        </Card>
      )}

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader title="1. الدولة والقطاع" subtitle="تحدد الضريبة والفوترة الإلكترونية والسنة المالية الحكومية ونظام التأمينات" />
          <div className="space-y-5 p-5">
            <div className="grid grid-cols-3 gap-2">
              {COUNTRY_PROFILES.map((c) => (
                <button
                  key={c.code}
                  type="button"
                  onClick={() => pick(c.code, draft.sector)}
                  className={cx(
                    'rounded-lg border px-3 py-2.5 text-sm transition',
                    c.code === draft.country
                      ? 'border-brand-500 bg-brand-50 font-semibold text-brand-700 ring-1 ring-brand-500'
                      : 'border-line hover:bg-slate-50',
                  )}
                >
                  {c.name}
                </button>
              ))}
            </div>
            <Field label="القطاع">
              <Segmented
                value={draft.sector}
                onChange={(s) => pick(draft.country, s)}
                options={[
                  { value: 'private', label: SECTOR_LABELS.private },
                  { value: 'government', label: SECTOR_LABELS.government },
                ]}
              />
            </Field>
            {draft.sector === 'private' ? (
              <Field label="النشاط" hint="يحدد حسابات الإيرادات والتكاليف في الدليل">
                <Select value={draft.activity} onChange={(e) => pick(draft.country, 'private', e.target.value as Activity)}>
                  {(Object.keys(ACTIVITY_LABELS) as Activity[]).map((a) => (
                    <option key={a} value={a}>
                      {ACTIVITY_LABELS[a]}
                    </option>
                  ))}
                </Select>
              </Field>
            ) : (
              <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-ink-subtle">
                دليل الحسابات الحكومي مقسّم على أبواب الموازنة الأربعة. وحدة الموازنة والارتباط والمشتريات الحكومية تُبنى على هذه الأبواب.
              </p>
            )}
          </div>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader title="2. السنة المالية والتقويم والمستندات" subtitle="تُطبَّق على فترات التقارير والإقفال السنوي وترويسة المطبوعات" />
            <div className="grid gap-4 p-5 sm:grid-cols-2">
              <Field
                label="بداية السنة المالية"
                hint={
                  <>
                    الحالية {fy.label}: من{' '}
                    <span className="num whitespace-nowrap" dir="ltr">
                      {fy.from}
                    </span>{' '}
                    إلى{' '}
                    <span className="num whitespace-nowrap" dir="ltr">
                      {fy.to}
                    </span>
                  </>
                }
              >
                <Select
                  value={draft.fiscalYearStartMonth}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      fiscalYearStartMonth: Number(e.target.value),
                    })
                  }
                >
                  {MONTHS_AR.map((m, i) => (
                    <option key={m} value={i + 1}>
                      {m}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="التقويم في المستندات">
                <Select
                  value={draft.calendar}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      calendar: e.target.value as CalendarMode,
                    })
                  }
                >
                  <option value="gregorian">ميلادي</option>
                  <option value="both">ميلادي وهجري (أم القرى)</option>
                </Select>
              </Field>
              <Field
                label={draft.sector === 'government' ? 'رمز الجهة' : 'رقم السجل التجاري'}
                className="sm:col-span-2"
                hint="يظهر في ترويسة الفواتير والسندات والتقارير المطبوعة"
              >
                <Input value={draft.crNumber || ''} onChange={(e) => setDraft({ ...draft, crNumber: e.target.value })} className="num" />
              </Field>
              <div className="space-y-1 rounded-lg border border-line bg-slate-50 px-4 py-3 text-xs sm:col-span-2">
                <p className="text-ink-subtle">معاينة الترويسة والمبلغ كتابةً:</p>
                <p className="text-ink">التاريخ: {formatOfficialDate(new Date(), draft.calendar)}</p>
                <p className="text-ink">{amountInWords(1250.5, country?.currency || mainCurrency)}</p>
              </div>
            </div>
          </Card>

          <Card>
            <CardHeader title="3. الضريبة والعملة والفوترة الإلكترونية" />
            <div className="space-y-3 p-5 text-sm">
              {taxCountry && (
                <div className="grid grid-cols-2 gap-3">
                  <Info
                    label="الضريبة"
                    value={taxCountry.hasVat ? `${taxCountry.taxName} ${formatPercent(taxCountry.standardRate, 0)}` : 'لا توجد ضريبة قيمة مضافة'}
                  />
                  <Info label="الإقرار" value={taxCountry.filing === 'monthly' ? 'شهري' : taxCountry.filing === 'quarterly' ? 'ربع سنوي' : '—'} />
                  <Info label="الفوترة الإلكترونية" value={country?.eInvoicing || '—'} />
                  <Info label="التأمينات" value={country?.socialInsurance || '—'} />
                </div>
              )}
              {taxDiffers ? (
                <label className="flex items-start gap-2">
                  <input
                    type="checkbox"
                    className="mt-0.5 h-4 w-4 accent-brand-600"
                    checked={applyTax}
                    onChange={(e) => setApplyTax(e.target.checked)}
                  />
                  <span>اضبط صفحة الضرائب على {country?.name} (يُحتفظ بالرقم الضريبي إن وُجد)</span>
                </label>
              ) : (
                <p className="text-xs text-success-700">صفحة الضرائب مضبوطة على هذه الدولة.</p>
              )}
              {canChangeCurrency ? (
                <label className="flex items-start gap-2">
                  <input
                    type="checkbox"
                    className="mt-0.5 h-4 w-4 accent-brand-600"
                    checked={applyCurrency}
                    onChange={(e) => setApplyCurrency(e.target.checked)}
                  />
                  <span>
                    اجعل العملة الرئيسية <span className="num">{country!.currency}</span> بدل <span className="num">{mainCurrency}</span> (تتزامن مع
                    الهاتف)
                  </span>
                </label>
              ) : (
                country &&
                country.currency !== mainCurrency && (
                  <p className="text-xs text-ink-subtle">
                    العملة الرئيسية <span className="num">{mainCurrency}</span> لا تتغير هنا لأن لديك قيوداً مسجلة. يمكنك تغييرها من{' '}
                    <Link to="/settings" className="text-brand-700 underline">
                      الإعدادات
                    </Link>
                    .
                  </p>
                )
              )}
              {(draft.country === 'SA' || draft.country === 'EG') && (
                <Link to="/einvoice" className="inline-flex items-center gap-1 text-xs font-medium text-brand-700 hover:underline">
                  <Icon name="shield" size={14} /> إعداد الفوترة الإلكترونية
                </Link>
              )}
            </div>
          </Card>
        </div>

        <Card className="xl:col-span-2">
          <CardHeader
            title="4. دليل الحسابات"
            subtitle={`${template.length} حساباً في القالب: ${plan.filter((r) => r.existing).length} موجود، و${toCreate} سيُنشأ. ألغِ تحديد ما لا تحتاجه.`}
            actions={
              <Button onClick={run} disabled={busy || !ready}>
                {busy ? 'جارٍ التطبيق...' : profile ? 'حفظ وتطبيق الإعداد' : 'تطبيق الإعداد'}
              </Button>
            }
          />
          {limitMsg && !err && (
            <p className="mx-5 mt-4 rounded-lg bg-warning-50 px-4 py-3 text-sm text-warning-700">
              {limitMsg}. ألغِ تحديد بعض الحسابات حتى يتسع لها حدّ الخطة، أو{' '}
              <Link to="/subscription" className="font-medium underline">
                اشترك
              </Link>
              .
            </p>
          )}
          {(err || done) && (
            <div className="px-5 pt-4">
              <FormError message={err} />
              {done && <p className="rounded-lg bg-success-50 px-4 py-3 text-sm text-success-700">{done}</p>}
            </div>
          )}
          <DataTable
            columns={columns}
            rows={plan}
            rowKey={(r) => r.tpl.code}
            maxHeight="34rem"
            mobileCard={(r) => (
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="text-sm text-ink">{r.tpl.name}</p>
                  <p className="num text-xs text-ink-subtle">
                    {r.tpl.code} · {CATEGORY_LABELS[r.tpl.category]}
                  </p>
                </div>
                {r.existing ? <Badge tone="success">موجود</Badge> : <Badge tone="info">جديد</Badge>}
              </div>
            )}
          />
        </Card>
      </div>
    </>
  );
};

const Info: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="rounded-lg border border-line px-3 py-2">
    <p className="text-xs text-ink-subtle">{label}</p>
    <p className="text-sm text-ink">{value}</p>
  </div>
);

export default Setup;
