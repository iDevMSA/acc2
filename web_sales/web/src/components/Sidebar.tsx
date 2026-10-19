import React from 'react';
import { NavLink } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import Icon from './ui/Icon';
import { cx } from './ui/primitives';
import { NAV_GROUPS } from './layout/navigation';
import InstallButton from './pwa/InstallButton';

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
  /** على الشاشات الأصغر من lg تظهر القائمة كدرج منزلق */
  mobileOpen: boolean;
  onMobileClose: () => void;
}

export const BrandMark: React.FC<{ className?: string }> = ({ className }) => (
  <span
    className={cx(
      'grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-brand-400 to-brand-700 text-white shadow-sm',
      className,
    )}
  >
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.2}
      strokeLinecap="round"
    >
      <path d="M5 19V11M12 19V5M19 19v-5" />
    </svg>
  </span>
);

const Sidebar: React.FC<SidebarProps> = ({ collapsed: collapsedPref, onToggle, mobileOpen, onMobileClose }) => {
  const { logout, companyInfo, user } = useApp();
  const companyName = companyInfo?.name || 'شركتك';
  // الدرج على الجوال يُعرض دائماً موسّعاً
  const collapsed = collapsedPref && !mobileOpen;

  return (
    <>
      {mobileOpen && (
        <div
          className="fixed inset-0 z-30 bg-slate-900/50 backdrop-blur-[1px] lg:hidden"
          onClick={onMobileClose}
          aria-hidden="true"
        />
      )}
      <aside
        className={cx(
          'fixed inset-y-0 start-0 z-40 flex h-[100dvh] shrink-0 flex-col bg-nav text-nav-text transition-[width,transform] duration-200 lg:static',
          mobileOpen ? 'shadow-pop' : 'max-lg:ltr:-translate-x-full max-lg:rtl:translate-x-full',
          collapsed ? 'w-[72px]' : 'w-64',
        )}
      >
        {/* الشعار */}
        <div
          className={cx(
            'flex h-16 items-center gap-3 border-b border-white/5',
            collapsed ? 'justify-center px-0' : 'px-5',
          )}
        >
          <BrandMark />
          {!collapsed && (
            <div className="min-w-0 flex-1">
              <p className="truncate text-[15px] font-bold text-white">المنصة المحاسبية</p>
              <p className="truncate text-xs text-nav-text">{companyName}</p>
            </div>
          )}
          {mobileOpen && (
            <button
              onClick={onMobileClose}
              aria-label="إغلاق القائمة"
              className="grid h-8 w-8 place-items-center rounded-md text-nav-text hover:bg-white/10 hover:text-white lg:hidden"
            >
              <Icon name="close" size={18} />
            </button>
          )}
        </div>

        {/* التنقل */}
        <nav className="flex-1 overflow-y-auto px-3 py-4">
          {NAV_GROUPS.map((group) => (
            <div key={group.label} className="mb-5">
              {!collapsed && (
                <p className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-wider text-white/35">
                  {group.label}
                </p>
              )}
              <ul className="space-y-1">
                {group.items.map((item) => (
                  <li key={item.path}>
                    <NavLink
                      to={item.path}
                      end
                      title={collapsed ? item.label : undefined}
                      className={({ isActive }) =>
                        cx(
                          'group relative flex h-10 items-center gap-3 rounded-lg text-sm font-medium transition',
                          collapsed ? 'justify-center' : 'px-3',
                          isActive ? 'bg-nav-active text-white' : 'hover:bg-nav-hover hover:text-white',
                        )
                      }
                    >
                      {({ isActive }) => (
                        <>
                          {isActive && (
                            <span className="absolute inset-y-2 start-0 w-[3px] rounded-e-full bg-brand-400" />
                          )}
                          <Icon name={item.icon} size={19} className={isActive ? 'text-brand-300' : ''} />
                          {!collapsed && <span>{item.label}</span>}
                        </>
                      )}
                    </NavLink>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>

        {/* المستخدم */}
        <div className="border-t border-white/5 p-3">
          <InstallButton variant="dark" compact={collapsed} className={cx('mb-2', collapsed && 'mx-auto')} />
          <div className={cx('flex items-center gap-3 rounded-lg p-2', collapsed && 'flex-col')}>
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white/10 text-sm font-semibold text-white">
              {(user?.email || companyName).charAt(0).toUpperCase()}
            </span>
            {!collapsed && (
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-white">{companyName}</p>
                <p className="truncate text-xs" dir="ltr">
                  {user?.email}
                </p>
              </div>
            )}
            <button
              onClick={logout}
              title="تسجيل الخروج"
              aria-label="تسجيل الخروج"
              className="grid h-8 w-8 shrink-0 place-items-center rounded-md text-nav-text transition hover:bg-white/10 hover:text-white"
            >
              <Icon name="logout" size={17} className="rtl:-scale-x-100" />
            </button>
          </div>
          <button
            onClick={onToggle}
            className={cx(
              'mt-1 hidden h-9 w-full items-center gap-3 rounded-lg lg:flex text-xs text-white/50 transition hover:bg-nav-hover hover:text-white',
              collapsed ? 'justify-center' : 'px-3',
            )}
            aria-label={collapsed ? 'توسيع القائمة' : 'طي القائمة'}
          >
            <Icon name="sidebar" size={17} />
            {!collapsed && <span>طي القائمة</span>}
          </button>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;
