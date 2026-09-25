import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useApp } from '../context/AppContext';

const Sidebar: React.FC = () => {
  const { logout, companyInfo } = useApp();
  const location = useLocation();

  const menuItems = [
    { path: '/', label: 'الرئيسية', icon: '📊' },
    { path: '/invoices', label: 'الفواتير', icon: '🧾' },
    { path: '/accounting', label: 'المحاسبة', icon: '📋' },
    { path: '/reports', label: 'التقارير', icon: '📈' },
  ];

  return (
    <aside className="w-64 bg-blue-900 text-white h-screen flex flex-col shadow-lg">
      {/* Header */}
      <div className="p-6 border-b border-blue-800">
        <h1 className="text-2xl font-bold">المنصة المحاسبية</h1>
        <p className="text-blue-200 text-sm mt-1">{companyInfo?.name || 'شركتك'}</p>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4">
        {menuItems.map((item) => (
          <Link
            key={item.path}
            to={item.path}
            className={`flex items-center gap-3 px-4 py-3 rounded-lg mb-2 transition ${
              location.pathname === item.path
                ? 'bg-blue-700 text-white'
                : 'text-blue-100 hover:bg-blue-800'
            }`}
          >
            <span className="text-xl">{item.icon}</span>
            <span>{item.label}</span>
          </Link>
        ))}
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-blue-800">
        <button
          onClick={logout}
          className="w-full px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg transition text-sm"
        >
          تسجيل الخروج
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;
