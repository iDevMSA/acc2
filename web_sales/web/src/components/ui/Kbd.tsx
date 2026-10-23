import React from 'react';
import { comboParts } from '../../lib/shortcuts';
import { cx } from './primitives';

/** عرض اختصار لوحة المفاتيح كأزرار صغيرة (من اليسار لليمين كما يُكتب على الكيبورد) */
const Kbd: React.FC<{ combo: string; className?: string; size?: 'sm' | 'md' }> = ({ combo, className, size = 'md' }) => {
  const parts = comboParts(combo);
  if (!parts.length) return null;
  return (
    <span dir="ltr" className={cx('inline-flex items-center gap-1', className)}>
      {parts.map((p, i) => (
        <kbd
          key={i}
          className={cx(
            'num rounded border border-line-strong bg-surface font-sans font-medium text-ink-muted shadow-[0_1px_0_rgba(15,23,42,0.08)]',
            size === 'sm' ? 'px-1 text-[10px] leading-4' : 'min-w-[1.75rem] px-1.5 py-0.5 text-center text-xs',
          )}
        >
          {p}
        </kbd>
      ))}
    </span>
  );
};

export default Kbd;
