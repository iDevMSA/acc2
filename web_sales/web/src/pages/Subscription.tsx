import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { useLedger } from '../context/LedgerContext';
import { Badge, Card, CardHeader, PageHeader, Tabs, cx } from '../components/ui/primitives';
import Icon, { IconName } from '../components/ui/Icon';
import {
  FREE_MAX_ACCOUNTS,
  FREE_MAX_OPERATIONS,
  KIND_LABELS,
  PLAN_LABELS,
  PRICES,
  PlanType,
  SubKind,
  SubscriptionInfo,
  daysLeft,
  isActive,
  whatsappLink,
} from '../lib/subscription';

// "الاشتراك": ثلاثة أنواع (موبايل / متصفح / متصفح + موبايل) بنفس خطط التطبيق.
// الدفع كما في التطبيق: واتساب ثم تفعيل الاشتراك من لوحة الإدارة.

const KIND_ICONS: Record<SubKind, IconName> = { mobile: 'phone', web: 'grid', bundle: 'sparkle' };

const PLAN_FEATURES: Record<SubKind, Record<Exclude<PlanType, 'free'>, string[]>> = {
  mobile: {
    monthly: ['حسابات وقيود غير محدودة في التطبيق', 'كشف حساب PDF', 'إرسال واتساب'],
    yearly: ['كل ميزات الشهري', 'توفير 25%', 'أولوية دعم فائقة'],
    lifetime: ['كل شيء غير محدود في التطبيق', 'تحديثات مجانية للأبد', 'لا تجديد أبداً'],
  },
  web: {
    monthly: ['حسابات وقيود غير محدودة في المتصفح', 'كل نوافذ المنصة والتقارير', 'نقطة البيع والمخازن'],
    yearly: ['كل ميزات الشهري', 'توفير 25%', 'أولوية دعم فائقة'],
    lifetime: ['كل شيء غير محدود في المتصفح', 'تحديثات مجانية للأبد', 'لا تجديد أبداً'],
  },
  bundle: {
    monthly: ['غير محدود في المتصفح والتطبيق', 'اشتراك واحد للجهازين', 'دعم أولوية'],
    yearly: ['كل ميزات الشهري', 'توفير مقارنة بالشهري', 'أولوية دعم فائقة'],
    lifetime: ['كل شيء غير محدود على الجهازين', 'تحديثات مجانية للأبد', 'دعم VIP'],
  },
};

const PERIOD: Record<PlanType, string> = { free: 'دائماً', monthly: 'شهرياً', yearly: 'سنوياً', lifetime: 'دفعة واحدة' };

const formatDate = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString('ar-EG-u-nu-latn') : '');

const StatusLine: React.FC<{ title: string; sub: SubscriptionInfo | null; note?: string }> = ({ title, sub, note }) => {
  const plan = sub?.plan || 'free';
  const active = sub ? isActive(sub) : true;
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 py-3">
      <div>
        <p className="text-sm font-semibold text-ink">{title}</p>
        {note && <p className="mt-0.5 text-xs text-ink-subtle">{note}</p>}
      </div>
      <div className="flex items-center gap-2">
        <Badge tone={plan === 'free' ? 'neutral' : active ? 'success' : 'danger'}>{PLAN_LABELS[plan]}</Badge>
        {sub && plan !== 'free' && plan !== 'lifetime' && sub.expiresAt && (
          <span className="text-xs text-ink-subtle">
            {active ? `ينتهي ${formatDate(sub.expiresAt)} (${daysLeft(sub)} يوم)` : `انتهى ${formatDate(sub.expiresAt)}`}
          </span>
        )}
      </div>
    </div>
  );
};

const Usage: React.FC<{ label: string; used: number; max: number }> = ({ label, used, max }) => {
  const pct = Math.min(100, Math.round((used / max) * 100));
  return (
    <div>
      <div className="flex justify-between text-sm">
        <span className="text-ink-muted">{label}</span>
        <span className="font-semibold tabular-nums text-ink">
          {used} / {max}
        </span>
      </div>
      <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-slate-100">
        <div className={cx('h-full rounded-full', pct >= 100 ? 'bg-danger-600' : 'bg-brand-600')} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
};

const Subscription: React.FC = () => {
  const { mobileSubscription, webSubscription, webAccess } = useApp();
  const { accounts, operations } = useLedger();
  const [kind, setKind] = useState<SubKind>(webAccess.kind || 'web');

  const mobileKind = mobileSubscription?.kind === 'bundle' ? 'bundle' : 'mobile';
  const currentPlan = (k: SubKind): PlanType | null => {
    if (k === 'web') return webSubscription?.plan || 'free';
    if (mobileKind !== k) return null;
    return mobileSubscription?.plan || 'free';
  };

  return (
    <div className="space-y-6">
      <PageHeader title="الاشتراك" description="خطط الموبايل والمتصفح، وحالة اشتراكك على الجهازين" />

      {webAccess.expired && (
        <div className="flex items-center gap-2 rounded-lg border border-warning-100 bg-warning-50 px-4 py-3 text-sm text-warning-700">
          <Icon name="alert" size={16} />
          انتهى اشتراك {KIND_LABELS[webAccess.expired.kind === 'bundle' ? 'bundle' : 'web']} — عاد الحساب إلى حدود الخطة المجانية في
          المتصفح. جدّد الاشتراك لإزالة الحدود.
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="اشتراكك الحالي" />
          <div className="divide-y divide-line px-5 pb-2 pt-1">
            <StatusLine
              title={mobileKind === 'bundle' ? 'المتصفح + الموبايل' : 'الموبايل'}
              sub={mobileSubscription}
              note={mobileKind === 'bundle' ? 'اشتراك واحد يعمل في التطبيق والمتصفح' : 'يُطبَّق في تطبيق الهاتف'}
            />
            <StatusLine title="المتصفح" sub={webSubscription} note="يُطبَّق في المنصة على المتصفح" />
          </div>
        </Card>

        <Card>
          <CardHeader
            title="المتصفح"
            subtitle={webAccess.unlimited ? 'لا حدود على حسابك في المتصفح' : 'الحساب الأساسي المجاني'}
            actions={webAccess.unlimited ? <Badge tone="success">غير محدود</Badge> : <Badge tone="neutral">مجاني</Badge>}
          />
          <div className="space-y-4 px-5 pb-5 pt-4">
            {webAccess.unlimited ? (
              <p className="text-sm text-ink-muted">
                {webAccess.kind
                  ? `مفعّل عبر اشتراك ${KIND_LABELS[webAccess.kind]} (${PLAN_LABELS[webAccess.source?.plan || 'free']}).`
                  : 'حسابك بلا حدود.'}
              </p>
            ) : (
              <>
                <Usage label="الحسابات" used={accounts.length} max={FREE_MAX_ACCOUNTS} />
                <Usage label="القيود" used={operations.length} max={FREE_MAX_OPERATIONS} />
                <p className="text-xs text-ink-subtle">
                  تبقى بياناتك ظاهرة كلها؛ الحد يمنع الإضافة فقط بعد الوصول إليه.
                </p>
              </>
            )}
          </div>
        </Card>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-bold text-ink">الخطط</h2>
        <Tabs<SubKind>
          value={kind}
          onChange={setKind}
          items={(['mobile', 'web', 'bundle'] as SubKind[]).map((k) => ({ value: k, label: KIND_LABELS[k], icon: KIND_ICONS[k] }))}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {(['free', 'monthly', 'yearly', 'lifetime'] as PlanType[])
          .filter((p) => kind !== 'bundle' || p !== 'free')
          .map((plan) => {
            const isCurrent = currentPlan(kind) === plan;
            const popular = plan === 'yearly';
            return (
              <Card key={plan} className={cx('flex flex-col p-5', popular && 'ring-2 ring-brand-600')}>
                <div className="flex items-center justify-between">
                  <p className="font-bold text-ink">{PLAN_LABELS[plan]}</p>
                  {isCurrent ? <Badge tone="success">خطتك</Badge> : popular ? <Badge tone="brand">الأكثر طلباً</Badge> : null}
                </div>
                <p className="mt-3 text-3xl font-extrabold tabular-nums text-ink" dir="ltr">
                  ${plan === 'free' ? '0.00' : PRICES[kind][plan].toFixed(2)}
                </p>
                <p className="text-xs text-ink-subtle">{PERIOD[plan]}</p>
                <ul className="mt-4 flex-1 space-y-2 text-sm text-ink-muted">
                  {(plan === 'free'
                    ? [`${FREE_MAX_ACCOUNTS} حساب`, `${FREE_MAX_OPERATIONS} قيد`, 'ميزات أساسية']
                    : PLAN_FEATURES[kind][plan]
                  ).map((f) => (
                    <li key={f} className="flex items-start gap-2">
                      <Icon name="check" size={15} className="mt-0.5 shrink-0 text-success-600" />
                      {f}
                    </li>
                  ))}
                </ul>
                {plan !== 'free' && (
                  <a
                    href={whatsappLink(kind, plan)}
                    target="_blank"
                    rel="noreferrer"
                    className={cx(
                      'mt-5 inline-flex h-10 items-center justify-center rounded-lg px-4 text-sm font-medium transition',
                      popular ? 'bg-brand-600 text-white hover:bg-brand-700' : 'border border-line-strong text-ink hover:bg-slate-50',
                    )}
                  >
                    {isCurrent ? 'تجديد' : 'اشترك عبر واتساب'}
                  </a>
                )}
              </Card>
            );
          })}
      </div>

      <Card className="p-5">
        <p className="font-semibold text-ink">كيفية الاشتراك</p>
        <p className="mt-2 text-sm leading-7 text-ink-muted">
          ١. اختر نوع الاشتراك والخطة المناسبة ٢. ستنتقل إلى واتساب تلقائياً ٣. أكمل الدفع وسيتم تفعيل اشتراكك على نفس حسابك فوراً.
        </p>
      </Card>
    </div>
  );
};

export default Subscription;
