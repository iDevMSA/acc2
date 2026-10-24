import React, { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useNewParam } from '../hooks/useNewParam';
import { useLedger } from '../context/LedgerContext';
import { Badge, Button, Card, PageHeader, StatCard, Tabs } from '../components/ui/primitives';
import DataTable, { Column } from '../components/ui/DataTable';
import Icon from '../components/ui/Icon';
import { ConfirmModal } from '../components/ui/Modal';
import { VoucherFormModal } from '../components/ledger/CashForms';
import { ExportButtons, PeriodPicker } from '../components/ledger/ReportToolbar';
import { formatDate, formatNumber } from '../lib/format';
import { Period, ROLE_LABELS, inPeriod, periodFromPreset, periodText } from '../lib/ledger';
import { Voucher, VoucherType, VOUCHER_LABELS } from '../lib/erp';
import { printReport } from '../lib/export';
import { amountInWords } from '../lib/localization';

type TypeFilter = 'all' | VoucherType;
type PartyFilter = 'all' | 'customer' | 'supplier' | 'employee' | 'general';

const Vouchers: React.FC = () => {
  const [params, setParams] = useSearchParams();
  const typeFilter = (params.get('type') as TypeFilter) || 'all';
  const partyFilter = (params.get('party') as PartyFilter) || 'all';
  const { vouchers, cashboxes, accountsById, roleOf, deleteVoucher, mainCurrency, company } = useLedger();
  const [period, setPeriod] = useState<Period>(periodFromPreset('month'));
  const [modal, setModal] = useState<{ open: boolean; type: VoucherType }>({ open: false, type: 'receipt' });
  const [confirm, setConfirm] = useState<Voucher | null>(null);
  useNewParam((k) => ['receipt', 'payment', 'transfer'].includes(k) && setModal({ open: true, type: k as VoucherType }));

  const setParam = (k: string, v: string) => {
    const next = new URLSearchParams(params);
    if (v === 'all') next.delete(k);
    else next.set(k, v);
    setParams(next);
  };

  const rows = useMemo(
    () =>
      vouchers.filter(
        (v) =>
          inPeriod(v.date, period) &&
          (typeFilter === 'all' || v.type === typeFilter) &&
          (partyFilter === 'all' || (v.partyId && roleOf(v.partyId) === partyFilter)),
      ),
    [vouchers, period, typeFilter, partyFilter, roleOf],
  );

  const main = (v: Voucher) => v.amount / (v.exchangeRate || 1);
  const sum = (t: VoucherType) => rows.filter((v) => v.type === t).reduce((s, v) => s + main(v), 0);
  const boxName = (id?: string | null) => cashboxes.find((b) => b.id === id)?.name || '—';

  // سند رسمي: الترويسة والتاريخ (هجري إن اختير) والمبلغ كتابةً وخانات التوقيع
  const printVoucher = (v: Voucher) => {
    const party = v.type === 'transfer' ? boxName(v.toBoxId) : v.partyId ? accountsById[v.partyId]?.name || v.partyId : '—';
    printReport(
      {
        title: `${VOUCHER_LABELS[v.type]} رقم ${v.number}`,
        docDate: v.date,
        summary: [
          [v.type === 'receipt' ? 'استلمنا من' : v.type === 'payment' ? 'صرفنا إلى' : 'إلى صندوق', String(party)],
          ['المبلغ', `${formatNumber(v.amount)} ${v.currency}`],
          ['الصندوق', String(boxName(v.boxId))],
        ],
        columns: ['البيان', 'العملة', 'سعر الصرف', 'المبلغ'],
        numericColumns: [2, 3],
        rows: [[v.statement || VOUCHER_LABELS[v.type], v.currency, v.exchangeRate, v.amount]],
        amountWords: amountInWords(v.amount, v.currency),
      },
      company,
    );
  };

  const columns: Array<Column<Voucher>> = [
    {
      key: 'n',
      header: 'السند',
      className: 'w-40',
      render: (v) => (
        <div>
          <Badge tone={v.type === 'receipt' ? 'success' : v.type === 'payment' ? 'danger' : 'info'}>{VOUCHER_LABELS[v.type]}</Badge>
          <span className="num ms-2 text-xs text-ink-subtle">#{v.number}</span>
        </div>
      ),
    },
    { key: 'date', header: 'التاريخ', className: 'w-32', render: (v) => <span className="text-ink-muted">{formatDate(v.date)}</span> },
    { key: 'box', header: 'الصندوق', render: (v) => boxName(v.boxId) },
    {
      key: 'party',
      header: 'الطرف',
      render: (v) =>
        v.type === 'transfer' ? (
          <span className="text-ink-muted">← {boxName(v.toBoxId)}</span>
        ) : v.partyId ? (
          <Link to={`/accounts/${v.partyId}`} className="font-medium text-brand-700 hover:underline">
            {accountsById[v.partyId]?.name || v.partyId}
          </Link>
        ) : (
          '—'
        ),
    },
    { key: 'st', header: 'البيان', render: (v) => <span className="text-ink-muted">{v.statement || '—'}</span> },
    {
      key: 'amt',
      header: 'المبلغ',
      numeric: true,
      render: (v) => (
        <>
          {formatNumber(v.amount)} <span className="text-xs text-ink-subtle">{v.currency}</span>
        </>
      ),
    },
    {
      key: 'print',
      header: '',
      className: 'w-12',
      render: (v) => (
        <button
          onClick={() => printVoucher(v)}
          title="طباعة السند"
          className="grid h-8 w-8 place-items-center rounded-md text-ink-subtle hover:bg-slate-100 hover:text-ink"
        >
          <Icon name="receipt" size={15} />
        </button>
      ),
    },
    {
      key: 'del',
      header: '',
      className: 'w-12',
      render: (v) => (
        <button
          onClick={() => setConfirm(v)}
          title="حذف السند وقيوده"
          className="grid h-8 w-8 place-items-center rounded-md text-ink-subtle hover:bg-danger-50 hover:text-danger-600"
        >
          <Icon name="trash" size={15} />
        </button>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="القبض والصرف"
        description="سندات القبض والصرف والتحويل بين الصناديق — كل سند ينشئ قيدين متقابلين على الحسابات"
        actions={
          <>
            <Button variant="secondary" icon="swap" onClick={() => setModal({ open: true, type: 'transfer' })}>
              تحويل
            </Button>
            <Button variant="secondary" icon="arrowOut" onClick={() => setModal({ open: true, type: 'payment' })}>
              سند صرف
            </Button>
            <Button icon="arrowIn" onClick={() => setModal({ open: true, type: 'receipt' })}>
              سند قبض
            </Button>
          </>
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <StatCard label="المقبوضات" value={formatNumber(sum('receipt'))} unit={mainCurrency} icon="arrowIn" tone="success" />
        <StatCard label="المدفوعات" value={formatNumber(sum('payment'))} unit={mainCurrency} icon="arrowOut" tone="danger" />
        <StatCard label="صافي النقدية" value={formatNumber(sum('receipt') - sum('payment'))} unit={mainCurrency} icon="scale" tone="brand" />
        <StatCard label="عدد السندات" value={formatNumber(rows.length, 0)} icon="receipt" tone="info" hint={periodText(period)} />
      </div>

      <Card className="overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-line px-5 py-4 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <Tabs<TypeFilter>
              value={typeFilter}
              onChange={(v) => setParam('type', v)}
              items={[
                { value: 'all', label: 'الكل' },
                { value: 'receipt', label: 'قبض' },
                { value: 'payment', label: 'صرف' },
                { value: 'transfer', label: 'تحويل' },
              ]}
            />
            <select
              value={partyFilter}
              onChange={(e) => setParam('party', e.target.value)}
              className="h-9 rounded-lg border border-line-strong bg-surface pe-8 ps-3 text-sm shadow-sm"
            >
              <option value="all">كل الأطراف</option>
              {(['customer', 'supplier', 'employee', 'general'] as const).map((r) => (
                <option key={r} value={r}>
                  {ROLE_LABELS[r]}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <PeriodPicker value={period} onChange={setPeriod} />
            <ExportButtons
              disabled={!rows.length}
              build={() => ({
                title: 'إيصالات القبض والصرف',
                subtitle: periodText(period),
                summary: [
                  ['المقبوضات', formatNumber(sum('receipt'))],
                  ['المدفوعات', formatNumber(sum('payment'))],
                ],
                columns: ['النوع', 'الرقم', 'التاريخ', 'الصندوق', 'الطرف', 'البيان', 'المبلغ', 'العملة'],
                numericColumns: [6],
                rows: rows.map((v) => [
                  VOUCHER_LABELS[v.type],
                  String(v.number),
                  formatDate(v.date),
                  boxName(v.boxId),
                  v.type === 'transfer' ? boxName(v.toBoxId) : accountsById[v.partyId || '']?.name || '',
                  v.statement,
                  v.amount,
                  v.currency,
                ]),
              })}
            />
          </div>
        </div>
        <DataTable
          columns={columns}
          rows={rows}
          rowKey={(v) => v.id}
          maxHeight="calc(100dvh - 380px)"
          empty={{ title: 'لا توجد سندات في هذه الفترة', description: 'سجّل سند قبض أو صرف من الأزرار في الأعلى.', icon: 'swap' }}
        />
      </Card>

      <VoucherFormModal open={modal.open} type={modal.type} onClose={() => setModal((m) => ({ ...m, open: false }))} />
      <ConfirmModal
        open={!!confirm}
        onClose={() => setConfirm(null)}
        title="حذف السند"
        message="سيُحذف السند والقيدان المرتبطان به من المنصة والهاتف."
        onConfirm={() => confirm && deleteVoucher(confirm.id)}
      />
    </>
  );
};

export default Vouchers;
