import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Badge, Button, Card, CardHeader, EmptyState, PageHeader, StatCard, Tabs, cx } from '../components/ui/primitives';
import { Field, Input, Select } from '../components/ui/Form';
import { useAlerts } from '../context/AlertsContext';
import { Alert, AlertKind, AlertSettings, KIND_LABELS, withDefaults } from '../lib/alerts';
import { SEVERITY_DOT } from '../components/layout/AlertsBell';
import { formatDate } from '../lib/format';

type Tab = 'active' | 'dismissed' | 'settings';

const GROUPS: { label: string; kinds: AlertKind[]; icon: 'box' | 'receipt' | 'users' | 'cheque' }[] = [
  { label: 'المخزون والصلاحية', kinds: ['lowStock', 'expiry'], icon: 'box' },
  { label: 'فواتير مستحقة ومتأخرة', kinds: ['invoiceOverdue', 'invoiceDue'], icon: 'receipt' },
  { label: 'ديون متأخرة', kinds: ['debtOverdue'], icon: 'users' },
  { label: 'شيكات مستحقة', kinds: ['chequeDue'], icon: 'cheque' },
];

const AlertRow: React.FC<{ a: Alert; action: React.ReactNode }> = ({ a, action }) => (
  <li className="flex items-start gap-3 px-4 py-3 sm:px-5">
    <span className={cx('mt-2 h-2 w-2 shrink-0 rounded-full', SEVERITY_DOT[a.severity])} />
    <div className="min-w-0 flex-1">
      <div className="flex flex-wrap items-center gap-2">
        <Link to={a.link} className="text-sm font-medium text-ink hover:text-brand-700">
          {a.title}
        </Link>
        <Badge tone={a.severity === 'danger' ? 'danger' : a.severity === 'warning' ? 'warning' : 'info'}>{KIND_LABELS[a.kind]}</Badge>
      </div>
      <p className="mt-0.5 text-xs text-ink-subtle">{a.detail}</p>
    </div>
    <div className="shrink-0">{action}</div>
  </li>
);

const Toggle: React.FC<{ checked: boolean; onChange: (v: boolean) => void; label: string; hint?: string }> = ({ checked, onChange, label, hint }) => (
  <label className="flex cursor-pointer items-start gap-3">
    <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="mt-1 h-4 w-4 accent-brand-600" />
    <span>
      <span className="block text-sm font-medium text-ink">{label}</span>
      {hint && <span className="block text-xs text-ink-subtle">{hint}</span>}
    </span>
  </label>
);

const NumField: React.FC<{ label: string; value: number; onChange: (v: number) => void; hint?: string }> = ({ label, value, onChange, hint }) => (
  <Field label={label} hint={hint}>
    <Input type="number" min={0} inputMode="numeric" className="num" value={value} onChange={(e) => onChange(Math.max(0, Number(e.target.value) || 0))} />
  </Field>
);

const SettingsTab: React.FC = () => {
  const { settings, saveSettings, enablePush, disablePush, thisDeviceSubscribed, pushDevices, sendTest, status } = useAlerts();
  const [f, setF] = useState<AlertSettings>(settings);
  const [emails, setEmails] = useState('');
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState('');
  useEffect(() => {
    setF(settings);
    setEmails((settings.email?.to || []).join('، '));
  }, [settings]);
  const v = withDefaults(f);
  const set = (p: Partial<AlertSettings>) => setF((x) => ({ ...x, ...p }));

  const run = async (name: string, fn: () => Promise<unknown>, ok: string) => {
    setBusy(name);
    setMsg(null);
    try {
      await fn();
      setMsg({ ok: true, text: ok });
    } catch (e: any) {
      setMsg({ ok: false, text: e?.message || 'حدث خطأ' });
    } finally {
      setBusy('');
    }
  };

  const save = () => {
    const to = emails
      .split(/[,،\s]+/)
      .map((e) => e.trim())
      .filter(Boolean);
    const bad = to.find((e) => !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e));
    if (bad) return setMsg({ ok: false, text: `بريد غير صحيح: ${bad}` });
    return run('save', () => saveSettings({ ...f, email: { enabled: !!f.email?.enabled && to.length > 0, to } }), 'تم حفظ إعدادات التنبيهات');
  };

  return (
    <div className="grid gap-6 xl:grid-cols-2">
      <Card>
        <CardHeader title="ما الذي يُنبَّه عنه" subtitle="تُحسب التنبيهات من أرصدة الحسابات والفواتير والمخزون لحظياً" />
        <div className="space-y-5 p-5">
          <div className="space-y-3">
            <Toggle checked={v.lowStock} onChange={(x) => set({ lowStock: x })} label="المخزون المنخفض" hint="أصناف الويب حسب الحد الأدنى أو حد إعادة الطلب في بطاقة الصنف" />
            {v.lowStock && (
              <div className="ms-7 max-w-xs">
                <NumField label="حد منتجات نقطة البيع" value={v.posMinQty} onChange={(x) => set({ posMinQty: x })} hint="منتجات التطبيق ليس لها حد أدنى؛ 0 = بلا تنبيه" />
              </div>
            )}
          </div>
          <div className="space-y-3">
            <Toggle checked={v.expiry} onChange={(x) => set({ expiry: x })} label="الصلاحية القريبة" hint="منتجات نقطة البيع التي فُعّل لها تتبع الصلاحية" />
            {v.expiry && (
              <div className="ms-7 max-w-xs">
                <NumField label="قبل الانتهاء بـ (يوم)" value={v.expiryDays} onChange={(x) => set({ expiryDays: x })} />
              </div>
            )}
          </div>
          <div className="space-y-3">
            <Toggle checked={v.invoices} onChange={(x) => set({ invoices: x })} label="الفواتير المستحقة والمتأخرة" hint="فواتير البيع الآجلة التي لم يغطها سداد الزبون (الأقدم يُسدَّد أولاً)" />
            {v.invoices && (
              <div className="ms-7 grid max-w-md gap-3 sm:grid-cols-2">
                <NumField label="التنبيه قبل الاستحقاق (يوم)" value={v.dueSoonDays} onChange={(x) => set({ dueSoonDays: x })} />
                <NumField label="مدة السداد الافتراضية (يوم)" value={v.termsDays} onChange={(x) => set({ termsDays: x })} hint="لفاتورة بلا تاريخ استحقاق" />
              </div>
            )}
          </div>
          <div className="space-y-3">
            <Toggle checked={v.debts} onChange={(x) => set({ debts: x })} label="الديون المتأخرة" hint="أرصدة الزبائن والمدينين التي مضى عليها وقت طويل دون سداد" />
            {v.debts && (
              <div className="ms-7 grid max-w-md gap-3 sm:grid-cols-2">
                <NumField label="متأخر بعد (يوم)" value={v.debtDays} onChange={(x) => set({ debtDays: x })} />
                <NumField label="تجاهل الأرصدة الأقل من" value={v.minDebt} onChange={(x) => set({ minDebt: x })} />
              </div>
            )}
          </div>
          <div className="space-y-3">
            <Toggle checked={v.cheques} onChange={(x) => set({ cheques: x })} label="الشيكات المستحقة" hint="الشيكات الواردة في الحافظة أو تحت التحصيل، والصادرة غير المصروفة" />
            {v.cheques && (
              <div className="ms-7 max-w-xs">
                <NumField label="قبل الاستحقاق بـ (يوم)" value={v.chequeDays} onChange={(x) => set({ chequeDays: x })} />
              </div>
            )}
          </div>
        </div>
      </Card>

      <div className="space-y-6">
        <Card>
          <CardHeader title="الإرسال إلى الهاتف والبريد" subtitle="ملخص يومي بالتنبيهات الجديدة، حتى لو كان التطبيق مغلقاً" />
          <div className="space-y-5 p-5">
            <div className="rounded-lg border border-line p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-ink">إشعارات الهاتف والمتصفح</p>
                  <p className="text-xs text-ink-subtle">
                    {thisDeviceSubscribed ? 'مفعّلة على هذا الجهاز' : 'غير مفعّلة على هذا الجهاز'}
                    {pushDevices > 0 && ` · ${pushDevices} جهاز مسجل`}
                  </p>
                </div>
                {thisDeviceSubscribed ? (
                  <Button variant="secondary" size="sm" disabled={!!busy} onClick={() => run('push', disablePush, 'أُوقفت الإشعارات على هذا الجهاز')}>
                    إيقاف على هذا الجهاز
                  </Button>
                ) : (
                  <Button size="sm" icon="bell" disabled={!!busy} onClick={() => run('push', enablePush, 'تم تفعيل الإشعارات على هذا الجهاز')}>
                    تفعيل على هذا الجهاز
                  </Button>
                )}
              </div>
              <p className="mt-3 text-xs text-ink-subtle">
                على الهاتف: افتح المنصة من المتصفح وثبّتها على الشاشة الرئيسية، ثم فعّل الإشعارات منها. في آيفون تعمل بعد التثبيت فقط.
              </p>
            </div>

            <div className="space-y-3 rounded-lg border border-line p-4">
              <Toggle
                checked={!!f.email?.enabled}
                onChange={(x) => set({ email: { ...(f.email || {}), enabled: x } })}
                label="البريد الإلكتروني"
                hint="رسالة واحدة يومياً بالتنبيهات الجديدة"
              />
              {f.email?.enabled && (
                <Field label="يُرسل إلى" hint="بريد أو أكثر، تفصل بينها فاصلة">
                  <Input dir="ltr" value={emails} onChange={(e) => setEmails(e.target.value)} placeholder="owner@example.com" />
                </Field>
              )}
            </div>

            <div className="grid max-w-md gap-3 sm:grid-cols-2">
              <Field label="وقت الإرسال اليومي">
                <Select value={v.hour} onChange={(e) => set({ hour: Number(e.target.value) })}>
                  {Array.from({ length: 24 }, (_, h) => (
                    <option key={h} value={h}>
                      {String(h).padStart(2, '0')}:00
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="المنطقة الزمنية">
                <Select value={v.timeZone} onChange={(e) => set({ timeZone: e.target.value })}>
                  {[
                    ['Asia/Riyadh', 'الرياض والكويت والدوحة والمنامة وبغداد'],
                    ['Asia/Dubai', 'دبي ومسقط'],
                    ['Africa/Cairo', 'القاهرة'],
                    ['Asia/Amman', 'عمّان'],
                    ['Asia/Beirut', 'بيروت'],
                    ['Asia/Damascus', 'دمشق'],
                    ['Asia/Gaza', 'فلسطين'],
                    ['Asia/Aden', 'صنعاء وعدن'],
                  ].map(([z, l]) => (
                    <option key={z} value={z}>
                      {l}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>

            {msg && <p className={cx('rounded-lg px-3 py-2 text-sm', msg.ok ? 'bg-success-50 text-success-700' : 'bg-danger-50 text-danger-700')}>{msg.text}</p>}

            <div className="flex flex-wrap gap-2">
              <Button disabled={!!busy} onClick={save}>
                {busy === 'save' ? 'جارٍ الحفظ...' : 'حفظ الإعدادات'}
              </Button>
              <Button
                variant="secondary"
                disabled={!!busy || (!settings.email?.enabled && !pushDevices)}
                onClick={() =>
                  run(
                    'test',
                    async () => {
                      const r = await sendTest();
                      if (!r.email && !r.push) throw new Error('لم يُرسل شيء: تأكد من البريد أو فعّل الإشعارات على جهاز');
                    },
                    'أُرسلت رسالة تجريبية',
                  )
                }
              >
                إرسال تجربة الآن
              </Button>
            </div>
            {status?.lastRunAt && (
              <p className="text-xs text-ink-subtle">
                آخر إرسال: {status.lastSentAt ? formatDate(status.lastSentAt, { dateStyle: 'medium', timeStyle: 'short' }) : 'لا يوجد'}
                {status.error && <span className="text-danger-700"> · {status.error}</span>}
              </p>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
};

// التنبيهات: ما يحتاج انتباهك الآن، وإعدادات ما يُنبَّه عنه وأين يُرسل
const Alerts: React.FC = () => {
  const { alerts, dismissedAlerts, dismiss, restore } = useAlerts();
  const [tab, setTab] = useState<Tab>('active');
  const [kind, setKind] = useState<number | null>(null);
  const counts = useMemo(() => GROUPS.map((g) => alerts.filter((a) => g.kinds.includes(a.kind)).length), [alerts]);
  const shown = kind == null ? alerts : alerts.filter((a) => GROUPS[kind].kinds.includes(a.kind));

  return (
    <>
      <PageHeader title="التنبيهات" description="مخزون منخفض، فواتير مستحقة، ديون متأخرة وشيكات — وتصلك على الهاتف أو البريد" />
      <div className="mb-6">
        <Tabs
          value={tab}
          onChange={setTab}
          items={[
            { value: 'active', label: `الحالية (${alerts.length})`, icon: 'bell' },
            { value: 'dismissed', label: `المخفية (${dismissedAlerts.length})` },
            { value: 'settings', label: 'الإعدادات', icon: 'settings' },
          ]}
        />
      </div>

      {tab === 'active' && (
        <>
          <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
            {GROUPS.map((g, i) => (
              <button key={g.label} onClick={() => setKind(kind === i ? null : i)} className={cx('rounded-xl text-start', kind === i && 'ring-2 ring-brand-500')}>
                <StatCard label={g.label} value={counts[i]} icon={g.icon} tone={counts[i] ? (i === 0 ? 'warning' : 'danger') : 'success'} />
              </button>
            ))}
          </div>
          <Card>
            {shown.length === 0 ? (
              <EmptyState icon="check" title="لا توجد تنبيهات" description="كل شيء على ما يرام" />
            ) : (
              <ul className="divide-y divide-line">
                {shown.map((a) => (
                  <AlertRow
                    key={a.id}
                    a={a}
                    action={
                      <Button size="sm" variant="ghost" onClick={() => dismiss(a.id)} title="إخفاء حتى تتغير الحالة">
                        إخفاء
                      </Button>
                    }
                  />
                ))}
              </ul>
            )}
          </Card>
        </>
      )}

      {tab === 'dismissed' && (
        <Card>
          {dismissedAlerts.length === 0 ? (
            <EmptyState title="لا توجد تنبيهات مخفية" />
          ) : (
            <ul className="divide-y divide-line">
              {dismissedAlerts.map((a) => (
                <AlertRow
                  key={a.id}
                  a={a}
                  action={
                    <Button size="sm" variant="secondary" onClick={() => restore(a.id)}>
                      إظهار
                    </Button>
                  }
                />
              ))}
            </ul>
          )}
        </Card>
      )}

      {tab === 'settings' && <SettingsTab />}
    </>
  );
};

export default Alerts;
