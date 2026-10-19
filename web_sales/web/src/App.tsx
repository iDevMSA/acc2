import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AppProvider, useApp } from './context/AppContext';
import { LedgerProvider } from './context/LedgerContext';
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
import Reports from './pages/Reports';
import { BrandMark } from './components/Sidebar';
import AppShell from './components/layout/AppShell';
import { Spinner } from './components/ui/primitives';

const ProtectedLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, loading } = useApp();

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

  return (
    <LedgerProvider>
      <AppShell>{children}</AppShell>
    </LedgerProvider>
  );
};

const PAGES: Array<[string, React.ReactNode]> = [
  ['/', <Dashboard />],
  ['/hub', <Hub />],
  ['/accounts', <Accounts />],
  ['/accounts/:id', <AccountDetail />],
  ['/accounting', <Accounting />],
  ['/cashboxes', <Cashboxes />],
  ['/vouchers', <Vouchers />],
  ['/cheques', <Cheques />],
  ['/warehouses', <Warehouses />],
  ['/invoices', <Invoices />],
  ['/reports', <Reports />],
];

function App() {
  return (
    <AppProvider>
      <Router>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
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
