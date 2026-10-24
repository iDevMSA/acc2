import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Badge, Button, Card, CardHeader, PageHeader, StatCard, Tabs, cx } from '../components/ui/primitives';
import { Field, FormError, Input, SearchSelect, Select, Textarea } from '../components/ui/Form';
import Modal from '../components/ui/Modal';
import DataTable, { Column } from '../components/ui/DataTable';
import Icon from '../components/ui/Icon';
import { useApp } from '../context/AppContext';
import { useLedger } from '../context/LedgerContext';
import { can } from '../lib/team';
import { useTeam } from '../lib/teamApi';
import { formatDate, formatNumber } from '../lib/format';
import { localIso } from '../lib/ledger';
import { printReport } from '../lib/export';
import { amountInWords } from '../lib/localization';
import {
  ApprovalLevel,
  COMMITMENT_STATUS,
  Commitment,
  DEFAULT_LEVEL,
  ENCUMBERING,
  budgetLines,
  chapterLabel,
  fyKeyOf,
  fyRangeOfKey,
  nextLevel,
  requiredLevels,
} from '../lib/budget';

type Tab = 'pending' | 'open' | 'paid' | 'closed' | 'all' | 'levels';

const TAB_FILTER: Record<Exclude<Tab, 'levels'>, (c: Commitment) => boolean> = {
  pending: (c) => c.status === 'requested',
  open: (c) => ENCUMBERING.includes(c.status),
  paid: (c) => c.status === 'paid',
  closed: (c) => c.status === 'rejected' || c.status === 'cancelled',
  all: () => true,
};

const NEXT_STEP: Record<Commitment['status'], string> = {
  requested: 'بانتظار الاعتماد',
  committed: 'إصدار أمر الشراء',
  ordered: 'محضر الاستلام',
  received: 'أمر الصرف',
  paid: '—',
  rejected: '—',
  cancelled: '—',
};

/** يستعمل بنود الموازنة لحساب المتاح لكل بند في سنة الطلب */
const useLines = (fy: string) => {
  const { accounts, accountMeta, opsByAccount, profile, appropriations, budgetTransfers, commitments } = useLedger();
  const range = fyRangeOfKey(fy, profile?.fiscalYearStartMonth ?? 1);
  return useMemo(
    () => budgetLines(accounts, accountMeta, { appropriations: appropriations[fy] || {}, transfers: budgetTransfers, commitments }, opsByAccount, range, fy),
    [accounts, accountMeta, appropriations, budgetTransfers, commitments, opsByAccount, fy, range.from, range.to], // eslint-disable-line react-hooks/exhaustive-deps
  );
};

// المشتريات والارتباطات: طلب شراء ← اعتماد حسب المبلغ ← ارتباط (حجز من البند) ← أمر شراء ← محضر استلام ← أمر صرف (قيد)
const Commitments: React.FC = () => {
  const { member } = useApp();
  const { commitments, accountsById, approvalLevels, mainCurrency } = useLedger();
  const [tab, setTab] = useState<Tab>('pending');
  const [newOpen, setNewOpen] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const editable = can(member, 'budget', 'edit');
  const levels = approvalLevels.length ? approvalLevels : [DEFAULT_LEVEL];

  const sum = (f: (c: Commitment) => boolean) => commitments.filter(f).reduce((s, c) => s + c.amount, 0);
  const rows = tab === 'levels' ? [] : commitments.filter(TAB_FILTER[tab]);
  const open = commitments.find((c) => c.id === openId) || null;

  const columns: Column<Commitment>[] = [
    { key: 'n', header: 'الرقم', render: (c) => <span className="num text-ink-subtle">{c.number}</span> },
    { key: 'd', header: 'التاريخ', render: (c) => <span className="whitespace-nowrap text-ink-muted">{formatDate(c.date)}</span> },
    {
      key: 'desc',
      header: 'المطلوب',
      className: 'min-w-[14rem]',
      render: (c) => (
        <div>
          <p className="text-sm text-ink">{c.description}</p>
          <p className="text-xs text-ink-subtle">
            {accountsById[c.accountId]?.name || c.accountId}
            {c.supplierId ? ` · ${accountsById[c.supplierId]?.name || ''}` : ''}
          </p>
        </div>
      ),
    },
    { key: 'a', header: 'المبلغ', numeric: true, render: (c) => <span className="num">{formatNumber(c.amount)}</span> },
    { key: 's', header: 'الحالة', render: (c) => <Badge tone={COMMITMENT_STATUS[c.status].tone}>{COMMITMENT_STATUS[c.status].label}</Badge> },
    {
      key: 'next',
      header: 'الخطوة التالية',
      render: (c) => (
        <span className="text-xs text-ink-subtle">{c.status === 'requested' ? `اعتماد: ${nextLevel(c, levels)?.name || ''}` : NEXT_STEP[c.status]}</span>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="المشتريات والارتباطات"
        description="طلب الشراء يمر بمستويات الاعتماد حسب مبلغه، ثم يُحجز مبلغه من بند الموازنة، ويصدر أمر الشراء ومحضر الاستلام وأمر الصرف"
        actions={
          <div className="flex flex-wrap gap-2">
            <Link to="/budget">
              <Button variant="secondary" icon="chart">
                تنفيذ الموازنة
              </Button>
            </Link>
            {editable && (
              <Button icon="plus" onClick={() => setNewOpen(true)}>
                طلب شراء جديد
              </Button>
            )}
          </div>
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="قيد الاعتماد" value={formatNumber(sum(TAB_FILTER.pending))} unit={mainCurrency} icon="history" tone="warning" />
        <StatCard label="مرتبط (محجوز)" value={formatNumber(sum(TAB_FILTER.open))} unit={mainCurrency} icon="lock" tone="info" />
        <StatCard label="صُرف" value={formatNumber(commitments.filter(TAB_FILTER.paid).reduce((s, c) => s + (c.paidAmount || 0), 0))} unit={mainCurrency} icon="check" tone="success" />
        <StatCard label="عدد الطلبات" value={commitments.length} icon="receipt" />
      </div>

      <div className="mb-4">
        <Tabs
          value={tab}
          onChange={setTab}
          items={[
            { value: 'pending', label: `قيد الاعتماد (${commitments.filter(TAB_FILTER.pending).length})` },
            { value: 'open', label: 'جارية' },
            { value: 'paid', label: 'مصروفة' },
            { value: 'closed', label: 'مرفوضة وملغاة' },
            { value: 'all', label: 'الكل' },
            { value: 'levels', label: 'مستويات الاعتماد', icon: 'lock' },
          ]}
        />
      </div>

      {tab === 'levels' ? (
        <LevelsEditor />
      ) : (
        <Card>
          <DataTable
            columns={columns}
            rows={rows}
            rowKey={(c) => c.id}
            onRowClick={(c) => setOpenId(c.id)}
            empty={{ title: 'لا توجد طلبات هنا', description: 'أنشئ طلب شراء ليمر بدورة الاعتماد والارتباط', icon: 'receipt' }}
            mobileCard={(c) => (
              <div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium text-ink">
                    {c.number}. {c.description}
                  </span>
                  <Badge tone={COMMITMENT_STATUS[c.status].tone}>{COMMITMENT_STATUS[c.status].label}</Badge>
                </div>
                <p className="num mt-1 text-xs text-ink-subtle">
                  {formatNumber(c.amount)} {mainCurrency} · {accountsById[c.accountId]?.name}
                </p>
              </div>
            )}
          />
        </Card>
      )}

      <NewRequestModal open={newOpen} onClose={() => setNewOpen(false)} />
      <DetailModal c={open} onClose={() => setOpenId(null)} />
    </>
  );
};

/* ───────── طلب شراء جديد ───────── */

const NewRequestModal: React.FC<{ open: boolean; onClose: () => void }> = ({ open, onClose }) => {
  const { createCommitment, profile, mainCurrency, accounts, roleOf } = useLedger();
  const [date, setDate] = useState(localIso().slice(0, 10));
  const [accountId, setAccountId] = useState('');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [supplierId, setSupplierId] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const fy = fyKeyOf(date || new Date(), profile?.fiscalYearStartMonth ?? 1);
  const lines = useLines(fy);
  const line = lines.find((l) => l.accountId === accountId);
  const suppliers = accounts.filter((a) => roleOf(a.id) === 'supplier').map((a) => ({ value: a.id, label: a.name }));

  useEffect(() => {
    if (!open) return;
    setAccountId('');
    setDescription('');
    setAmount('');
    setSupplierId('');
    setErr(null);
  }, [open]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      await createCommitment({ date, accountId, description, amount: Number(amount), supplierId: supplierId || null });
      onClose();
    } catch (e: any) {
      setErr(e?.message || 'تعذّر الحفظ');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="طلب شراء جديد" subtitle={`السنة المالية ${fy.replace('-', '/')}`}>
      <form onSubmit={submit} className="space-y-4">
        <Field label="وصف المطلوب" hint="الأصناف أو الخدمة والكمية والمواصفات">
          <Textarea rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
        </Field>
        <Field
          label="بند الموازنة"
          hint={
            line ? (
              <span className={cx(line.available < Number(amount || 0) && 'text-danger-700')}>
                {chapterLabel(line.chapter)} · المتاح {formatNumber(line.available)} {mainCurrency}
              </span>
            ) : undefined
          }
        >
          <SearchSelect
            value={accountId}
            onChange={setAccountId}
            options={lines.map((l) => ({ value: l.accountId, label: l.name, hint: `المتاح ${formatNumber(l.available)}` }))}
          />
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label={`المبلغ التقديري (${mainCurrency})`}>
            <Input className="num" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ''))} />
          </Field>
          <Field label="التاريخ">
            <Input type="date" className="num" value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>
        </div>
        <Field label="المورد المقترح (اختياري)">
          <SearchSelect value={supplierId} onChange={setSupplierId} options={suppliers} allowEmpty placeholder="—" />
        </Field>
        {line && line.available < Number(amount || 0) && (
          <p className="rounded-lg bg-warning-50 px-3 py-2 text-xs text-warning-700">
            المبلغ أكبر من المتاح في البند. يمكن رفع الطلب، لكن الاعتماد الأخير (الارتباط) لن يتم قبل مناقلة تغطي الفرق.
          </p>
        )}
        <FormError message={err} />
        <div className="flex justify-end">
          <Button type="submit" disabled={busy}>
            {busy ? 'جارٍ الحفظ...' : 'رفع الطلب للاعتماد'}
          </Button>
        </div>
      </form>
    </Modal>
  );
};

/* ───────── تفاصيل الطلب ودورته ───────── */

const DetailModal: React.FC<{ c: Commitment | null; onClose: () => void }> = ({ c, onClose }) => {
  const { member, actor } = useApp();
  const ledger = useLedger();
  const { accountsById, accounts, roleOf, approvalLevels, mainCurrency, company } = ledger;
  const [note, setNote] = useState('');
  const [supplierId, setSupplierId] = useState('');
  const [terms, setTerms] = useState('');
  const [day, setDay] = useState(localIso().slice(0, 10));
  const [payAmount, setPayAmount] = useState('');
  const [payAccount, setPayAccount] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const levels = approvalLevels.length ? approvalLevels : [DEFAULT_LEVEL];
  const editable = can(member, 'budget', 'edit');

  useEffect(() => {
    setErr(null);
    setNote('');
    setSupplierId(c?.supplierId || '');
    setTerms('');
    setPayAmount(c ? String(c.amount) : '');
    setPayAccount(c?.supplierId || '');
    setDay(localIso().slice(0, 10));
  }, [c?.id, c?.status]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!c) return null;
  const name = (id?: string | null) => (id ? accountsById[id]?.name || id : '—');
  const level = c.status === 'requested' ? nextLevel(c, levels) : null;
  const mayApprove = editable && level && (!member || !level.approverUid || level.approverUid === actor?.uid);
  const payOptions = accounts
    .filter((a) => a.category === 'asset' || a.category === 'liability' || ['cash', 'bank', 'supplier'].includes(roleOf(a.id)))
    .map((a) => ({ value: a.id, label: a.name, hint: roleOf(a.id) === 'supplier' ? 'مورد (آجل)' : undefined }));

  const act = async (fn: () => Promise<void>) => {
    setBusy(true);
    setErr(null);
    try {
      await fn();
    } catch (e: any) {
      setErr(e?.message || 'تعذّر التنفيذ');
    } finally {
      setBusy(false);
    }
  };

  const print = (kind: 'pr' | 'po' | 'grn' | 'pay') => {
    const titles = { pr: `طلب شراء رقم ${c.number}`, po: `أمر شراء رقم ${c.poNumber}`, grn: `محضر استلام — أمر شراء ${c.poNumber}`, pay: `أمر صرف رقم ${c.payNumber}` };
    const date = { pr: c.date, po: c.poDate, grn: c.receivedDate, pay: c.paidDate }[kind] || c.date;
    const amt = kind === 'pay' ? c.paidAmount || 0 : c.amount;
    printReport(
      {
        title: titles[kind],
        docDate: date,
        summary: [
          ['بند الموازنة', name(c.accountId)],
          ...(c.supplierId ? ([['المورد', name(c.supplierId)]] as Array<[string, string]>) : []),
          ['المبلغ', `${formatNumber(amt)} ${mainCurrency}`],
          ['مقدم الطلب', c.requestedByName || '—'],
        ],
        columns: ['البيان', kind === 'grn' ? 'ملاحظات الاستلام' : 'التفاصيل', 'المبلغ'],
        numericColumns: [2],
        rows: [
          [
            c.description,
            kind === 'po' ? c.deliveryTerms || '' : kind === 'grn' ? c.receivedNote || 'استُلم مطابقاً لأمر الشراء' : kind === 'pay' ? `يُصرف من: ${name(c.payAccountId)}` : '',
            amt,
          ],
        ],
        sections: kind === 'pr' && c.approvals.length
          ? [
              { heading: 'المطلوب', rows: [[c.description, '', c.amount]] },
              { heading: 'الاعتمادات', rows: c.approvals.map((a) => [`${a.levelName}: ${a.byName}`, `${a.action === 'approve' ? 'اعتماد' : 'رفض'} — ${formatDate(a.at, { dateStyle: 'medium', timeStyle: 'short' })}${a.note ? ` — ${a.note}` : ''}`, '']) },
            ]
          : undefined,
        amountWords: amountInWords(amt, mainCurrency),
      },
      company,
    );
  };

  const steps: Array<{ label: string; done: boolean; detail?: string }> = [
    { label: 'طلب الشراء', done: true, detail: `${c.requestedByName || ''} · ${formatDate(c.date)}` },
    ...requiredLevels(levels, c.amount).map((l) => {
      const a = c.approvals.find((x) => x.levelId === l.id);
      return { label: `اعتماد: ${l.name}`, done: a?.action === 'approve', detail: a ? `${a.action === 'approve' ? 'اعتمد' : 'رفض'} ${a.byName}${a.note ? ` — ${a.note}` : ''}` : undefined };
    }),
    { label: 'الارتباط (حجز المبلغ)', done: ENCUMBERING.includes(c.status) || c.status === 'paid' },
    { label: 'أمر الشراء', done: !!c.poNumber, detail: c.poNumber ? `رقم ${c.poNumber} · ${name(c.supplierId)}` : undefined },
    { label: 'محضر الاستلام', done: !!c.receivedDate, detail: c.receivedDate ? formatDate(c.receivedDate) : undefined },
    { label: 'أمر الصرف', done: c.status === 'paid', detail: c.payNumber ? `رقم ${c.payNumber} · ${formatNumber(c.paidAmount || 0)} من ${name(c.payAccountId)}` : undefined },
  ];

  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      title={`طلب شراء رقم ${c.number}`}
      subtitle={
        <span>
          <Badge tone={COMMITMENT_STATUS[c.status].tone}>{COMMITMENT_STATUS[c.status].label}</Badge>{' '}
          <span className="num">
            {formatNumber(c.amount)} {mainCurrency}
          </span>{' '}
          · {name(c.accountId)}
        </span>
      }
    >
      <div className="space-y-5">
        <p className="rounded-lg bg-slate-50 px-4 py-3 text-sm text-ink">{c.description}</p>

        <ol className="space-y-2">
          {steps.map((s, i) => (
            <li key={i} className="flex items-start gap-3">
              <span className={cx('mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full', s.done ? 'bg-success-600 text-white' : 'border border-line-strong bg-white')}>
                {s.done && <Icon name="check" size={12} />}
              </span>
              <div className="text-sm">
                <p className={s.done ? 'text-ink' : 'text-ink-subtle'}>{s.label}</p>
                {s.detail && <p className="text-xs text-ink-subtle">{s.detail}</p>}
              </div>
            </li>
          ))}
        </ol>
        {(c.status === 'rejected' || c.status === 'cancelled') && (
          <p className="rounded-lg bg-danger-50 px-3 py-2 text-sm text-danger-700">
            {c.status === 'rejected' ? 'رُفض الطلب' : `أُلغي الطلب${c.cancelReason ? `: ${c.cancelReason}` : ''}`}
          </p>
        )}

        {editable && c.status === 'requested' && level && (
          <Card className="p-4">
            <p className="mb-3 text-sm font-medium text-ink">اعتماد: {level.name}</p>
            {mayApprove ? (
              <>
                <Field label="ملاحظة (اختياري)">
                  <Input value={note} onChange={(e) => setNote(e.target.value)} />
                </Field>
                <div className="mt-3 flex gap-2">
                  <Button disabled={busy} onClick={() => act(() => ledger.decideCommitment(c.id, 'approve', note))}>
                    اعتماد
                  </Button>
                  <Button variant="secondary" disabled={busy} onClick={() => act(() => ledger.decideCommitment(c.id, 'reject', note))}>
                    رفض
                  </Button>
                </div>
              </>
            ) : (
              <p className="text-xs text-ink-subtle">هذا المستوى يعتمده شخص آخر.</p>
            )}
          </Card>
        )}

        {editable && c.status === 'committed' && (
          <Card className="space-y-3 p-4">
            <p className="text-sm font-medium text-ink">إصدار أمر الشراء</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="المورد">
                <SearchSelect value={supplierId} onChange={setSupplierId} options={accounts.filter((a) => roleOf(a.id) === 'supplier').map((a) => ({ value: a.id, label: a.name }))} />
              </Field>
              <Field label="تاريخ أمر الشراء">
                <Input type="date" className="num" value={day} onChange={(e) => setDay(e.target.value)} />
              </Field>
            </div>
            <Field label="شروط التوريد (المدة، مكان التسليم، الضمان)">
              <Input value={terms} onChange={(e) => setTerms(e.target.value)} />
            </Field>
            <Button disabled={busy} onClick={() => act(() => ledger.orderCommitment(c.id, { supplierId, poDate: day, deliveryTerms: terms }))}>
              إصدار أمر الشراء
            </Button>
          </Card>
        )}

        {editable && c.status === 'ordered' && (
          <Card className="space-y-3 p-4">
            <p className="text-sm font-medium text-ink">محضر الاستلام</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="تاريخ الاستلام">
                <Input type="date" className="num" value={day} onChange={(e) => setDay(e.target.value)} />
              </Field>
              <Field label="ملاحظات لجنة الاستلام">
                <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="استُلم مطابقاً للمواصفات" />
              </Field>
            </div>
            <Button disabled={busy} onClick={() => act(() => ledger.receiveCommitment(c.id, { receivedDate: day, receivedNote: note }))}>
              تسجيل الاستلام
            </Button>
          </Card>
        )}

        {editable && c.status === 'received' && (
          <Card className="space-y-3 p-4">
            <p className="text-sm font-medium text-ink">أمر الصرف</p>
            <p className="text-xs text-ink-subtle">يُسجَّل قيد: مدين {name(c.accountId)} / دائن حساب الصرف. ما يزيد من المبلغ المرتبط عن المصروف يعود متاحاً في البند.</p>
            <div className="grid gap-3 sm:grid-cols-3">
              <Field label={`المبلغ (${mainCurrency})`}>
                <Input className="num" inputMode="decimal" value={payAmount} onChange={(e) => setPayAmount(e.target.value.replace(/[^0-9.]/g, ''))} />
              </Field>
              <Field label="يُصرف من / يُقيَّد على">
                <SearchSelect value={payAccount} onChange={setPayAccount} options={payOptions} />
              </Field>
              <Field label="التاريخ">
                <Input type="date" className="num" value={day} onChange={(e) => setDay(e.target.value)} />
              </Field>
            </div>
            <Button disabled={busy} onClick={() => act(() => ledger.payCommitment(c.id, { amount: Number(payAmount), payAccountId: payAccount, date: day }))}>
              إصدار أمر الصرف وتسجيل القيد
            </Button>
          </Card>
        )}

        <FormError message={err} />

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line pt-4">
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" size="sm" icon="download" onClick={() => print('pr')}>
              طباعة طلب الشراء
            </Button>
            {c.poNumber && (
              <Button variant="secondary" size="sm" icon="download" onClick={() => print('po')}>
                أمر الشراء
              </Button>
            )}
            {c.receivedDate && (
              <Button variant="secondary" size="sm" icon="download" onClick={() => print('grn')}>
                محضر الاستلام
              </Button>
            )}
            {c.payNumber && (
              <Button variant="secondary" size="sm" icon="download" onClick={() => print('pay')}>
                أمر الصرف
              </Button>
            )}
          </div>
          {editable && !['paid', 'cancelled', 'rejected'].includes(c.status) && (
            <Button
              variant="secondary"
              size="sm"
              disabled={busy}
              onClick={() => {
                const reason = window.prompt('سبب الإلغاء');
                if (reason !== null) act(() => ledger.cancelCommitment(c.id, reason));
              }}
            >
              إلغاء الطلب
            </Button>
          )}
        </div>
      </div>
    </Modal>
  );
};

/* ───────── مستويات الاعتماد ───────── */

const LevelsEditor: React.FC = () => {
  const { member, ownerUid } = useApp();
  const { approvalLevels, saveApprovalLevels, mainCurrency } = useLedger();
  const { members } = useTeam(member ? null : ownerUid);
  const [rows, setRows] = useState<Array<{ id?: string; name: string; upTo: string; approverUid: string }>>([]);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    setRows(
      approvalLevels.length
        ? approvalLevels.map((l) => ({ id: l.id, name: l.name, upTo: l.upTo == null ? '' : String(l.upTo), approverUid: l.approverUid || '' }))
        : [
            { name: 'مدير الإدارة', upTo: '50000', approverUid: '' },
            { name: 'المدير المالي', upTo: '', approverUid: '' },
          ],
    );
  }, [approvalLevels]);

  const save = async () => {
    setMsg(null);
    try {
      await saveApprovalLevels(rows.map((r) => ({ id: r.id, name: r.name, upTo: r.upTo === '' ? null : Number(r.upTo), approverUid: r.approverUid || null })));
      setMsg({ ok: true, text: 'حُفظت مستويات الاعتماد' });
    } catch (e: any) {
      setMsg({ ok: false, text: e?.message || 'تعذّر الحفظ' });
    }
  };

  const set = (i: number, k: 'name' | 'upTo' | 'approverUid', v: string) => setRows(rows.map((r, j) => (j === i ? { ...r, [k]: v } : r)));
  const preview = (amount: number) =>
    requiredLevels(
      rows.map((r, i) => ({ id: String(i), name: r.name, upTo: r.upTo === '' ? null : Number(r.upTo), order: i }) as ApprovalLevel).sort((a, b) => (a.upTo ?? Infinity) - (b.upTo ?? Infinity)),
      amount,
    )
      .map((l) => l.name)
      .join(' ← ');

  return (
    <Card>
      <CardHeader
        title="مستويات الاعتماد حسب المبلغ"
        subtitle="كل طلب يمر بالمستوى الأول، ويصعد للمستوى التالي إذا تجاوز مبلغه حدّ المستوى الذي قبله. آخر اعتماد يحجز المبلغ من البند."
        actions={!member && <Button onClick={save}>حفظ</Button>}
      />
      <div className="space-y-3 p-5">
        {rows.map((r, i) => (
          <div key={i} className="grid items-end gap-3 sm:grid-cols-[1fr_12rem_14rem_auto]">
            <Field label={`المستوى ${i + 1}`}>
              <Input value={r.name} disabled={!!member} onChange={(e) => set(i, 'name', e.target.value)} />
            </Field>
            <Field label={`يعتمد حتى (${mainCurrency})`} hint={r.upTo === '' ? 'بلا حد' : undefined}>
              <Input className="num" value={r.upTo} disabled={!!member} placeholder="بلا حد" onChange={(e) => set(i, 'upTo', e.target.value.replace(/[^0-9.]/g, ''))} />
            </Field>
            <Field label="المخوّل بالاعتماد">
              <Select value={r.approverUid} disabled={!!member} onChange={(e) => set(i, 'approverUid', e.target.value)}>
                <option value="">المالك أو من له صلاحية الموازنة</option>
                {members
                  .filter((m) => m.active && m.perms.budget === 'edit')
                  .map((m) => (
                    <option key={m.uid} value={m.uid}>
                      {m.name}
                    </option>
                  ))}
              </Select>
            </Field>
            {!member && (
              <button
                type="button"
                onClick={() => setRows(rows.filter((_, j) => j !== i))}
                className="mb-1 grid h-9 w-9 place-items-center rounded-md text-ink-subtle hover:bg-danger-50 hover:text-danger-600"
                title="حذف المستوى"
              >
                <Icon name="trash" size={15} />
              </button>
            )}
          </div>
        ))}
        {!member && (
          <Button variant="secondary" size="sm" icon="plus" onClick={() => setRows([...rows, { name: '', upTo: '', approverUid: '' }])}>
            إضافة مستوى
          </Button>
        )}
        {rows.length > 0 && (
          <div className="rounded-lg bg-slate-50 px-4 py-3 text-xs text-ink-subtle">
            <p>
              طلب بـ <span className="num">10,000</span>: {preview(10000)}
            </p>
            <p>
              طلب بـ <span className="num">250,000</span>: {preview(250000)}
            </p>
          </div>
        )}
        {msg && <p className={cx('rounded-lg px-4 py-3 text-sm', msg.ok ? 'bg-success-50 text-success-700' : 'bg-danger-50 text-danger-700')}>{msg.text}</p>}
      </div>
    </Card>
  );
};

export default Commitments;
