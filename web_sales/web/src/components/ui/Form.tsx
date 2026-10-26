import React, { useEffect, useMemo, useRef, useState } from 'react';
import Icon from './Icon';
import { cx } from './primitives';
import { playSound } from '../../lib/sounds';

// عناصر نماذج الإدخال الموحّدة.

export const Field: React.FC<{ label: string; hint?: React.ReactNode; className?: string; children: React.ReactNode }> = ({
  label,
  hint,
  className,
  children,
}) => (
  <label className={cx('block', className)}>
    <span className="field-label">{label}</span>
    {children}
    {hint && <span className="mt-1 block text-xs text-ink-subtle">{hint}</span>}
  </label>
);

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...rest }, refEl) => <input ref={refEl} className={cx('field-input', className)} {...rest} />,
);
Input.displayName = 'Input';

export const Select: React.FC<React.SelectHTMLAttributes<HTMLSelectElement>> = ({ className, children, ...rest }) => (
  <select className={cx('field-input pe-8', className)} {...rest}>
    {children}
  </select>
);

export const Textarea: React.FC<React.TextareaHTMLAttributes<HTMLTextAreaElement>> = ({ className, ...rest }) => (
  <textarea className={cx('field-input min-h-[72px]', className)} {...rest} />
);

/** مفتاح اختيار من خيارين أو ثلاثة (لنا/لهم، نقدي/آجل ...) */
export function Segmented<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: Array<{ value: T; label: string; tone?: 'success' | 'danger' | 'brand' }>;
}) {
  return (
    <div className="grid auto-cols-fr grid-flow-col gap-1 rounded-xl border border-line bg-slate-50 p-1">
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(o.value)}
            className={cx(
              'h-9 rounded-lg text-sm font-medium transition',
              active
                ? o.tone === 'success'
                  ? 'bg-success-600 text-white shadow-sm'
                  : o.tone === 'danger'
                    ? 'bg-danger-600 text-white shadow-sm'
                    : 'bg-brand-600 text-white shadow-sm'
                : 'text-ink-muted hover:bg-white',
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export interface PickerOption {
  value: string;
  label: string;
  hint?: string;
}

/** قائمة منسدلة قابلة للبحث (لاختيار الحسابات من بين المئات) */
export const SearchSelect: React.FC<{
  value: string;
  onChange: (v: string) => void;
  options: PickerOption[];
  placeholder?: string;
  allowEmpty?: boolean;
}> = ({ value, onChange, options, placeholder = 'اختر...', allowEmpty }) => {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const box = useRef<HTMLDivElement>(null);
  const selected = options.find((o) => o.value === value);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  const filtered = useMemo(() => {
    const s = q.trim();
    return (s ? options.filter((o) => o.label.includes(s) || o.hint?.includes(s) || o.value.includes(s)) : options).slice(
      0,
      200,
    );
  }, [options, q]);

  return (
    <div ref={box} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="field-input flex items-center justify-between gap-2 text-start"
      >
        <span className={cx('truncate', !selected && 'text-ink-faint')}>{selected?.label || placeholder}</span>
        <Icon name="chevronDown" size={16} className="shrink-0 text-ink-subtle" />
      </button>
      {open && (
        <div className="absolute inset-x-0 top-full z-30 mt-1 overflow-hidden rounded-xl border border-line bg-surface shadow-pop">
          <div className="border-b border-line p-2">
            <input
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="بحث بالاسم أو الرقم..."
              className="w-full rounded-lg bg-slate-50 px-3 py-2 text-sm outline-none"
            />
          </div>
          <ul className="max-h-64 overflow-y-auto py-1">
            {allowEmpty && (
              <li>
                <button
                  type="button"
                  onClick={() => {
                    onChange('');
                    setOpen(false);
                  }}
                  className="w-full px-3 py-2 text-start text-sm text-ink-subtle hover:bg-slate-50"
                >
                  — بدون —
                </button>
              </li>
            )}
            {filtered.map((o) => (
              <li key={o.value}>
                <button
                  type="button"
                  onClick={() => {
                    onChange(o.value);
                    setOpen(false);
                    setQ('');
                  }}
                  className={cx(
                    'flex w-full items-center justify-between gap-3 px-3 py-2 text-start text-sm hover:bg-slate-50',
                    o.value === value && 'bg-brand-50 text-brand-700',
                  )}
                >
                  <span className="truncate">{o.label}</span>
                  {o.hint && <span className="num shrink-0 text-xs text-ink-subtle">{o.hint}</span>}
                </button>
              </li>
            ))}
            {filtered.length === 0 && <li className="px-3 py-4 text-center text-xs text-ink-subtle">لا نتائج</li>}
          </ul>
        </div>
      )}
    </div>
  );
};

export const FormError: React.FC<{ message?: string | null }> = ({ message }) => {
  // كل رسالة خطأ جديدة في نموذج (تحقق أو رفض الحفظ) يصحبها صوت الفشل
  useEffect(() => {
    if (message) playSound('error');
  }, [message]);
  return message ? (
    <p className="mt-4 flex items-center gap-2 rounded-lg bg-danger-50 px-3 py-2 text-sm text-danger-700">
      <Icon name="alert" size={16} /> {message}
    </p>
  ) : null;
};
