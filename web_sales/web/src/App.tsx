import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AppProvider, useApp } from './context/AppContext';
import { LedgerProvider } from './context/LedgerContext';
import { PosProvider } from './context/PosContext';
import { ShortcutsProvider } from './context/ShortcutsContext';
import LoginPage from './pages/LoginPage';
import Dashboard from './pages/Dashboard';
import Accounting from './pages/Accounting';
import Accounts from './pages/Accounts';
import AccountDetail from './pages/AccountDetail';
import Invoices from './pages/Invoices';
import Cashboxes from './pages/Cashboxes';
import Vouchers from './pages/Vouchers';
import Warehouses from './pages/Warehouses';
import Cheques from './pages/Cheques';
import Hub from './pages/Hub';
import Settings from './pages/Settings';
import ShortcutsSettings from './pages/ShortcutsSettings';
import Reports from './pages/Reports';
import Trade from './pages/Trade';
import Notes from './pages/Notes';
import Payroll from './pages/Payroll';
import Rates from './pages/Rates';
import Charts from './pages/Charts';
import Subscription from './pages/Subscription';
import PosAdmin from './pages/pos/PosAdmin';
import Cashier from './pages/pos/Cashier';
import { BrandMark } from './components/Sidebar';
import AppShell from './components/layout/AppShell';
import { Spinner } from './components/ui/primitives';
import Taxes from './pages/Taxes';
import EInvoice from './pages/EInvoice';
import Alerts from './pages/Alerts';
import { AlertsProvider } from './context/AlertsContext';
import Team from './pages/Team';
import Audit from './pages/Audit';
import Import from './pages/Import';
import { canOpen } from './lib/team';
import { EmptyState } from './components/ui/primitives';

const NoAccess: React.FC = () => (
  <EmptyState icon="lock" title="ليس لديك صلاحية فتح هذه الصفحة" description="اطلب من صاحب الحساب منحك الصلاحية من صفحة الفريق والصلاحيات" className="py-24" />
);

const ProtectedLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, loading, isCashier, member, suspended, logout } = useApp();
  const { pathname } = useLocation();

  if (loading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-canvas">
        <BrandMark className="h-11 w-11" />
        <Spinner />
        <p className="text-sm text-ink-subtle">جاري التحميل...</p>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" />;
  }

  if (suspended) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-canvas px-6 text-center">
        <BrandMark className="h-11 w-11" />
        <p className="text-base font-semibold text-ink">أوقف صاحب الحساب صلاحية دخولك</p>
        <p className="text-sm text-ink-subtle">تواصل معه لإعادة تفعيل حسابك.</p>
        <button onClick={logout} className="text-sm font-medium text-brand-700">
          تسجيل الخروج
        </button>
      </div>
    );
  }

  // الكاشير لا يرى إلا واجهة نقطة البيع على صندوقه (لا صلاحية له على حسابات المالك)
  if (isCashier) {
    if (pathname !== '/pos') return <Navigate to="/pos" replace />;
    return (
      <PosProvider>
        <main className="min-h-[100dvh] bg-canvas px-3 py-3 sm:px-6 sm:py-5">
          <Cashier />
        </main>
      </PosProvider>
    );
  }

  return (
    <LedgerProvider>
      <PosProvider>
        <AlertsProvider>
          <ShortcutsProvider>
            <AppShell>{canOpen(member, pathname) ? children : <NoAccess />}</AppShell>
          </ShortcutsProvider>
        </AlertsProvider>
      </PosProvider>
    </LedgerProvider>
  );
};

const PAGES: Array<[string, React.ReactNode]> = [
  ['/', <Dashboard />],
  ['/hub', <Hub />],
  ['/settings', <Settings />],
  ['/settings/shortcuts', <ShortcutsSettings />],
  ['/subscription', <Subscription />],
  ['/accounts', <Accounts />],
  ['/accounts/:id', <AccountDetail />],
  ['/accounting', <Accounting />],
  ['/cashboxes', <Cashboxes />],
  ['/vouchers', <Vouchers />],
  ['/cheques', <Cheques />],
  ['/warehouses', <Warehouses />],
  ['/invoices', <Invoices />],
  ['/reports', <Reports />],
  ['/trade', <Trade />],
  ['/notes', <Notes />],
  ['/payroll', <Payroll />],
  ['/rates', <Rates />],
  ['/charts', <Charts />],
  ['/taxes', <Taxes />],
  ['/einvoice', <EInvoice />],
  ['/alerts', <Alerts />],
  ['/team', <Team />],
  ['/audit', <Audit />],
  ['/import', <Import />],
  ['/pos-admin', <PosAdmin />],
  ['/pos', <Cashier />],
];

function App() {
  return (
    <AppProvider>
      <Router basename={process.env.PUBLIC_URL || undefined}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<LoginPage mode="signup" />} />
          {PAGES.map(([path, page]) => (
            <Route key={path} path={path} element={<ProtectedLayout>{page}</ProtectedLayout>} />
          ))}
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </Router>
    </AppProvider>
  );
}

export default App;
