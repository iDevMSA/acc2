import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { db } from '../config/firebase';
import { ref, onValue } from 'firebase/database';
import { useApp } from '../context/AppContext';
import { useTaxSettings } from '../hooks/useTaxSettings';
import { TAX_COUNTRIES, TaxCountry, countryForCurrency, findTaxCountry } from '../tax/countries';
import {
  SalesInvoice,
  TaxSettings,
  buildTaxReport,
  effectiveCountry,
  parseRates,
  computeInvoiceTax,
  validateTrn,
  zatcaQrBase64,
} from '../tax/taxEngine';

const quarterStart = (d: Date) => new Date(d.getFullYear(), Math.floor(d.getMonth() / 3) * 3, 1);
const toInput = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const Taxes: React.FC = () => {
  const { user, currency } = useApp();
  const { settings, loading, save } = useTaxSettings(user?.uid || null);
  const [invoices, setInvoices] = useState<Record<string, SalesInvoice>>({});
  const [companyName, setCompanyName] = useState('');

  const [countryCode, setCountryCode] = useState('');
  const [trn, setTrn] = useState('');
  const [standardRate, setStandardRate] = useState('');
  const [reducedRates, setReducedRates] = useState('');
  const [hasVat, setHasVat] = useState(true);
  const [taxName, setTaxName] = useState('');
  const [filing, setFiling] = useState<TaxSettings['filing']>('none');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  const [from, setFrom] = useState(toInput(quarterStart(new Date())));
  const [to, setTo] = useState(toInput(new Date()));
  const [qrInvoice, setQrInvoice] = useState('');

  useEffect(() => {
    if (!user) return;
    const unsubInvoices = onValue(ref(db, `sales/${user.uid}/invoices`), (s) => setInvoices(s.val() || {}));
    const unsubCompany = onValue(ref(db, `users/${user.uid}/companyInfo/name`), (s) => setCompanyName(s.val() || ''));
    return () => {
      unsubInvoices();
      unsubCompany();
    };
  }, [user]);

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
    fillForm(effectiveCountry(c, settings?.countryCode === c.code ? settings : null));
  }, [loading, settings, currency, fillForm]);

  const baseCountry = findTaxCountry(countryCode);
  const rate = parseFloat(standardRate);
  const reduced = parseRates(reducedRates);
  const country = baseCountry
    ? effectiveCountry(baseCountry, {
        standardRate: isNaN(rate) ? undefined : rate,
        reducedRates: reduced ?? undefined,
        hasVat,
        taxName,
        filing,
      })
    : undefined;
  const trnValid = country ? validateTrn(country, trn) : false;

  const report = useMemo(() => {
    if (!country) return null;
    const end = new Date(to);
    end.setHours(23, 59, 59, 999);
    return buildTaxReport(invoices, country, undefined, new Date(from + 'T00:00:00'), end);
  }, [invoices, country, from, to]);

  const closedInvoices = useMemo(
    () =>
      Object.entries(invoices)
        .filter(([, inv]) => !inv.status || inv.status === 'closed')
        .sort(([, a], [, b]) => (b.createdAt || '').localeCompare(a.createdAt || ''))
        .slice(0, 50),
    [invoices],
  );

  const qr = useMemo(() => {
    const inv = invoices[qrInvoice];
    if (!inv || country?.eInvoicing !== 'zatca' || !trnValid) return '';
    const t = computeInvoiceTax(inv);
    const ts = inv.createdAt ? new Date(inv.createdAt).toISOString() : new Date().toISOString();
    return zatcaQrBase64(companyName || 'Seller', trn.trim(), ts, t.total, t.tax);
  }, [qrInvoice, invoices, country, trnValid, companyName, trn]);

  const onSave = async () => {
    if (!country) return;
    if (isNaN(rate) || rate < 0 || rate > 100) {
      setMessage('المعدل يجب أن يكون بين 0 و 100');
      return;
    }
    if (!reduced) {
      setMessage('المعدلات المخفضة يجب أن تكون أرقاماً بين 0 و 100 مفصولة بفواصل');
      return;
    }
    if (!trnValid) {
      setMessage(`${country.trnLabel} غير صحيح${country.trnHint ? ` (${country.trnHint})` : ''}`);
      return;
    }
    setSaving(true);
    try {
      await save({
        countryCode: country.code,
        trn: trn.trim(),
        standardRate: rate,
        reducedRates: reduced,
        hasVat,
        taxName: taxName.trim(),
        filing,
      });
      setMessage('تم الحفظ');
    } catch (e: any) {
      setMessage(`تعذر الحفظ: ${e?.message || e}`);
    } finally {
      setSaving(false);
    }
  };

  const fmt = (n: number) => `${n.toFixed(2)} ${country?.currency || currency}`;

  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold text-gray-900 mb-8">الضرائب</h1>

      {/* الإعدادات */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h2 className="text-lg font-bold text-gray-900 mb-4">إعدادات الضريبة حسب الدولة</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <label className="block">
            <span className="text-sm text-gray-600">الدولة</span>
            <select
              value={countryCode}
              onChange={(e) => {
                const c = findTaxCountry(e.target.value);
                setCountryCode(e.target.value);
                if (c) fillForm(c);
              }}
              className="mt-1 w-full border rounded-lg px-3 py-2"
            >
              {TAX_COUNTRIES.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.name} — {c.hasVat ? `${c.standardRate}%` : 'بدون ضريبة'}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="text-sm text-gray-600">{country?.trnLabel || 'الرقم الضريبي'}</span>
            <input
              value={trn}
              onChange={(e) => setTrn(e.target.value)}
              placeholder={country?.trnHint}
              dir="ltr"
              className={`mt-1 w-full border rounded-lg px-3 py-2 ${trn && !trnValid ? 'border-red-500' : ''}`}
            />
          </label>
          <label className="block">
            <span className="text-sm text-gray-600">المعدل الأساسي %</span>
            <input
              type="number"
              value={standardRate}
              onChange={(e) => setStandardRate(e.target.value)}
              disabled={!hasVat}
              dir="ltr"
              className="mt-1 w-full border rounded-lg px-3 py-2"
            />
          </label>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
          <label className="block">
            <span className="text-sm text-gray-600">اسم الضريبة في الفواتير والتقارير</span>
            <input
              value={taxName}
              onChange={(e) => setTaxName(e.target.value)}
              className="mt-1 w-full border rounded-lg px-3 py-2"
            />
          </label>
          <label className="block">
            <span className="text-sm text-gray-600">المعدلات المخفضة المسموحة % (مفصولة بفواصل)</span>
            <input
              value={reducedRates}
              onChange={(e) => setReducedRates(e.target.value)}
              disabled={!hasVat}
              dir="ltr"
              className={`mt-1 w-full border rounded-lg px-3 py-2 ${reduced ? '' : 'border-red-500'}`}
            />
          </label>
          <label className="block">
            <span className="text-sm text-gray-600">فترة الإقرار</span>
            <select
              value={filing}
              onChange={(e) => setFiling(e.target.value as TaxSettings['filing'])}
              className="mt-1 w-full border rounded-lg px-3 py-2"
            >
              <option value="monthly">شهري</option>
              <option value="quarterly">ربع سنوي</option>
              <option value="none">لا يوجد</option>
            </select>
          </label>
        </div>
        <label className="mt-4 flex items-center gap-2 text-sm text-gray-700">
          <input type="checkbox" checked={hasVat} onChange={(e) => setHasVat(e.target.checked)} />
          الحساب خاضع للضريبة (ألغِ التحديد إذا كانت المنشأة غير مسجلة أو معفاة)
        </label>
        {country && (
          <div className="mt-4 text-sm text-gray-600 space-y-1">
            <div>
              {country.taxName} · {country.authority}
              {country.filing !== 'none' && ` · إقرار ${country.filing === 'monthly' ? 'شهري' : 'ربع سنوي'}`}
            </div>
            {country.notes && <div className="text-amber-700">{country.notes}</div>}
          </div>
        )}
        <div className="mt-4 flex items-center gap-4">
          <button
            onClick={onSave}
            disabled={saving || !country}
            className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg disabled:opacity-50"
          >
            {saving ? 'جاري الحفظ...' : 'حفظ'}
          </button>
          <button
            onClick={() => baseCountry && fillForm(baseCountry)}
            disabled={!baseCountry}
            className="px-4 py-2 border rounded-lg text-gray-700 hover:bg-gray-50"
          >
            استعادة قيم الدولة الافتراضية
          </button>
          {message && <span className="text-sm text-gray-700">{message}</span>}
        </div>
      </div>

      {/* تقرير الإقرار */}
      {report && (
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <div className="flex flex-wrap items-end justify-between gap-4 mb-4">
            <h2 className="text-lg font-bold text-gray-900">ملخص الإقرار الضريبي (المبيعات)</h2>
            <div className="flex gap-2 items-end">
              <label className="text-sm text-gray-600">
                من
                <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="block border rounded px-2 py-1" />
              </label>
              <label className="text-sm text-gray-600">
                إلى
                <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="block border rounded px-2 py-1" />
              </label>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div className="p-4 bg-blue-50 rounded">
              <div className="text-xs text-gray-600">عدد الفواتير</div>
              <div className="text-2xl font-bold text-blue-600">{report.invoiceCount}</div>
            </div>
            <div className="p-4 bg-green-50 rounded">
              <div className="text-xs text-gray-600">المبيعات الخاضعة</div>
              <div className="text-xl font-bold text-green-700">{fmt(report.taxableSales)}</div>
            </div>
            <div className="p-4 bg-gray-50 rounded">
              <div className="text-xs text-gray-600">مبيعات بنسبة صفر / معفاة</div>
              <div className="text-xl font-bold text-gray-700">{fmt(report.zeroRatedSales)}</div>
            </div>
            <div className="p-4 bg-red-50 rounded">
              <div className="text-xs text-gray-600">ضريبة المخرجات المستحقة</div>
              <div className="text-xl font-bold text-red-600">{fmt(report.outputTax)}</div>
            </div>
          </div>

          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-4 py-2 text-right">المعدل</th>
                <th className="px-4 py-2 text-right">المبلغ الخاضع</th>
                <th className="px-4 py-2 text-right">الضريبة</th>
              </tr>
            </thead>
            <tbody>
              {report.byRate.map((l) => (
                <tr key={l.rate} className="border-b">
                  <td className="px-4 py-2">{l.rate}%</td>
                  <td className="px-4 py-2 font-mono">{l.taxable.toFixed(2)}</td>
                  <td className="px-4 py-2 font-mono">{l.tax.toFixed(2)}</td>
                </tr>
              ))}
              {report.byRate.length === 0 && (
                <tr>
                  <td colSpan={3} className="px-4 py-6 text-center text-gray-500">لا توجد فواتير في هذه الفترة</td>
                </tr>
              )}
            </tbody>
          </table>

          {report.invalidRateInvoices.length > 0 && (
            <div className="mt-4 p-3 bg-amber-50 text-amber-800 rounded text-sm">
              {report.invalidRateInvoices.length} فاتورة فيها بنود بمعدل ضريبة غير معتمد في {country?.name}. راجع نسبة
              الضريبة في إعدادات المنتجات:{' '}
              {report.invalidRateInvoices
                .slice(0, 10)
                .map((id) => invoices[id]?.number || id)
                .join('، ')}
            </div>
          )}
          <p className="mt-4 text-xs text-gray-500">
            ضريبة المدخلات (المشتريات) غير محسوبة بعد لأن وحدة المشتريات غير موجودة؛ الرقم أعلاه هو ضريبة المبيعات فقط.
          </p>
        </div>
      )}

      {/* رمز QR للسعودية */}
      {country?.eInvoicing === 'zatca' && (
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-bold text-gray-900 mb-4">رمز QR للفاتورة المبسطة (ZATCA)</h2>
          {!trnValid || !trn ? (
            <p className="text-sm text-gray-600">أدخل رقماً ضريبياً صحيحاً واحفظه لتوليد الرمز.</p>
          ) : (
            <div className="flex flex-wrap gap-6 items-start">
              <select
                value={qrInvoice}
                onChange={(e) => setQrInvoice(e.target.value)}
                className="border rounded-lg px-3 py-2"
              >
                <option value="">اختر فاتورة</option>
                {closedInvoices.map(([id, inv]) => (
                  <option key={id} value={id}>
                    #{inv.number || id} — {(inv.createdAt || '').slice(0, 10)}
                  </option>
                ))}
              </select>
              {qr && (
                <div className="text-center">
                  <QRCodeSVG value={qr} size={180} />
                  <div className="mt-2 text-xs text-gray-500 font-mono break-all max-w-xs" dir="ltr">
                    {qr}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default Taxes;
