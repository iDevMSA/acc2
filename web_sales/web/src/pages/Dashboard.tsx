import React, { useEffect, useState } from 'react';
import { db } from '../config/firebase';
import { ref, onValue } from 'firebase/database';
import { useApp } from '../context/AppContext';

const Dashboard: React.FC = () => {
  const { user, currency } = useApp();
  const [kpis, setKpis] = useState({
    revenue: 0,
    invoices: 0,
    branches: 0,
    registers: 0,
  });
  const [invoices, setInvoices] = useState<any[]>([]);

  useEffect(() => {
    if (!user) return;

    // تحميل الفواتير
    const invoicesRef = ref(db, `sales/${user.uid}/invoices`);
    onValue(invoicesRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const allInvoices = Object.entries(data).map(([id, inv]: any) => ({
          id,
          ...inv,
        }));

        // حساب KPIs
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        const todayInvoices = allInvoices.filter((inv) => {
          const invDate = new Date(inv.createdAt || inv.date || '');
          invDate.setHours(0, 0, 0, 0);
          return invDate.getTime() === today.getTime() && inv.status === 'closed';
        });

        const revenue = todayInvoices.reduce((sum: number, inv: any) => sum + (inv.total || 0), 0);

        setKpis({
          revenue,
          invoices: todayInvoices.length,
          branches: 0,
          registers: 0,
        });

        setInvoices(todayInvoices.sort((a, b) => 
          new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
        ).slice(0, 8));
      }
    });
  }, [user]);

  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold text-gray-900 mb-8">لوحة التحكم</h1>

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-blue-50 border-l-4 border-blue-600 p-6 rounded">
          <div className="text-3xl font-bold text-blue-600">
            {kpis.revenue.toFixed(2)}
          </div>
          <div className="text-gray-600 text-sm mt-2">إيرادات اليوم ({currency})</div>
        </div>

        <div className="bg-green-50 border-l-4 border-green-600 p-6 rounded">
          <div className="text-3xl font-bold text-green-600">{kpis.invoices}</div>
          <div className="text-gray-600 text-sm mt-2">فواتير اليوم</div>
        </div>

        <div className="bg-purple-50 border-l-4 border-purple-600 p-6 rounded">
          <div className="text-3xl font-bold text-purple-600">0</div>
          <div className="text-gray-600 text-sm mt-2">الفروع</div>
        </div>

        <div className="bg-orange-50 border-l-4 border-orange-600 p-6 rounded">
          <div className="text-3xl font-bold text-orange-600">0</div>
          <div className="text-gray-600 text-sm mt-2">الصناديق المفتوحة</div>
        </div>
      </div>

      {/* آخر الفواتير */}
      <div className="bg-white rounded-lg shadow">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-xl font-bold text-gray-900">آخر الفواتير</h2>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-right text-sm font-semibold text-gray-900">الرقم</th>
                <th className="px-6 py-3 text-right text-sm font-semibold text-gray-900">العميل</th>
                <th className="px-6 py-3 text-right text-sm font-semibold text-gray-900">المبلغ</th>
                <th className="px-6 py-3 text-right text-sm font-semibold text-gray-900">التاريخ</th>
              </tr>
            </thead>
            <tbody>
              {invoices.length > 0 ? (
                invoices.map((inv) => (
                  <tr key={inv.id} className="border-b hover:bg-gray-50">
                    <td className="px-6 py-4 text-sm text-gray-900">{inv.number || inv.id}</td>
                    <td className="px-6 py-4 text-sm text-gray-600">{inv.customerName || '—'}</td>
                    <td className="px-6 py-4 text-sm font-semibold text-gray-900">
                      {inv.total?.toFixed(2)} {currency}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {new Date(inv.createdAt || inv.date || '').toLocaleDateString('ar-SA')}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={4} className="px-6 py-8 text-center text-gray-500">
                    لا توجد فواتير اليوم
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
