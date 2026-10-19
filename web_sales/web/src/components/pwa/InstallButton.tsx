import React, { useState } from 'react';
import Icon from '../ui/Icon';
import { cx } from '../ui/primitives';
import { useInstall } from '../../lib/pwa';

interface InstallButtonProps {
  /** dark: داخل الشريط الجانبي الداكن، light: على خلفية فاتحة */
  variant?: 'dark' | 'light';
  compact?: boolean;
  className?: string;
}

// زر "تثبيت التطبيق": يفتح نافذة التثبيت في Chrome/Edge (ويندوز، ماك، أندرويد)،
// ويعرض خطوات "إضافة إلى الشاشة الرئيسية" على iPhone و iPad لأن Safari لا يدعم التثبيت البرمجي.
const InstallButton: React.FC<InstallButtonProps> = ({ variant = 'light', compact, className }) => {
  const { mode, promptInstall } = useInstall();
  const [showIos, setShowIos] = useState(false);

  if (!mode) return null;

  return (
    <>
      <button
        onClick={() => (mode === 'prompt' ? promptInstall() : setShowIos(true))}
        title="تثبيت التطبيق"
        className={cx(
          'flex items-center gap-3 rounded-lg text-sm font-medium transition',
          compact ? 'h-10 w-10 justify-center' : 'h-10 w-full px-3',
          variant === 'dark'
            ? 'bg-brand-600/20 text-brand-200 ring-1 ring-inset ring-brand-400/30 hover:bg-brand-600/30 hover:text-white'
            : 'bg-brand-50 text-brand-700 ring-1 ring-inset ring-brand-200 hover:bg-brand-100',
          className,
        )}
      >
        <Icon name="install" size={18} />
        {!compact && <span>تثبيت التطبيق</span>}
      </button>

      {showIos && (
        <div
          className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center"
          role="dialog"
          aria-modal="true"
        >
          <div className="absolute inset-0 bg-slate-900/50" onClick={() => setShowIos(false)} aria-hidden="true" />
          <div className="relative w-full max-w-sm rounded-t-2xl bg-surface p-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))] text-ink shadow-pop sm:rounded-2xl sm:pb-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold">تثبيت التطبيق على جهازك</h2>
                <p className="mt-1 text-sm text-ink-subtle">يعمل من الشاشة الرئيسية، حتى بدون اتصال.</p>
              </div>
              <button
                onClick={() => setShowIos(false)}
                aria-label="إغلاق"
                className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-ink-subtle hover:bg-slate-100"
              >
                <Icon name="close" size={18} />
              </button>
            </div>
            <ol className="mt-5 space-y-4 text-sm">
              {[
                { icon: 'share' as const, text: 'اضغط زر المشاركة في شريط Safari' },
                { icon: 'plusSquare' as const, text: 'اختر «إضافة إلى الشاشة الرئيسية»' },
                { icon: 'check' as const, text: 'اضغط «إضافة» — ستجد أيقونة المنصة على الشاشة' },
              ].map((step, i) => (
                <li key={i} className="flex items-center gap-3">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-brand-50 text-brand-600">
                    <Icon name={step.icon} size={18} />
                  </span>
                  <span>
                    <span className="num me-1 font-semibold text-ink-subtle">{i + 1}.</span>
                    {step.text}
                  </span>
                </li>
              ))}
            </ol>
          </div>
        </div>
      )}
    </>
  );
};

export default InstallButton;
