import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { useInvoiceProfitability } from '../hooks/useInvoiceProfitability';

const Invoices: React.FC = () => {
  const { user } = useApp();
  const { data: profitabilityData, loading } = useInvoiceProfitability(user?.uid || null);
  const [selectedInvoice, setSelectedInvoice] = useState<string | null>(null);

  const selectedData = profitabilityData.find((item) => item.invoiceId === selectedInvoice);

  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold text-gray-900 mb-8">الفواتير وتحليل الربحية</h1>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        {/* Total Revenue */}
        <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg shadow p-6">
          <div className="text-sm text-gray-600 mb-2">إجمالي الإيرادات</div>
          <div className="text-3xl font-bold text-blue-600">
            {profitabilityData.reduce((sum, item) => sum + item.revenue, 0).toFixed(0)}
          </div>
          <div className="text-xs text-gray-500 mt-2">
            {profitabilityData.length} فاتورة
          </div>
        </div>

        {/* Total COGS */}
        <div className="bg-gradient-to-br from-red-50 to-red-100 rounded-lg shadow p-6">
          <div className="text-sm text-gray-600 mb-2">إجمالي COGS</div>
          <div className="text-3xl font-bold text-red-600">
            {profitabilityData.reduce((sum, item) => sum + item.cogs, 0).toFixed(0)}
          </div>
        </div>

        {/* Total Profit */}
        <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-lg shadow p-6">
          <div className="text-sm text-gray-600 mb-2">إجمالي الربح</div>
          <div className="text-3xl font-bold text-green-600">
            {profitabilityData.reduce((sum, item) => sum + item.profit, 0).toFixed(0)}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Invoices List */}
        <div className="lg:col-span-1 bg-white rounded-lg shadow overflow-hidden">
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-lg font-bold text-gray-900">قائمة الفواتير</h2>
          </div>
          <div className="divide-y max-h-96 overflow-y-auto">
            {loading ? (
              <div className="p-4 text-center text-gray-500">جاري التحميل...</div>
            ) : profitabilityData.length > 0 ? (
              profitabilityData.map((invoice) => (
                <button
                  key={invoice.invoiceId}
                  onClick={() => setSelectedInvoice(invoice.invoiceId)}
                  className={`w-full text-right p-4 hover:bg-gray-50 border-r-4 ${
                    selectedInvoice === invoice.invoiceId
                      ? 'border-blue-600 bg-blue-50'
                      : 'border-gray-300'
                  }`}
                >
                  <div className="font-medium text-gray-900">#{invoice.invoiceId}</div>
                  <div className="text-sm text-gray-500">
                    الربح: {invoice.profit.toFixed(2)}
                  </div>
                  <div className="text-xs text-gray-400 mt-1">
                    الهامش: {invoice.margin.toFixed(1)}%
                  </div>
                </button>
              ))
            ) : (
              <div className="p-4 text-center text-gray-500">لا توجد فواتير</div>
            )}
          </div>
        </div>

        {/* Invoice Details */}
        <div className="lg:col-span-2 bg-white rounded-lg shadow p-6">
          {selectedData ? (
            <div>
              <h2 className="text-lg font-bold text-gray-900 mb-6">
                تفاصيل الفاتورة #{selectedData.invoiceId}
              </h2>

              {/* Summary Cards */}
              <div className="grid grid-cols-3 gap-4 mb-6">
                <div className="p-4 bg-blue-50 rounded text-center">
                  <div className="text-2xl font-bold text-blue-600">
                    {selectedData.revenue.toFixed(2)}
                  </div>
                  <div className="text-xs text-gray-600">الإيراد</div>
                </div>
                <div className="p-4 bg-red-50 rounded text-center">
                  <div className="text-2xl font-bold text-red-600">
                    {selectedData.cogs.toFixed(2)}
                  </div>
                  <div className="text-xs text-gray-600">COGS</div>
                </div>
                <div className="p-4 bg-green-50 rounded text-center">
                  <div className="text-2xl font-bold text-green-600">
                    {selectedData.profit.toFixed(2)}
                  </div>
                  <div className="text-xs text-gray-600">الربح</div>
                </div>
              </div>

              {/* Margin */}
              <div className="mb-6 p-4 bg-gradient-to-r from-purple-50 to-purple-100 rounded">
                <div className="flex justify-between items-center">
                  <span className="text-gray-700 font-medium">هامش الربح</span>
                  <span className="text-2xl font-bold text-purple-600">
                    {selectedData.margin.toFixed(2)}%
                  </span>
                </div>
              </div>

              {/* Items Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      <th className="px-4 py-2 text-right text-gray-900 font-semibold">
                        المنتج
                      </th>
                      <th className="px-4 py-2 text-right text-gray-900 font-semibold">
                        الكمية
                      </th>
                      <th className="px-4 py-2 text-right text-gray-900 font-semibold">
                        السعر
                      </th>
                      <th className="px-4 py-2 text-right text-gray-900 font-semibold">
                        التكلفة
                      </th>
                      <th className="px-4 py-2 text-right text-gray-900 font-semibold">
                        الربح
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedData.items.map((item, idx) => (
                      <tr key={idx} className="border-b hover:bg-gray-50">
                        <td className="px-4 py-3 text-gray-900">{item.name}</td>
                        <td className="px-4 py-3 text-gray-600">{item.quantity}</td>
                        <td className="px-4 py-3 font-mono text-gray-900">
                          {item.salePrice.toFixed(2)}
                        </td>
                        <td className="px-4 py-3 font-mono text-red-600">
                          {item.costPrice.toFixed(2)}
                        </td>
                        <td className="px-4 py-3 font-mono text-green-600 font-medium">
                          {item.itemProfit.toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="text-center py-12 text-gray-500">
              اختر فاتورة لعرض التفاصيل
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Invoices;
