import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { useLedger } from '../context/LedgerContext';
import { useTaxSettings } from '../hooks/useTaxSettings';
import { Badge, Button, Card, CardHeader, PageHeader, StatCard, cx } from '../components/ui/primitives';
import { Field, FormError, Input, Select } from '../components/ui/Form';
import DataTable, { Column } from '../components/ui/DataTable';
import Icon from '../components/ui/Icon';
import { ExportButtons, PeriodPicker } from '../components/ledger/ReportToolbar';
import { ReportTable } from '../lib/export';
import { formatDate, formatNumber } from '../lib/format';
import { Period, periodFromPreset, periodText } from '../lib/ledger';
import { useSalesInvoices } from '../lib/salesInvoices';
import { TAX_COUNTRIES, TaxCountry, countryForCurrency, findTaxCountry } from '../tax/countries';
import { RateLine, SalesInvoice, TaxSettings, TradeTaxDoc, VatSection, buildVatReturn, effectiveCountry, parseRates, validateTrn } from '../tax/taxEngine';

const KIND_LABEL: Record<TradeTaxDoc['kind'], string> = {
  sale: 'مبيعات',
  saleReturn: 'مرتجع مبيعات',
  purchase: 'مشتريات',
  purchaseReturn: 'مرتجع مشتريات',
};

/** فترة الإقرار الافتراضية حسب دورية الدولة */
const defaultPeriod = (filing?: TaxSettings['filing']): Period => periodFromPreset(filing === 'monthly' ? 'month' : 'quarter');

const Taxes: React.FC = () => {
  const { user, currency } = useApp();
  const { invoices, notes, accountsById, roleOf, mainCurrency } = useLedger();
  const { settings, loading, save } = useTaxSettings(user?.uid || null);
  const { invoices: posList } = useSalesInvoices(user?.uid || null);

  const [countryCode, setCountryCode] = useState('');
  const [trn, setTrn] = useState('');
  const [standardRate, setStandardRate] = useState('');
  const [reducedRates, setReducedRates] = useState('');
  const [hasVat, setHasVat] = useState(true);
  const [taxName, setTaxName] = useState('');
  const [filing, setFiling] = useState<TaxSettings['filing']>('none');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [period, setPeriod] = useState<Period>(defaultPeriod());

  const fillForm = useCallback((c: TaxCountry) => {
    setStandardRate(String(c.standardRate));
    setReducedRates(c.reducedRates.join('، '));
    setHasVat(c.hasVat);
    setTaxName(c.taxName);
    setFiling(c.filing);
  }, []);

  // تعبئة النموذج من إعدادات الحساب المحفوظة، أو من عملة الحساب عند أول استخدام
  useEffect(() => {
    if (loading) return;
    const fallback = countryForCurrency(currency) || TAX_COUNTRIES[0];
    const c = findTaxCountry(settings?.countryCode) || fallback;
    setCountryCode(c.code);
    setTrn(settings?.trn || '');
    const eff = effectiveCountry(c, settings?.countryCode === c.code ? settings : null);
    fillForm(eff);
    setPeriod(defaultPeriod(eff.filing));
  }, [loading, settings, currency, fillForm]);

  const baseCountry = findTaxCountry(countryCode);
  const rate = parseFloat(standardRate);
  const reduced = parseRates(reducedRates);
  const country = baseCountry
    ? effectiveCountry(baseCountry, { standardRate: isNaN(rate) ? undefined : rate, reducedRates: reduced ?? undefined, hasVat, taxName, filing })
    : undefined;
  const trnValid = country ? validateTrn(country, trn) : false;
  const cur = mainCurrency || country?.currency || currency;

  // فواتير البيع والشراء ومرتجعاتها من الويب، والإشعارات حسب جهة الطرف (مورد ← مدخلات، غيره ← مخرجات)
  const tradeDocs = useMemo<TradeTaxDoc[]>(() => {
    const out: TradeTaxDoc[] = invoices.map((i) => ({
      id: i.id,
      number: `${{ sale: 'S', saleReturn: 'SR', purchase: 'P', purchaseReturn: 'PR' }[i.kind]}-${i.number}`,
      kind: i.kind,
      date: i.date,
      party: accountsById[i.partyId]?.name || '—',
      net: i.totals?.net || 0,
      vat: i.totals?.vat || 0,
      vatPct: i.vatPct || 0,
      exchangeRate: i.exchangeRate || 1,
    }));
    for (const n of notes) {
      if (!n.vatPct) continue;
      const supplier = roleOf(n.partyId) === 'supplier';
      out.push({
        id: n.id,
        number: `${n.kind === 'debit' ? 'DN' : 'CN'}-${n.number}`,
        kind: supplier ? (n.kind === 'credit' ? 'purchase' : 'purchaseReturn') : n.kind === 'debit' ? 'sale' : 'saleReturn',
        date: n.date,
        party: accountsById[n.partyId]?.name || '—',
        net: n.amount,
        vat: (n.amount * n.vatPct) / 100,
        vatPct: n.vatPct,
        exchangeRate: n.exchangeRate || 1,
      });
    }
    return out;
  }, [invoices, notes, accountsById, roleOf]);

  const pos = useMemo(() => Object.fromEntries(posList.map((i) => [i.id, i as SalesInvoice])), [posList]);

  const vat = useMemo(() => {
    if (!country) return null;
    const from = period.preset === 'all' || !period.from ? undefined : new Date(`${period.from}T00:00:00`);
    const to = period.preset === 'all' || !period.to ? undefined : new Date(`${period.to}T23:59:59.999`);
    return buildVatReturn(pos, tradeDocs, country, undefined, from, to);
  }, [pos, tradeDocs, country, period]);

  const onSave = async () => {
    if (!country) return;
    if (isNaN(rate) || rate < 0 || rate > 100) return setMessage({ ok: false, text: 'المعدل يجب أن يكون بين 0 و 100' });
    if (!reduced) return setMessage({ ok: false, text: 'المعدلات المخفضة يجب أن تكون أرقاماً بين 0 و 100 مفصولة بفواصل' });
    if (!trnValid) return setMessage({ ok: false, text: `${country.trnLabel} غير صحيح${country.trnHint ? ` (${country.trnHint})` : ''}` });
    setSaving(true);
    try {
      await save({ countryCode: country.code, trn: trn.trim(), standardRate: rate, reducedRates: reduced, hasVat, taxName: taxName.trim(), filing });
      setMessage({ ok: true, text: 'تم الحفظ' });
    } catch (e: any) {
      setMessage({ ok: false, text: `تعذر الحفظ: ${e?.message || e}` });
    } finally {
      setSaving(false);
    }
  };

  const buildExport = (): ReportTable => {
    const r = vat!;
    const sec = (title: string, s: VatSection, sign = 1) => ({
      heading: title,
      rows: s.byRate.map((l) => [`${l.rate}%`, sign * l.taxable, sign * l.tax]),
      footer: [['الإجمالي', sign * (s.taxable + s.zeroRated), sign * s.tax]],
    });
    return {
      title: `الإقرار الضريبي — ${country?.taxName || ''}`,
      subtitle: `${periodText(period)} · ${country?.trnLabel || 'الرقم الضريبي'}: ${trn || '—'} · المبالغ بـ ${cur}`,
      columns: ['المعدل', 'المبلغ الخاضع', 'الضريبة'],
      numericColumns: [1, 2],
      rows: [],
      summary: [
        ['ضريبة المخرجات (المبيعات)', formatNumber(r.outputTax)],
        ['ضريبة المدخلات (المشتريات)', formatNumber(r.inputTax)],
        [r.net >= 0 ? 'صافي الضريبة المستحقة' : 'رصيد ضريبي مسترد', formatNumber(Math.abs(r.net))],
      ],
      sections: [
        sec('المبيعات', r.sales),
        sec('مرتجعات المبيعات والإشعارات الدائنة', r.salesReturns, -1),
        sec('المشتريات', r.purchases),
        sec('مرتجعات المشتريات والإشعارات المدينة', r.purchaseReturns, -1),
      ],
    };
  };

  const docColumns: Array<Column<TradeTaxDoc>> = [
    { key: 'n', header: 'المستند', render: (d) => <span className="num font-medium">{d.number}</span> },
    { key: 'k', header: 'النوع', render: (d) => <Badge tone={d.kind.startsWith('purchase') ? 'info' : 'success'}>{KIND_LABEL[d.kind]}</Badge> },
    { key: 'd', header: 'التاريخ', render: (d) => <span className="text-ink-muted">{formatDate(d.date)}</span> },
    { key: 'p', header: 'الطرف', render: (d) => d.party },
    { key: 'r', header: 'النسبة', numeric: true, render: (d) => `${d.vatPct}%` },
    { key: 'b', header: `الصافي (${cur})`, numeric: true, render: (d) => formatNumber(d.net / (d.exchangeRate || 1)) },
    {
      key: 't',
      header: `الضريبة (${cur})`,
      numeric: true,
      render: (d) => <span className={d.kind.endsWith('Return') ? 'text-danger-700' : ''}>{formatNumber(((d.kind.endsWith('Return') ? -1 : 1) * d.vat) / (d.exchangeRate || 1))}</span>,
    },
  ];

  return (
    <>
      <PageHeader title="الضرائب" description={country ? `${country.taxName} · ${country.authority}` : undefined} />

      {vat && country?.hasVat !== false && (
        <div className="mb-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-ink">الإقرار الضريبي</h2>
            <div className="flex flex-wrap items-center gap-2">
              <PeriodPicker value={period} onChange={setPeriod} />
              <ExportButtons build={buildExport} />
            </div>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <StatCard label="ضريبة المخرجات (المبيعات)" value={formatNumber(vat.outputTax)} unit={cur} icon="arrowOut" tone="success" hint={`${vat.sales.count} مستند بيع، ${vat.salesReturns.count} مرتجع`} />
            <StatCard label="ضريبة المدخلات (المشتريات)" value={formatNumber(vat.inputTax)} unit={cur} icon="arrowIn" tone="info" hint={`${vat.purchases.count} فاتورة شراء، ${vat.purchaseReturns.count} مرتجع`} />
            <StatCard
              label={vat.net >= 0 ? 'صافي الضريبة المستحقة' : 'رصيد ضريبي مسترد'}
              value={formatNumber(Math.abs(vat.net))}
              unit={cur}
              icon="scale"
              tone={vat.net >= 0 ? 'danger' : 'brand'}
              hint="المخرجات − المدخلات"
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <ReturnCard title="المبيعات" add={vat.sales} sub={vat.salesReturns} subLabel="مرتجعات المبيعات والإشعارات الدائنة" total={vat.outputTax} />
            <ReturnCard title="المشتريات" add={vat.purchases} sub={vat.purchaseReturns} subLabel="مرتجعات المشتريات والإشعارات المدينة" total={vat.inputTax} />
          </div>

          {vat.invalidRateInvoices.length > 0 && (
            <Card className="flex items-start gap-3 border-warning-200 bg-warning-50 p-4 text-sm text-warning-800">
              <Icon name="alert" size={18} className="mt-0.5 shrink-0" />
              <span>
                {vat.invalidRateInvoices.length} فاتورة بيع فيها نسبة ضريبة غير معتمدة في {country?.name}: {vat.invalidRateInvoices.slice(0, 10).map((id) => pos[id]?.number || id).join('، ')}
              </span>
            </Card>
          )}

          <Card>
            <CardHeader title="فواتير الويب والإشعارات في الفترة" subtitle="فواتير نقاط البيع من الهاتف محسوبة ضمن المبيعات أعلاه" />
            <DataTable columns={docColumns} rows={vat.docs} rowKey={(d) => `${d.kind}_${d.id}`} maxHeight="50vh" empty={{ title: 'لا توجد فواتير بيع أو شراء من الويب في هذه الفترة', icon: 'receipt' }} />
          </Card>
        </div>
      )}

      <Card>
        <CardHeader title="إعدادات الضريبة حسب الدولة" subtitle="القيم الافتراضية للدولة قابلة للتعديل لحسابك" />
        <div className="grid gap-4 p-5 md:grid-cols-3">
          <Field label="الدولة">
            <Select
              value={countryCode}
              onChange={(e) => {
                const c = findTaxCountry(e.target.value);
                setCountryCode(e.target.value);
                if (c) fillForm(c);
              }}
            >
              {TAX_COUNTRIES.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.name} — {c.hasVat ? `${c.standardRate}%` : 'بدون ضريبة'}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={country?.trnLabel || 'الرقم الضريبي'}>
            <Input value={trn} onChange={(e) => setTrn(e.target.value)} placeholder={country?.trnHint} dir="ltr" className={cx(trn && !trnValid && 'border-danger-500')} />
          </Field>
          <Field label="المعدل الأساسي %">
            <Input type="number" value={standardRate} onChange={(e) => setStandardRate(e.target.value)} disabled={!hasVat} dir="ltr" />
          </Field>
          <Field label="اسم الضريبة في الفواتير والتقارير">
            <Input value={taxName} onChange={(e) => setTaxName(e.target.value)} />
          </Field>
          <Field label="المعدلات المخفضة المسموحة % (مفصولة بفواصل)">
            <Input value={reducedRates} onChange={(e) => setReducedRates(e.target.value)} disabled={!hasVat} dir="ltr" className={cx(!reduced && 'border-danger-500')} />
          </Field>
          <Field label="فترة الإقرار">
            <Select value={filing} onChange={(e) => setFiling(e.target.value as TaxSettings['filing'])}>
              <option value="monthly">شهري</option>
              <option value="quarterly">ربع سنوي</option>
              <option value="none">لا يوجد</option>
            </Select>
          </Field>
          <label className="flex items-center gap-2 text-sm text-ink-muted md:col-span-3">
            <input type="checkbox" checked={hasVat} onChange={(e) => setHasVat(e.target.checked)} className="h-4 w-4 accent-brand-600" />
            الحساب خاضع للضريبة (ألغِ التحديد إذا كانت المنشأة غير مسجلة أو معفاة)
          </label>
          {country?.notes && <p className="text-sm text-warning-700 md:col-span-3">{country.notes}</p>}
          <div className="flex flex-wrap items-center gap-3 md:col-span-3">
            <Button onClick={onSave} disabled={saving || !country}>
              {saving ? 'جاري الحفظ...' : 'حفظ'}
            </Button>
            <Button variant="secondary" onClick={() => baseCountry && fillForm(baseCountry)} disabled={!baseCountry}>
              استعادة قيم الدولة الافتراضية
            </Button>
            {message && (message.ok ? <span className="text-sm text-success-700">{message.text}</span> : <FormError message={message.text} />)}
          </div>
        </div>
      </Card>

      {country?.eInvoicing && country.eInvoicing !== 'none' && (
        <Card className="mt-4 flex flex-wrap items-center justify-between gap-3 p-5">
          <div className="flex items-center gap-3 text-sm">
            <Icon name="shield" size={20} className="text-brand-600" />
            <span>
              {country.eInvoicing === 'zatca' ? 'الفوترة الإلكترونية (المرحلة الثانية) ورمز QR الموقّع' : 'إرسال الفواتير لمنظومة الفاتورة الإلكترونية'} في صفحة مستقلة.
            </span>
          </div>
          <Link to="/einvoice">
            <Button variant="secondary" size="sm">
              الفوترة الإلكترونية
            </Button>
          </Link>
        </Card>
      )}
    </>
  );
};

const RateRows: React.FC<{ lines: RateLine[]; sign?: number }> = ({ lines, sign = 1 }) => (
  <>
    {lines.map((l) => (
      <tr key={l.rate} className="border-t border-line">
        <td className="px-5 py-2">{l.rate}%</td>
        <td className="num px-5 py-2 text-end">{formatNumber(sign * l.taxable)}</td>
        <td className="num px-5 py-2 text-end">{formatNumber(sign * l.tax)}</td>
      </tr>
    ))}
  </>
);

const ReturnCard: React.FC<{ title: string; add: VatSection; sub: VatSection; subLabel: string; total: number }> = ({ title, add, sub, subLabel, total }) => (
  <Card>
    <CardHeader title={title} />
    <table className="w-full text-sm">
      <thead className="bg-slate-50 text-xs text-ink-subtle">
        <tr>
          <th className="px-5 py-2 text-start font-semibold">المعدل</th>
          <th className="px-5 py-2 text-end font-semibold">المبلغ الخاضع</th>
          <th className="px-5 py-2 text-end font-semibold">الضريبة</th>
        </tr>
      </thead>
      <tbody>
        {add.byRate.length === 0 && sub.byRate.length === 0 && (
          <tr>
            <td colSpan={3} className="px-5 py-6 text-center text-ink-subtle">
              لا توجد مستندات في هذه الفترة
            </td>
          </tr>
        )}
        <RateRows lines={add.byRate} />
        {sub.byRate.length > 0 && (
          <>
            <tr className="border-t border-line bg-slate-50/60">
              <td colSpan={3} className="px-5 py-1.5 text-xs text-ink-subtle">
                {subLabel}
              </td>
            </tr>
            <RateRows lines={sub.byRate} sign={-1} />
          </>
        )}
      </tbody>
      <tfoot>
        <tr className="border-t border-line-strong font-semibold">
          <td className="px-5 py-2.5" colSpan={2}>
            صافي ضريبة {title}
          </td>
          <td className="num px-5 py-2.5 text-end">{formatNumber(total)}</td>
        </tr>
      </tfoot>
    </table>
  </Card>
);

export default Taxes;
