import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AppProvider, useApp } from './context/AppContext';
import LoginPage from './pages/LoginPage';
import Dashboard from './pages/Dashboard';
import Accounting from './pages/Accounting';
import Invoices from './pages/Invoices';
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

  return <AppShell>{children}</AppShell>;
};

function App() {
  return (
    <AppProvider>
      <Router>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route
            path="/"
            element={
              <ProtectedLayout>
                <Dashboard />
              </ProtectedLayout>
            }
          />
          <Route
            path="/accounting"
            element={
              <ProtectedLayout>
                <Accounting />
              </ProtectedLayout>
            }
          />
          <Route
            path="/invoices"
            element={
              <ProtectedLayout>
                <Invoices />
              </ProtectedLayout>
            }
          />
          <Route
            path="/reports"
            element={
              <ProtectedLayout>
                <Reports />
              </ProtectedLayout>
            }
          />
        </Routes>
      </Router>
    </AppProvider>
  );
}

export default App;
