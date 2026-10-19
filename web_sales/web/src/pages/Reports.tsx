import React, { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useLedger } from '../context/LedgerContext';
import { Card, EmptyState, cx } from '../components/ui/primitives';
import Icon from '../components/ui/Icon';
import { SearchSelect } from '../components/ui/Form';
import { ExportButtons, PeriodPicker } from '../components/ledger/ReportToolbar';
import { useAccountOptions } from '../components/ledger/LedgerForms';
import { formatNumber } from '../lib/format';
import { CATEGORY_LABELS, Period, periodFromPreset } from '../lib/ledger';
import { REPORTS, REPORT_GROUPS, ReportContext } from '../lib/reports';
import { ReportTable } from '../lib/export';

const GROUP_ICONS: Record<string, 'ledger' | 'users' | 'wallet' | 'warehouse'> = {
  المحاسبة: 'ledger',
  الفهارس: 'users',
  النقدية: 'wallet',
  المخازن: 'warehouse',
};

/** يعرض جدول التقرير كما سيُطبع: نفس الأعمدة والصفوف والإجماليات */
const ReportView: React.FC<{ table: ReportTable }> = ({ table }) => {
  const numeric = new Set(table.numericColumns || []);
  const cell = (v: string | number, i: number, strong = false) => {
    if (typeof v === 'number') {
      return (
        <td key={i} className={cx('text-end', strong && 'font-semibold')}>
          <span className={cx('num', v < 0 ? 'text-danger-700' : strong ? 'text-ink' : 'text-ink')}>{formatNumber(v)}</span>
        </td>
      );
    }
    return (
      <td key={i} className={cx(numeric.has(i) && 'text-end', strong && 'font-semibold', i === 0 && 'font-medium')}>
        {v === '' ? <span className="text-ink-faint">—</span> : v}
      </td>
    );
  };
  const head = (
    <thead>
      <tr>
        {table.columns.map((c, i) => (
          <th key={i} className={cx(numeric.has(i) && 'text-end')}>
            {c}
          </th>
        ))}
      </tr>
    </thead>
  );
  const body = (rows: Array<Array<string | number>>, footer?: Array<Array<string | number>>) => (
    <>
      <tbody>
        {rows.length ? (
          rows.map((r, i) => <tr key={i}>{r.map((v, j) => cell(v, j))}</tr>)
        ) : (
          <tr className="hover:bg-transparent">
            <td colSpan={table.columns.length} className="p-0">
              <EmptyState icon="chart" title="لا توجد بيانات لهذا التقرير" description="جرّب فترة أخرى أو أضف بيانات." />
            </td>
          </tr>
        )}
      </tbody>
      {footer?.length && rows.length ? (
        <tfoot>
          {footer.map((r, i) => (
            <tr key={i}>{r.map((v, j) => cell(v, j, true))}</tr>
          ))}
        </tfoot>
      ) : null}
    </>
  );

  return (
    <>
      {table.summary && table.summary.length > 0 && (
        <div className="grid grid-cols-2 gap-3 border-b border-line p-5 md:grid-cols-4">
          {table.summary.map(([k, v]) => (
            <div key={k} className="rounded-xl bg-slate-50 px-4 py-3">
              <p className="text-xs text-ink-subtle">{k}</p>
              <p className="num mt-1 text-lg font-semibold text-ink">{v}</p>
            </div>
          ))}
        </div>
      )}
      {table.sections ? (
        table.sections.length ? (
          table.sections.map((s) => (
            <div key={s.heading} className="border-b border-line last:border-0">
              <p className="bg-brand-50/60 px-5 py-2.5 text-sm font-semibold text-brand-800">{s.heading}</p>
              <div className="overflow-x-auto">
                <table className="table-base">
                  {head}
                  {body(s.rows, s.footer)}
                </table>
              </div>
            </div>
          ))
        ) : (
          <EmptyState icon="chart" title="لا توجد بيانات لهذا التقرير" />
        )
      ) : (
        <div className="max-h-[calc(100dvh-330px)] overflow-auto">
          <table className="table-base">
            {head}
            {body(table.rows, table.footer)}
          </table>
        </div>
      )}
    </>
  );
};

const Reports: React.FC = () => {
  const ledger = useLedger();
  const [params, setParams] = useSearchParams();
  const reportId = params.get('r') || 'income-expense';
  const report = REPORTS.find((r) => r.id === reportId) || REPORTS[0];
  const [period, setPeriod] = useState<Period>(periodFromPreset('year'));
  const [accountId, setAccountId] = useState(params.get('account') || '');
  const [category, setCategory] = useState('');
  const [q, setQ] = useState('');
  const options = useAccountOptions();

  const ctx: ReportContext = {
    accounts: ledger.accounts,
    accountsById: ledger.accountsById,
    operations: ledger.operations,
    opsByAccount: ledger.opsByAccount,
    roleOf: ledger.roleOf,
    mainCurrency: ledger.mainCurrency,
    cashboxes: ledger.cashboxes,
    vouchers: ledger.vouchers,
    warehouses: ledger.warehouses,
    items: ledger.items,
    moves: ledger.moves,
    cheques: ledger.cheques,
    period: report.usesPeriod ? period : periodFromPreset('all'),
    accountId,
    category,
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const table = useMemo(() => report.build(ctx), [report, ledger, period, accountId, category]);

  const visible = REPORTS.filter((r) => !q.trim() || r.title.includes(q.trim()) || r.description.includes(q.trim()));

  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-[280px_minmax(0,1fr)]">
      {/* قائمة التقارير */}
      <Card className="h-fit overflow-hidden xl:sticky xl:top-0">
        <div className="border-b border-line p-3">
          <div className="relative">
            <Icon name="search" size={15} className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-ink-faint" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="ابحث عن تقرير..."
              className="h-9 w-full rounded-lg bg-slate-50 pe-3 ps-9 text-sm outline-none focus:bg-white focus:ring-2 focus:ring-brand-500/20"
            />
          </div>
        </div>
        <nav className="max-h-[calc(100dvh-220px)] overflow-y-auto p-2">
          {REPORT_GROUPS.map((g) => {
            const list = visible.filter((r) => r.group === g);
            if (!list.length) return null;
            return (
              <div key={g} className="mb-3">
                <p className="flex items-center gap-2 px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wider text-ink-faint">
                  <Icon name={GROUP_ICONS[g] || 'chart'} size={13} /> {g}
                </p>
                {list.map((r) => (
                  <button
                    key={r.id}
                    onClick={() => setParams({ r: r.id })}
                    className={cx(
                      'block w-full rounded-lg px-3 py-2 text-start text-sm transition',
                      r.id === report.id ? 'bg-brand-600 font-medium text-white shadow-sm' : 'text-ink-muted hover:bg-slate-50 hover:text-ink',
                    )}
                  >
                    {r.title}
                  </button>
                ))}
              </div>
            );
          })}
          <div className="mb-1">
            <p className="flex items-center gap-2 px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wider text-ink-faint">
              <Icon name="receipt" size={13} /> المبيعات
            </p>
            <Link to="/invoices" className="block rounded-lg px-3 py-2 text-sm text-ink-muted hover:bg-slate-50 hover:text-ink">
              فواتير البيع وتحليل الربحية
            </Link>
          </div>
        </nav>
      </Card>

      {/* التقرير */}
      <div className="min-w-0">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-medium text-brand-600">{report.group}</p>
            <h1 className="text-2xl font-bold tracking-tight text-ink">{report.title}</h1>
            <p className="mt-1 text-sm text-ink-subtle">{report.description}</p>
          </div>
          <ExportButtons build={() => table} />
        </div>

        {(report.usesPeriod || report.params?.length) && (
          <Card className="mb-4 flex flex-wrap items-center gap-3 px-5 py-3">
            {report.usesPeriod && <PeriodPicker value={period} onChange={setPeriod} />}
            {report.params?.includes('account') && (
              <div className="w-72">
                <SearchSelect value={accountId} onChange={setAccountId} options={options} placeholder="اختر الحساب" />
              </div>
            )}
            {report.params?.includes('account') && accountId && (
              <Link to={`/accounts/${accountId}`} className="text-sm font-medium text-brand-600 hover:underline">
                فتح نافذة الحساب
              </Link>
            )}
            {report.params?.includes('category') && (
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
            )}
          </Card>
        )}

        <Card className="overflow-hidden">
          <div className="flex items-center justify-between border-b border-line px-5 py-3 text-xs text-ink-subtle">
            <span>{table.subtitle || ledger.company.name || 'المنصة المحاسبية'}</span>
            <span className="num">
              {formatNumber(table.sections ? table.sections.reduce((s, x) => s + x.rows.length, 0) : table.rows.length, 0)} سطر
            </span>
          </div>
          {report.params?.includes('account') && !accountId ? (
            <EmptyState icon="ledger" title="اختر الحساب لعرض كشفه" />
          ) : (
            <ReportView table={table} />
          )}
        </Card>
      </div>
    </div>
  );
};

export default Reports;
