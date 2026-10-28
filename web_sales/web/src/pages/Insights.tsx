import React from 'react';
import { useLedger } from '../context/LedgerContext';
import { Badge, Card, CardHeader, EmptyState, PageHeader, StatCard, Tone } from '../components/ui/primitives';
import { formatDate, formatNumber } from '../lib/format';

// الأداء والمخاطر كما يحسبها تطبيق الهاتف (users/{uid}/erp/insights) — نفس الأرقام
// التي يراها المستخدم في «التحليلات» على الهاتف ويقرؤها «المدقق».

interface Risk {
  id: string;
  level: 'high' | 'medium' | 'low';
  upcoming?: boolean;
  title: string;
  body: string;
}

const LEVEL: Record<Risk['level'], { label: string; tone: Tone; border: string }> = {
  high: { label: 'مرتفعة', tone: 'danger', border: 'border-r-danger-600' },
  medium: { label: 'متوسطة', tone: 'warning', border: 'border-r-warning-600' },
  low: { label: 'منخفضة', tone: 'info', border: 'border-r-sky-500' },
};

const Insights: React.FC = () => {
  const { insights, mainCurrency } = useLedger();

  if (!insights) {
    return (
      <>
        <PageHeader title="الأداء والمخاطر" description="تحليلات يحسبها تطبيق الهاتف من قيودك" />
        <EmptyState icon="chart" title="لا توجد بيانات بعد" description="افتح «التحليلات» في تطبيق الهاتف مرة واحدة لتظهر هنا" />
      </>
    );
  }

  const p = insights.performance || {};
  const cur = insights.currency || mainCurrency;
  const risks: Risk[] = Array.isArray(insights.risks) ? insights.risks : [];
  const now = risks.filter((r) => !r.upcoming);
  const next = risks.filter((r) => r.upcoming);
  const high = risks.filter((r) => r.level === 'high').length;
  const overall = high ? LEVEL.high : risks.some((r) => r.level === 'medium') ? LEVEL.medium : null;

  return (
    <>
      <PageHeader
        title="الأداء والمخاطر"
        description={`آخر تحديث من الهاتف: ${insights.updatedAt ? formatDate(insights.updatedAt, { dateStyle: 'medium', timeStyle: 'short' }) : '—'}`}
      />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="لنا" value={formatNumber(p.lana || 0)} unit={cur} tone="success" icon="coins" />
        <StatCard label="لهم" value={formatNumber(p.lahom || 0)} unit={cur} tone="danger" icon="wallet" />
        <StatCard label="صافي المركز" value={formatNumber(p.net || 0)} unit={cur} tone={(p.net || 0) >= 0 ? 'brand' : 'danger'} icon="scale" />
        <StatCard
          label="ديون بلا حركة 60 يوماً"
          value={formatNumber(p.staleTotal || 0)}
          unit={cur}
          hint={`${p.staleCount || 0} حساب`}
          tone="warning"
          icon="alert"
        />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="حركة لنا (30 يوماً)" value={formatNumber(p.periodLana || 0)} unit={cur} tone="success" icon="chart" />
        <StatCard label="حركة لهم (30 يوماً)" value={formatNumber(p.periodLahom || 0)} unit={cur} tone="danger" icon="chart" />
        <StatCard label="القيود (30 يوماً)" value={formatNumber(p.periodCount || 0, 0)} tone="brand" icon="receipt" />
      </div>

      <Card className="mt-6">
        <CardHeader
          title="المخاطر"
          subtitle="فحوص على قيودك: الحالية والمتوقعة"
          actions={overall ? <Badge tone={overall.tone}>{overall.label}</Badge> : <Badge tone="success">منخفضة</Badge>}
        />
        <div className="space-y-5 p-5">
          {risks.length === 0 && <p className="text-sm text-ink-subtle">لا مخاطر واضحة الآن.</p>}
          {[
            ['الآن', now],
            ['قادمة ومتوقعة', next],
          ].map(([label, list]) =>
            (list as Risk[]).length ? (
              <div key={label as string}>
                <p className="mb-2 text-sm font-semibold text-ink">{label as string}</p>
                <ul className="space-y-2">
                  {(list as Risk[]).map((r) => (
                    <li key={r.id} className={`rounded-xl border border-slate-100 border-r-4 bg-white p-3 ${LEVEL[r.level]?.border || ''}`}>
                      <div className="flex items-start justify-between gap-3">
                        <p className="font-semibold text-ink">{r.title}</p>
                        <Badge tone={LEVEL[r.level]?.tone || 'neutral'}>{LEVEL[r.level]?.label || r.level}</Badge>
                      </div>
                      <p className="mt-1 text-sm text-ink-subtle">{r.body}</p>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null,
          )}
        </div>
      </Card>
    </>
  );
};

export default Insights;
