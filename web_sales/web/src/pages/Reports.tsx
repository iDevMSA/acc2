import React, { useEffect, useState } from 'react';
import { db } from '../config/firebase';
import { ref, onValue } from 'firebase/database';
import { useApp } from '../context/AppContext';

interface TrialBalanceItem {
  account: string;
  debit: number;
  credit: number;
}

const Reports: React.FC = () => {
  const { user } = useApp();
  const [activeTab, setActiveTab] = useState<'trial-balance' | 'income-statement' | 'balance-sheet'>('trial-balance');
  const [journal, setJournal] = useState<any[]>([]);

  useEffect(() => {
    if (!user) return;

    const journalRef = ref(db, `users/${user.uid}/journal_entries`);
    onValue(journalRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        setJournal(Object.values(data as any));
      }
    });

  }, [user]);

  // حساب ميزان المراجعة
  const calculateTrialBalance = (): TrialBalanceItem[] => {
    if (journal.length === 0) return [];

    const balances: { [key: string]: { debit: number; credit: number } } = {};

    journal.forEach((entry) => {
      const accountName = entry.account || 'حساب عام';
      if (!balances[accountName]) {
        balances[accountName] = { debit: 0, credit: 0 };
      }
      if (entry.debit) balances[accountName].debit += entry.debit;
      if (entry.credit) balances[accountName].credit += entry.credit;
    });

    return Object.entries(balances).map(([account, amounts]) => ({
      account,
      debit: amounts.debit,
      credit: amounts.credit,
    }));
  };

  // حساب قائمة الدخل
  const calculateIncomeStatement = () => {
    const revenueAccounts = journal.filter((e) => e.type === 'Revenue' || e.statement?.includes('إيراد'));
    const expenseAccounts = journal.filter((e) => e.type === 'Expense' || e.statement?.includes('مصروف'));

    const revenue = revenueAccounts.reduce((sum, e) => sum + (e.credit || 0), 0);
    const expenses = expenseAccounts.reduce((sum, e) => sum + (e.debit || 0), 0);

    return {
      revenue,
      expenses,
      grossProfit: revenue - expenses,
      profit: revenue - expenses,
      margin: revenue > 0 ? ((revenue - expenses) / revenue * 100).toFixed(2) : '0',
    };
  };

  // حساب الميزانية العمومية
  const calculateBalanceSheet = () => {
    const assets = journal.filter((e) => e.type === 'Asset' || e.statement?.includes('أصل'));
    const liabilities = journal.filter((e) => e.type === 'Liability' || e.statement?.includes('خصم'));
    const equity = journal.filter((e) => e.type === 'Equity' || e.statement?.includes('حقوق'));

    const totalAssets = assets.reduce((sum, e) => sum + (e.debit || 0), 0);
    const totalLiabilities = liabilities.reduce((sum, e) => sum + (e.credit || 0), 0);
    const totalEquity = equity.reduce((sum, e) => sum + (e.credit || 0), 0);

    return {
      assets: totalAssets,
      liabilities: totalLiabilities,
      equity: totalEquity,
      balanced: Math.abs(totalAssets - (totalLiabilities + totalEquity)) < 0.01,
    };
  };

  const trialBalance = calculateTrialBalance();
  const incomeStatement = calculateIncomeStatement();
  const balanceSheet = calculateBalanceSheet();

  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold text-gray-900 mb-8">التقارير المالية</h1>

      {/* Tabs */}
      <div className="flex gap-4 mb-8 border-b border-gray-200">
        <button
          onClick={() => setActiveTab('trial-balance')}
          className={`px-4 py-2 font-medium ${
            activeTab === 'trial-balance'
              ? 'text-blue-600 border-b-2 border-blue-600'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          ميزان المراجعة
        </button>
        <button
          onClick={() => setActiveTab('income-statement')}
          className={`px-4 py-2 font-medium ${
            activeTab === 'income-statement'
              ? 'text-blue-600 border-b-2 border-blue-600'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          قائمة الدخل
        </button>
        <button
          onClick={() => setActiveTab('balance-sheet')}
          className={`px-4 py-2 font-medium ${
            activeTab === 'balance-sheet'
              ? 'text-blue-600 border-b-2 border-blue-600'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          الميزانية العمومية
        </button>
      </div>

      {/* Trial Balance Tab */}
      {activeTab === 'trial-balance' && (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-xl font-bold text-gray-900">ميزان المراجعة</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-right text-sm font-semibold text-gray-900">الحساب</th>
                  <th className="px-6 py-3 text-right text-sm font-semibold text-gray-900">مدين</th>
                  <th className="px-6 py-3 text-right text-sm font-semibold text-gray-900">دائن</th>
                </tr>
              </thead>
              <tbody>
                {trialBalance.length > 0 ? (
                  <>
                    {trialBalance.map((item, idx) => (
                      <tr key={idx} className="border-b hover:bg-gray-50">
                        <td className="px-6 py-4 text-sm text-gray-900">{item.account}</td>
                        <td className="px-6 py-4 text-sm text-right font-mono">
                          {item.debit.toFixed(2)}
                        </td>
                        <td className="px-6 py-4 text-sm text-right font-mono">
                          {item.credit.toFixed(2)}
                        </td>
                      </tr>
                    ))}
                    <tr className="bg-blue-50 font-bold">
                      <td className="px-6 py-4 text-sm text-gray-900">الإجمالي</td>
                      <td className="px-6 py-4 text-sm text-right font-mono">
                        {trialBalance.reduce((sum, item) => sum + item.debit, 0).toFixed(2)}
                      </td>
                      <td className="px-6 py-4 text-sm text-right font-mono">
                        {trialBalance.reduce((sum, item) => sum + item.credit, 0).toFixed(2)}
                      </td>
                    </tr>
                  </>
                ) : (
                  <tr>
                    <td colSpan={3} className="px-6 py-8 text-center text-gray-500">
                      لا توجد بيانات
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Income Statement Tab */}
      {activeTab === 'income-statement' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-6">قائمة الدخل</h2>
            <div className="space-y-4">
              <div className="flex justify-between items-center pb-3 border-b">
                <span className="text-gray-600">الإيرادات</span>
                <span className="font-mono text-lg text-green-600">
                  {incomeStatement.revenue.toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between items-center pb-3 border-b">
                <span className="text-gray-600">المصروفات</span>
                <span className="font-mono text-lg text-red-600">
                  {incomeStatement.expenses.toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between items-center py-3 bg-blue-50 px-3 rounded font-bold">
                <span className="text-gray-900">الربح الصافي</span>
                <span className="font-mono text-lg text-blue-600">
                  {incomeStatement.profit.toFixed(2)}
                </span>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-6">مؤشرات الأداء</h2>
            <div className="space-y-4">
              <div className="p-4 bg-gradient-to-br from-green-50 to-green-100 rounded">
                <div className="text-sm text-gray-600">هامش الربح</div>
                <div className="text-3xl font-bold text-green-600">{incomeStatement.margin}%</div>
              </div>
              <div className="p-4 bg-gradient-to-br from-blue-50 to-blue-100 rounded">
                <div className="text-sm text-gray-600">الإيراد الكلي</div>
                <div className="text-2xl font-bold text-blue-600">
                  {incomeStatement.revenue.toFixed(0)}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Balance Sheet Tab */}
      {activeTab === 'balance-sheet' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-4">الأصول</h2>
            <div className="text-3xl font-bold text-blue-600">
              {balanceSheet.assets.toFixed(2)}
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-4">الخصوم</h2>
            <div className="text-3xl font-bold text-red-600">
              {balanceSheet.liabilities.toFixed(2)}
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-4">حقوق الملكية</h2>
            <div className="text-3xl font-bold text-purple-600">
              {balanceSheet.equity.toFixed(2)}
            </div>
          </div>

          {/* Balance Check */}
          <div className="lg:col-span-3 bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-gray-900">تحقق من التوازن</h3>
              <div className={`text-xl font-bold px-4 py-2 rounded ${
                balanceSheet.balanced
                  ? 'bg-green-100 text-green-700'
                  : 'bg-red-100 text-red-700'
              }`}>
                {balanceSheet.balanced ? '✅ متوازنة' : '❌ غير متوازنة'}
              </div>
            </div>
            <div className="mt-4 grid grid-cols-3 gap-4 text-center">
              <div>
                <div className="text-sm text-gray-600">الأصول</div>
                <div className="text-2xl font-bold text-gray-900">
                  {balanceSheet.assets.toFixed(0)}
                </div>
              </div>
              <div className="flex items-center justify-center">
                <span className="text-3xl font-bold text-gray-400">=</span>
              </div>
              <div>
                <div className="text-sm text-gray-600">الخصوم + الملكية</div>
                <div className="text-2xl font-bold text-gray-900">
                  {(balanceSheet.liabilities + balanceSheet.equity).toFixed(0)}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Reports;
