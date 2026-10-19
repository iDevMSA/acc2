import React, { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useLedger } from '../context/LedgerContext';
import { Badge, Button, Card, PageHeader, StatCard, Tabs } from '../components/ui/primitives';
import DataTable, { Column } from '../components/ui/DataTable';
import Icon from '../components/ui/Icon';
import { AccountFormModal, OperationFormModal } from '../components/ledger/LedgerForms';
import { ExportButtons, PeriodPicker, SignedAmount } from '../components/ledger/ReportToolbar';
import { formatDate, formatNumber } from '../lib/format';
import {
  Account,
  CATEGORY_LABELS,
  Period,
  ROLE_LABELS,
  inPeriod,
  periodFromPreset,
  periodText,
  totalsOf,
} from '../lib/ledger';

type RoleFilter = 'all' | 'customer' | 'supplier' | 'employee' | 'bank' | 'cash' | 'general';

const ROLE_TABS: Array<{ value: RoleFilter; label: string }> = [
  { value: 'all', label: 'كل الحسابات' },
  { value: 'customer', label: 'الزبائن' },
  { value: 'supplier', label: 'الموردون' },
  { value: 'employee', label: 'الموظفون' },
  { value: 'bank', label: 'البنوك' },
  { value: 'cash', label: 'النقدية' },
  { value: 'general', label: 'حسابات عامة' },
];

const Accounts: React.FC = () => {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const role = (params.get('role') as RoleFilter) || 'all';
  const { accounts, operations, balances, mainCurrency, roleOf, ready } = useLedger();
  const [q, setQ] = useState('');
  const [category, setCategory] = useState('');
  const [period, setPeriod] = useState<Period>(periodFromPreset('all'));
  const [newAccount, setNewAccount] = useState(false);
  const [newOp, setNewOp] = useState(false);

  const totals = useMemo(() => totalsOf(operations.filter((o) => inPeriod(o.date, period))), [operations, period]);

  const rows = useMemo(() => {
    const s = q.trim();
    return accounts.filter(
      (a) =>
        (role === 'all' || roleOf(a.id) === role) &&
        (!category || a.category === category) &&
        (!s || a.name.includes(s) || a.id.includes(s) || a.code.includes(s) || a.phone.includes(s)),
    );
  }, [accounts, q, role, category, roleOf]);

  const listTotal = rows.reduce((s, a) => s + (balances[a.id]?.total || 0), 0);

  const columns: Array<Column<Account>> = [
    { key: 'id', header: 'الرقم', className: 'w-20', render: (a) => <span className="num text-ink-subtle">{a.id}</span> },
    {
      key: 'name',
      header: 'اسم الحساب',
      render: (a) => (
        <div className="min-w-0">
          <p className="truncate font-medium text-ink">{a.name}</p>
          {(a.code || a.phone) && (
            <p className="num truncate text-xs text-ink-subtle">{[a.code, a.phone].filter(Boolean).join(' · ')}</p>
          )}
        </div>
      ),
    },
    { key: 'cat', header: 'التصنيف', render: (a) => <Badge>{CATEGORY_LABELS[a.category] || 'أخرى'}</Badge> },
    {
      key: 'role',
      header: 'الفهرس',
      render: (a) => <span className="text-ink-muted">{ROLE_LABELS[roleOf(a.id) as keyof typeof ROLE_LABELS]}</span>,
    },
    {
      key: 'count',
      header: 'القيود',
      numeric: true,
      className: 'w-20',
      render: (a) => formatNumber(balances[a.id]?.count || 0, 0),
    },
    {
      key: 'last',
      header: 'آخر حركة',
      className: 'w-36',
      render: (a) => <span className="text-ink-muted">{formatDate(balances[a.id]?.lastDate)}</span>,
    },
    {
      key: 'bal',
      header: `الرصيد (${mainCurrency})`,
      className: 'w-44 text-end',
      render: (a) => <SignedAmount value={balances[a.id]?.total || 0} label />,
    },
  ];

  const buildReport = () => ({
    title: role === 'all' ? 'أرصدة الحسابات' : `فهرس ${ROLE_TABS.find((t) => t.value === role)?.label}`,
    subtitle: `العملة الرئيسية ${mainCurrency} · ${rows.length} حساب`,
    columns: ['الرقم', 'الحساب', 'التصنيف', 'الهاتف', 'عدد القيود', 'الرصيد', 'الحالة'],
    numericColumns: [4, 5],
    rows: rows.map((a) => {
      const b = balances[a.id]?.total || 0;
      return [a.id, a.name, CATEGORY_LABELS[a.category] || 'أخرى', a.phone, String(balances[a.id]?.count || 0), Math.abs(b), b >= 0 ? 'لنا' : 'لهم'];
    }),
    footer: [['', 'الإجمالي', '', '', '', Math.abs(listTotal), listTotal >= 0 ? 'لنا' : 'لهم']],
  });

  return (
    <>
      <PageHeader
        title="الحسابات"
        description="دليل الحسابات متزامن مع تطبيق الهاتف لحظياً — اضغط على أي حساب لعرض تفاصيله وتقاريره"
        actions={
          <>
            <Button variant="secondary" icon="plusSquare" onClick={() => setNewOp(true)}>
              قيد جديد
            </Button>
            <Button icon="plusSquare" onClick={() => setNewAccount(true)}>
              حساب جديد
            </Button>
          </>
        }
      />

      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-ink-subtle">
          ملخص القيود: <span className="font-medium text-ink">{periodText(period)}</span>
        </p>
        <PeriodPicker value={period} onChange={setPeriod} />
      </div>
      <div className="mb-6 grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <StatCard
          label="مجموع التحصيل (قيود موجبة)"
          value={formatNumber(totals.collected)}
          unit={mainCurrency}
          icon="trendUp"
          tone="success"
        />
        <StatCard
          label="مجموع المصروفات (قيود سالبة)"
          value={formatNumber(totals.spent)}
          unit={mainCurrency}
          icon="coins"
          tone="danger"
        />
        <StatCard
          label={totals.net >= 0 ? 'صافي الإيراد' : 'صافي الخسارة'}
          value={formatNumber(Math.abs(totals.net))}
          unit={mainCurrency}
          icon="scale"
          tone={totals.net >= 0 ? 'brand' : 'warning'}
          hint="التحصيل − المصروفات"
        />
        <StatCard
          label="الحسابات / القيود"
          value={`${formatNumber(accounts.length, 0)} / ${formatNumber(totals.count, 0)}`}
          icon="ledger"
          tone="info"
        />
      </div>

      <Card className="overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-line px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
          <Tabs<RoleFilter>
            value={role}
            onChange={(v) => setParams(v === 'all' ? {} : { role: v })}
            items={ROLE_TABS}
          />
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Icon name="search" size={16} className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-ink-faint" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="بحث بالاسم أو الرقم أو الهاتف"
                className="h-9 w-64 rounded-lg border border-line-strong bg-surface pe-3 ps-9 text-sm shadow-sm"
              />
            </div>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="h-9 rounded-lg border border-line-strong bg-surface pe-8 ps-3 text-sm shadow-sm"
            >
              <option value="">كل التصنيفات</option>
              {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
            <ExportButtons build={buildReport} disabled={rows.length === 0} />
          </div>
        </div>
        <DataTable
          columns={columns}
          rows={rows}
          rowKey={(a) => a.id}
          loading={!ready}
          maxHeight="calc(100dvh - 380px)"
          onRowClick={(a) => navigate(`/accounts/${a.id}`)}
          empty={{
            title: q || category || role !== 'all' ? 'لا توجد حسابات مطابقة' : 'لا توجد حسابات بعد',
            description: 'أضف حساباً من هنا أو من تطبيق الهاتف وسيظهر في الطرفين.',
            icon: 'ledger',
          }}
          mobileCard={(a) => (
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate font-medium text-ink">{a.name}</p>
                <p className="num text-xs text-ink-subtle">
                  {a.id} · {CATEGORY_LABELS[a.category] || 'أخرى'}
                </p>
              </div>
              <SignedAmount value={balances[a.id]?.total || 0} label />
            </div>
          )}
          footer={
            <tr>
              <td colSpan={6}>الإجمالي ({formatNumber(rows.length, 0)} حساب)</td>
              <td className="text-end">
                <SignedAmount value={listTotal} label />
              </td>
            </tr>
          }
        />
      </Card>

      <AccountFormModal
        open={newAccount}
        onClose={() => setNewAccount(false)}
        defaultRole={role === 'all' ? undefined : role}
        onSaved={(id) => navigate(`/accounts/${id}`)}
      />
      <OperationFormModal open={newOp} onClose={() => setNewOp(false)} />
    </>
  );
};

export default Accounts;
