import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useLedger } from '../context/LedgerContext';
import { Badge, Button, Card, CardHeader, EmptyState, PageHeader, StatCard, cx } from '../components/ui/primitives';
import DataTable, { Column } from '../components/ui/DataTable';
import Icon from '../components/ui/Icon';
import { ConfirmModal } from '../components/ui/Modal';
import { CashboxFormModal, VoucherFormModal } from '../components/ledger/CashForms';
import { ExportButtons, PeriodPicker, SignedAmount } from '../components/ledger/ReportToolbar';
import { formatDate, formatNumber } from '../lib/format';
import { Operation, Period, accountLabel, inPeriod, periodFromPreset, periodText, sortByDate, totalsOf } from '../lib/ledger';
import { Cashbox, VoucherType, cashboxBalance } from '../lib/erp';

const Cashboxes: React.FC = () => {
  const { cashboxes, phoneCashboxes, opsByAccount, accountsById, balances, mainCurrency, deleteCashbox, ready } = useLedger();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [boxModal, setBoxModal] = useState<{ open: boolean; box?: Cashbox | null; template?: Cashbox | null }>({ open: false });
  const [voucher, setVoucher] = useState<{ open: boolean; type: VoucherType }>({ open: false, type: 'receipt' });
  const [confirm, setConfirm] = useState<Cashbox | null>(null);
  const [period, setPeriod] = useState<Period>(periodFromPreset('month'));

  const balanceOf = useMemo(() => {
    const cache: Record<string, ReturnType<typeof cashboxBalance>> = {};
    [...cashboxes, ...phoneCashboxes].forEach((b) => {
      cache[`${b.fromPhone ? 'p' : 'w'}:${b.id}`] = cashboxBalance(b, b.fromPhone ? phoneCashboxes : cashboxes, opsByAccount);
    });
    return (b: Cashbox) => cache[`${b.fromPhone ? 'p' : 'w'}:${b.id}`] || { total: 0, byCurrency: {}, own: 0 };
  }, [cashboxes, phoneCashboxes, opsByAccount]);

  const selected = cashboxes.find((b) => b.id === selectedId) || cashboxes[0] || null;
  const roots = cashboxes.filter((b) => !b.parentId || !cashboxes.some((x) => x.id === b.parentId));
  const grandTotal = roots.reduce((s, b) => s + balanceOf(b).total, 0);

  // حركة الصندوق المختار: قيود حساب النقدية + الحسابات المرتبطة + الصناديق الأبناء
  const boxAccountIds = useMemo(() => {
    if (!selected) return [] as string[];
    const ids = new Set<string>();
    const walk = (b: Cashbox, seen = new Set<string>()) => {
      if (seen.has(b.id)) return;
      seen.add(b.id);
      if (b.cashAccountId) ids.add(b.cashAccountId);
      b.linkedAccountIds.forEach((i) => ids.add(i));
      cashboxes.filter((c) => c.parentId === b.id).forEach((c) => walk(c, seen));
    };
    walk(selected);
    return Array.from(ids);
  }, [selected, cashboxes]);

  const allBoxOps = useMemo(() => sortByDate(boxAccountIds.flatMap((id) => opsByAccount[id] || [])), [boxAccountIds, opsByAccount]);
  const periodOps = useMemo(() => allBoxOps.filter((o) => inPeriod(o.date, period)), [allBoxOps, period]);
  const totals = totalsOf(periodOps);
  const rows = useMemo(() => {
    let r = allBoxOps.filter((o) => period.from && o.date.slice(0, 10) < period.from).reduce((s, o) => s + o.amountUSD, 0);
    return periodOps.map((o) => ({ ...o, running: (r += o.amountUSD) }));
  }, [allBoxOps, periodOps, period]);

  const columns: Array<Column<Operation & { running: number }>> = [
    { key: 'date', header: 'التاريخ', className: 'w-32', render: (o) => <span className="text-ink-muted">{formatDate(o.date)}</span> },
    {
      key: 'acc',
      header: 'الحساب',
      render: (o) => (
        <Link to={`/accounts/${o.accountId}`} className="font-medium text-brand-700 hover:underline" onClick={(e) => e.stopPropagation()}>
          {accountsById[o.accountId]?.name || o.accountId}
        </Link>
      ),
    },
    { key: 'st', header: 'البيان', render: (o) => <span className="text-ink-muted">{o.statement || '—'}</span> },
    { key: 'in', header: 'وارد', numeric: true, render: (o) => (o.amountUSD >= 0 ? formatNumber(o.amountUSD) : '—') },
    { key: 'out', header: 'صادر', numeric: true, render: (o) => (o.amountUSD < 0 ? formatNumber(-o.amountUSD) : '—') },
    { key: 'run', header: 'الرصيد', className: 'text-end', render: (o) => <SignedAmount value={o.running} /> },
  ];

  const BoxNode: React.FC<{ box: Cashbox; depth: number }> = ({ box, depth }) => {
    const children = cashboxes.filter((b) => b.parentId === box.id);
    const bal = balanceOf(box);
    const active = selected?.id === box.id;
    return (
      <li>
        <button
          onClick={() => setSelectedId(box.id)}
          className={cx(
            'flex w-full items-center justify-between gap-3 rounded-lg py-2.5 pe-3 text-start transition',
            active ? 'bg-brand-50 ring-1 ring-brand-200' : 'hover:bg-slate-50',
          )}
          style={{ paddingInlineStart: 12 + depth * 18 }}
        >
          <span className="flex min-w-0 items-center gap-2">
            <Icon name={children.length ? 'warehouse' : 'wallet'} size={16} className={active ? 'text-brand-600' : 'text-ink-subtle'} />
            <span className="truncate font-medium text-ink">{box.name}</span>
            {box.currency && <Badge>{box.currency}</Badge>}
          </span>
          <SignedAmount value={bal.total} className="text-sm" />
        </button>
        {children.length > 0 && (
          <ul className="mt-0.5 space-y-0.5">
            {children.map((c) => (
              <BoxNode key={c.id} box={c} depth={depth + 1} />
            ))}
          </ul>
        )}
      </li>
    );
  };

  const selBal = selected ? balanceOf(selected) : null;

  return (
    <>
      <PageHeader
        title="الصناديق"
        description="أنشئ الصناديق واربطها بالحسابات — رصيد الصندوق يُحسب من قيود حساباته كما في تطبيق الهاتف"
        actions={
          <>
            <Button variant="secondary" icon="arrowIn" onClick={() => setVoucher({ open: true, type: 'receipt' })}>
              سند قبض
            </Button>
            <Button variant="secondary" icon="arrowOut" onClick={() => setVoucher({ open: true, type: 'payment' })}>
              سند صرف
            </Button>
            <Button variant="secondary" icon="swap" onClick={() => setVoucher({ open: true, type: 'transfer' })}>
              تحويل
            </Button>
            <Button icon="plus" onClick={() => setBoxModal({ open: true })}>
              صندوق جديد
            </Button>
          </>
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <StatCard label="إجمالي النقدية في الصناديق" value={formatNumber(grandTotal)} unit={mainCurrency} icon="wallet" tone="brand" />
        <StatCard label="عدد الصناديق" value={formatNumber(cashboxes.length, 0)} icon="grid" tone="info" />
        <StatCard label="وارد الصندوق المختار" value={formatNumber(totals.collected)} unit={mainCurrency} icon="arrowIn" tone="success" hint={periodText(period)} />
        <StatCard label="صادر الصندوق المختار" value={formatNumber(totals.spent)} unit={mainCurrency} icon="arrowOut" tone="danger" hint={periodText(period)} />
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
        <div className="space-y-6">
          <Card className="overflow-hidden">
            <CardHeader title="شجرة الصناديق" subtitle="اضغط على صندوق لعرض حركته" />
            <div className="p-2">
              {cashboxes.length ? (
                <ul className="space-y-0.5">
                  {roots.map((b) => (
                    <BoxNode key={b.id} box={b} depth={0} />
                  ))}
                </ul>
              ) : (
                <EmptyState
                  icon="wallet"
                  title={ready ? 'لا توجد صناديق في المنصة' : 'جاري التحميل...'}
                  description="أنشئ صندوقاً واربطه بحساب نقدية، أو انسخ صناديق الهاتف من الأسفل."
                />
              )}
            </div>
          </Card>

          {phoneCashboxes.length > 0 && (
            <Card className="overflow-hidden">
              <CardHeader title="صناديق تطبيق الهاتف" subtitle="للعرض — انسخها إلى المنصة لاستخدامها في السندات والمخازن" />
              <ul className="divide-y divide-line">
                {phoneCashboxes.map((b) => (
                  <li key={b.id} className="flex items-center justify-between gap-3 px-5 py-3">
                    <div className="min-w-0">
                      <p className="truncate font-medium text-ink">{b.name}</p>
                      <p className="text-xs text-ink-subtle">
                        {formatNumber(b.linkedAccountIds.length, 0)} حساب مرتبط{b.currency ? ` · ${b.currency}` : ''}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <SignedAmount value={balanceOf(b).total} className="text-sm" />
                      <Button size="sm" variant="secondary" onClick={() => setBoxModal({ open: true, template: b })}>
                        نسخ
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>

        {selected && selBal ? (
          <div className="min-w-0 space-y-6">
            <Card>
              <div className="flex flex-wrap items-start justify-between gap-4 px-5 py-4">
                <div>
                  <h2 className="text-lg font-semibold text-ink">{selected.name}</h2>
                  <p className="mt-1 text-xs text-ink-subtle">
                    حساب النقدية:{' '}
                    {selected.cashAccountId ? (
                      <Link to={`/accounts/${selected.cashAccountId}`} className="font-medium text-brand-700 hover:underline">
                        {accountLabel(accountsById[selected.cashAccountId])}
                      </Link>
                    ) : (
                      <span className="text-danger-700">غير محدد</span>
                    )}
                    {selected.currency && ` · عملة ثابتة ${selected.currency}`}
                    {selected.exchangeRate && ` · سعر ثابت ${selected.exchangeRate}`}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button size="sm" variant="secondary" icon="edit" onClick={() => setBoxModal({ open: true, box: selected })}>
                    تعديل وربط الحسابات
                  </Button>
                  <Button size="sm" variant="ghost" icon="trash" onClick={() => setConfirm(selected)}>
                    حذف
                  </Button>
                </div>
              </div>
              <div className="grid grid-cols-1 gap-4 border-t border-line px-5 py-4 md:grid-cols-3">
                <div>
                  <p className="text-xs text-ink-subtle">الرصيد الكلي (مع الصناديق الفرعية)</p>
                  <SignedAmount value={selBal.total} currency={mainCurrency} className="mt-1 text-2xl" />
                </div>
                <div>
                  <p className="text-xs text-ink-subtle">رصيد الصندوق وحده</p>
                  <SignedAmount value={selBal.own} currency={mainCurrency} className="mt-1 text-xl" />
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {Object.entries(selBal.byCurrency).map(([c, v]) => (
                    <span key={c} className="rounded-lg border border-line px-2.5 py-1 text-xs">
                      <span className="text-ink-subtle">{c} </span>
                      <span className={cx('num font-semibold', v >= 0 ? 'text-success-700' : 'text-danger-700')}>{formatNumber(v)}</span>
                    </span>
                  ))}
                </div>
              </div>
            </Card>

            <Card className="overflow-hidden">
              <CardHeader title="الحسابات المرتبطة" subtitle="كل قيد على هذه الحسابات يغيّر رصيد الصندوق" />
              {selected.linkedAccountIds.length ? (
                <ul className="grid grid-cols-1 divide-y divide-line md:grid-cols-2 md:divide-y-0">
                  {selected.linkedAccountIds.map((id) => (
                    <li key={id} className="flex items-center justify-between gap-3 border-line px-5 py-3 md:border-b">
                      <Link to={`/accounts/${id}`} className="truncate font-medium text-brand-700 hover:underline">
                        {accountLabel(accountsById[id]) || id}
                      </Link>
                      <SignedAmount value={balances[id]?.total || 0} label className="text-sm" />
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="px-5 py-4 text-sm text-ink-subtle">لا توجد حسابات مرتبطة غير حساب النقدية.</p>
              )}
            </Card>

            <Card className="overflow-hidden">
              <CardHeader
                title="حركة الصندوق"
                subtitle={`${periodText(period)} · ${formatNumber(periodOps.length, 0)} حركة`}
                actions={
                  <div className="flex flex-wrap items-center gap-2">
                    <PeriodPicker value={period} onChange={setPeriod} />
                    <ExportButtons
                      disabled={!rows.length}
                      build={() => ({
                        title: `حركة صندوق ${selected.name}`,
                        subtitle: `${periodText(period)} · ${mainCurrency}`,
                        summary: [
                          ['الوارد', formatNumber(totals.collected)],
                          ['الصادر', formatNumber(totals.spent)],
                          ['الصافي', formatNumber(totals.net)],
                        ],
                        columns: ['التاريخ', 'الحساب', 'البيان', 'وارد', 'صادر', 'الرصيد'],
                        numericColumns: [3, 4, 5],
                        rows: rows.map((o) => [
                          formatDate(o.date),
                          accountsById[o.accountId]?.name || o.accountId,
                          o.statement,
                          o.amountUSD >= 0 ? o.amountUSD : '',
                          o.amountUSD < 0 ? -o.amountUSD : '',
                          o.running,
                        ]),
                      })}
                    />
                  </div>
                }
              />
              <DataTable
                columns={columns}
                rows={rows}
                rowKey={(o) => o.id}
                maxHeight="520px"
                empty={{ title: 'لا توجد حركات في هذه الفترة', icon: 'wallet' }}
              />
            </Card>
          </div>
        ) : (
          <Card>
            <EmptyState icon="wallet" title="اختر صندوقاً أو أنشئ صندوقاً جديداً" />
          </Card>
        )}
      </div>

      <CashboxFormModal
        open={boxModal.open}
        onClose={() => setBoxModal({ open: false })}
        box={boxModal.box}
        template={boxModal.template}
        onSaved={setSelectedId}
      />
      <VoucherFormModal
        open={voucher.open}
        type={voucher.type}
        boxId={selected?.id}
        onClose={() => setVoucher((v) => ({ ...v, open: false }))}
      />
      <ConfirmModal
        open={!!confirm}
        onClose={() => setConfirm(null)}
        title="حذف الصندوق"
        message={
          <>
            حذف صندوق <b>{confirm?.name}</b>؟ الصناديق الفرعية تصبح رئيسية، والحسابات وقيودها تبقى كما هي.
          </>
        }
        onConfirm={() => confirm && deleteCashbox(confirm.id).then(() => setSelectedId(null))}
      />
    </>
  );
};

export default Cashboxes;
