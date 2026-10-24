import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Badge, Button, Card, CardHeader, PageHeader, StatCard, Tabs, cx } from '../components/ui/primitives';
import { Field, FormError, Input, SearchSelect, Select } from '../components/ui/Form';
import Modal from '../components/ui/Modal';
import DataTable, { Column } from '../components/ui/DataTable';
import { ExportButtons } from '../components/ledger/ReportToolbar';
import { useApp } from '../context/AppContext';
import { useLedger } from '../context/LedgerContext';
import { can } from '../lib/team';
import { formatDate, formatNumber, formatPercent } from '../lib/format';
import { localIso } from '../lib/ledger';
import { BudgetLine, CHAPTER_ORDER, budgetLines, chapterLabel, executionPct, fyKeyOf, fyRangeOfKey, sumLines } from '../lib/budget';

type Tab = 'exec' | 'plan' | 'transfers';

const Bar: React.FC<{ pct: number }> = ({ pct }) => (
  <div className="h-1.5 w-20 overflow-hidden rounded-full bg-slate-100">
    <div className={cx('h-full rounded-full', pct > 100 ? 'bg-danger-600' : pct > 85 ? 'bg-warning-600' : 'bg-brand-600')} style={{ width: `${Math.min(pct, 100)}%` }} />
  </div>
);

// الموازنة: الاعتمادات لكل بند (حساب مصروف) حسب أبواب الموازنة، والمناقلات، وتقرير التنفيذ
const Budget: React.FC = () => {
  const { member } = useApp();
  const { accounts, accountMeta, opsByAccount, profile, appropriations, budgetTransfers, commitments, accountsById, saveAppropriations, mainCurrency } =
    useLedger();
  const startMonth = profile?.fiscalYearStartMonth ?? 1;
  const currentFy = fyKeyOf(new Date(), startMonth);
  const [fy, setFy] = useState(currentFy);
  const [tab, setTab] = useState<Tab>('exec');
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [transferOpen, setTransferOpen] = useState(false);
  const editable = can(member, 'budget', 'edit');

  const fys = useMemo(() => {
    const prev = fyKeyOf(new Date(new Date().getFullYear() - 1, startMonth - 1, 15), startMonth);
    const next = fyKeyOf(new Date(new Date().getFullYear() + 1, startMonth - 1, 15), startMonth);
    return Array.from(new Set([next, currentFy, prev, ...Object.keys(appropriations)])).sort().reverse();
  }, [appropriations, currentFy, startMonth]);
  const range = fyRangeOfKey(fy, startMonth);

  const lines = useMemo(
    () =>
      budgetLines(accounts, accountMeta, { appropriations: appropriations[fy] || {}, transfers: budgetTransfers, commitments }, opsByAccount, range, fy),
    [accounts, accountMeta, appropriations, budgetTransfers, commitments, opsByAccount, range.from, range.to, fy], // eslint-disable-line react-hooks/exhaustive-deps
  );
  const totals = sumLines(lines);
  const shown = tab === 'exec' ? lines.filter((l) => l.current || l.spent || l.committed || l.pending) : lines;

  useEffect(() => {
    setDraft(Object.fromEntries(Object.entries(appropriations[fy] || {}).map(([k, v]) => [k, String(v)])));
  }, [fy, appropriations]);

  const savePlan = async () => {
    setMsg(null);
    try {
      const values: Record<string, number> = {};
      lines.forEach((l) => {
        const v = Number(draft[l.accountId] || 0);
        if (v !== (appropriations[fy]?.[l.accountId] || 0)) values[l.accountId] = v;
      });
      await saveAppropriations(fy, values);
      setMsg({ ok: true, text: `حُفظت اعتمادات السنة المالية ${fy.replace('-', '/')}` });
    } catch (e: any) {
      setMsg({ ok: false, text: e?.message || 'تعذّر الحفظ' });
    }
  };

  const rowsWithChapters = useMemo(() => {
    const out: Array<BudgetLine | { chapter: BudgetLine['chapter']; header: true; t: ReturnType<typeof sumLines> }> = [];
    CHAPTER_ORDER.forEach((ch) => {
      const ls = shown.filter((l) => l.chapter === ch);
      if (!ls.length) return;
      out.push({ chapter: ch, header: true, t: sumLines(ls) });
      out.push(...ls);
    });
    return out;
  }, [shown]);
  type Row = (typeof rowsWithChapters)[number];
  const isHeader = (r: Row): r is { chapter: BudgetLine['chapter']; header: true; t: ReturnType<typeof sumLines> } => 'header' in r;

  const n = (v: number) => <span className={cx('num', v < 0 && 'text-danger-700')}>{formatNumber(v)}</span>;

  const execCols: Column<Row>[] = [
    {
      key: 'name',
      header: 'البند',
      className: 'min-w-[14rem]',
      render: (r) =>
        isHeader(r) ? (
          <span className="font-semibold text-brand-800">{chapterLabel(r.chapter)}</span>
        ) : (
          <Link to={`/accounts/${r.accountId}`} className="text-ink hover:text-brand-700">
            {r.code && <span className="num me-2 text-xs text-ink-subtle">{r.code}</span>}
            {r.name}
          </Link>
        ),
    },
    { key: 'cur', header: 'الاعتماد الحالي', numeric: true, render: (r) => n(isHeader(r) ? r.t.current : r.current) },
    { key: 'pend', header: 'قيد الاعتماد', numeric: true, render: (r) => <span className="text-ink-subtle">{n(isHeader(r) ? r.t.pending : r.pending)}</span> },
    { key: 'com', header: 'المرتبط', numeric: true, render: (r) => n(isHeader(r) ? r.t.committed : r.committed) },
    { key: 'sp', header: 'المصروف', numeric: true, render: (r) => n(isHeader(r) ? r.t.spent : r.spent) },
    { key: 'av', header: 'المتاح', numeric: true, render: (r) => <b>{n(isHeader(r) ? r.t.available : r.available)}</b> },
    {
      key: 'pct',
      header: 'التنفيذ',
      render: (r) => {
        const p = executionPct(isHeader(r) ? r.t : r);
        return (
          <div className="flex items-center gap-2">
            <Bar pct={p} />
            <span className="num text-xs text-ink-subtle">{formatPercent(p, 0)}</span>
          </div>
        );
      },
    },
  ];

  const planCols: Column<Row>[] = [
    execCols[0],
    {
      key: 'orig',
      header: `الاعتماد الأصلي (${mainCurrency})`,
      render: (r) =>
        isHeader(r) ? (
          <span className="num font-semibold">{formatNumber(lines.filter((l) => l.chapter === r.chapter).reduce((s, l) => s + Number(draft[l.accountId] || 0), 0))}</span>
        ) : (
          <Input
            className="num h-9 w-40"
            inputMode="decimal"
            disabled={!editable}
            value={draft[r.accountId] ?? ''}
            placeholder="0"
            onChange={(e) => setDraft({ ...draft, [r.accountId]: e.target.value.replace(/[^0-9.]/g, '') })}
          />
        ),
    },
    { key: 'tin', header: 'مناقلات واردة', numeric: true, render: (r) => (isHeader(r) ? '' : n(r.transfersIn)) },
    { key: 'tout', header: 'مناقلات صادرة', numeric: true, render: (r) => (isHeader(r) ? '' : n(r.transfersOut)) },
  ];

  const exportTable = () => ({
    title: `تنفيذ الموازنة — السنة المالية ${fy.replace('-', '/')}`,
    subtitle: `من ${range.from} إلى ${range.to}`,
    columns: ['البند', 'الاعتماد الأصلي', 'المناقلات', 'الاعتماد الحالي', 'المرتبط', 'المصروف', 'المتاح', 'التنفيذ %'],
    numericColumns: [1, 2, 3, 4, 5, 6, 7],
    summary: [
      ['الاعتماد الحالي', `${formatNumber(totals.current)} ${mainCurrency}`],
      ['المرتبط', `${formatNumber(totals.committed)} ${mainCurrency}`],
      ['المصروف', `${formatNumber(totals.spent)} ${mainCurrency}`],
      ['المتاح', `${formatNumber(totals.available)} ${mainCurrency}`],
    ] as Array<[string, string]>,
    rows: [],
    sections: CHAPTER_ORDER.map((ch) => {
      const ls = shown.filter((l) => l.chapter === ch);
      const t = sumLines(ls);
      return {
        heading: chapterLabel(ch),
        rows: ls.map((l) => [l.name, l.appropriation, l.transfersIn - l.transfersOut, l.current, l.committed, l.spent, l.available, Math.round(executionPct(l))]),
        footer: [['إجمالي الباب', t.appropriation, t.current - t.appropriation, t.current, t.committed, t.spent, t.available, Math.round(executionPct(t))]],
      };
    }).filter((s) => s.rows.length),
  });

  const transferCols: Column<(typeof budgetTransfers)[number]>[] = [
    { key: 'n', header: 'الرقم', render: (t) => <span className="num text-ink-subtle">{t.number}</span> },
    { key: 'd', header: 'التاريخ', render: (t) => <span className="text-ink-muted">{formatDate(t.date)}</span> },
    { key: 'f', header: 'من بند', render: (t) => (t.fromAccountId ? accountsById[t.fromAccountId]?.name || t.fromAccountId : <Badge tone="info">اعتماد إضافي</Badge>) },
    { key: 't', header: 'إلى بند', render: (t) => accountsById[t.toAccountId]?.name || t.toAccountId },
    { key: 'a', header: 'المبلغ', numeric: true, render: (t) => n(t.amount) },
    { key: 'note', header: 'السبب', render: (t) => <span className="text-ink-muted">{t.note || '—'}</span> },
    { key: 'by', header: 'بواسطة', render: (t) => <span className="text-xs text-ink-subtle">{t.byName}</span> },
  ];

  return (
    <>
      <PageHeader
        title="الموازنة"
        description="اعتمادات كل بند حسب أبواب الموازنة، والمناقلات بينها، وتقرير التنفيذ: المرتبط والمصروف والمتاح"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Select value={fy} onChange={(e) => setFy(e.target.value)} className="h-9 w-60">
              {fys.map((k) => (
                <option key={k} value={k}>
                  السنة المالية {k.replace('-', '/')}
                </option>
              ))}
            </Select>
            <Link to="/commitments">
              <Button variant="secondary" icon="cheque">
                المشتريات والارتباطات
              </Button>
            </Link>
          </div>
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="الاعتماد الحالي" value={formatNumber(totals.current)} unit={mainCurrency} icon="wallet" />
        <StatCard label="المرتبط" value={formatNumber(totals.committed)} unit={mainCurrency} icon="lock" tone="info" />
        <StatCard label="المصروف" value={formatNumber(totals.spent)} unit={mainCurrency} icon="arrowOut" tone="warning" />
        <StatCard label="المتاح" value={formatNumber(totals.available)} unit={mainCurrency} icon="check" tone={totals.available < 0 ? 'danger' : 'success'} />
      </div>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <Tabs
          value={tab}
          onChange={setTab}
          items={[
            { value: 'exec', label: 'تنفيذ الموازنة', icon: 'chart' },
            { value: 'plan', label: 'الاعتمادات', icon: 'edit' },
            { value: 'transfers', label: 'المناقلات', icon: 'swap' },
          ]}
        />
        {tab === 'exec' && <ExportButtons build={exportTable} disabled={!shown.length} />}
        {tab === 'plan' && editable && <Button onClick={savePlan}>حفظ الاعتمادات</Button>}
        {tab === 'transfers' && editable && (
          <Button icon="plus" onClick={() => setTransferOpen(true)}>
            مناقلة أو اعتماد إضافي
          </Button>
        )}
      </div>

      {msg && <p className={cx('mb-4 rounded-lg px-4 py-3 text-sm', msg.ok ? 'bg-success-50 text-success-700' : 'bg-danger-50 text-danger-700')}>{msg.text}</p>}

      <Card>
        {tab === 'transfers' ? (
          <DataTable
            columns={transferCols}
            rows={budgetTransfers.filter((t) => t.fy === fy)}
            rowKey={(t) => t.id}
            empty={{ title: 'لا توجد مناقلات في هذه السنة', description: 'انقل جزءاً من اعتماد بند إلى بند آخر، أو أضف اعتماداً إضافياً', icon: 'swap' }}
          />
        ) : (
          <>
            {!lines.length && (
              <CardHeader
                title="لا توجد بنود"
                subtitle="بنود الموازنة هي حسابات المصروفات. أنشئها من إعداد المنشأة (القالب الحكومي مبوّب على أبواب الموازنة) أو من صفحة الحسابات."
              />
            )}
            <DataTable
              columns={tab === 'exec' ? execCols : planCols}
              rows={rowsWithChapters}
              rowKey={(r) => (isHeader(r) ? `h${r.chapter}` : r.accountId)}
              empty={{ title: 'لا توجد اعتمادات لهذه السنة', description: 'أدخل الاعتمادات من تبويب الاعتمادات', icon: 'chart' }}
              mobileCard={(r) =>
                isHeader(r) ? (
                  <p className="font-semibold text-brand-800">{chapterLabel(r.chapter)}</p>
                ) : (
                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm text-ink">{r.name}</span>
                      <span className="num text-sm font-semibold">{formatNumber(r.available)}</span>
                    </div>
                    <p className="num mt-1 text-xs text-ink-subtle">
                      الاعتماد {formatNumber(r.current)} · مرتبط {formatNumber(r.committed)} · مصروف {formatNumber(r.spent)}
                    </p>
                  </div>
                )
              }
            />
          </>
        )}
      </Card>

      <TransferModal open={transferOpen} onClose={() => setTransferOpen(false)} fy={fy} lines={lines} />
    </>
  );
};

const TransferModal: React.FC<{ open: boolean; onClose: () => void; fy: string; lines: BudgetLine[] }> = ({ open, onClose, fy, lines }) => {
  const { createTransfer, mainCurrency } = useLedger();
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [date, setDate] = useState(localIso().slice(0, 10));
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!open) return;
    setFrom('');
    setTo('');
    setAmount('');
    setNote('');
    setErr(null);
  }, [open]);
  const options = lines.map((l) => ({ value: l.accountId, label: l.name, hint: `المتاح ${formatNumber(l.available)}` }));
  const fromLine = lines.find((l) => l.accountId === from);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      await createTransfer({ fy, date, fromAccountId: from || null, toAccountId: to, amount: Number(amount), note });
      onClose();
    } catch (e: any) {
      setErr(e?.message || 'تعذّر الحفظ');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="مناقلة بين البنود" subtitle={`السنة المالية ${fy.replace('-', '/')}`}>
      <form onSubmit={submit} className="space-y-4">
        <Field label="من بند" hint={fromLine ? `المتاح للنقل: ${formatNumber(fromLine.available)} ${mainCurrency}` : 'اتركه فارغاً لاعتماد إضافي من خارج الموازنة'}>
          <SearchSelect value={from} onChange={setFrom} options={options} allowEmpty placeholder="اعتماد إضافي" />
        </Field>
        <Field label="إلى بند">
          <SearchSelect value={to} onChange={setTo} options={options.filter((o) => o.value !== from)} />
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label={`المبلغ (${mainCurrency})`}>
            <Input className="num" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ''))} />
          </Field>
          <Field label="التاريخ">
            <Input type="date" className="num" value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>
        </div>
        <Field label="السبب / رقم القرار">
          <Input value={note} onChange={(e) => setNote(e.target.value)} />
        </Field>
        <FormError message={err} />
        <div className="flex justify-end">
          <Button type="submit" disabled={busy || !to || !amount}>
            {busy ? 'جارٍ الحفظ...' : 'حفظ المناقلة'}
          </Button>
        </div>
      </form>
    </Modal>
  );
};

export default Budget;
