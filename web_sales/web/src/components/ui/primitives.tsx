import React from 'react';
import Icon, { IconName } from './Icon';

export const cx = (...classes: Array<string | false | null | undefined>) => classes.filter(Boolean).join(' ');

/* ───────── Button ───────── */

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

const buttonVariants: Record<ButtonVariant, string> = {
  primary: 'bg-brand-600 text-white shadow-sm hover:bg-brand-700 disabled:bg-brand-300',
  secondary: 'bg-surface text-ink border border-line-strong shadow-sm hover:bg-slate-50',
  ghost: 'text-ink-muted hover:bg-slate-100 hover:text-ink',
  danger: 'bg-danger-600 text-white shadow-sm hover:bg-danger-700',
};

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: 'sm' | 'md' | 'lg';
  icon?: IconName;
}

export const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  size = 'md',
  icon,
  className,
  children,
  ...rest
}) => (
  <button
    className={cx(
      'inline-flex items-center justify-center gap-2 rounded-lg font-medium transition disabled:cursor-not-allowed disabled:opacity-70',
      size === 'sm' && 'h-8 px-3 text-xs',
      size === 'md' && 'h-10 px-4 text-sm',
      size === 'lg' && 'h-11 px-5 text-sm',
      buttonVariants[variant],
      className,
    )}
    {...rest}
  >
    {icon && <Icon name={icon} size={size === 'sm' ? 14 : 16} />}
    {children}
  </button>
);

/* ───────── Card ───────── */

export const Card: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({ className, ...rest }) => (
  <div className={cx('rounded-xl border border-line bg-surface shadow-card', className)} {...rest} />
);

interface CardHeaderProps {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}

export const CardHeader: React.FC<CardHeaderProps> = ({ title, subtitle, actions, className }) => (
  <div className={cx('flex items-start justify-between gap-4 border-b border-line px-5 py-4', className)}>
    <div className="min-w-0">
      <h2 className="text-[15px] font-semibold text-ink">{title}</h2>
      {subtitle && <p className="mt-0.5 text-xs text-ink-subtle">{subtitle}</p>}
    </div>
    {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
  </div>
);

/* ───────── PageHeader ───────── */

interface PageHeaderProps {
  title: string;
  description?: React.ReactNode;
  actions?: React.ReactNode;
}

export const PageHeader: React.FC<PageHeaderProps> = ({ title, description, actions }) => (
  <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
    <div>
      <h1 className="text-2xl font-bold tracking-tight text-ink">{title}</h1>
      {description && <p className="mt-1 text-sm text-ink-subtle">{description}</p>}
    </div>
    {actions && <div className="flex items-center gap-2">{actions}</div>}
  </div>
);

/* ───────── StatCard ───────── */

export type Tone = 'brand' | 'success' | 'danger' | 'warning' | 'info' | 'neutral';

const toneIcon: Record<Tone, string> = {
  brand: 'bg-brand-50 text-brand-600 ring-brand-100',
  success: 'bg-success-50 text-success-600 ring-success-100',
  danger: 'bg-danger-50 text-danger-600 ring-danger-100',
  warning: 'bg-warning-50 text-warning-600 ring-warning-100',
  info: 'bg-info-50 text-info-600 ring-info-100',
  neutral: 'bg-slate-100 text-ink-muted ring-slate-200',
};

interface StatCardProps {
  label: string;
  value: React.ReactNode;
  unit?: string;
  hint?: React.ReactNode;
  icon?: IconName;
  tone?: Tone;
}

export const StatCard: React.FC<StatCardProps> = ({ label, value, unit, hint, icon, tone = 'brand' }) => (
  <Card className="p-4 sm:p-5">
    <div className="flex items-start justify-between gap-3">
      <p className="text-sm font-medium text-ink-subtle">{label}</p>
      {icon && (
        <span className={cx('hidden h-9 w-9 shrink-0 sm:grid place-items-center rounded-lg ring-1', toneIcon[tone])}>
          <Icon name={icon} size={18} />
        </span>
      )}
    </div>
    <div className="mt-3 flex items-baseline gap-1.5">
      <span className="num text-xl sm:text-[26px] font-semibold leading-none tracking-tight text-ink">{value}</span>
      {unit && <span className="text-xs font-medium text-ink-subtle">{unit}</span>}
    </div>
    {hint && <p className="mt-2 text-xs text-ink-subtle">{hint}</p>}
  </Card>
);

/* ───────── Badge ───────── */

const badgeTones: Record<Tone, string> = {
  brand: 'bg-brand-50 text-brand-700 ring-brand-200/60',
  success: 'bg-success-50 text-success-700 ring-success-100',
  danger: 'bg-danger-50 text-danger-700 ring-danger-100',
  warning: 'bg-warning-50 text-warning-700 ring-warning-100',
  info: 'bg-info-50 text-info-700 ring-info-100',
  neutral: 'bg-slate-100 text-ink-muted ring-slate-200',
};

export const Badge: React.FC<{ tone?: Tone; children: React.ReactNode; className?: string }> = ({
  tone = 'neutral',
  children,
  className,
}) => (
  <span
    className={cx(
      'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset',
      badgeTones[tone],
      className,
    )}
  >
    {children}
  </span>
);

/* ───────── EmptyState ───────── */

export const EmptyState: React.FC<{ icon?: IconName; title: string; description?: string; className?: string }> = ({
  icon = 'inbox',
  title,
  description,
  className,
}) => (
  <div className={cx('flex flex-col items-center justify-center px-6 py-12 text-center', className)}>
    <span className="grid h-12 w-12 place-items-center rounded-full bg-slate-100 text-ink-faint">
      <Icon name={icon} size={22} />
    </span>
    <p className="mt-3 text-sm font-semibold text-ink">{title}</p>
    {description && <p className="mt-1 max-w-sm text-xs text-ink-subtle">{description}</p>}
  </div>
);

/* ───────── Spinner ───────── */

export const Spinner: React.FC<{ className?: string }> = ({ className }) => (
  <span
    className={cx(
      'inline-block h-5 w-5 animate-spin rounded-full border-2 border-brand-200 border-t-brand-600',
      className,
    )}
    role="status"
    aria-label="جاري التحميل"
  />
);

/* ───────── Tabs (segmented) ───────── */

interface TabsProps<T extends string> {
  value: T;
  onChange: (value: T) => void;
  items: Array<{ value: T; label: string; icon?: IconName }>;
}

export function Tabs<T extends string>({ value, onChange, items }: TabsProps<T>) {
  return (
    <div
      role="tablist"
      className="inline-flex max-w-full gap-1 overflow-x-auto rounded-xl border border-line bg-surface p-1 shadow-card"
    >
      {items.map((item) => {
        const active = item.value === value;
        return (
          <button
            key={item.value}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(item.value)}
            className={cx(
              'inline-flex h-9 shrink-0 items-center gap-2 whitespace-nowrap rounded-lg px-4 text-sm font-medium transition',
              active ? 'bg-brand-600 text-white shadow-sm' : 'text-ink-muted hover:bg-slate-100 hover:text-ink',
            )}
          >
            {item.icon && <Icon name={item.icon} size={16} />}
            {item.label}
          </button>
        );
      })}
    </div>
  );
}
