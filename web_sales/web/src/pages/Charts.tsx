import React, { useMemo, useState } from 'react';
import { useLedger } from '../context/LedgerContext';
import { Card, CardHeader, EmptyState, PageHeader } from '../components/ui/primitives';
import { SearchSelect } from '../components/ui/Form';
import { useAccountOptions } from '../components/ledger/LedgerForms';
import { BarChart, LineChart, Point, RankBars } from '../components/trade/Charts';
import { lineShare } from '../lib/trade';

// الرسوم البيانية والتحاليل المالية (فصل التحاليل المالية في الأصيل):
// رصيد أي حساب عبر الأشهر، الإيرادات مقابل المصروفات، المبيعات مقابل المشتريات، رصيد صنف، الأعلى مبيعاً.

const lastMonths = (n: number) => {
  const out: string[] = [];
  const d = new Date();
  d.setDate(1);
  for (let i = n - 1; i >= 0; i--) {
    const x = new Date(d.getFullYear(), d.getMonth() - i, 1);
    out.push(`${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}`);
  }
  return out;
};

const Charts: React.FC = () => {
  const { accounts, accountsById, operations, opsByAccount, invoices, items, moves, mainCurrency } = useLedger();
  const options = useAccountOptions();
  const [accountId, setAccountId] = useState('');
  const [itemId, setItemId] = useState('');
  const months = useMemo(() => lastMonths(12), []);

  const revExp: Point[] = useMemo(() => {
    const cat = Object.fromEntries(accounts.map((a) => [a.id, a.category]));
    return months.map((m) => {
      let rev = 0;
      let exp = 0;
      operations.forEach((o) => {
        if (o.date.slice(0, 7) !== m) return;
        if (cat[o.accountId] === 'revenue') rev -= o.amountUSD;
        else if (cat[o.accountId] === 'expense') exp += o.amountUSD;
      });
      return { label: m.slice(2), value: rev, value2: exp };
    });
  }, [accounts, operations, months]);

  const salesPurch: Point[] = useMemo(
    () =>
      months.map((m) => {
        const of = (k: string) =>
          invoices.filter((i) => i.kind === k && i.date.slice(0, 7) === m).reduce((s, i) => s + i.totals.net / (i.exchangeRate || 1), 0);
        return { label: m.slice(2), value: of('sale') - of('saleReturn'), value2: of('purchase') - of('purchaseReturn') };
      }),
    [invoices, months],
  );

  const accountId2 = accountId || accounts[0]?.id || '';
  const accountLine: Point[] = useMemo(() => {
    const ops = opsByAccount[accountId2] || [];
    return months.map((m) => ({ label: m.slice(2), value: ops.filter((o) => o.date.slice(0, 7) <= m).reduce((s, o) => s + o.amountUSD, 0) }));
  }, [opsByAccount, accountId2, months]);

  const itemId2 = itemId || items[0]?.id || '';
  const itemLine: Point[] = useMemo(() => {
    const ms = moves.filter((m) => m.itemId === itemId2);
    return months.map((mo) => ({
      label: mo.slice(2),
      value: ms
        .filter((m) => m.date.slice(0, 7) <= mo && m.type !== 'transfer')
        .reduce((s, m) => s + (m.type === 'in' ? m.qty : m.type === 'out' ? -m.qty : m.qty), 0),
    }));
  }, [moves, itemId2, months]);

  const topItems: Point[] = useMemo(() => {
    const map = new Map<string, number>();
    invoices
      .filter((i) => i.kind === 'sale' || i.kind === 'saleReturn')
      .forEach((i) =>
        i.lines.forEach((l) => {
          if (!l.itemId) return;
          const v = (lineShare(l, i.discountPct) / (i.exchangeRate || 1)) * (i.kind === 'sale' ? 1 : -1);
          map.set(l.itemId, (map.get(l.itemId) || 0) + v);
        }),
      );
    return Array.from(map.entries())
      .map(([id, value]) => ({ label: items.find((x) => x.id === id)?.name || id, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);
  }, [invoices, items]);

  const topCustomers: Point[] = useMemo(() => {
    const map = new Map<string, number>();
    invoices
      .filter((i) => i.kind === 'sale' || i.kind === 'saleReturn')
      .forEach((i) => map.set(i.partyId, (map.get(i.partyId) || 0) + (i.totals.net / (i.exchangeRate || 1)) * (i.kind === 'sale' ? 1 : -1)));
    return Array.from(map.entries())
      .map(([id, value]) => ({ label: accountsById[id]?.name || id, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);
  }, [invoices, accountsById]);

  return (
    <>
      <PageHeader title="الرسوم البيانية" description={`تحليل الأداء لآخر 12 شهراً بالعملة الرئيسية (${mainCurrency})`} />
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader title="الإيرادات مقابل المصروفات" subtitle="من حسابات الإيرادات والمصروفات" />
          <div className="p-5">
            <BarChart data={revExp} legend={['الإيرادات', 'المصروفات']} />
          </div>
        </Card>
        <Card>
          <CardHeader title="المبيعات مقابل المشتريات" subtitle="صافي الفواتير بعد المرتجعات" />
          <div className="p-5">
            {invoices.length ? <BarChart data={salesPurch} legend={['المبيعات', 'المشتريات']} /> : <EmptyState icon="chart" title="لا توجد فواتير بعد" />}
          </div>
        </Card>
        <Card>
          <CardHeader
            title="رصيد حساب عبر الأشهر"
            actions={
              <div className="w-56">
                <SearchSelect value={accountId2} onChange={setAccountId} options={options} />
              </div>
            }
          />
          <div className="p-5">
            <LineChart data={accountLine} />
          </div>
        </Card>
        <Card>
          <CardHeader
            title="رصيد صنف عبر الأشهر"
            actions={
              <div className="w-56">
                <SearchSelect value={itemId2} onChange={setItemId} options={items.map((i) => ({ value: i.id, label: i.name, hint: i.code }))} />
              </div>
            }
          />
          <div className="p-5">{items.length ? <LineChart data={itemLine} /> : <EmptyState icon="box" title="لا توجد أصناف" />}</div>
        </Card>
        <Card>
          <CardHeader title="الأصناف الأعلى مبيعاً" subtitle="صافي قيمة المبيعات من الفواتير" />
          <div className="p-5">{topItems.length ? <RankBars data={topItems} unit={mainCurrency} /> : <EmptyState icon="box" title="لا توجد مبيعات أصناف بعد" />}</div>
        </Card>
        <Card>
          <CardHeader title="أكبر الزبائن" subtitle="صافي فواتير البيع" />
          <div className="p-5">
            {topCustomers.length ? <RankBars data={topCustomers} unit={mainCurrency} /> : <EmptyState icon="users" title="لا توجد فواتير بيع بعد" />}
          </div>
        </Card>
      </div>
    </>
  );
};

export default Charts;
