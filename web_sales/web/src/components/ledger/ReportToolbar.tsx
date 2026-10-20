import React from 'react';
import { Button, cx } from '../ui/primitives';
import { Period, PERIOD_LABELS, PeriodPreset, periodFromPreset } from '../../lib/ledger';
import { ReportTable, exportCsv, printReport } from '../../lib/export';
import { useLedger } from '../../context/LedgerContext';
import { formatNumber } from '../../lib/format';

const PRESETS: PeriodPreset[] = ['all', 'today', 'week', 'month', 'lastMonth', 'quarter', 'year', 'custom'];

/** اختيار فترة التقرير: فترات جاهزة + فترة مخصصة من/إلى */
export const PeriodPicker: React.FC<{ value: Period; onChange: (p: Period) => void; compact?: boolean }> = ({
  value,
  onChange,
  compact,
}) => (
  <div className={cx('flex flex-wrap items-center gap-2', compact && 'gap-1.5')}>
    <select
      value={value.preset}
      onChange={(e) => onChange(periodFromPreset(e.target.value as PeriodPreset, value))}
      className="h-9 rounded-lg border border-line-strong bg-surface pe-8 ps-3 text-sm text-ink shadow-sm"
      aria-label="فترة التقرير"
    >
      {PRESETS.map((p) => (
        <option key={p} value={p}>
          {PERIOD_LABELS[p]}
        </option>
      ))}
    </select>
    {value.preset !== 'all' && (
      <div className="flex items-center gap-1.5 text-xs text-ink-subtle">
        <span>من</span>
        <input
          type="date"
          value={value.from}
          onChange={(e) => onChange({ ...value, preset: 'custom', from: e.target.value })}
          className="num h-9 rounded-lg border border-line-strong bg-surface px-2 text-sm text-ink shadow-sm"
        />
        <span>إلى</span>
        <input
          type="date"
          value={value.to}
          onChange={(e) => onChange({ ...value, preset: 'custom', to: e.target.value })}
          className="num h-9 rounded-lg border border-line-strong bg-surface px-2 text-sm text-ink shadow-sm"
        />
      </div>
    )}
  </div>
);

/** أزرار تحميل التقرير (PDF / Excel) */
export const ExportButtons: React.FC<{ build: () => ReportTable; disabled?: boolean }> = ({ build, disabled }) => {
  const { company } = useLedger();
  return (
    <div className="flex items-center gap-2">
      <Button variant="secondary" size="sm" icon="download" disabled={disabled} onClick={() => printReport(build(), company)}>
        PDF
      </Button>
      <Button variant="secondary" size="sm" icon="download" disabled={disabled} onClick={() => exportCsv(build())}>
        Excel
      </Button>
    </div>
  );
};

/** مبلغ بإشارة ولون: موجب (لنا) أخضر، سالب (لهم) أحمر */
export const SignedAmount: React.FC<{ value: number; currency?: string; className?: string; label?: boolean }> = ({
  value,
  currency,
  className,
  label,
}) => (
  <span className={cx('inline-flex items-baseline gap-1', className)}>
    {label && (
      <span className={cx('text-[11px] font-medium', value >= 0 ? 'text-success-700' : 'text-danger-700')}>
        {value >= 0 ? 'لنا' : 'لهم'}
      </span>
    )}
    <span className={cx('num font-semibold', value > 0 ? 'text-success-700' : value < 0 ? 'text-danger-700' : 'text-ink-muted')}>
      {formatNumber(label ? Math.abs(value) : value)}
    </span>
    {currency && <span className="text-xs font-normal text-ink-subtle">{currency}</span>}
  </span>
);
