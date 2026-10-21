import React, { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useLedger } from '../context/LedgerContext';
import { Badge, Button, Card, PageHeader, StatCard, Tabs } from '../components/ui/primitives';
import DataTable, { Column } from '../components/ui/DataTable';
import Icon from '../components/ui/Icon';
import { ConfirmModal } from '../components/ui/Modal';
import { ExportButtons, SignedAmount } from '../components/ledger/ReportToolbar';
import { AccountExtraModal, PayrollFormModal } from '../components/trade/AdminForms';
import { formatDate, formatNumber } from '../lib/format';
import { Account } from '../lib/ledger';
import { Payroll as PayrollDoc, payrollGross } from '../lib/trade';

// الرواتب والأجور: بيانات الموظفين + كشوف الرواتب الشهرية المرحَّلة

type Tab = 'payrolls' | 'employees';

const Payroll: React.FC = () => {
  const [params, setParams] = useSearchParams();
  const tab = (params.get('tab') as Tab) || 'payrolls';
  const { payrolls, accounts, roleOf, accountMeta, accountsById, balances, deletePayroll, mainCurrency, cashboxes } = useLedger();
  const employees = useMemo(() => accounts.filter((a) => roleOf(a.id) === 'employee'), [accounts, roleOf]);
  const [modal, setModal] = useState(false);
  const [extra, setExtra] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<PayrollDoc | null>(null);
  const [open, setOpen] = useState<string | null>(null);

  const monthly = employees.reduce((s, e) => {
    const i = accountMeta[e.id]?.employee;
    return s + (i?.salary || 0) + (i?.allowances || 0) - (i?.deductions || 0);
  }, 0);
  const lastTotal = payrolls[0]?.lines.reduce((s, l) => s + l.net, 0) || 0;

  const payrollColumns: Array<Column<PayrollDoc>> = [
    { key: 'm', header: 'الشهر', render: (p) => <span className="num font-medium">{p.month}</span> },
    { key: 'd', header: 'التاريخ', render: (p) => <span className="text-ink-muted">{formatDate(p.date)}</span> },
    {
      key: 'pay',
      header: 'الصرف',
      render: (p) => (
        <Badge tone={p.payment === 'cash' ? 'success' : 'info'}>
          {p.payment === 'cash' ? `نقدي — ${cashboxes.find((b) => b.id === p.cashboxId)?.name || ''}` : 'مرحّل للحسابات'}
        </Badge>
      ),
    },
    { key: 'n', header: 'الموظفون', numeric: true, render: (p) => formatNumber(p.lines.length, 0) },
    { key: 'g', header: 'الإجمالي', numeric: true, render: (p) => formatNumber(p.lines.reduce((s, l) => s + payrollGross(l), 0)) },
    { key: 'net', header: 'الصافي', numeric: true, render: (p) => formatNumber(p.lines.reduce((s, l) => s + l.net, 0)) },
    {
      key: 'act',
      header: '',
      className: 'w-24',
      render: (p) => (
        <div className="flex justify-end gap-1">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setOpen(open === p.id ? null : p.id);
            }}
            title="التفاصيل"
            className="grid h-8 w-8 place-items-center rounded-md text-ink-subtle hover:bg-slate-100"
          >
            <Icon name="chevronDown" size={15} />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setConfirm(p);
            }}
            title="حذف الكشف وقيوده"
            className="grid h-8 w-8 place-items-center rounded-md text-ink-subtle hover:bg-danger-50 hover:text-danger-600"
          >
            <Icon name="trash" size={15} />
          </button>
        </div>
      ),
    },
  ];

  const empColumns: Array<Column<Account>> = [
    {
      key: 'name',
      header: 'الموظف',
      render: (e) => (
        <Link to={`/accounts/${e.id}`} className="font-medium text-brand-700 hover:underline">
          {e.name}
        </Link>
      ),
    },
    { key: 'job', header: 'الوظيفة', render: (e) => accountMeta[e.id]?.employee?.jobTitle || '—' },
    { key: 'hire', header: 'تاريخ التوظيف', render: (e) => (accountMeta[e.id]?.employee?.hireDate ? formatDate(accountMeta[e.id]!.employee!.hireDate) : '—') },
    { key: 'sal', header: 'الراتب', numeric: true, render: (e) => formatNumber(accountMeta[e.id]?.employee?.salary || 0) },
    { key: 'alw', header: 'البدلات', numeric: true, render: (e) => formatNumber(accountMeta[e.id]?.employee?.allowances || 0) },
    { key: 'ded', header: 'الاستقطاعات', numeric: true, render: (e) => formatNumber(accountMeta[e.id]?.employee?.deductions || 0) },
    { key: 'bal', header: 'الرصيد', numeric: true, render: (e) => <SignedAmount value={balances[e.id]?.total || 0} label /> },
    {
      key: 'act',
      header: '',
      className: 'w-12',
      render: (e) => (
        <button onClick={() => setExtra(e.id)} title="بيانات الموظف" className="grid h-8 w-8 place-items-center rounded-md text-ink-subtle hover:bg-slate-100">
          <Icon name="edit" size={15} />
        </button>
      ),
    },
  ];

  const detail = payrolls.find((p) => p.id === open);

  return (
    <>
      <PageHeader
        title="الرواتب والأجور"
        description="بيانات الموظفين ورواتبهم، وكشوف رواتب شهرية تُرحَّل لمصروف الرواتب وحسابات الموظفين والصندوق"
        actions={
          <Button icon="plus" onClick={() => setModal(true)}>
            كشف رواتب جديد
          </Button>
        }
      />
      <div className="mb-6 grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <StatCard label="الموظفون" value={formatNumber(employees.length, 0)} icon="users" tone="brand" />
        <StatCard label="الرواتب الشهرية المتوقعة" value={formatNumber(monthly)} unit={mainCurrency} icon="coins" tone="info" hint="صافي حسب بيانات الموظفين" />
        <StatCard label="آخر كشف" value={formatNumber(lastTotal)} unit={mainCurrency} icon="receipt" tone="success" hint={payrolls[0]?.month || '—'} />
        <StatCard label="عدد الكشوف" value={formatNumber(payrolls.length, 0)} icon="calendar" tone="neutral" />
      </div>
      <Card className="overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-4">
          <Tabs<Tab>
            value={tab}
            onChange={(v) => setParams(v === 'payrolls' ? {} : { tab: v })}
            items={[
              { value: 'payrolls', label: 'كشوف الرواتب', icon: 'receipt' },
              { value: 'employees', label: 'الموظفون', icon: 'users' },
            ]}
          />
          <ExportButtons
            disabled={tab === 'payrolls' ? !detail && !payrolls.length : !employees.length}
            build={() =>
              tab === 'employees' || !detail
                ? {
                    title: 'بيانات الموظفين',
                    columns: ['الموظف', 'الوظيفة', 'تاريخ التوظيف', 'الراتب', 'البدلات', 'الاستقطاعات', 'الرصيد'],
                    numericColumns: [3, 4, 5, 6],
                    rows: employees.map((e) => {
                      const i = accountMeta[e.id]?.employee || {};
                      return [e.name, i.jobTitle || '', i.hireDate || '', i.salary || 0, i.allowances || 0, i.deductions || 0, balances[e.id]?.total || 0];
                    }),
                  }
                : {
                    title: `كشف رواتب ${detail.month}`,
                    columns: ['الموظف', 'الأساسي', 'البدلات', 'إضافي', 'استقطاعات', 'سلف', 'الصافي'],
                    numericColumns: [1, 2, 3, 4, 5, 6],
                    rows: detail.lines.map((l) => [accountsById[l.employeeId]?.name || l.employeeId, l.basic, l.allowances, l.overtime, l.deductions, l.advances, l.net]),
                    footer: [['الإجمالي', '', '', '', '', '', detail.lines.reduce((s, l) => s + l.net, 0)]],
                  }
            }
          />
        </div>
        {tab === 'payrolls' ? (
          <>
            <DataTable
              columns={payrollColumns}
              rows={payrolls}
              rowKey={(p) => p.id}
              onRowClick={(p) => setOpen(open === p.id ? null : p.id)}
              empty={{ title: 'لا توجد كشوف رواتب', description: 'أنشئ كشف الشهر من الزر في الأعلى.', icon: 'coins' }}
            />
            {detail && (
              <div className="border-t border-line bg-slate-50/60 p-5">
                <p className="mb-3 text-sm font-semibold">تفاصيل كشف {detail.month}</p>
                <div className="overflow-x-auto">
                  <table className="table-base">
                    <thead>
                      <tr>
                        <th>الموظف</th>
                        <th className="text-end">الأساسي</th>
                        <th className="text-end">البدلات</th>
                        <th className="text-end">إضافي</th>
                        <th className="text-end">استقطاعات</th>
                        <th className="text-end">سلف</th>
                        <th className="text-end">الصافي</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detail.lines.map((l) => (
                        <tr key={l.employeeId}>
                          <td>{accountsById[l.employeeId]?.name || l.employeeId}</td>
                          {[l.basic, l.allowances, l.overtime, l.deductions, l.advances, l.net].map((v, i) => (
                            <td key={i} className="text-end">
                              <span className="num">{formatNumber(v)}</span>
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        ) : (
          <DataTable
            columns={empColumns}
            rows={employees}
            rowKey={(e) => e.id}
            empty={{ title: 'لا يوجد موظفون', description: 'من نافذة الحسابات اجعل دور الحساب «موظف».', icon: 'users' }}
          />
        )}
      </Card>
      <PayrollFormModal open={modal} onClose={() => setModal(false)} />
      {extra && <AccountExtraModal open onClose={() => setExtra(null)} accountId={extra} />}
      <ConfirmModal
        open={!!confirm}
        onClose={() => setConfirm(null)}
        title="حذف كشف الرواتب"
        message={`سيُحذف كشف ${confirm?.month} وكل قيوده (${confirm?.opIds.length}) من المنصة والهاتف.`}
        onConfirm={() => confirm && deletePayroll(confirm.id)}
      />
    </>
  );
};

export default Payroll;
