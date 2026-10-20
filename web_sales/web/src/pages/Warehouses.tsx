import React, { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useLedger } from '../context/LedgerContext';
import { Badge, Button, Card, EmptyState, PageHeader, StatCard, Tabs, cx } from '../components/ui/primitives';
import DataTable, { Column } from '../components/ui/DataTable';
import Icon from '../components/ui/Icon';
import { ConfirmModal } from '../components/ui/Modal';
import { ItemFormModal, StockMoveModal, WarehouseFormModal } from '../components/ledger/StockForms';
import { ExportButtons, PeriodPicker, SignedAmount } from '../components/ledger/ReportToolbar';
import { formatDate, formatNumber } from '../lib/format';
import { Period, accountLabel, inPeriod, periodFromPreset, periodText } from '../lib/ledger';
import { MOVE_LABELS, StockItem, StockMove, StockMoveType, Warehouse, stockLevels } from '../lib/erp';

type Tab = 'stock' | 'items' | 'moves' | 'warehouses';

const Warehouses: React.FC = () => {
  const [params, setParams] = useSearchParams();
  const tab = (params.get('tab') as Tab) || 'stock';
  const { warehouses, items, moves, cashboxes, accountsById, balances, mainCurrency, deleteMove, deleteWarehouse, deleteItem, error } =
    useLedger();
  const levels = useMemo(() => stockLevels(moves), [moves]);
  const [whFilter, setWhFilter] = useState('');
  const [period, setPeriod] = useState<Period>(periodFromPreset('month'));
  const [whModal, setWhModal] = useState<{ open: boolean; wh?: Warehouse | null }>({ open: false });
  const [itemModal, setItemModal] = useState<{ open: boolean; item?: StockItem | null }>({ open: false });
  const [moveModal, setMoveModal] = useState<{ open: boolean; type: StockMoveType; itemId?: string }>({ open: false, type: 'in' });
  const [confirm, setConfirm] = useState<{ title: string; message: string; run: () => Promise<void> } | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const whValue = (w: Warehouse) => items.reduce((s, i) => s + levels.of(w.id, i.id).value, 0);
  const totalValue = warehouses.reduce((s, w) => s + whValue(w), 0);
  const visibleWh = whFilter ? warehouses.filter((w) => w.id === whFilter) : warehouses;

  const stockRows = useMemo(
    () =>
      items
        .map((i) => {
          const qty = visibleWh.reduce((s, w) => s + levels.of(w.id, i.id).qty, 0);
          const value = visibleWh.reduce((s, w) => s + levels.of(w.id, i.id).value, 0);
          return { item: i, qty, value, avg: qty > 0 ? value / qty : 0 };
        })
        .filter((r) => r.qty !== 0 || r.value !== 0 || tab === 'items'),
    [items, visibleWh, levels, tab],
  );
  const lowStock = items.filter((i) => i.minQty && warehouses.reduce((s, w) => s + levels.of(w.id, i.id).qty, 0) < i.minQty);

  const moveRows = useMemo(
    () => moves.filter((m) => inPeriod(m.date, period) && (!whFilter || m.warehouseId === whFilter || m.toWarehouseId === whFilter)),
    [moves, period, whFilter],
  );

  const whName = (id?: string | null) => warehouses.find((w) => w.id === id)?.name || '—';
  const itemName = (id: string) => items.find((i) => i.id === id)?.name || id;

  const run = (title: string, message: string, fn: () => Promise<void>) =>
    setConfirm({
      title,
      message,
      run: () => fn().catch((e) => setActionError(e?.message || 'تعذّر التنفيذ')),
    });

  const stockColumns: Array<Column<(typeof stockRows)[number]>> = [
    {
      key: 'name',
      header: 'الصنف',
      render: (r) => (
        <div>
          <p className="font-medium text-ink">{r.item.name}</p>
          <p className="num text-xs text-ink-subtle">{[r.item.code, r.item.category].filter(Boolean).join(' · ')}</p>
        </div>
      ),
    },
    ...(whFilter
      ? []
      : warehouses.map<Column<(typeof stockRows)[number]>>((w) => ({
          key: w.id,
          header: w.name,
          numeric: true,
          render: (r) => formatNumber(levels.of(w.id, r.item.id).qty, 2),
        }))),
    {
      key: 'qty',
      header: 'الكمية',
      numeric: true,
      render: (r) => (
        <span className={cx(r.item.minQty && r.qty < r.item.minQty ? 'text-danger-700' : '')}>
          {formatNumber(r.qty, 2)} <span className="text-xs font-normal text-ink-subtle">{r.item.unit}</span>
        </span>
      ),
    },
    { key: 'avg', header: 'متوسط التكلفة', numeric: true, render: (r) => formatNumber(r.avg) },
    { key: 'val', header: `القيمة (${mainCurrency})`, numeric: true, render: (r) => formatNumber(r.value) },
    {
      key: 'act',
      header: '',
      className: 'w-24',
      render: (r) => (
        <div className="flex justify-end gap-1">
          <IconBtn icon="arrowIn" title="إدخال" onClick={() => setMoveModal({ open: true, type: 'in', itemId: r.item.id })} />
          <IconBtn icon="arrowOut" title="إخراج" onClick={() => setMoveModal({ open: true, type: 'out', itemId: r.item.id })} />
        </div>
      ),
    },
  ];

  const itemColumns: Array<Column<StockItem>> = [
    { key: 'name', header: 'الصنف', render: (i) => <span className="font-medium">{i.name}</span> },
    { key: 'code', header: 'الرمز', render: (i) => <span className="num text-ink-muted">{i.code || '—'}</span> },
    { key: 'unit', header: 'الوحدة', render: (i) => i.unit || '—' },
    { key: 'cat', header: 'المجموعة', render: (i) => i.category || '—' },
    { key: 'price', header: 'سعر البيع', numeric: true, render: (i) => formatNumber(i.price || 0) },
    { key: 'min', header: 'الحد الأدنى', numeric: true, render: (i) => formatNumber(i.minQty || 0, 0) },
    {
      key: 'qty',
      header: 'الرصيد الكلي',
      numeric: true,
      render: (i) => formatNumber(warehouses.reduce((s, w) => s + levels.of(w.id, i.id).qty, 0), 2),
    },
    {
      key: 'act',
      header: '',
      className: 'w-24',
      render: (i) => (
        <div className="flex justify-end gap-1">
          <IconBtn icon="edit" title="تعديل" onClick={() => setItemModal({ open: true, item: i })} />
          <IconBtn icon="trash" title="حذف" onClick={() => run('حذف الصنف', `حذف ${i.name}؟`, () => deleteItem(i.id))} />
        </div>
      ),
    },
  ];

  const moveColumns: Array<Column<StockMove>> = [
    {
      key: 'type',
      header: 'الحركة',
      render: (m) => (
        <div>
          <Badge tone={m.type === 'in' ? 'success' : m.type === 'out' ? 'danger' : m.type === 'transfer' ? 'info' : 'warning'}>
            {MOVE_LABELS[m.type]}
          </Badge>
          <span className="num ms-2 text-xs text-ink-subtle">#{m.number}</span>
        </div>
      ),
    },
    { key: 'date', header: 'التاريخ', render: (m) => <span className="text-ink-muted">{formatDate(m.date)}</span> },
    { key: 'item', header: 'الصنف', render: (m) => itemName(m.itemId) },
    {
      key: 'wh',
      header: 'المخزن',
      render: (m) => (m.type === 'transfer' ? `${whName(m.warehouseId)} ← ${whName(m.toWarehouseId)}` : whName(m.warehouseId)),
    },
    { key: 'qty', header: 'الكمية', numeric: true, render: (m) => formatNumber(m.qty, 2) },
    { key: 'cost', header: 'التكلفة', numeric: true, render: (m) => formatNumber(Math.abs(m.qty) * m.unitCost) },
    {
      key: 'sale',
      header: 'البيع',
      numeric: true,
      render: (m) => (m.type === 'out' ? formatNumber(m.qty * (m.unitPrice || 0)) : '—'),
    },
    {
      key: 'pay',
      header: 'الدفع',
      render: (m) =>
        m.payment === 'cash' ? (
          'نقدي'
        ) : m.payment === 'credit' ? (
          <Link to={`/accounts/${m.partyId}`} className="text-brand-700 hover:underline">
            آجل · {accountsById[m.partyId || '']?.name}
          </Link>
        ) : (
          '—'
        ),
    },
    {
      key: 'del',
      header: '',
      className: 'w-12',
      render: (m) => (
        <IconBtn icon="trash" title="حذف الحركة وقيودها" onClick={() => run('حذف الحركة', 'ستُحذف الحركة وقيودها المحاسبية من المنصة والهاتف.', () => deleteMove(m.id))} />
      ),
    },
  ];

  const setTab = (t: Tab) => setParams(t === 'stock' ? {} : { tab: t });

  return (
    <>
      <PageHeader
        title="المخازن"
        description="المخزن ← مرتبط بصندوق (للدفع والقبض النقدي) وبحساب مخزون (لقيمة البضاعة) — كل حركة تنشئ قيودها تلقائياً"
        actions={
          <>
            <Button variant="secondary" icon="plus" onClick={() => setItemModal({ open: true })}>
              صنف جديد
            </Button>
            <Button variant="secondary" icon="warehouse" onClick={() => setWhModal({ open: true })}>
              مخزن جديد
            </Button>
            <Button icon="box" onClick={() => setMoveModal({ open: true, type: 'in' })}>
              حركة مخزن
            </Button>
          </>
        }
      />

      {(actionError || error) && (
        <p className="mb-4 flex items-center gap-2 rounded-lg bg-danger-50 px-4 py-3 text-sm text-danger-700">
          <Icon name="alert" size={16} /> {actionError || error}
          <button className="ms-auto text-xs underline" onClick={() => setActionError(null)}>
            إخفاء
          </button>
        </p>
      )}

      <div className="mb-6 grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <StatCard label="قيمة البضاعة الموجودة" value={formatNumber(totalValue)} unit={mainCurrency} icon="box" tone="brand" />
        <StatCard label="المخازن" value={formatNumber(warehouses.length, 0)} icon="warehouse" tone="info" />
        <StatCard label="الأصناف" value={formatNumber(items.length, 0)} icon="grid" tone="neutral" />
        <StatCard
          label="أصناف دون الحد الأدنى"
          value={formatNumber(lowStock.length, 0)}
          icon="alert"
          tone={lowStock.length ? 'danger' : 'success'}
        />
      </div>

      {/* بطاقات المخازن وربطها */}
      {warehouses.length > 0 ? (
        <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-2 2xl:grid-cols-3">
          {warehouses.map((w) => {
            const box = cashboxes.find((b) => b.id === w.cashboxId);
            const inv = w.inventoryAccountId ? accountsById[w.inventoryAccountId] : undefined;
            return (
              <Card key={w.id} className={cx('p-5 transition', whFilter === w.id && 'ring-2 ring-brand-400')}>
                <div className="flex items-start justify-between gap-3">
                  <button className="min-w-0 text-start" onClick={() => setWhFilter(whFilter === w.id ? '' : w.id)}>
                    <p className="flex items-center gap-2 font-semibold text-ink">
                      <Icon name="warehouse" size={17} className="text-brand-600" /> {w.name}
                    </p>
                    {w.location && <p className="mt-0.5 text-xs text-ink-subtle">{w.location}</p>}
                  </button>
                  <div className="flex gap-1">
                    <IconBtn icon="edit" title="تعديل" onClick={() => setWhModal({ open: true, wh: w })} />
                    <IconBtn icon="trash" title="حذف" onClick={() => run('حذف المخزن', `حذف ${w.name}؟`, () => deleteWarehouse(w.id))} />
                  </div>
                </div>
                <p className="mt-3 flex items-baseline gap-1.5">
                  <span className="num text-2xl font-semibold text-ink">{formatNumber(whValue(w))}</span>
                  <span className="text-xs text-ink-subtle">{mainCurrency} قيمة البضاعة</span>
                </p>
                <div className="mt-3 space-y-1.5 border-t border-line pt-3 text-xs">
                  <p className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-1.5 text-ink-subtle">
                      <Icon name="wallet" size={13} /> الصندوق
                    </span>
                    {box ? (
                      <Link to="/cashboxes" className="font-medium text-brand-700 hover:underline">
                        {box.name}
                      </Link>
                    ) : (
                      <span className="text-warning-700">غير مرتبط</span>
                    )}
                  </p>
                  <p className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-1.5 text-ink-subtle">
                      <Icon name="ledger" size={13} /> حساب المخزون
                    </span>
                    {inv ? (
                      <Link to={`/accounts/${inv.id}`} className="flex items-center gap-2 font-medium text-brand-700 hover:underline">
                        {accountLabel(inv)} <SignedAmount value={balances[inv.id]?.total || 0} className="text-xs" />
                      </Link>
                    ) : (
                      <span className="text-danger-700">غير محدد</span>
                    )}
                  </p>
                </div>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card className="mb-6">
          <EmptyState
            icon="warehouse"
            title="لا توجد مخازن بعد"
            description="أنشئ مخزناً واربطه بصندوق، ثم أضف الأصناف وسجّل حركات الإدخال والإخراج."
          />
        </Card>
      )}

      <Card className="overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-line px-5 py-4 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <Tabs<Tab>
              value={tab}
              onChange={setTab}
              items={[
                { value: 'stock', label: 'أرصدة المخازن', icon: 'box' },
                { value: 'moves', label: 'حركات المخازن', icon: 'swap' },
                { value: 'items', label: 'فهرس الأصناف', icon: 'grid' },
              ]}
            />
            <select
              value={whFilter}
              onChange={(e) => setWhFilter(e.target.value)}
              className="h-9 rounded-lg border border-line-strong bg-surface pe-8 ps-3 text-sm shadow-sm"
            >
              <option value="">كل المخازن</option>
              {warehouses.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {tab === 'moves' && <PeriodPicker value={period} onChange={setPeriod} />}
            <ExportButtons
              build={() =>
                tab === 'moves'
                  ? {
                      title: 'حركات المخازن',
                      subtitle: `${whFilter ? whName(whFilter) : 'كل المخازن'} · ${periodText(period)}`,
                      columns: ['الرقم', 'الحركة', 'التاريخ', 'الصنف', 'المخزن', 'الكمية', 'التكلفة', 'البيع'],
                      numericColumns: [5, 6, 7],
                      rows: moveRows.map((m) => [
                        String(m.number),
                        MOVE_LABELS[m.type],
                        formatDate(m.date),
                        itemName(m.itemId),
                        whName(m.warehouseId),
                        m.qty,
                        Math.abs(m.qty) * m.unitCost,
                        m.type === 'out' ? m.qty * (m.unitPrice || 0) : '',
                      ]),
                    }
                  : {
                      title: tab === 'items' ? 'فهرس الأصناف' : 'أرصدة المخازن',
                      subtitle: whFilter ? whName(whFilter) : 'كل المخازن',
                      summary: [['قيمة البضاعة', formatNumber(stockRows.reduce((s, r) => s + r.value, 0))]],
                      columns: ['الصنف', 'الرمز', 'الوحدة', 'الكمية', 'متوسط التكلفة', 'القيمة'],
                      numericColumns: [3, 4, 5],
                      rows: stockRows.map((r) => [r.item.name, r.item.code || '', r.item.unit || '', r.qty, r.avg, r.value]),
                      footer: [['الإجمالي', '', '', '', '', stockRows.reduce((s, r) => s + r.value, 0)]],
                    }
              }
            />
          </div>
        </div>
        {tab === 'stock' && (
          <DataTable
            columns={stockColumns}
            rows={stockRows}
            rowKey={(r) => r.item.id}
            maxHeight="560px"
            empty={{ title: 'لا توجد أرصدة', description: 'سجّل حركة إدخال لتظهر الكميات هنا.', icon: 'box' }}
          />
        )}
        {tab === 'items' && (
          <DataTable
            columns={itemColumns}
            rows={items}
            rowKey={(i) => i.id}
            maxHeight="560px"
            empty={{ title: 'لا توجد أصناف', description: 'أضف صنفاً من زر "صنف جديد".', icon: 'grid' }}
          />
        )}
        {tab === 'moves' && (
          <DataTable
            columns={moveColumns}
            rows={moveRows}
            rowKey={(m) => m.id}
            maxHeight="560px"
            empty={{ title: 'لا توجد حركات في هذه الفترة', icon: 'swap' }}
          />
        )}
      </Card>

      <WarehouseFormModal open={whModal.open} onClose={() => setWhModal({ open: false })} warehouse={whModal.wh} />
      <ItemFormModal open={itemModal.open} onClose={() => setItemModal({ open: false })} item={itemModal.item} />
      <StockMoveModal
        open={moveModal.open}
        type={moveModal.type}
        itemId={moveModal.itemId}
        warehouseId={whFilter || undefined}
        onClose={() => setMoveModal((m) => ({ ...m, open: false }))}
      />
      <ConfirmModal
        open={!!confirm}
        onClose={() => setConfirm(null)}
        title={confirm?.title || ''}
        message={confirm?.message}
        onConfirm={() => confirm?.run()}
      />
    </>
  );
};

const IconBtn: React.FC<{ icon: 'edit' | 'trash' | 'arrowIn' | 'arrowOut'; title: string; onClick: () => void }> = ({
  icon,
  title,
  onClick,
}) => (
  <button
    onClick={onClick}
    title={title}
    aria-label={title}
    className={cx(
      'grid h-8 w-8 place-items-center rounded-md text-ink-subtle hover:bg-slate-100',
      icon === 'trash' ? 'hover:text-danger-600' : 'hover:text-brand-600',
    )}
  >
    <Icon name={icon} size={15} />
  </button>
);

export default Warehouses;
