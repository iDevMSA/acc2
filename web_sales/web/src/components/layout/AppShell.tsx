import React, { useState } from 'react';
import { useLocation } from 'react-router-dom';
import Sidebar from '../Sidebar';
import Icon from '../ui/Icon';
import { useApp } from '../../context/AppContext';
import { NAV_GROUPS } from './navigation';
import { formatDate } from '../../lib/format';

const COLLAPSE_KEY = 'erp.sidebarCollapsed';

const readCollapsed = () => {
  try {
    return localStorage.getItem(COLLAPSE_KEY) === '1';
  } catch {
    return false;
  }
};

const Topbar: React.FC = () => {
  const { pathname } = useLocation();
  const { currency, companyInfo } = useApp();
  const group = NAV_GROUPS.find((g) => g.items.some((i) => i.path === pathname));
  const item = group?.items.find((i) => i.path === pathname);

  return (
    <header className="sticky top-0 z-20 flex h-16 shrink-0 items-center justify-between gap-4 border-b border-line bg-surface/90 px-8 backdrop-blur">
      <nav aria-label="مسار الصفحة" className="flex min-w-0 items-center gap-2 text-sm">
        <span className="text-ink-subtle">{companyInfo?.name || 'شركتك'}</span>
        {group && group.label !== 'عام' && group.label !== item?.label && (
          <>
            <Icon name="chevronLeft" size={14} className="text-ink-faint" />
            <span className="text-ink-subtle">{group.label}</span>
          </>
        )}
        {item && (
          <>
            <Icon name="chevronLeft" size={14} className="text-ink-faint" />
            <span className="font-medium text-ink">{item.label}</span>
          </>
        )}
      </nav>

      <div className="flex items-center gap-2">
        <span className="hidden items-center gap-2 rounded-lg border border-line px-3 py-1.5 text-xs text-ink-muted md:inline-flex">
          <Icon name="calendar" size={14} />
          {formatDate(new Date(), { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
        </span>
        <span className="inline-flex items-center gap-2 rounded-lg border border-line px-3 py-1.5 text-xs text-ink-muted">
          <Icon name="coins" size={14} />
          <span className="num font-semibold text-ink">{currency}</span>
        </span>
      </div>
    </header>
  );
};

const AppShell: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [collapsed, setCollapsed] = useState(readCollapsed);

  const toggle = () =>
    setCollapsed((c) => {
      try {
        localStorage.setItem(COLLAPSE_KEY, c ? '0' : '1');
      } catch {
        // التخزين غير متاح (وضع خاص مثلاً) — نكتفي بالحالة في الذاكرة
      }
      return !c;
    });

  return (
    <div className="flex h-screen overflow-hidden bg-canvas">
      <Sidebar collapsed={collapsed} onToggle={toggle} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar />
        <main className="flex-1 overflow-y-auto">
          <div className="mx-auto w-full max-w-[1400px] px-8 py-7">{children}</div>
        </main>
      </div>
    </div>
  );
};

export default AppShell;
