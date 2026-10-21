import React, { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import Sidebar from '../Sidebar';
import BottomNav from './BottomNav';
import { OfflineBanner, UpdateToast } from '../pwa/StatusBanners';
import Icon from '../ui/Icon';
import { useLedger } from '../../context/LedgerContext';
import { NAV_GROUPS, findNavItem } from './navigation';
import { formatDate } from '../../lib/format';
import CommandPalette, { useCommandPalette } from './CommandPalette';

const COLLAPSE_KEY = 'erp.sidebarCollapsed';

const readCollapsed = () => {
  try {
    return localStorage.getItem(COLLAPSE_KEY) === '1';
  } catch {
    return false;
  }
};

const Topbar: React.FC<{ onMenu: () => void; onSearch: () => void }> = ({ onMenu, onSearch }) => {
  const { pathname } = useLocation();
  // العملة الرئيسية المختارة في الإعدادات (وليست عملة نقاط البيع)
  const { mainCurrency: currency, company: companyInfo } = useLedger();
  const item = findNavItem(pathname);
  const group = NAV_GROUPS.find((g) => g.items.some((i) => i === item));

  return (
    <header className="sticky top-0 z-20 flex h-16 shrink-0 items-center justify-between gap-4 border-b border-line bg-surface/90 px-4 backdrop-blur sm:px-6 lg:px-8">
      <button
        onClick={onMenu}
        aria-label="فتح القائمة"
        className="-ms-1 grid h-9 w-9 shrink-0 place-items-center rounded-lg text-ink-muted hover:bg-slate-100 lg:hidden"
      >
        <Icon name="menu" size={20} />
      </button>
      <nav aria-label="مسار الصفحة" className="flex min-w-0 flex-1 items-center gap-2 text-sm">
        <span className="hidden truncate text-ink-subtle sm:inline">{companyInfo?.name || 'شركتك'}</span>
        {group && group.label !== 'عام' && group.label !== item?.label && (
          <>
            <Icon name="chevronLeft" size={14} className="hidden text-ink-faint sm:block" />
            <span className="hidden text-ink-subtle sm:inline">{group.label}</span>
          </>
        )}
        {item && (
          <>
            <Icon name="chevronLeft" size={14} className="hidden text-ink-faint sm:block" />
            <span className="truncate font-medium text-ink">{item.label}</span>
          </>
        )}
      </nav>

      <div className="flex items-center gap-2">
        <button
          onClick={onSearch}
          title="بحث شامل (Ctrl+K)"
          className="inline-flex items-center gap-2 rounded-lg border border-line px-3 py-1.5 text-xs text-ink-muted hover:bg-slate-50"
        >
          <Icon name="search" size={14} />
          <span className="hidden sm:inline">بحث</span>
          <kbd className="hidden rounded border border-line px-1 text-[10px] lg:inline">Ctrl K</kbd>
        </button>
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
  const [mobileOpen, setMobileOpen] = useState(false);
  const { pathname } = useLocation();
  const palette = useCommandPalette();

  // إغلاق الدرج عند الانتقال لصفحة أخرى
  useEffect(() => setMobileOpen(false), [pathname]);

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
    <div className="flex h-[100dvh] overflow-hidden bg-canvas">
      <Sidebar
        collapsed={collapsed}
        onToggle={toggle}
        mobileOpen={mobileOpen}
        onMobileClose={() => setMobileOpen(false)}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar onMenu={() => setMobileOpen(true)} onSearch={() => palette.setOpen(true)} />
        <OfflineBanner />
        <main className="flex-1 overflow-y-auto">
          <div className="mx-auto w-full max-w-[1400px] px-4 pb-[calc(6rem+env(safe-area-inset-bottom))] pt-5 sm:px-6 md:pb-7 lg:px-8 lg:pt-7">
            {children}
          </div>
        </main>
        <BottomNav />
        <UpdateToast />
        <CommandPalette open={palette.open} onClose={() => palette.setOpen(false)} />
      </div>
    </div>
  );
};

export default AppShell;
