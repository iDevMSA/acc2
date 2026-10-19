import React, { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useLedger } from '../context/LedgerContext';
import { Badge, Button, Card, PageHeader, StatCard, cx } from '../components/ui/primitives';
import DataTable, { Column } from '../components/ui/DataTable';
import Icon from '../components/ui/Icon';
import { ConfirmModal } from '../components/ui/Modal';
import { ChequeActionModal, ChequeFormModal } from '../components/ledger/ChequeForms';
import { ExportButtons } from '../components/ledger/ReportToolbar';
import { formatNumber } from '../lib/format';
import { localIso } from '../lib/ledger';
import { CHEQUE_STATUS, CHEQUE_TRANSITIONS, Cheque, ChequeDirection, ChequeStatus } from '../lib/erp';

type View = { direction: ChequeDirection; status: ChequeStatus | 'all' };

const VIEWS: Array<{ key: string; label: string; view: View }> = [
  { key: 'in', label: 'الشيكات الواردة', view: { direction: 'in', status: 'all' } },
  { key: 'in-portfolio', label: 'حافظة الشيكات', view: { direction: 'in', status: 'portfolio' } },
  { key: 'in-collecting', label: 'تحت التحصيل', view: { direction: 'in', status: 'collecting' } },
  { key: 'in-cleared', label: 'واردة مصروفة', view: { direction: 'in', status: 'cleared' } },
  { key: 'in-returned', label: 'مرجعة في البنك', view: { direction: 'in', status: 'returned' } },
  { key: 'in-endorsed', label: 'المجيّرة', view: { direction: 'in', status: 'endorsed' } },
  { key: 'out', label: 'الشيكات الصادرة', view: { direction: 'out', status: 'all' } },
  { key: 'out-issued', label: 'غير مصروفة', view: { direction: 'out', status: 'issued' } },
  { key: 'out-cleared', label: 'صادرة مصروفة', view: { direction: 'out', status: 'cleared' } },
  { key: 'out-returned', label: 'صادرة مرجعة', view: { direction: 'out', status: 'returned' } },
];

const Cheques: React.FC = () => {
  const [params, setParams] = useSearchParams();
  const viewKey = params.get('view') || 'in';
  const current = VIEWS.find((v) => v.key === viewKey) || VIEWS[0];
  const { cheques, accountsById, deleteCheque, mainCurrency } = useLedger();
  const [form, setForm] = useState<{ open: boolean; direction: ChequeDirection }>({ open: false, direction: 'in' });
  const [action, setAction] = useState<{ cheque: Cheque | null; status: ChequeStatus | null }>({ cheque: null, status: null });
  const [confirm, setConfirm] = useState<Cheque | null>(null);

  const rows = useMemo(
    () =>
      cheques.filter(
        (c) => c.direction === current.view.direction && (current.view.status === 'all' || c.status === current.view.status),
      ),
    [cheques, current],
  );

  const today = localIso().slice(0, 10);
  const sumOf = (dir: ChequeDirection, statuses: ChequeStatus[]) =>
    cheques
      .filter((c) => c.direction === dir && statuses.includes(c.status))
      .reduce((s, c) => s + c.amount / (c.exchangeRate || 1), 0);
  const dueSoon = cheques.filter(
    (c) => ['portfolio', 'collecting', 'issued'].includes(c.status) && c.dueDate && c.dueDate <= localIso(new Date(Date.now() + 7 * 864e5)).slice(0, 10),
  );

  const count = (v: View) =>
    cheques.filter((c) => c.direction === v.direction && (v.status === 'all' || c.status === v.status)).length;

  const columns: Array<Column<Cheque>> = [
    {
      key: 'num',
      header: 'رقم الشيك',
      render: (c) => (
        <div>
          <p className="num font-medium text-ink">{c.number}</p>
          <p className="text-xs text-ink-subtle">{c.bank || '—'}</p>
        </div>
      ),
    },
    {
      key: 'party',
      header: c0(current.view.direction),
      render: (c) => (
        <Link to={`/accounts/${c.partyId}`} className="font-medium text-brand-700 hover:underline">
          {accountsById[c.partyId]?.name || c.partyId}
        </Link>
      ),
    },
    {
      key: 'due',
      header: 'الاستحقاق',
      render: (c) => (
        <span className={cx('num', c.dueDate < today && ['portfolio', 'collecting', 'issued'].includes(c.status) && 'font-semibold text-danger-700')}>
          {c.dueDate || '—'}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'الحالة',
      render: (c) => (
        <div>
          <Badge tone={CHEQUE_STATUS[c.status].tone}>{CHEQUE_STATUS[c.status].label}</Badge>
          {c.status === 'endorsed' && c.endorsedToId && (
            <p className="mt-0.5 text-xs text-ink-subtle">إلى {accountsById[c.endorsedToId]?.name}</p>
          )}
          {c.bankAccountId && ['collecting', 'cleared'].includes(c.status) && (
            <p className="mt-0.5 text-xs text-ink-subtle">{accountsById[c.bankAccountId]?.name}</p>
          )}
        </div>
      ),
    },
    {
      key: 'amt',
      header: 'المبلغ',
      numeric: true,
      render: (c) => (
        <>
          {formatNumber(c.amount)} <span className="text-xs font-normal text-ink-subtle">{c.currency}</span>
        </>
      ),
    },
    {
      key: 'act',
      header: 'الإجراءات',
      render: (c) => (
        <div className="flex flex-wrap items-center justify-end gap-1">
          {(CHEQUE_TRANSITIONS[c.direction][c.status] || []).map((s) => (
            <button
              key={s}
              onClick={() => setAction({ cheque: c, status: s })}
              className="h-7 rounded-md border border-line-strong px-2 text-[11px] font-medium text-ink-muted hover:border-brand-300 hover:bg-brand-50 hover:text-brand-700"
            >
              {s === 'collecting' ? 'إيداع' : s === 'cleared' ? 'صرف' : s === 'returned' ? 'إرجاع' : s === 'endorsed' ? 'تجيير' : 'إعادة'}
            </button>
          ))}
          <button
            onClick={() => setConfirm(c)}
            title="حذف الشيك وقيوده"
            className="grid h-7 w-7 place-items-center rounded-md text-ink-subtle hover:bg-danger-50 hover:text-danger-600"
          >
            <Icon name="trash" size={14} />
          </button>
        </div>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="الشيكات"
        description="دورة حياة الشيك كاملة: الحافظة ← الإيداع ← الصرف أو الإرجاع أو التجيير، مع قيودها على الحسابات"
        actions={
          <>
            <Button variant="secondary" icon="arrowOut" onClick={() => setForm({ open: true, direction: 'out' })}>
              شيك صادر
            </Button>
            <Button icon="arrowIn" onClick={() => setForm({ open: true, direction: 'in' })}>
              شيك وارد
            </Button>
          </>
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <StatCard label="في الحافظة" value={formatNumber(sumOf('in', ['portfolio']))} unit={mainCurrency} icon="cheque" tone="info" />
        <StatCard label="تحت التحصيل" value={formatNumber(sumOf('in', ['collecting']))} unit={mainCurrency} icon="building" tone="warning" />
        <StatCard label="صادرة غير مصروفة" value={formatNumber(sumOf('out', ['issued']))} unit={mainCurrency} icon="arrowOut" tone="danger" />
        <StatCard
          label="تستحق خلال 7 أيام"
          value={formatNumber(dueSoon.length, 0)}
          unit="شيك"
          icon="calendar"
          tone={dueSoon.length ? 'warning' : 'success'}
        />
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[240px_minmax(0,1fr)]">
        <Card className="h-fit p-2">
          {VIEWS.map((v, i) => (
            <React.Fragment key={v.key}>
              {i === 6 && <div className="my-2 border-t border-line" />}
              <button
                onClick={() => setParams(v.key === 'in' ? {} : { view: v.key })}
                className={cx(
                  'flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm transition',
                  v.key === current.key ? 'bg-brand-50 font-semibold text-brand-700' : 'text-ink-muted hover:bg-slate-50',
                  v.view.status === 'all' && 'font-semibold',
                )}
              >
                {v.label}
                <span className="num text-xs text-ink-subtle">{count(v.view)}</span>
              </button>
            </React.Fragment>
          ))}
        </Card>

        <Card className="min-w-0 overflow-hidden">
          <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-4">
            <div>
              <h2 className="text-[15px] font-semibold text-ink">{current.label}</h2>
              <p className="text-xs text-ink-subtle">
                {formatNumber(rows.length, 0)} شيك · الإجمالي{' '}
                <span className="num">{formatNumber(rows.reduce((s, c) => s + c.amount / (c.exchangeRate || 1), 0))}</span> {mainCurrency}
              </p>
            </div>
            <ExportButtons
              disabled={!rows.length}
              build={() => ({
                title: current.label,
                columns: ['رقم الشيك', 'البنك', current.view.direction === 'in' ? 'الساحب' : 'المستفيد', 'الاستحقاق', 'الحالة', 'المبلغ', 'العملة'],
                numericColumns: [5],
                rows: rows.map((c) => [
                  c.number,
                  c.bank,
                  accountsById[c.partyId]?.name || '',
                  c.dueDate,
                  CHEQUE_STATUS[c.status].label,
                  c.amount,
                  c.currency,
                ]),
              })}
            />
          </div>
          <DataTable
            columns={columns}
            rows={rows}
            rowKey={(c) => c.id}
            maxHeight="calc(100dvh - 360px)"
            empty={{ title: 'لا توجد شيكات هنا', description: 'سجّل شيكاً وارداً أو صادراً من الأزرار في الأعلى.', icon: 'cheque' }}
          />
        </Card>
      </div>

      <ChequeFormModal open={form.open} direction={form.direction} onClose={() => setForm((f) => ({ ...f, open: false }))} />
      <ChequeActionModal cheque={action.cheque} status={action.status} onClose={() => setAction({ cheque: null, status: null })} />
      <ConfirmModal
        open={!!confirm}
        onClose={() => setConfirm(null)}
        title="حذف الشيك"
        message={`حذف الشيك رقم ${confirm?.number} وكل قيوده (التسجيل والصرف والإرجاع) من المنصة والهاتف؟`}
        onConfirm={() => confirm && deleteCheque(confirm)}
      />
    </>
  );
};

const c0 = (d: ChequeDirection) => (d === 'in' ? 'الساحب' : 'المستفيد');

export default Cheques;
