import React, { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Icon from '../ui/Icon';
import { cx } from '../ui/primitives';
import { useAlerts } from '../../context/AlertsContext';
import { AlertSeverity } from '../../lib/alerts';

export const SEVERITY_DOT: Record<AlertSeverity, string> = {
  danger: 'bg-danger-600',
  warning: 'bg-warning-600',
  info: 'bg-info-600',
};

// جرس التنبيهات في الشريط العلوي: العدد وأهم التنبيهات، والتفاصيل في /alerts
const AlertsBell: React.FC = () => {
  const { alerts } = useAlerts();
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const danger = alerts.some((a) => a.severity === 'danger');

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => !box.current?.contains(e.target as Node) && setOpen(false);
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', esc);
    };
  }, [open]);

  return (
    <div ref={box} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label={`التنبيهات (${alerts.length})`}
        title="التنبيهات"
        className="relative grid h-8 w-8 place-items-center rounded-lg border border-line text-ink-muted hover:bg-slate-50"
      >
        <Icon name="bell" size={16} />
        {alerts.length > 0 && (
          <span
            className={cx(
              'num absolute -end-1.5 -top-1.5 grid h-4 min-w-4 place-items-center rounded-full px-1 text-[10px] font-bold text-white',
              danger ? 'bg-danger-600' : 'bg-warning-600',
            )}
          >
            {alerts.length > 99 ? '99+' : alerts.length}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute end-0 top-10 z-30 w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-xl border border-line bg-surface shadow-lg">
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <span className="text-sm font-semibold text-ink">التنبيهات</span>
            <span className="text-xs text-ink-subtle">{alerts.length ? `${alerts.length} تنبيه` : ''}</span>
          </div>
          {alerts.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-ink-subtle">لا توجد تنبيهات الآن</p>
          ) : (
            <ul className="max-h-80 divide-y divide-line overflow-y-auto">
              {alerts.slice(0, 8).map((a) => (
                <li key={a.id}>
                  <button
                    onClick={() => {
                      setOpen(false);
                      navigate(a.link);
                    }}
                    className="flex w-full items-start gap-3 px-4 py-3 text-start hover:bg-slate-50"
                  >
                    <span className={cx('mt-1.5 h-2 w-2 shrink-0 rounded-full', SEVERITY_DOT[a.severity])} />
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium text-ink">{a.title}</span>
                      <span className="block truncate text-xs text-ink-subtle">{a.detail}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          <Link
            to="/alerts"
            onClick={() => setOpen(false)}
            className="block border-t border-line px-4 py-2.5 text-center text-sm font-medium text-brand-700 hover:bg-slate-50"
          >
            كل التنبيهات والإعدادات
          </Link>
        </div>
      )}
    </div>
  );
};

export default AlertsBell;
