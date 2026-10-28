import React, { useEffect, useMemo, useState } from 'react';
import { Badge, Button, Card, CardHeader, cx } from '../ui/primitives';
import { Field, FormError, Input, Select } from '../ui/Form';
import Modal from '../ui/Modal';
import Icon from '../ui/Icon';
import DataTable, { Column } from '../ui/DataTable';
import { useLedger } from '../../context/LedgerContext';
import { formatDate } from '../../lib/format';
import {
  ETA_ZERO_SUBTYPES,
  EinvoiceData,
  EinvoiceSettings,
  ItemCode,
  Party,
  Provider,
  Seller,
  VATEX,
  ZatcaStatus,
  etaConnect,
  saveEinvoice,
  zatcaOnboard,
} from '../../lib/einvoice';

const Msg: React.FC<{ ok?: string | null; err?: string | null }> = ({ ok, err }) => (
  <>
    <FormError message={err} />
    {ok && <p className="text-sm text-success-700">{ok}</p>}
  </>
);

const useFlash = () => {
  const [ok, setOk] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  return {
    ok,
    err,
    done: (m: string) => {
      setErr(null);
      setOk(m);
      setTimeout(() => setOk(null), 3000);
    },
    fail: (e: any) => {
      setOk(null);
      setErr(e?.message || String(e));
    },
  };
};

/* ───────── بيانات المنشأة ───────── */

export const SellerTab: React.FC<{ uid: string; data: EinvoiceData; provider: Provider; defaults: Seller }> = ({ uid, data, provider, defaults }) => {
  const [f, setF] = useState<Seller>({ ...defaults, ...(data.seller || {}) });
  const flash = useFlash();
  useEffect(() => setF({ ...defaults, ...(data.seller || {}) }), [data.seller]); // eslint-disable-line react-hooks/exhaustive-deps
  const set = (k: keyof Seller) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF((s) => ({ ...s, [k]: e.target.value }));
  const sa = provider === 'zatca';

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await saveEinvoice(uid, { seller: { ...f, country: sa ? 'SA' : 'EG' } });
      flash.done('تم حفظ بيانات المنشأة');
    } catch (er) {
      flash.fail(er);
    }
  };

  return (
    <Card>
      <CardHeader title="بيانات المنشأة على الفاتورة" subtitle="تظهر كبيانات البائع في كل فاتورة إلكترونية ويجب أن تطابق تسجيلك لدى الجهة الضريبية" />
      <form onSubmit={save} className="grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-3">
        <Field label="الاسم القانوني للمنشأة" className="sm:col-span-2">
          <Input value={f.name || ''} onChange={set('name')} required />
        </Field>
        <Field label={sa ? 'الرقم الضريبي (15 رقماً)' : 'رقم التسجيل الضريبي (9 أرقام)'}>
          <Input value={f.vatNumber || ''} onChange={set('vatNumber')} dir="ltr" inputMode="numeric" required />
        </Field>
        {sa ? (
          <Field label="رقم السجل التجاري (CRN)">
            <Input value={f.crn || ''} onChange={set('crn')} dir="ltr" inputMode="numeric" />
          </Field>
        ) : (
          <>
            <Field label="رمز النشاط الضريبي" hint="من شهادة التسجيل، مثل 4620">
              <Input value={f.activityCode || ''} onChange={set('activityCode')} dir="ltr" />
            </Field>
            <Field label="رقم الفرع في المنظومة" hint="0 للمركز الرئيسي">
              <Input value={f.branchId ?? '0'} onChange={set('branchId')} dir="ltr" />
            </Field>
            <Field label="المحافظة">
              <Input value={f.governate || ''} onChange={set('governate')} />
            </Field>
          </>
        )}
        <Field label="المدينة">
          <Input value={f.city || ''} onChange={set('city')} />
        </Field>
        {sa && (
          <Field label="الحي">
            <Input value={f.district || ''} onChange={set('district')} />
          </Field>
        )}
        <Field label="الشارع">
          <Input value={f.street || ''} onChange={set('street')} />
        </Field>
        <Field label={sa ? 'رقم المبنى (4 أرقام)' : 'رقم المبنى'}>
          <Input value={f.building || ''} onChange={set('building')} dir="ltr" />
        </Field>
        <Field label={sa ? 'الرمز البريدي (5 أرقام)' : 'الرمز البريدي (اختياري)'}>
          <Input value={f.postalCode || ''} onChange={set('postalCode')} dir="ltr" inputMode="numeric" />
        </Field>
        <div className="flex items-center gap-3 sm:col-span-2 lg:col-span-3">
          <Button type="submit">حفظ</Button>
          <Msg ok={flash.ok} err={flash.err} />
        </div>
      </form>
    </Card>
  );
};

/* ───────── الربط مع ZATCA ───────── */

const ENV_LABEL: Record<ZatcaStatus['env'], string> = { sandbox: 'بيئة المطورين (تجريبية)', simulation: 'بيئة المحاكاة', production: 'الإنتاج (فعلي)' };

export const ZatcaTab: React.FC<{ data: EinvoiceData; sellerReady: boolean }> = ({ data, sellerReady }) => {
  const st = data.zatca;
  const [env, setEnv] = useState<ZatcaStatus['env']>(st?.env || 'sandbox');
  const [otp, setOtp] = useState('');
  const [egs, setEgs] = useState({
    branchName: data.seller?.city ? `فرع ${data.seller.city}` : 'الفرع الرئيسي',
    commonName: `EGS-${data.seller?.vatNumber || ''}`,
    invoiceTypes: '1100',
    location: [data.seller?.building, data.seller?.street, data.seller?.city].filter(Boolean).join(' '),
    industry: 'Retail',
    model: 'Web',
    orgName: data.seller?.name || '',
  });
  const [busy, setBusy] = useState(false);
  const flash = useFlash();
  const set = (k: keyof typeof egs) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setEgs((s) => ({ ...s, [k]: e.target.value }));

  const run = async (e: React.FormEvent) => {
    e.preventDefault();
    if (env === 'production' && !window.confirm('الربط مع بيئة الإنتاج يعني أن كل فاتورة تُرسل لاحقاً تُسجَّل رسمياً لدى ZATCA. متابعة؟')) return;
    setBusy(true);
    try {
      const r = await zatcaOnboard({ env, otp, egs: { ...egs, orgName: egs.orgName || data.seller?.name || '' } });
      if (r.status === 'ready') flash.done('تم الربط بنجاح');
      else flash.fail(new Error(r.message || 'لم يكتمل الربط'));
      setOtp('');
    } catch (er) {
      flash.fail(er);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_22rem]">
      <Card>
        <CardHeader title="ربط وحدة إصدار الفواتير (EGS) مع فاتورة" subtitle="المرحلة الثانية: كل فاتورة تُوقّع إلكترونياً، والمبسطة يُبلَّغ عنها خلال 24 ساعة، والقياسية تُعتمد قبل تسليمها للعميل" />
        <form onSubmit={run} className="grid gap-4 p-5 sm:grid-cols-2">
          <Field label="البيئة" className="sm:col-span-2">
            <Select value={env} onChange={(e) => setEnv(e.target.value as any)}>
              {Object.entries(ENV_LABEL).map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </Select>
          </Field>
          <Field
            label="رمز OTP"
            hint={env === 'sandbox' ? 'بيئة المطورين تقبل الرمز 123345' : 'من بوابة فاتورة (fatoora.zatca.gov.sa) ← إضافة جهاز جديد. صالح لساعة واحدة'}
          >
            <Input value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))} dir="ltr" inputMode="numeric" required />
          </Field>
          <Field label="أنواع الفواتير">
            <Select value={egs.invoiceTypes} onChange={set('invoiceTypes')}>
              <option value="1100">قياسية (للشركات) ومبسطة (للأفراد)</option>
              <option value="0100">مبسطة فقط</option>
              <option value="1000">قياسية فقط</option>
            </Select>
          </Field>
          <Field label="اسم الفرع" hint="أو الرقم الضريبي الموحد (10 أرقام) إن كانت المنشأة ضمن مجموعة ضريبية">
            <Input value={egs.branchName} onChange={set('branchName')} required />
          </Field>
          <Field label="اسم وحدة الإصدار">
            <Input value={egs.commonName} onChange={set('commonName')} dir="ltr" required />
          </Field>
          <Field label="عنوان الفرع">
            <Input value={egs.location} onChange={set('location')} required />
          </Field>
          <Field label="النشاط">
            <Input value={egs.industry} onChange={set('industry')} required />
          </Field>
          <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
            <Button type="submit" disabled={busy || !sellerReady}>
              {busy ? 'جارٍ الربط وفحص المطابقة…' : st?.status === 'ready' ? 'إعادة الربط' : 'ربط الآن'}
            </Button>
            {!sellerReady && <span className="text-xs text-warning-700">أكمل بيانات المنشأة أولاً</span>}
            <Msg ok={flash.ok} err={flash.err} />
          </div>
        </form>
      </Card>

      <Card className="h-fit">
        <CardHeader title="حالة الربط" />
        <div className="space-y-3 p-5 text-sm">
          {!st ? (
            <p className="text-ink-subtle">لم يتم الربط بعد.</p>
          ) : (
            <>
              <div className="flex flex-wrap gap-2">
                <Badge tone={st.status === 'ready' ? 'success' : st.status === 'error' ? 'danger' : 'info'}>
                  {st.status === 'ready' ? 'مربوط' : st.status === 'error' ? 'فشل الربط' : 'جارٍ الربط'}
                </Badge>
                <Badge tone={st.env === 'production' ? 'brand' : 'neutral'}>{ENV_LABEL[st.env]}</Badge>
              </div>
              {st.message && <p className="text-ink-muted">{st.message}</p>}
              {st.certExpiresAt && <p className="text-ink-muted">تنتهي الشهادة: {formatDate(st.certExpiresAt)}</p>}
              {st.checks?.length ? (
                <ul className="space-y-1.5 border-t border-line pt-3">
                  {st.checks.map((c) => (
                    <li key={c.name}>
                      <div className="flex items-center gap-2">
                        <Icon
                          name={c.status === 'fail' ? 'close' : c.status === 'warning' ? 'alert' : 'check'}
                          size={15}
                          className={c.status === 'fail' ? 'text-danger-600' : c.status === 'warning' ? 'text-warning-600' : 'text-success-600'}
                        />
                        <span>{c.name}</span>
                      </div>
                      {c.messages?.map((m, i) => (
                        <p key={i} className="ms-6 text-xs text-ink-subtle" dir="auto">
                          {m}
                        </p>
                      ))}
                    </li>
                  ))}
                </ul>
              ) : null}
            </>
          )}
        </div>
      </Card>
    </div>
  );
};

/* ───────── الربط مع ETA ───────── */

const readFileB64 = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(',')[1] || '');
    r.onerror = () => reject(r.error);
    r.readAsDataURL(file);
  });

export const EtaTab: React.FC<{ data: EinvoiceData }> = ({ data }) => {
  const st = data.eta;
  const [env, setEnv] = useState<'preprod' | 'production'>(st?.env || 'preprod');
  const [clientId, setClientId] = useState(st?.clientId || '');
  const [clientSecret, setClientSecret] = useState('');
  const [pfx, setPfx] = useState<File | null>(null);
  const [pfxPassword, setPfxPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const flash = useFlash();

  const run = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await etaConnect({ env, clientId, clientSecret: clientSecret || undefined, pfx: pfx ? await readFileB64(pfx) : undefined, pfxPassword: pfx ? pfxPassword : undefined });
      setClientSecret('');
      setPfx(null);
      setPfxPassword('');
      flash.done('تم التحقق من بيانات الربط وحفظها');
    } catch (er) {
      flash.fail(er);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_22rem]">
      <Card>
        <CardHeader title="الربط مع منظومة الفاتورة الإلكترونية (ETA)" subtitle="سجّل نظام ERP في بوابة المنظومة لتحصل على Client ID و Client Secret" />
        <form onSubmit={run} className="grid gap-4 p-5 sm:grid-cols-2">
          <Field label="البيئة" className="sm:col-span-2">
            <Select value={env} onChange={(e) => setEnv(e.target.value as any)}>
              <option value="preprod">البيئة التجريبية (preprod)</option>
              <option value="production">الإنتاج (فعلي)</option>
            </Select>
          </Field>
          <Field label="Client ID">
            <Input value={clientId} onChange={(e) => setClientId(e.target.value)} dir="ltr" required />
          </Field>
          <Field label="Client Secret" hint={st ? 'اتركه فارغاً للإبقاء على المحفوظ' : undefined}>
            <Input type="password" value={clientSecret} onChange={(e) => setClientSecret(e.target.value)} dir="ltr" required={!st} autoComplete="new-password" />
          </Field>
          <Field label="شهادة التوقيع الإلكتروني (PFX / P12)" hint="مطلوبة في الإنتاج. شهادات الفلاشة (USB Token) لا تُصدَّر كملف؛ راجع الملاحظة بجانبه">
            <Input type="file" accept=".pfx,.p12" onChange={(e) => setPfx(e.target.files?.[0] || null)} />
          </Field>
          <Field label="كلمة مرور الشهادة">
            <Input type="password" value={pfxPassword} onChange={(e) => setPfxPassword(e.target.value)} disabled={!pfx} autoComplete="new-password" />
          </Field>
          <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
            <Button type="submit" disabled={busy}>
              {busy ? 'جارٍ التحقق…' : 'تحقق واحفظ'}
            </Button>
            <Msg ok={flash.ok} err={flash.err} />
          </div>
        </form>
      </Card>
      <Card className="h-fit">
        <CardHeader title="حالة الربط" />
        <div className="space-y-3 p-5 text-sm text-ink-muted">
          {st ? (
            <>
              <div className="flex flex-wrap gap-2">
                <Badge tone="success">مربوط</Badge>
                <Badge tone={st.env === 'production' ? 'brand' : 'neutral'}>{st.env === 'production' ? 'الإنتاج' : 'التجريبية'}</Badge>
                <Badge tone={st.hasCertificate ? 'success' : 'warning'}>{st.hasCertificate ? 'شهادة توقيع محفوظة' : 'بدون شهادة توقيع'}</Badge>
              </div>
              <p>آخر تحقق: {formatDate(st.updatedAt, { dateStyle: 'medium', timeStyle: 'short' })}</p>
            </>
          ) : (
            <p>لم يتم الربط بعد.</p>
          )}
          <p className="border-t border-line pt-3 text-xs">
            بدون شهادة تُرسل المستندات بالإصدار 0.9 غير الموقّع، وهذا مقبول في البيئة التجريبية فقط. الإنتاج يتطلب الإصدار 1.0 الموقّع بشهادة من جهة معتمدة (مثل Egypt Trust أو MCDR).
          </p>
        </div>
      </Card>
    </div>
  );
};

/* ───────── بيانات العملاء الضريبية ───────── */

interface PartyRow {
  id: string;
  name: string;
  tax: Party;
}

export const PartiesTab: React.FC<{ uid: string; data: EinvoiceData; provider: Provider }> = ({ uid, data, provider }) => {
  const { accounts, invoices, notes } = useLedger();
  const [all, setAll] = useState(false);
  const [edit, setEdit] = useState<PartyRow | null>(null);
  const used = useMemo(() => {
    const s = new Set<string>();
    invoices.forEach((i) => (i.kind === 'sale' || i.kind === 'saleReturn') && s.add(i.partyId));
    notes.forEach((n) => s.add(n.partyId));
    Object.keys(data.parties).forEach((id) => s.add(id));
    return s;
  }, [invoices, notes, data.parties]);
  const rows: PartyRow[] = accounts
    .filter((a) => all || used.has(a.id))
    .map((a) => ({ id: a.id, name: a.name, tax: data.parties[a.id] || {} }))
    .sort((a, b) => a.name.localeCompare(b.name, 'ar'));

  const columns: Array<Column<PartyRow>> = [
    { key: 'n', header: 'العميل', render: (r) => <span className="font-medium">{r.name}</span> },
    { key: 'v', header: 'الرقم الضريبي', render: (r) => <span className="num" dir="ltr">{r.tax.vatNumber || '—'}</span> },
    { key: 'a', header: 'العنوان', render: (r) => <span className="text-ink-muted">{[r.tax.building, r.tax.street, r.tax.district, r.tax.city].filter(Boolean).join('، ') || '—'}</span> },
    {
      key: 's',
      header: 'نوع الفاتورة',
      render: (r) =>
        provider === 'zatca' ? (
          <Badge tone={r.tax.vatNumber ? 'brand' : 'neutral'}>{r.tax.vatNumber ? 'قياسية (B2B)' : 'مبسطة'}</Badge>
        ) : (
          <Badge tone="neutral">{r.tax.type === 'F' ? 'أجنبي' : r.tax.type === 'P' || !r.tax.vatNumber ? 'شخص' : 'شركة'}</Badge>
        ),
    },
    { key: 'e', header: '', className: 'w-16', render: (r) => <Button size="sm" variant="ghost" icon="edit" onClick={() => setEdit(r)} aria-label="تعديل" /> },
  ];

  return (
    <Card>
      <CardHeader
        title="البيانات الضريبية للعملاء"
        subtitle={provider === 'zatca' ? 'العميل الذي له رقم ضريبي تصدر له فاتورة ضريبية قياسية وتحتاج عنوانه الكامل' : 'الشركات تحتاج رقم التسجيل الضريبي والعنوان، والأفراد الرقم القومي عند تجاوز 50,000 جنيه'}
        actions={
          <label className="flex items-center gap-2 text-xs text-ink-muted">
            <input type="checkbox" checked={all} onChange={(e) => setAll(e.target.checked)} />
            كل الحسابات
          </label>
        }
      />
      <DataTable columns={columns} rows={rows} rowKey={(r) => r.id} maxHeight="60vh" empty={{ title: 'لا يوجد عملاء في فواتير البيع بعد', icon: 'users' }} onRowClick={setEdit} />
      {edit && <PartyModal uid={uid} row={edit} provider={provider} onClose={() => setEdit(null)} />}
    </Card>
  );
};

const PartyModal: React.FC<{ uid: string; row: PartyRow; provider: Provider; onClose: () => void }> = ({ uid, row, provider, onClose }) => {
  const [f, setF] = useState<Party>({ type: 'B', ...row.tax });
  const flash = useFlash();
  const set = (k: keyof Party) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF((s) => ({ ...s, [k]: e.target.value }));
  const sa = provider === 'zatca';
  const save = async () => {
    try {
      await saveEinvoice(uid, { [`parties/${row.id}`]: f });
      onClose();
    } catch (e) {
      flash.fail(e);
    }
  };
  return (
    <Modal
      open
      onClose={onClose}
      title={row.name}
      subtitle="البيانات الضريبية للعميل"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            إلغاء
          </Button>
          <Button onClick={save}>حفظ</Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        {!sa && (
          <Field label="النوع" className="sm:col-span-2">
            <Select value={f.type || 'B'} onChange={set('type')}>
              <option value="B">شركة مسجلة</option>
              <option value="P">شخص طبيعي</option>
              <option value="F">جهة أجنبية</option>
            </Select>
          </Field>
        )}
        <Field label={sa ? 'الرقم الضريبي (15 رقماً)' : 'رقم التسجيل الضريبي'}>
          <Input value={f.vatNumber || ''} onChange={set('vatNumber')} dir="ltr" />
        </Field>
        {sa ? (
          <Field label="السجل التجاري (اختياري)">
            <Input value={f.crn || ''} onChange={set('crn')} dir="ltr" />
          </Field>
        ) : (
          <Field label="الرقم القومي (للأفراد)">
            <Input value={f.nationalId || ''} onChange={set('nationalId')} dir="ltr" />
          </Field>
        )}
        {!sa && (
          <Field label="المحافظة">
            <Input value={f.governate || ''} onChange={set('governate')} />
          </Field>
        )}
        <Field label="المدينة">
          <Input value={f.city || ''} onChange={set('city')} />
        </Field>
        {sa && (
          <Field label="الحي">
            <Input value={f.district || ''} onChange={set('district')} />
          </Field>
        )}
        <Field label="الشارع">
          <Input value={f.street || ''} onChange={set('street')} />
        </Field>
        <Field label="رقم المبنى">
          <Input value={f.building || ''} onChange={set('building')} dir="ltr" />
        </Field>
        <Field label="الرمز البريدي">
          <Input value={f.postalCode || ''} onChange={set('postalCode')} dir="ltr" />
        </Field>
        <Field label="الدولة (رمز من حرفين)">
          <Input value={f.country || (sa ? 'SA' : 'EG')} onChange={set('country')} dir="ltr" maxLength={2} />
        </Field>
      </div>
      <Msg err={flash.err} />
    </Modal>
  );
};

/* ───────── الإعدادات ───────── */

export const SettingsTab: React.FC<{ uid: string; data: EinvoiceData; provider: Provider }> = ({ uid, data, provider }) => {
  const { items } = useLedger();
  const s = data.settings;
  const flash = useFlash();
  const save = async (patch: Partial<EinvoiceSettings>) => {
    try {
      await saveEinvoice(uid, { settings: { ...s, ...patch } });
      flash.done('تم الحفظ');
    } catch (e) {
      flash.fail(e);
    }
  };
  const auto = s.auto || {};
  const setAuto = (patch: NonNullable<EinvoiceSettings['auto']>) =>
    save({ auto: { ...auto, ...patch, since: patch.enabled && !auto.enabled ? new Date().toISOString() : auto.since } });

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader title="الإرسال التلقائي" subtitle="كل 15 دقيقة تُرسل المستندات الجديدة (منذ لحظة التفعيل) دون ضغط زر الإرسال" />
        <div className="space-y-3 p-5 text-sm">
          <Toggle label="تفعيل الإرسال التلقائي" checked={!!auto.enabled} onChange={(v) => setAuto({ enabled: v })} />
          <div className={cx('ms-6 space-y-2', !auto.enabled && 'pointer-events-none opacity-50')}>
            <Toggle label="فواتير نقاط البيع من الهاتف" checked={auto.pos !== false} onChange={(v) => setAuto({ pos: v })} />
            <Toggle label="فواتير البيع ومرتجعاتها من الويب" checked={auto.trade !== false} onChange={(v) => setAuto({ trade: v })} />
            <Toggle label="الإشعارات المدينة والدائنة" checked={!!auto.notes} onChange={(v) => setAuto({ notes: v })} />
          </div>
          {auto.enabled && auto.since && <p className="text-xs text-ink-subtle">يشمل المستندات المنشأة منذ {formatDate(auto.since, { dateStyle: 'medium', timeStyle: 'short' })}</p>}
        </div>
      </Card>

      {provider === 'zatca' ? (
        <Card>
          <CardHeader title="البنود بنسبة 0%" subtitle="ZATCA تشترط سبب النسبة الصفرية أو الإعفاء لكل بند بنسبة 0%" />
          <div className="p-5">
            <Field label="السبب" className="max-w-lg">
              <Select
                value={s.zatcaExemption?.code || ''}
                onChange={(e) => {
                  const v = VATEX.find((x) => x.code === e.target.value);
                  save({ zatcaExemption: v ? { category: v.category, code: v.code, reason: v.reason } : undefined });
                }}
              >
                <option value="">— لا أبيع بنسبة 0% —</option>
                {VATEX.map((v) => (
                  <option key={v.code} value={v.code}>
                    {v.label} ({v.code})
                  </option>
                ))}
              </Select>
            </Field>
          </div>
        </Card>
      ) : (
        <EtaCodes uid={uid} data={data} items={items} onSave={save} />
      )}
      <Msg ok={flash.ok} err={flash.err} />
    </div>
  );
};

const Toggle: React.FC<{ label: string; checked: boolean; onChange: (v: boolean) => void }> = ({ label, checked, onChange }) => (
  <label className="flex cursor-pointer items-center gap-2">
    <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="h-4 w-4 accent-brand-600" />
    <span>{label}</span>
  </label>
);

const EtaCodes: React.FC<{ uid: string; data: EinvoiceData; items: { id: string; name: string; code?: string }[]; onSave: (p: Partial<EinvoiceSettings>) => void }> = ({
  uid,
  data,
  items,
  onSave,
}) => {
  const def = data.settings.etaDefaultItem || {};
  const [d, setD] = useState<ItemCode>({ itemType: 'EGS', unitType: 'EA', ...def });
  const [codes, setCodes] = useState<Record<string, ItemCode>>(data.itemCodes);
  useEffect(() => setCodes(data.itemCodes), [data.itemCodes]);
  const saveItem = (id: string, c: ItemCode) => saveEinvoice(uid, { [`itemCodes/${id}`]: c.itemCode ? c : null });

  return (
    <>
      <Card>
        <CardHeader title="ترميز الأصناف (EGS / GS1)" subtitle="كل بند في الفاتورة يحتاج رمزاً مسجلاً في المنظومة. الرمز الافتراضي يُستخدم لأي صنف بلا رمز خاص" />
        <div className="grid gap-4 p-5 sm:grid-cols-4">
          <Field label="نوع الترميز">
            <Select value={d.itemType} onChange={(e) => setD({ ...d, itemType: e.target.value as any })}>
              <option value="EGS">EGS</option>
              <option value="GS1">GS1</option>
            </Select>
          </Field>
          <Field label="الرمز الافتراضي" className="sm:col-span-2">
            <Input value={d.itemCode || ''} onChange={(e) => setD({ ...d, itemCode: e.target.value })} dir="ltr" placeholder="EG-123456789-1001" />
          </Field>
          <Field label="وحدة القياس">
            <Input value={d.unitType || ''} onChange={(e) => setD({ ...d, unitType: e.target.value })} dir="ltr" placeholder="EA" />
          </Field>
          <Field label="النوع الفرعي عند نسبة 0%" className="sm:col-span-2">
            <Select value={data.settings.etaZeroSubtype || 'V003'} onChange={(e) => onSave({ etaZeroSubtype: e.target.value })}>
              {ETA_ZERO_SUBTYPES.map((z) => (
                <option key={z.code} value={z.code}>
                  {z.code} — {z.label}
                </option>
              ))}
            </Select>
          </Field>
          <div className="flex items-end">
            <Button onClick={() => onSave({ etaDefaultItem: d })}>حفظ</Button>
          </div>
        </div>
      </Card>
      {items.length > 0 && (
        <Card>
          <CardHeader title="رموز الأصناف" subtitle="اختياري: رمز خاص لكل صنف في المخزن" />
          <div className="max-h-[50vh] divide-y divide-line overflow-y-auto">
            {items.map((it) => (
              <div key={it.id} className="grid items-center gap-3 px-5 py-2.5 sm:grid-cols-[1fr_7rem_14rem_6rem]">
                <span className="truncate text-sm">{it.name}</span>
                <Select value={codes[it.id]?.itemType || 'EGS'} onChange={(e) => setCodes({ ...codes, [it.id]: { ...codes[it.id], itemType: e.target.value as any } })}>
                  <option value="EGS">EGS</option>
                  <option value="GS1">GS1</option>
                </Select>
                <Input
                  value={codes[it.id]?.itemCode || ''}
                  onChange={(e) => setCodes({ ...codes, [it.id]: { ...codes[it.id], itemCode: e.target.value } })}
                  onBlur={() => saveItem(it.id, { unitType: 'EA', itemType: 'EGS', ...codes[it.id] })}
                  dir="ltr"
                  placeholder={it.code || 'رمز الصنف'}
                />
                <Input
                  value={codes[it.id]?.unitType || ''}
                  onChange={(e) => setCodes({ ...codes, [it.id]: { ...codes[it.id], unitType: e.target.value } })}
                  onBlur={() => saveItem(it.id, { itemType: 'EGS', ...codes[it.id] })}
                  dir="ltr"
                  placeholder="EA"
                />
              </div>
            ))}
          </div>
        </Card>
      )}
    </>
  );
};
