import React, { useEffect, useMemo, useState } from 'react';
import { watchValue } from '../lib/offlineStore';
import { useApp } from '../context/AppContext';
import { Badge, Card, CardHeader, PageHeader, StatCard, Tabs, cx } from '../components/ui/primitives';
import DataTable, { Column } from '../components/ui/DataTable';
import Icon from '../components/ui/Icon';
import { formatNumber, formatPercent } from '../lib/format';
import {
  TrialBalanceItem,
  calculateBalanceSheet,
  calculateIncomeStatement,
  calculateTrialBalance,
} from '../lib/statements';

type ReportTab = 'trial-balance' | 'income-statement' | 'balance-sheet';

const StatementRow: React.FC<{ label: string; value: number; tone?: string; strong?: boolean; currency: string }> = ({
  label,
  value,
  tone,
  strong,
  currency,
}) => (
  <div
    className={cx(
      'flex items-center justify-between px-5 py-3.5',
      strong ? 'bg-slate-50 font-semibold' : 'border-b border-line',
    )}
  >
    <span className={strong ? 'text-ink' : 'text-ink-muted'}>{label}</span>
    <span className="flex items-baseline gap-1.5">
      <span className={cx('num', strong ? 'text-lg' : '', tone || 'text-ink')}>{formatNumber(value)}</span>
      <span className="text-xs font-normal text-ink-subtle">{currency}</span>
    </span>
  </div>
);

const Reports: React.FC = () => {
  const { user, currency } = useApp();
  const [activeTab, setActiveTab] = useState<ReportTab>('trial-balance');
  const [journal, setJournal] = useState<any[]>([]);

  useEffect(() => {
    if (!user) return;

    return watchValue(`users/${user.uid}/journal_entries`, (data) => {
      if (data) {
        setJournal(Object.values(data as any));
      }
    });
  }, [user]);

  const trialBalance = useMemo(() => calculateTrialBalance(journal), [journal]);
  const incomeStatement = useMemo(() => calculateIncomeStatement(journal), [journal]);
  const balanceSheet = useMemo(() => calculateBalanceSheet(journal), [journal]);

  const tbTotals = {
    debit: trialBalance.reduce((sum, item) => sum + item.debit, 0),
    credit: trialBalance.reduce((sum, item) => sum + item.credit, 0),
  };

  const tbColumns: Array<Column<TrialBalanceItem>> = [
    { key: 'account', header: 'الحساب', render: (item) => <span className="font-medium">{item.account}</span> },
    { key: 'debit', header: 'مدين', numeric: true, className: 'w-44', render: (item) => formatNumber(item.debit) },
    { key: 'credit', header: 'دائن', numeric: true, className: 'w-44', render: (item) => formatNumber(item.credit) },
  ];

  return (
    <>
      <PageHeader
        title="التقارير المالية"
        description="القوائم المالية المحسوبة من قيود السجل العام"
        actions={
          <Tabs<ReportTab>
            value={activeTab}
            onChange={setActiveTab}
            items={[
              { value: 'trial-balance', label: 'ميزان المراجعة', icon: 'scale' },
              { value: 'income-statement', label: 'قائمة الدخل', icon: 'trendUp' },
              { value: 'balance-sheet', label: 'الميزانية العمومية', icon: 'pie' },
            ]}
          />
        }
      />

      {/* ميزان المراجعة */}
      {activeTab === 'trial-balance' && (
        <Card className="overflow-hidden">
          <CardHeader
            title="ميزان المراجعة"
            subtitle={`${formatNumber(trialBalance.length, 0)} حساب · المبالغ بـ ${currency}`}
            actions={
              trialBalance.length > 0 &&
              (Math.abs(tbTotals.debit - tbTotals.credit) < 0.01 ? (
                <Badge tone="success">
                  <Icon name="check" size={12} /> متوازن
                </Badge>
              ) : (
                <Badge tone="danger">
                  <Icon name="alert" size={12} /> غير متوازن
                </Badge>
              ))
            }
          />
          <DataTable
            columns={tbColumns}
            rows={trialBalance}
            rowKey={(item) => item.account}
            empty={{
              title: 'لا توجد بيانات',
              description: 'يُبنى ميزان المراجعة تلقائياً من قيود السجل العام.',
              icon: 'scale',
            }}
            footer={
              <tr>
                <td>الإجمالي</td>
                <td className="text-end">
                  <span className="num">{formatNumber(tbTotals.debit)}</span>
                </td>
                <td className="text-end">
                  <span className="num">{formatNumber(tbTotals.credit)}</span>
                </td>
              </tr>
            }
          />
        </Card>
      )}

      {/* قائمة الدخل */}
      {activeTab === 'income-statement' && (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
          <Card className="overflow-hidden xl:col-span-2">
            <CardHeader title="قائمة الدخل" subtitle="للفترة الحالية" />
            <StatementRow
              label="الإيرادات"
              value={incomeStatement.revenue}
              tone="text-success-700"
              currency={currency}
            />
            <StatementRow
              label="المصروفات"
              value={incomeStatement.expenses}
              tone="text-danger-700"
              currency={currency}
            />
            <StatementRow
              label="صافي الربح"
              value={incomeStatement.profit}
              tone={incomeStatement.profit >= 0 ? 'text-brand-700' : 'text-danger-700'}
              currency={currency}
              strong
            />
          </Card>
          <div className="grid gap-4">
            <StatCard
              label="هامش الربح"
              value={formatPercent(incomeStatement.margin, 2)}
              icon="percent"
              tone="success"
            />
            <StatCard
              label="الإيراد الكلي"
              value={formatNumber(incomeStatement.revenue, 0)}
              unit={currency}
              icon="wallet"
              tone="brand"
            />
          </div>
        </div>
      )}

      {/* الميزانية العمومية */}
      {activeTab === 'balance-sheet' && (
        <div className="grid grid-cols-1 gap-6">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <StatCard
              label="الأصول"
              value={formatNumber(balanceSheet.assets)}
              unit={currency}
              icon="building"
              tone="brand"
            />
            <StatCard
              label="الخصوم"
              value={formatNumber(balanceSheet.liabilities)}
              unit={currency}
              icon="scale"
              tone="danger"
            />
            <StatCard
              label="حقوق الملكية"
              value={formatNumber(balanceSheet.equity)}
              unit={currency}
              icon="pie"
              tone="info"
            />
          </div>

          <Card className="overflow-hidden">
            <CardHeader
              title="معادلة الميزانية"
              subtitle="الأصول = الخصوم + حقوق الملكية"
              actions={
                balanceSheet.balanced ? (
                  <Badge tone="success">
                    <Icon name="check" size={12} /> متوازنة
                  </Badge>
                ) : (
                  <Badge tone="danger">
                    <Icon name="alert" size={12} /> غير متوازنة
                  </Badge>
                )
              }
            />
            <div className="grid grid-cols-1 items-center gap-4 p-6 text-center md:grid-cols-[1fr_auto_1fr]">
              <div className="rounded-xl bg-slate-50 p-5">
                <p className="text-sm text-ink-subtle">الأصول</p>
                <p className="num mt-1 text-2xl font-semibold text-ink">{formatNumber(balanceSheet.assets)}</p>
              </div>
              <span className="text-3xl font-light text-ink-faint">=</span>
              <div className="rounded-xl bg-slate-50 p-5">
                <p className="text-sm text-ink-subtle">الخصوم + حقوق الملكية</p>
                <p className="num mt-1 text-2xl font-semibold text-ink">
                  {formatNumber(balanceSheet.liabilities + balanceSheet.equity)}
                </p>
              </div>
            </div>
          </Card>
        </div>
      )}
    </>
  );
};

export default Reports;
