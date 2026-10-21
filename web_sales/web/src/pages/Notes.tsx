import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useLedger } from '../context/LedgerContext';
import { Badge, Button, Card, PageHeader, StatCard } from '../components/ui/primitives';
import DataTable, { Column } from '../components/ui/DataTable';
import Icon from '../components/ui/Icon';
import { ConfirmModal } from '../components/ui/Modal';
import { ExportButtons, PeriodPicker } from '../components/ledger/ReportToolbar';
import { NoteFormModal } from '../components/trade/AdminForms';
import { formatDate, formatNumber } from '../lib/format';
import { Period, inPeriod, periodFromPreset, periodText } from '../lib/ledger';
import { NOTE_LABELS, Note, NoteKind } from '../lib/trade';

// الإشعارات المدينة والدائنة (فصل الإشعارات في الأصيل)

const Notes: React.FC = () => {
  const { notes, accountsById, deleteNote, mainCurrency } = useLedger();
  const [period, setPeriod] = useState<Period>(periodFromPreset('year'));
  const [modal, setModal] = useState<{ open: boolean; kind: NoteKind }>({ open: false, kind: 'debit' });
  const [confirm, setConfirm] = useState<Note | null>(null);

  const rows = useMemo(() => notes.filter((n) => inPeriod(n.date, period)), [notes, period]);
  const total = (k: NoteKind) => rows.filter((n) => n.kind === k).reduce((s, n) => s + (n.amount * (1 + (n.vatPct || 0) / 100)) / (n.exchangeRate || 1), 0);
  const name = (id: string) => accountsById[id]?.name || id;

  const columns: Array<Column<Note>> = [
    {
      key: 'n',
      header: 'الإشعار',
      className: 'w-40',
      render: (n) => (
        <div>
          <Badge tone={n.kind === 'debit' ? 'success' : 'danger'}>{NOTE_LABELS[n.kind]}</Badge>
          <span className="num ms-2 text-xs text-ink-subtle">#{n.number}</span>
        </div>
      ),
    },
    { key: 'date', header: 'التاريخ', className: 'w-32', render: (n) => <span className="text-ink-muted">{formatDate(n.date)}</span> },
    {
      key: 'party',
      header: 'الطرف',
      render: (n) => (
        <Link to={`/accounts/${n.partyId}`} className="font-medium text-brand-700 hover:underline">
          {name(n.partyId)}
        </Link>
      ),
    },
    { key: 'counter', header: 'الحساب المقابل', render: (n) => name(n.counterAccountId) },
    { key: 'st', header: 'البيان', render: (n) => <span className="text-ink-muted">{n.statement || '—'}</span> },
    {
      key: 'amt',
      header: 'المبلغ',
      numeric: true,
      render: (n) => (
        <>
          {formatNumber(n.amount)} <span className="text-xs text-ink-subtle">{n.currency}</span>
          {n.vatPct ? <span className="block text-[11px] text-ink-subtle">+ ضريبة {n.vatPct}%</span> : null}
        </>
      ),
    },
    {
      key: 'del',
      header: '',
      className: 'w-12',
      render: (n) => (
        <button
          onClick={() => setConfirm(n)}
          title="حذف الإشعار وقيوده"
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
        title="الإشعارات المدينة والدائنة"
        description="تسويات مع الزبائن والموردين دون فاتورة: فروق أسعار، خصومات لاحقة، تعويضات، مصاريف محمّلة"
        actions={
          <>
            <Button variant="secondary" icon="arrowOut" onClick={() => setModal({ open: true, kind: 'credit' })}>
              إشعار دائن
            </Button>
            <Button icon="arrowIn" onClick={() => setModal({ open: true, kind: 'debit' })}>
              إشعار مدين
            </Button>
          </>
        }
      />
      <div className="mb-6 grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-3">
        <StatCard label="الإشعارات المدينة" value={formatNumber(total('debit'))} unit={mainCurrency} icon="arrowIn" tone="success" />
        <StatCard label="الإشعارات الدائنة" value={formatNumber(total('credit'))} unit={mainCurrency} icon="arrowOut" tone="danger" />
        <StatCard label="عدد الإشعارات" value={formatNumber(rows.length, 0)} icon="receipt" tone="info" hint={periodText(period)} />
      </div>
      <Card className="overflow-hidden">
        <div className="flex flex-wrap items-center justify-end gap-2 border-b border-line px-5 py-4">
          <PeriodPicker value={period} onChange={setPeriod} />
          <ExportButtons
            disabled={!rows.length}
            build={() => ({
              title: 'الإشعارات المدينة والدائنة',
              subtitle: periodText(period),
              columns: ['النوع', 'الرقم', 'التاريخ', 'الطرف', 'الحساب المقابل', 'البيان', 'المبلغ', 'الضريبة %', 'العملة'],
              numericColumns: [6, 7],
              rows: rows.map((n) => [
                NOTE_LABELS[n.kind],
                String(n.number),
                formatDate(n.date),
                name(n.partyId),
                name(n.counterAccountId),
                n.statement,
                n.amount,
                n.vatPct || 0,
                n.currency,
              ]),
            })}
          />
        </div>
        <DataTable
          columns={columns}
          rows={rows}
          rowKey={(n) => n.id}
          maxHeight="calc(100dvh - 380px)"
          empty={{ title: 'لا توجد إشعارات في هذه الفترة', icon: 'receipt' }}
        />
      </Card>
      <NoteFormModal open={modal.open} kind={modal.kind} onClose={() => setModal((m) => ({ ...m, open: false }))} />
      <ConfirmModal
        open={!!confirm}
        onClose={() => setConfirm(null)}
        title="حذف الإشعار"
        message="سيُحذف الإشعار وقيوده من المنصة والهاتف."
        onConfirm={() => confirm && deleteNote(confirm.id)}
      />
    </>
  );
};

export default Notes;
