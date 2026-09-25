import React, { useEffect, useState } from 'react';
import { db } from '../config/firebase';
import { ref, onValue } from 'firebase/database';
import { useApp } from '../context/AppContext';

const Accounting: React.FC = () => {
  const { user } = useApp();
  const [accounts, setAccounts] = useState<any[]>([]);
  const [journal, setJournal] = useState<any[]>([]);

  useEffect(() => {
    if (!user) return;

    // تحميل الحسابات
    const accountsRef = ref(db, `users/${user.uid}/accounts`);
    onValue(accountsRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        setAccounts(Object.values(data as any));
      }
    });

    // تحميل السجل العام
    const journalRef = ref(db, `users/${user.uid}/journal_entries`);
    onValue(journalRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        setJournal(Object.values(data as any));
      }
    });
  }, [user]);

  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold text-gray-900 mb-8">المحاسبة</h1>

      {/* دليل الحسابات */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">دليل الحسابات</h2>
          <div className="space-y-2">
            {accounts.length > 0 ? (
              accounts.map((acc, idx) => (
                <div key={idx} className="flex justify-between items-center p-3 border rounded hover:bg-gray-50">
                  <span className="text-gray-900 font-medium">{acc.name || acc.code}</span>
                  <span className="text-sm text-gray-600">{acc.category || 'حساب عام'}</span>
                </div>
              ))
            ) : (
              <p className="text-gray-500 text-center py-4">لا توجد حسابات</p>
            )}
          </div>
        </div>

        {/* ملخص الأرصدة */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">ملخص الأرصدة</h2>
          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 bg-blue-50 rounded">
              <div className="text-2xl font-bold text-blue-600">0</div>
              <div className="text-sm text-gray-600">أصول</div>
            </div>
            <div className="p-4 bg-green-50 rounded">
              <div className="text-2xl font-bold text-green-600">0</div>
              <div className="text-sm text-gray-600">خصوم</div>
            </div>
            <div className="p-4 bg-purple-50 rounded">
              <div className="text-2xl font-bold text-purple-600">0</div>
              <div className="text-sm text-gray-600">إيرادات</div>
            </div>
            <div className="p-4 bg-red-50 rounded">
              <div className="text-2xl font-bold text-red-600">0</div>
              <div className="text-sm text-gray-600">مصروفات</div>
            </div>
          </div>
        </div>
      </div>

      {/* السجل العام */}
      <div className="bg-white rounded-lg shadow">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-xl font-bold text-gray-900">السجل العام</h2>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-right text-sm font-semibold text-gray-900">التاريخ</th>
                <th className="px-6 py-3 text-right text-sm font-semibold text-gray-900">الوصف</th>
                <th className="px-6 py-3 text-right text-sm font-semibold text-gray-900">مدين</th>
                <th className="px-6 py-3 text-right text-sm font-semibold text-gray-900">دائن</th>
              </tr>
            </thead>
            <tbody>
              {journal.length > 0 ? (
                journal.map((entry, idx) => (
                  <tr key={idx} className="border-b hover:bg-gray-50">
                    <td className="px-6 py-4 text-sm text-gray-600">{entry.date || '—'}</td>
                    <td className="px-6 py-4 text-sm text-gray-900">{entry.statement || '—'}</td>
                    <td className="px-6 py-4 text-sm text-right font-mono text-gray-900">
                      {entry.debit ? entry.debit.toFixed(2) : '—'}
                    </td>
                    <td className="px-6 py-4 text-sm text-right font-mono text-gray-900">
                      {entry.credit ? entry.credit.toFixed(2) : '—'}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={4} className="px-6 py-8 text-center text-gray-500">
                    لا توجد قيود
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

export default Accounting;
