import React, { useEffect } from 'react';
import Icon from './Icon';

interface DrawerProps {
  open: boolean;
  onClose: () => void;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
}

// لوحة جانبية تنزلق من طرف الشاشة (اليسار في الواجهة العربية) لعرض التفاصيل دون مغادرة القائمة.
const Drawer: React.FC<DrawerProps> = ({ open, onClose, title, subtitle, actions, children, footer }) => {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-[1px]" onClick={onClose} aria-hidden="true" />
      <aside className="absolute inset-y-0 end-0 flex w-full max-w-xl flex-col bg-surface shadow-pop">
        <header className="flex items-start justify-between gap-4 border-b border-line px-6 py-5">
          <div className="min-w-0">
            <h2 className="text-lg font-semibold text-ink">{title}</h2>
            {subtitle && <div className="mt-1 text-sm text-ink-subtle">{subtitle}</div>}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {actions}
            <button
              onClick={onClose}
              aria-label="إغلاق"
              className="grid h-9 w-9 place-items-center rounded-lg text-ink-subtle hover:bg-slate-100 hover:text-ink"
            >
              <Icon name="close" size={18} />
            </button>
          </div>
        </header>
        <div className="flex-1 overflow-y-auto">{children}</div>
        {footer && <footer className="border-t border-line bg-slate-50 px-6 py-4">{footer}</footer>}
      </aside>
    </div>
  );
};

export default Drawer;
