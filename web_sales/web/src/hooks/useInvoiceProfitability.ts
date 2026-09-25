import { useEffect, useState } from 'react';
import { db } from '../config/firebase';
import { ref, onValue } from 'firebase/database';

interface InvoiceItem {
  name?: string;
  costPrice: number;
  salePrice: number;
  quantity: number;
}

interface ProfitabilityData {
  invoiceId: string;
  revenue: number;
  cogs: number;
  profit: number;
  margin: number;
  items: Array<{
    name: string;
    costPrice: number;
    salePrice: number;
    quantity: number;
    itemCOGS: number;
    itemProfit: number;
  }>;
}

export const useInvoiceProfitability = (userId: string | null, invoiceId?: string) => {
  const [data, setData] = useState<ProfitabilityData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) return;

    let invoicesRef;
    if (invoiceId) {
      invoicesRef = ref(db, `users/${userId}/invoices/${invoiceId}`);
    } else {
      invoicesRef = ref(db, `users/${userId}/invoices`);
    }

    const unsubscribe = onValue(invoicesRef, (snapshot) => {
      const invoicesData = snapshot.val();
      if (!invoicesData) {
        setData([]);
        setLoading(false);
        return;
      }

      const processedData: ProfitabilityData[] = [];

      const invoices = invoiceId ? { [invoiceId]: invoicesData } : invoicesData;

      Object.entries(invoices).forEach(([id, invoice]: [string, any]) => {
        const items = invoice.items || [];

        const processedItems = items.map((item: InvoiceItem) => {
          const itemCOGS = item.costPrice * item.quantity;
          const itemRevenue = item.salePrice * item.quantity;
          const itemProfit = itemRevenue - itemCOGS;

          return {
            name: item.name || 'منتج',
            costPrice: item.costPrice,
            salePrice: item.salePrice,
            quantity: item.quantity,
            itemCOGS,
            itemProfit,
          };
        });

        const totalRevenue = items.reduce(
          (sum: number, item: InvoiceItem) => sum + (item.salePrice * item.quantity),
          0
        );
        const totalCOGS = items.reduce(
          (sum: number, item: InvoiceItem) => sum + (item.costPrice * item.quantity),
          0
        );
        const profit = totalRevenue - totalCOGS;
        const margin = totalRevenue > 0 ? (profit / totalRevenue) * 100 : 0;

        processedData.push({
          invoiceId: id,
          revenue: totalRevenue,
          cogs: totalCOGS,
          profit,
          margin: Math.round(margin * 100) / 100,
          items: processedItems,
        });
      });

      setData(processedData);
      setLoading(false);
    });

    return unsubscribe;
  }, [userId, invoiceId]);

  return { data, loading };
};
