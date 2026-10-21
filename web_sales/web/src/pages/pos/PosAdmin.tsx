import React, { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { usePos } from '../../context/PosContext';
import { Badge, Button, Card, CardHeader, EmptyState, PageHeader, StatCard, Tabs, cx } from '../../components/ui/primitives';
import DataTable, { Column } from '../../components/ui/DataTable';
import Icon, { IconName } from '../../components/ui/Icon';
import Modal, { ConfirmModal } from '../../components/ui/Modal';
import { Field, FormError, Input, Select } from '../../components/ui/Form';
import { BranchModal, CashierModal, ImportProductsModal, ProductModal, RegisterModal, WarehouseModal } from '../../components/pos/PosForms';
import ProductImage from '../../components/pos/ProductImage';
import { BUSINESS_LABELS, CashRegister, PosBranch, PosEmployee, PosProduct, PosSession, PosWarehouse, ROLE_LABELS } from '../../lib/pos';
import { formatDate, formatNumber } from '../../lib/format';

// لوحة تحكم المالك لنقطة البيع: الفرع ← المخازن ← الصناديق ← حسابات الكاشير، والمنتجات بصورها، والجلسات.

type Tab = 'overview' | 'branches' | 'warehouses' | 'registers' | 'cashiers' | 'products' | 'sessions';

const TABS: Array<{ value: Tab; label: string; icon: IconName }> = [
  { value: 'overview', label: 'الهيكل', icon: 'grid' },
  { value: 'branches', label: 'الفروع', icon: 'store' },
  { value: 'warehouses', label: 'المخازن', icon: 'warehouse' },
  { value: 'registers', label: 'الصناديق', icon: 'wallet' },
  { value: 'cashiers', label: 'الكاشير', icon: 'users' },
  { value: 'products', label: 'المنتجات', icon: 'box' },
  { value: 'sessions', label: 'الجلسات', icon: 'calendar' },
];

const PosAdmin: React.FC = () => {
  const [params, setParams] = useSearchParams();
  const tab = (params.get('tab') as Tab) || 'overview';
  const pos = usePos();
  const { branches, warehouses, registers, employees, products, sessions, links, productMeta, catalog, currency } = pos;

  const [branchM, setBranchM] = useState<{ open: boolean; v?: PosBranch | null }>({ open: false });
  const [whM, setWhM] = useState<{ open: boolean; v?: PosWarehouse | null }>({ open: false });
  const [regM, setRegM] = useState<{ open: boolean; v?: CashRegister | null }>({ open: false });
  const [empM, setEmpM] = useState<{ open: boolean; v?: PosEmployee | null }>({ open: false });
  const [prodM, setProdM] = useState<{ open: boolean; v?: PosProduct | null }>({ open: false });
  const [transferM, setTransferM] = useState<PosProduct | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [confirm, setConfirm] = useState<{ title: string; message: string; run: () => Promise<void> } | null>(null);
  const [actionErr, setActionErr] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [whFilter, setWhFilter] = useState('');

  const branchName = (id?: string | null) => branches.find((b) => b.id === id)?.name || '—';
  const whName = (id?: string | null) => warehouses.find((w) => w.id === id)?.name || '—';
  const regName = (id?: string | null) => registers.find((r) => r.id === id)?.name || '—';
  const openSessions = sessions.filter((s) => !s.closedAt);
  const ask = (title: string, message: string, fn: () => Promise<void>) =>
    setConfirm({ title, message, run: () => fn().catch((e) => setActionErr(e?.message || 'تعذّر التنفيذ')) });

  const actions = (edit: () => void, del: () => void) => (
    <div className="flex justify-end gap-1">
      <IconBtn icon="edit" title="تعديل" onClick={edit} />
      <IconBtn icon="trash" title="حذف" onClick={del} danger />
    </div>
  );

  const shownProducts = useMemo(() => {
    const s = q.trim();
    return products.filter((p) => (!whFilter || p.warehouseId === whFilter) && (!s || p.name.includes(s) || (p.barcode || '').includes(s)));
  }, [products, q, whFilter]);

  const imgOf = (p: PosProduct) => productMeta[p.id]?.imageUrl || (p.barcode ? catalog[p.barcode]?.imageUrl : undefined);

  const branchCols: Array<Column<PosBranch>> = [
    { key: 'n', header: 'الفرع', render: (b) => <span className="font-medium">{b.name}</span> },
    { key: 't', header: 'النشاط', render: (b) => BUSINESS_LABELS[b.type] },
    { key: 'w', header: 'المخازن', numeric: true, render: (b) => formatNumber(warehouses.filter((w) => w.branchId === b.id).length, 0) },
    { key: 'r', header: 'الصناديق', numeric: true, render: (b) => formatNumber(registers.filter((r) => r.branchId === b.id).length, 0) },
    { key: 'e', header: 'الموظفون', numeric: true, render: (b) => formatNumber(employees.filter((e) => e.branchId === b.id).length, 0) },
    { key: 'a', header: '', className: 'w-24', render: (b) => actions(() => setBranchM({ open: true, v: b }), () => ask('حذف الفرع', `حذف ${b.name}؟`, () => pos.deleteBranch(b.id))) },
  ];
  const whCols: Array<Column<PosWarehouse>> = [
    { key: 'n', header: 'المخزن', render: (w) => <span className="font-medium">{w.name}</span> },
    { key: 'b', header: 'الفرع', render: (w) => branchName(w.branchId) },
    {
      key: 'l',
      header: 'مرتبط بـ',
      render: (w) =>
        (links[w.id] || []).length ? (
          <div className="flex flex-wrap gap-1">
            {(links[w.id] || []).map((id) => (
              <Badge key={id} tone="brand">
                {whName(id)}
              </Badge>
            ))}
          </div>
        ) : (
          <span className="text-ink-faint">—</span>
        ),
    },
    { key: 'p', header: 'المنتجات', numeric: true, render: (w) => formatNumber(products.filter((p) => p.warehouseId === w.id).length, 0) },
    {
      key: 'v',
      header: `قيمة المخزون (${currency})`,
      numeric: true,
      render: (w) => formatNumber(products.filter((p) => p.warehouseId === w.id).reduce((s, p) => s + p.quantity * p.costPrice, 0)),
    },
    { key: 'a', header: '', className: 'w-24', render: (w) => actions(() => setWhM({ open: true, v: w }), () => ask('حذف المخزن', `حذف ${w.name}؟`, () => pos.deleteWarehouse(w.id))) },
  ];
  const regCols: Array<Column<CashRegister>> = [
    { key: 'n', header: 'الصندوق', render: (r) => <span className="font-medium">{r.name}</span> },
    { key: 'b', header: 'الفرع', render: (r) => branchName(r.branchId) },
    {
      key: 'c',
      header: 'الكاشير',
      render: (r) => employees.filter((e) => e.cashRegisterId === r.id).map((e) => e.name).join('، ') || <span className="text-ink-faint">غير مرتبط</span>,
    },
    { key: 's', header: 'الجلسة', render: (r) => <Badge tone={r.sessionOpen ? 'success' : 'neutral'}>{r.sessionOpen ? 'مفتوحة' : 'مغلقة'}</Badge> },
    {
      key: 'a',
      header: '',
      className: 'w-24',
      render: (r) => actions(() => setRegM({ open: true, v: r }), () => ask('حذف الصندوق', `حذف ${r.name}؟ يُفك ربط الكاشير به.`, () => pos.deleteRegister(r.id))),
    },
  ];
  const empCols: Array<Column<PosEmployee>> = [
    {
      key: 'n',
      header: 'الموظف',
      render: (e) => (
        <div>
          <p className="font-medium">{e.name}</p>
          <p className="text-xs text-ink-subtle" dir="ltr">
            {e.email}
          </p>
        </div>
      ),
    },
    { key: 'r', header: 'الصلاحية', render: (e) => <Badge tone={e.role === 'manager' ? 'brand' : 'info'}>{ROLE_LABELS[e.role]}</Badge> },
    { key: 'b', header: 'الفرع', render: (e) => branchName(e.branchId) },
    { key: 'g', header: 'الصندوق', render: (e) => (e.cashRegisterId ? regName(e.cashRegisterId) : <span className="text-danger-600">غير مرتبط</span>) },
    {
      key: 's',
      header: 'الحالة',
      render: (e) => {
        const s = openSessions.find((x) => x.cashierUid === e.uid);
        return s ? <Badge tone="success">يبيع الآن</Badge> : <span className="text-ink-faint">—</span>;
      },
    },
    {
      key: 'a',
      header: '',
      className: 'w-24',
      render: (e) =>
        actions(
          () => setEmpM({ open: true, v: e }),
          () => ask('إيقاف حساب الكاشير', `سيفقد ${e.name} الوصول لنقطة البيع فوراً.`, () => pos.removeEmployee(e.uid)),
        ),
    },
  ];
  const prodCols: Array<Column<PosProduct>> = [
    {
      key: 'n',
      header: 'المنتج',
      render: (p) => (
        <div className="flex items-center gap-3">
          <ProductImage src={imgOf(p)} className="h-11 w-11 shrink-0 rounded-lg border border-line" iconSize={18} />
          <div className="min-w-0">
            <p className="truncate font-medium">{p.name}</p>
            <p className="num text-xs text-ink-subtle">{p.barcode || 'بدون باركود'}</p>
          </div>
        </div>
      ),
    },
    { key: 'w', header: 'المخزن', render: (p) => whName(p.warehouseId) },
    { key: 's', header: 'سعر البيع', numeric: true, render: (p) => formatNumber(p.sellPrice) },
    { key: 'c', header: 'التكلفة', numeric: true, render: (p) => formatNumber(p.costPrice) },
    { key: 'q', header: 'الكمية', numeric: true, render: (p) => <span className={p.quantity <= 0 ? 'text-danger-700' : ''}>{formatNumber(p.quantity, 2)}</span> },
    {
      key: 'a',
      header: '',
      className: 'w-32',
      render: (p) => (
        <div className="flex justify-end gap-1">
          {(links[p.warehouseId] || []).length > 0 && <IconBtn icon="swap" title="تحويل لمخزن مرتبط" onClick={() => setTransferM(p)} />}
          <IconBtn icon="edit" title="تعديل" onClick={() => setProdM({ open: true, v: p })} />
          <IconBtn icon="trash" title="حذف" danger onClick={() => ask('حذف المنتج', `حذف ${p.name}؟`, () => pos.deleteProduct(p.id))} />
        </div>
      ),
    },
  ];
  const sessionCols: Array<Column<PosSession>> = [
    { key: 'r', header: 'الصندوق', render: (s) => regName(s.registerId) },
    { key: 'c', header: 'الكاشير', render: (s) => s.cashierName },
    { key: 'o', header: 'الفتح', render: (s) => formatDate(s.openedAt, { dateStyle: 'short', timeStyle: 'short' }) },
    { key: 'x', header: 'الإغلاق', render: (s) => (s.closedAt ? formatDate(s.closedAt, { dateStyle: 'short', timeStyle: 'short' }) : <Badge tone="success">مفتوحة</Badge>) },
    { key: 'n', header: 'الفواتير', numeric: true, render: (s) => formatNumber(((s as any).running?.count as number) || 0, 0) },
    { key: 't', header: 'المبيعات', numeric: true, render: (s) => formatNumber(((s as any).running?.total as number) || 0) },
    {
      key: 'd',
      header: 'فرق الجرد',
      numeric: true,
      render: (s) => {
        if (s.countedCash == null) return '—';
        const diff = s.countedCash - (s.openingCash || 0) - (((s as any).running?.cash as number) || 0);
        return <span className={Math.abs(diff) < 0.005 ? 'text-success-700' : diff < 0 ? 'text-danger-700' : 'text-info-700'}>{formatNumber(diff)}</span>;
      },
    },
  ];

  const addBtn: Partial<Record<Tab, React.ReactNode>> = {
    branches: <Button icon="plus" onClick={() => setBranchM({ open: true })}>فرع جديد</Button>,
    warehouses: <Button icon="plus" disabled={!branches.length} onClick={() => setWhM({ open: true })}>مخزن جديد</Button>,
    registers: <Button icon="plus" disabled={!branches.length} onClick={() => setRegM({ open: true })}>صندوق جديد</Button>,
    cashiers: <Button icon="plus" disabled={!registers.length} onClick={() => setEmpM({ open: true })}>حساب كاشير جديد</Button>,
    products: (
      <>
        <Button variant="secondary" icon="download" disabled={!warehouses.length} onClick={() => setImportOpen(true)}>
          استيراد من قاعدة المنتجات
        </Button>
        <Button icon="plus" disabled={!warehouses.length} onClick={() => setProdM({ open: true })}>
          منتج جديد
        </Button>
      </>
    ),
  };

  return (
    <>
      <PageHeader
        title="نقطة البيع"
        description="الفرع ← المخازن ← صناديق الكاشير ← حسابات الكاشير. الكاشير يدخل من متصفح هاتفه فتفتح له واجهة البيع على صندوقه"
        actions={
          <>
            <Link to="/pos">
              <Button variant="secondary" icon="barcode">
                شاشة الكاشير
              </Button>
            </Link>
            {addBtn[tab]}
          </>
        }
      />
      <div className="mb-6 grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <StatCard label="الفروع" value={formatNumber(branches.length, 0)} icon="store" tone="brand" hint={`${warehouses.length} مخزن`} />
        <StatCard label="الصناديق" value={formatNumber(registers.length, 0)} icon="wallet" tone="info" hint={`${openSessions.length} جلسة مفتوحة الآن`} />
        <StatCard label="الكاشير" value={formatNumber(employees.length, 0)} icon="users" tone="success" />
        <StatCard label="المنتجات" value={formatNumber(products.length, 0)} icon="box" tone="warning" hint={`${products.filter((p) => p.quantity <= 0).length} نفدت كميته`} />
      </div>

      {actionErr && (
        <p className="mb-4 flex items-center gap-2 rounded-lg bg-danger-50 px-3 py-2 text-sm text-danger-700">
          <Icon name="alert" size={16} /> {actionErr}
        </p>
      )}

      <div className="mb-4 overflow-x-auto">
        <Tabs<Tab> value={tab} onChange={(v) => setParams(v === 'overview' ? {} : { tab: v })} items={TABS} />
      </div>

      {tab === 'overview' ? (
        branches.length ? (
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            {branches.map((b) => (
              <Card key={b.id}>
                <CardHeader title={b.name} subtitle={`${BUSINESS_LABELS[b.type]}${b.address ? ` · ${b.address}` : ''}`} />
                <div className="grid grid-cols-1 gap-4 p-5 sm:grid-cols-2">
                  <div>
                    <p className="mb-2 text-xs font-semibold text-ink-subtle">المخازن</p>
                    {warehouses.filter((w) => w.branchId === b.id).map((w) => (
                      <p key={w.id} className="flex items-center gap-2 py-1 text-sm">
                        <Icon name="warehouse" size={14} className="text-ink-subtle" /> {w.name}
                        {(links[w.id] || []).length > 0 && <span className="text-xs text-ink-faint">↔ {(links[w.id] || []).map(whName).join('، ')}</span>}
                      </p>
                    ))}
                    {!warehouses.some((w) => w.branchId === b.id) && <p className="text-xs text-danger-600">لا يوجد مخزن — الكاشير لن يجد منتجات</p>}
                  </div>
                  <div>
                    <p className="mb-2 text-xs font-semibold text-ink-subtle">الصناديق والكاشير</p>
                    {registers.filter((r) => r.branchId === b.id).map((r) => (
                      <div key={r.id} className="flex items-center gap-2 py-1 text-sm">
                        <span className={cx('h-2 w-2 rounded-full', r.sessionOpen ? 'bg-success-600' : 'bg-slate-300')} />
                        {r.name}
                        <span className="text-xs text-ink-subtle">← {employees.filter((e) => e.cashRegisterId === r.id).map((e) => e.name).join('، ') || 'بدون كاشير'}</span>
                      </div>
                    ))}
                    {!registers.some((r) => r.branchId === b.id) && <p className="text-xs text-ink-faint">لا يوجد صندوق</p>}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        ) : (
          <Card>
            <EmptyState icon="store" title="ابدأ بإنشاء فرع" description="ثم أضف له مخزناً وصندوق كاشير، ثم أنشئ حساب الكاشير واربطه بالصندوق." />
            <div className="pb-8 text-center">
              <Button icon="plus" onClick={() => setBranchM({ open: true })}>
                فرع جديد
              </Button>
            </div>
          </Card>
        )
      ) : (
        <Card className="overflow-hidden">
          {tab === 'products' && (
            <div className="flex flex-wrap items-center gap-2 border-b border-line px-5 py-3">
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="بحث بالاسم أو الباركود..."
                className="h-9 w-64 rounded-lg border border-line-strong bg-surface px-3 text-sm shadow-sm"
              />
              <select value={whFilter} onChange={(e) => setWhFilter(e.target.value)} className="h-9 rounded-lg border border-line-strong bg-surface pe-8 ps-3 text-sm shadow-sm">
                <option value="">كل المخازن</option>
                {warehouses.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name}
                  </option>
                ))}
              </select>
              <span className="ms-auto text-xs text-ink-subtle">امسح أي باركود في نموذج المنتج ليُعبّأ الاسم والصورة من قاعدة المنتجات العالمية</span>
            </div>
          )}
          {tab === 'branches' && <DataTable columns={branchCols} rows={branches} rowKey={(b) => b.id} empty={{ title: 'لا توجد فروع', icon: 'store' }} />}
          {tab === 'warehouses' && <DataTable columns={whCols} rows={warehouses} rowKey={(w) => w.id} empty={{ title: 'لا توجد مخازن', icon: 'warehouse' }} />}
          {tab === 'registers' && <DataTable columns={regCols} rows={registers} rowKey={(r) => r.id} empty={{ title: 'لا توجد صناديق', icon: 'wallet' }} />}
          {tab === 'cashiers' && <DataTable columns={empCols} rows={employees} rowKey={(e) => e.uid} empty={{ title: 'لا يوجد كاشير', description: 'أنشئ حساباً واربطه بصندوق.', icon: 'users' }} />}
          {tab === 'products' && <DataTable columns={prodCols} rows={shownProducts} rowKey={(p) => p.id} maxHeight="calc(100dvh - 380px)" empty={{ title: 'لا توجد منتجات', icon: 'box' }} />}
          {tab === 'sessions' && <DataTable columns={sessionCols} rows={sessions} rowKey={(s) => s.id} empty={{ title: 'لا توجد جلسات بعد', icon: 'calendar' }} />}
        </Card>
      )}

      <BranchModal open={branchM.open} branch={branchM.v} onClose={() => setBranchM({ open: false })} />
      <WarehouseModal open={whM.open} warehouse={whM.v} onClose={() => setWhM({ open: false })} />
      <RegisterModal open={regM.open} register={regM.v} onClose={() => setRegM({ open: false })} />
      <CashierModal open={empM.open} employee={empM.v} onClose={() => setEmpM({ open: false })} />
      <ProductModal open={prodM.open} product={prodM.v} onClose={() => setProdM({ open: false })} defaultWarehouseId={whFilter} />
      <TransferModal product={transferM} onClose={() => setTransferM(null)} />
      <ImportProductsModal open={importOpen} onClose={() => setImportOpen(false)} defaultWarehouseId={whFilter} />
      <ConfirmModal open={!!confirm} onClose={() => setConfirm(null)} title={confirm?.title || ''} message={confirm?.message || ''} onConfirm={() => confirm?.run()} />
    </>
  );
};

const IconBtn: React.FC<{ icon: IconName; title: string; onClick: () => void; danger?: boolean }> = ({ icon, title, onClick, danger }) => (
  <button
    onClick={onClick}
    title={title}
    className={cx('grid h-8 w-8 place-items-center rounded-md text-ink-subtle', danger ? 'hover:bg-danger-50 hover:text-danger-600' : 'hover:bg-slate-100 hover:text-ink')}
  >
    <Icon name={icon} size={15} />
  </button>
);

const TransferModal: React.FC<{ product: PosProduct | null; onClose: () => void }> = ({ product, onClose }) => {
  const { links, warehouses, transferStock } = usePos();
  const [to, setTo] = useState('');
  const [qty, setQty] = useState('');
  const [err, setErr] = useState<string | null>(null);
  React.useEffect(() => {
    setTo('');
    setQty('');
    setErr(null);
  }, [product]);
  const targets = product ? (links[product.warehouseId] || []).map((id) => warehouses.find((w) => w.id === id)).filter(Boolean) : [];
  return (
    <Modal
      open={!!product}
      onClose={onClose}
      size="sm"
      title="تحويل بين مخزنين مرتبطين"
      subtitle={product ? `${product.name} — المتاح ${product.quantity}` : ''}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            إلغاء
          </Button>
          <Button
            onClick={async () => {
              try {
                await transferStock(product!.id, to, Number(qty));
                onClose();
              } catch (e: any) {
                setErr(e?.message || 'تعذّر التحويل');
              }
            }}
            disabled={!to || !(Number(qty) > 0)}
          >
            تحويل
          </Button>
        </>
      }
    >
      <div className="grid gap-4">
        <Field label="إلى مخزن">
          <Select value={to} onChange={(e) => setTo(e.target.value)}>
            <option value="">اختر...</option>
            {targets.map((w) => (
              <option key={w!.id} value={w!.id}>
                {w!.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="الكمية">
          <Input inputMode="decimal" value={qty} onChange={(e) => setQty(e.target.value.replace(/[^0-9.]/g, ''))} className="num" />
        </Field>
      </div>
      <FormError message={err} />
    </Modal>
  );
};

export default PosAdmin;
