import React, { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useLedger } from '../context/LedgerContext';
import { Badge, Button, Card, PageHeader, cx } from '../components/ui/primitives';
import Icon, { IconName } from '../components/ui/Icon';
import Modal from '../components/ui/Modal';
import { Field, Select } from '../components/ui/Form';
import { CURRENCIES } from '../lib/ledger';
import { ClosePeriodModal } from '../components/trade/AdminForms';
import { formatNumber } from '../lib/format';

// "الأقسام": نفس تنظيم البرنامج المكتبي (المبيعات، المشتريات، قبض وصرف، الشيكات، المحاسبة، المخازن، أخرى، أدوات، عامة)
// كل قسم: فهارس (البيانات الأساسية) ← حركات (العمليات) ← تقارير. كل بلاطة تفتح النافذة المنفذة في المنصة.

type Tile = { label: string; icon: IconName; to?: string; action?: 'settings' | 'backup' | 'check' | 'close'; soon?: boolean; tone?: string };
type Section = { key: string; label: string; indexes: Tile[]; actions: Tile[]; reports: Array<{ label: string; to: string }> };

const SECTIONS: Section[] = [
  {
    key: 'sales',
    label: 'المبيعات',
    indexes: [
      { label: 'الزبائن', icon: 'users', to: '/accounts?role=customer' },
      { label: 'الحسابات', icon: 'ledger', to: '/accounts' },
      { label: 'الأصناف', icon: 'box', to: '/warehouses?tab=items' },
    ],
    actions: [
      { label: 'فواتير البيع', icon: 'receipt', to: '/trade?kind=sale' },
      { label: 'فواتير مرجع البيع', icon: 'refresh', to: '/trade?kind=saleReturn' },
      { label: 'عروض الأسعار والطلبيات', icon: 'tag', to: '/trade?view=quotes' },
      { label: 'الإشعارات المدينة والدائنة', icon: 'mail', to: '/notes' },
      { label: 'فواتير نقاط البيع', icon: 'receipt', to: '/invoices' },
      { label: 'سند قبض من زبون', icon: 'arrowIn', to: '/vouchers?type=receipt&party=customer' },
      { label: 'الشيكات الواردة', icon: 'cheque', to: '/cheques' },
      { label: 'الإرساليات', icon: 'truck', soon: true },
    ],
    reports: [
      { label: 'الفواتير', to: '/invoices' },
      { label: 'أرصدة الزبائن', to: '/reports?r=customers' },
      { label: 'حركات الزبائن', to: '/reports?r=customers-moves' },
      { label: 'صافي المبيعات الشهري', to: '/reports?r=monthly-sales' },
      { label: 'الحسابات المدينة', to: '/reports?r=debtors' },
      { label: 'سجل الفواتير', to: '/reports?r=invoices-register' },
      { label: 'المبيعات حسب الصنف', to: '/reports?r=sales-by-item' },
      { label: 'المبيعات حسب الزبون', to: '/reports?r=sales-by-customer' },
      { label: 'أعمار الديون', to: '/reports?r=receivables-aging' },
      { label: 'كشف الضريبة المضافة', to: '/reports?r=vat-report' },
      { label: 'زبائن تجاوزوا حد الائتمان', to: '/reports?r=over-credit-limit' },
    ],
  },
  {
    key: 'purchases',
    label: 'المشتريات',
    indexes: [
      { label: 'الموردون', icon: 'truck', to: '/accounts?role=supplier' },
      { label: 'الحسابات', icon: 'ledger', to: '/accounts' },
      { label: 'الأصناف', icon: 'box', to: '/warehouses?tab=items' },
    ],
    actions: [
      { label: 'فواتير الشراء', icon: 'arrowIn', to: '/trade?kind=purchase' },
      { label: 'مرجع المشتريات', icon: 'refresh', to: '/trade?kind=purchaseReturn' },
      { label: 'الطلبيات الصادرة والعروض الواردة', icon: 'tag', to: '/trade?view=quotes' },
      { label: 'إدخال مباشر للمخزن', icon: 'warehouse', to: '/warehouses?tab=moves' },
      { label: 'المصروفات', icon: 'arrowOut', to: '/vouchers?type=payment' },
      { label: 'سند صرف لمورد', icon: 'swap', to: '/vouchers?type=payment&party=supplier' },
      { label: 'الشيكات الصادرة', icon: 'cheque', to: '/cheques?view=out' },
      { label: 'البيانات الجمركية', icon: 'shield', soon: true },
    ],
    reports: [
      { label: 'أرصدة الموردين', to: '/reports?r=suppliers' },
      { label: 'حركات الموردين', to: '/reports?r=suppliers-moves' },
      { label: 'سندات الصرف', to: '/reports?r=vouchers' },
      { label: 'الحسابات الدائنة', to: '/reports?r=creditors' },
      { label: 'المشتريات حسب المورد', to: '/reports?r=purchases-by-supplier' },
      { label: 'كشف الضريبة المضافة', to: '/reports?r=vat-report' },
    ],
  },
  {
    key: 'cash',
    label: 'قبض وصرف',
    indexes: [
      { label: 'الزبائن', icon: 'users', to: '/accounts?role=customer' },
      { label: 'الموردون', icon: 'truck', to: '/accounts?role=supplier' },
      { label: 'الموظفون', icon: 'users', to: '/accounts?role=employee' },
      { label: 'الحسابات', icon: 'ledger', to: '/accounts' },
    ],
    actions: [
      { label: 'سندات القبض', icon: 'arrowIn', to: '/vouchers?type=receipt' },
      { label: 'سندات الصرف', icon: 'arrowOut', to: '/vouchers?type=payment' },
      { label: 'التحويل بين الصناديق', icon: 'swap', to: '/vouchers?type=transfer' },
      { label: 'الصناديق', icon: 'wallet', to: '/cashboxes' },
    ],
    reports: [
      { label: 'إيصالات القبض والصرف للزبائن', to: '/vouchers?party=customer' },
      { label: 'إيصالات القبض والصرف للموردين', to: '/vouchers?party=supplier' },
      { label: 'إيصالات القبض والصرف للموظفين', to: '/vouchers?party=employee' },
      { label: 'إيصالات القبض والصرف للحسابات', to: '/vouchers?party=general' },
      { label: 'حركات الزبائن', to: '/reports?r=customers-moves' },
      { label: 'حركات الموردين', to: '/reports?r=suppliers-moves' },
      { label: 'حركات الموظفين', to: '/reports?r=employees-moves' },
      { label: 'حساب الأستاذ', to: '/reports?r=general-ledger' },
    ],
  },
  {
    key: 'cheques',
    label: 'الشيكات',
    indexes: [
      { label: 'حسابات البنوك', icon: 'building', to: '/accounts?role=bank' },
      { label: 'الشيكات الواردة', icon: 'cheque', to: '/cheques' },
      { label: 'الشيكات الصادرة', icon: 'cheque', to: '/cheques?view=out' },
    ],
    actions: [
      { label: 'حافظة الشيكات', icon: 'lock', to: '/cheques?view=in-portfolio' },
      { label: 'تحت التحصيل', icon: 'building', to: '/cheques?view=in-collecting' },
      { label: 'واردة مصروفة', icon: 'check', to: '/cheques?view=in-cleared' },
      { label: 'مرجعة في البنك', icon: 'alert', to: '/cheques?view=in-returned' },
      { label: 'المجيّرة', icon: 'share', to: '/cheques?view=in-endorsed' },
      { label: 'صادرة غير مصروفة', icon: 'cheque', to: '/cheques?view=out-issued' },
      { label: 'صادرة مصروفة', icon: 'check', to: '/cheques?view=out-cleared' },
      { label: 'صادرة مرجعة', icon: 'alert', to: '/cheques?view=out-returned' },
    ],
    reports: [
      { label: 'الشيكات الواردة', to: '/reports?r=cheques-in' },
      { label: 'الشيكات الصادرة', to: '/reports?r=cheques-out' },
      { label: 'السيولة المالية للبنوك', to: '/reports?r=bank-liquidity' },
    ],
  },
  {
    key: 'accounting',
    label: 'المحاسبة',
    indexes: [
      { label: 'الحسابات', icon: 'ledger', to: '/accounts' },
      { label: 'الصناديق', icon: 'wallet', to: '/cashboxes' },
      { label: 'المخازن', icon: 'warehouse', to: '/warehouses' },
    ],
    actions: [
      { label: 'قيود المحاسبة', icon: 'receipt', to: '/accounting' },
      { label: 'الميزانية العمومية', icon: 'scale', to: '/reports?r=balance-sheet' },
      { label: 'الإيرادات والمصروفات', icon: 'trendUp', to: '/reports?r=income-expense' },
      { label: 'الرسوم البيانية', icon: 'chart', to: '/charts' },
      { label: 'أسعار العملات', icon: 'coins', to: '/rates' },
      { label: 'ترحيل وإغلاق الفترة', icon: 'lock', action: 'close' },
    ],
    reports: [
      { label: 'أرصدة الحسابات', to: '/reports?r=balances' },
      { label: 'ميزان مراجعة', to: '/reports?r=trial-balance' },
      { label: 'قائمة الدخل', to: '/reports?r=income-statement' },
      { label: 'الحسابات المدينة', to: '/reports?r=debtors' },
      { label: 'الحسابات الدائنة', to: '/reports?r=creditors' },
      { label: 'أرصدة الحسابات شهرية', to: '/reports?r=monthly-balances' },
      { label: 'قيود المحاسبة', to: '/reports?r=journal' },
      { label: 'حساب الأستاذ', to: '/reports?r=general-ledger' },
      { label: 'كشف حساب', to: '/reports?r=statement' },
      { label: 'مقارنة الموازنة مع الأرصدة', to: '/reports?r=budget-vs-actual' },
      { label: 'الحسابات التي تعدّت الموازنة', to: '/reports?r=over-budget' },
      { label: 'حسابات اختلفت أرصدتها عن طبيعتها', to: '/reports?r=nature-mismatch' },
      { label: 'الحسابات المجمّدة', to: '/reports?r=frozen-accounts' },
    ],
  },
  {
    key: 'stock',
    label: 'المخازن',
    indexes: [
      { label: 'الأصناف', icon: 'box', to: '/warehouses?tab=items' },
      { label: 'المخازن', icon: 'warehouse', to: '/warehouses' },
    ],
    actions: [
      { label: 'حركات المخازن', icon: 'swap', to: '/warehouses?tab=moves' },
      { label: 'قيمة البضاعة الموجودة', icon: 'coins', to: '/reports?r=stock-value' },
    ],
    reports: [
      { label: 'أرصدة المخازن', to: '/reports?r=stock-balances' },
      { label: 'حركات المخازن', to: '/reports?r=stock-moves' },
      { label: 'أصناف دون الحد الأدنى', to: '/reports?r=stock-low' },
      { label: 'أصناف فوق الحد الأقصى', to: '/reports?r=stock-over-max' },
      { label: 'أصناف بلغت حد إعادة الطلب', to: '/reports?r=stock-reorder' },
      { label: 'الفحص على الرصيد السالب', to: '/reports?r=stock-negative' },
      { label: 'الأصناف بدون فواتير', to: '/reports?r=items-no-invoices' },
      { label: 'مصفوفة حركات الأصناف', to: '/reports?r=item-movement-matrix' },
      { label: 'قائمة الأسعار', to: '/reports?r=price-list' },
      { label: 'صافي المبيعات الشهري', to: '/reports?r=monthly-sales' },
    ],
  },
  {
    key: 'other',
    label: 'أخرى',
    indexes: [
      { label: 'الزبائن', icon: 'users', to: '/accounts?role=customer' },
      { label: 'الموردون', icon: 'truck', to: '/accounts?role=supplier' },
      { label: 'الموظفون', icon: 'users', to: '/accounts?role=employee' },
      { label: 'الحسابات', icon: 'ledger', to: '/accounts' },
    ],
    actions: [
      { label: 'الرواتب والأجور', icon: 'coins', to: '/payroll' },
      { label: 'بيانات الموظفين', icon: 'users', to: '/payroll?tab=employees' },
      { label: 'الإشعارات', icon: 'mail', to: '/notes' },
      { label: 'سندات القيود', icon: 'receipt', to: '/accounting' },
      { label: 'الإيرادات والمصروفات', icon: 'trendUp', to: '/reports?r=income-expense' },
      { label: 'اللوحة الإدارية', icon: 'home', to: '/' },
    ],
    reports: [
      { label: 'أرصدة الموظفين', to: '/reports?r=employees' },
      { label: 'ملخص الرواتب والأجور', to: '/reports?r=payroll-summary' },
      { label: 'رواتب موظف', to: '/reports?r=employee-payroll' },
      { label: 'حركات الموظفين', to: '/reports?r=employees-moves' },
      { label: 'الإيرادات والمصروفات', to: '/reports?r=income-expense' },
    ],
  },
  {
    key: 'tools',
    label: 'أدوات',
    indexes: [],
    actions: [
      { label: 'نسخ بيانات المجموعة', icon: 'download', action: 'backup' },
      { label: 'فحص وتدقيق البيانات', icon: 'shield', action: 'check' },
      { label: 'الإعدادات ومعلومات الشركة', icon: 'settings', to: '/settings' },
      { label: 'ترحيل وإغلاق الفترة', icon: 'lock', action: 'close' },
      { label: 'أسعار العملات', icon: 'coins', to: '/rates' },
    ],
    reports: [],
  },
  {
    key: 'general',
    label: 'عامة',
    indexes: [],
    actions: [
      { label: 'العملة الرئيسية', icon: 'coins', to: '/settings' },
      { label: 'البنوك', icon: 'building', to: '/accounts?role=bank' },
      { label: 'المستخدمون', icon: 'users', soon: true },
    ],
    reports: [
      { label: 'كشف بأرصدة الحسابات', to: '/reports?r=balances' },
      { label: 'أسعار العملات', to: '/reports?r=currency-rates' },
    ],
  },
];

const Hub: React.FC = () => {
  const [params, setParams] = useSearchParams();
  const section = SECTIONS.find((s) => s.key === params.get('s')) || SECTIONS[0];
  const [modal, setModal] = useState<'settings' | 'check' | 'close' | null>(null);
  const ledger = useLedger();

  const backup = () => {
    const data = {
      exportedAt: new Date().toISOString(),
      company: ledger.company,
      accounts: ledger.accounts,
      operations: ledger.operations,
      erp: {
        settings: ledger.settings,
        cashboxes: ledger.cashboxes,
        vouchers: ledger.vouchers,
        warehouses: ledger.warehouses,
        items: ledger.items,
        stockMoves: ledger.moves,
        cheques: ledger.cheques,
        invoices: ledger.invoices,
        quotes: ledger.quotes,
        notes: ledger.notes,
        payrolls: ledger.payrolls,
        rates: ledger.rates,
        accountMeta: ledger.accountMeta,
      },
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `نسخة-احتياطية-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };

  const onTile = (t: Tile) => {
    if (t.action === 'backup') backup();
    else if (t.action) setModal(t.action);
  };

  const TileView: React.FC<{ t: Tile; big?: boolean }> = ({ t, big }) => {
    const inner = (
      <>
        <span
          className={cx(
            'grid place-items-center rounded-xl transition',
            big ? 'h-14 w-14' : 'h-11 w-11',
            t.soon ? 'bg-slate-100 text-ink-faint' : 'bg-brand-50 text-brand-600 group-hover:bg-brand-600 group-hover:text-white',
          )}
        >
          <Icon name={t.icon} size={big ? 26 : 22} />
        </span>
        <span className={cx('text-center text-sm font-medium leading-5', t.soon ? 'text-ink-faint' : 'text-ink')}>{t.label}</span>
        {t.soon && <Badge className="absolute end-2 top-2 text-[10px]">قريباً</Badge>}
      </>
    );
    const cls = cx(
      'group relative flex flex-col items-center justify-center gap-2.5 rounded-xl border border-line bg-surface p-4 shadow-card transition',
      big ? 'min-h-[132px]' : 'min-h-[118px]',
      t.soon ? 'cursor-default opacity-80' : 'hover:-translate-y-0.5 hover:border-brand-200 hover:shadow-pop',
    );
    if (t.to && !t.soon)
      return (
        <Link to={t.to} className={cls}>
          {inner}
        </Link>
      );
    return (
      <button type="button" disabled={t.soon} onClick={() => onTile(t)} className={cls}>
        {inner}
      </button>
    );
  };

  return (
    <>
      <PageHeader title="الأقسام" description="كل نوافذ وأدوات النظام مرتبة كما في البرنامج المكتبي: فهارس ← حركات ← تقارير" />

      <div className="mb-5 flex gap-1 overflow-x-auto rounded-xl border border-line bg-surface p-1 shadow-card">
        {SECTIONS.map((s) => (
          <button
            key={s.key}
            onClick={() => setParams(s.key === 'sales' ? {} : { s: s.key })}
            className={cx(
              'h-10 shrink-0 rounded-lg px-4 text-sm font-medium transition',
              s.key === section.key ? 'bg-brand-600 text-white shadow-sm' : 'text-ink-muted hover:bg-slate-100 hover:text-ink',
            )}
          >
            {s.label}
          </button>
        ))}
      </div>

      <div
        className={cx(
          'grid grid-cols-1 gap-5',
          section.indexes.length > 0 && section.reports.length > 0 && 'xl:grid-cols-[220px_minmax(0,1fr)_300px]',
          section.indexes.length === 0 && section.reports.length > 0 && 'xl:grid-cols-[minmax(0,1fr)_300px]',
        )}
      >
        {section.indexes.length > 0 && (
          <Card className="h-fit bg-slate-50/60 p-4">
            <h2 className="mb-3 text-center text-sm font-semibold text-ink-muted">الفهارس</h2>
            <div className="grid grid-cols-2 gap-3 xl:grid-cols-1">
              {section.indexes.map((t) => (
                <TileView key={t.label} t={t} big />
              ))}
            </div>
          </Card>
        )}

        <Card className="h-fit p-4">
          <h2 className="mb-3 text-center text-sm font-semibold text-ink-muted">{section.indexes.length ? 'الحركات' : 'الأدوات'}</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 2xl:grid-cols-4">
            {section.actions.map((t) => (
              <TileView key={t.label} t={t} />
            ))}
          </div>
        </Card>

        {section.reports.length > 0 && (
          <Card className="h-fit p-4">
            <h2 className="mb-3 text-center text-sm font-semibold text-ink-muted">التقارير</h2>
            <ul className="space-y-1">
              {section.reports.map((r) => (
                <li key={r.label}>
                  <Link
                    to={r.to}
                    className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-ink-muted transition hover:bg-brand-50 hover:text-brand-700"
                  >
                    <Icon name="chart" size={16} className="shrink-0 text-success-600" />
                    {r.label}
                  </Link>
                </li>
              ))}
            </ul>
          </Card>
        )}
      </div>

      <SettingsModal open={modal === 'settings'} onClose={() => setModal(null)} />
      <CheckModal open={modal === 'check'} onClose={() => setModal(null)} />
      <ClosePeriodModal open={modal === 'close'} onClose={() => setModal(null)} />
    </>
  );
};

const SettingsModal: React.FC<{ open: boolean; onClose: () => void }> = ({ open, onClose }) => {
  const { mainCurrency, saveSettings } = useLedger();
  const [cur, setCur] = useState(mainCurrency);
  React.useEffect(() => {
    if (open) setCur(mainCurrency);
  }, [open, mainCurrency]);
  return (
    <Modal
      open={open}
      onClose={onClose}
      size="sm"
      title="العملة الرئيسية"
      subtitle="العملة التي تُحسب بها الأرصدة والتقارير (يجب أن تطابق العملة الرئيسية في تطبيق الهاتف)"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            إلغاء
          </Button>
          <Button
            onClick={() => {
              saveSettings({ mainCurrency: cur });
              onClose();
            }}
          >
            حفظ
          </Button>
        </>
      }
    >
      <Field label="العملة الرئيسية" hint="أسعار الصرف تُدخل مع كل قيد: كم وحدة من العملة تساوي 1 من العملة الرئيسية">
        <Select value={cur} onChange={(e) => setCur(e.target.value)}>
          {Array.from(new Set([mainCurrency, ...CURRENCIES])).map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </Select>
      </Field>
    </Modal>
  );
};

/** فحص وتدقيق البيانات: قيود يتيمة، أسعار صرف شاذة، سندات ناقصة القيود، أرصدة مخزون سالبة */
const CheckModal: React.FC<{ open: boolean; onClose: () => void }> = ({ open, onClose }) => {
  const { operations, accountsById, vouchers, moves, cheques, cashboxes, warehouses } = useLedger();
  const issues = useMemo(() => {
    if (!open) return [];
    const opIds = new Set(operations.map((o) => o.id));
    const list: Array<{ tone: 'danger' | 'warning' | 'success'; text: string }> = [];
    const orphan = operations.filter((o) => !accountsById[o.accountId]);
    if (orphan.length) list.push({ tone: 'danger', text: `${orphan.length} قيد مرتبط بحساب غير موجود` });
    const badRate = operations.filter((o) => !(o.exchangeRate > 0) || Math.abs(o.amountUSD - o.amount / o.exchangeRate) > 0.01);
    if (badRate.length) list.push({ tone: 'warning', text: `${badRate.length} قيد معادله بالعملة الرئيسية لا يطابق سعر الصرف` });
    const brokenDocs = [
      ...vouchers.filter((v) => v.opIds.some((id) => !opIds.has(id))),
      ...moves.filter((m) => m.opIds.some((id) => !opIds.has(id))),
      ...cheques.filter((c) => c.history.some((h) => (h.opIds || []).some((id) => !opIds.has(id)))),
    ];
    if (brokenDocs.length) list.push({ tone: 'warning', text: `${brokenDocs.length} مستند (سند/حركة/شيك) حُذف أحد قيوده من الهاتف` });
    const noCash = cashboxes.filter((b) => !b.cashAccountId || !accountsById[b.cashAccountId]);
    if (noCash.length) list.push({ tone: 'warning', text: `${noCash.length} صندوق بلا حساب نقدية صالح` });
    const noInv = warehouses.filter((w) => !w.inventoryAccountId || !accountsById[w.inventoryAccountId]);
    if (noInv.length) list.push({ tone: 'warning', text: `${noInv.length} مخزن بلا حساب مخزون صالح` });
    if (!list.length) list.push({ tone: 'success', text: `لا توجد مشكلات — تم فحص ${formatNumber(operations.length, 0)} قيد` });
    return list;
  }, [open, operations, accountsById, vouchers, moves, cheques, cashboxes, warehouses]);

  return (
    <Modal open={open} onClose={onClose} size="sm" title="فحص وتدقيق البيانات">
      <ul className="space-y-2">
        {issues.map((i) => (
          <li
            key={i.text}
            className={cx(
              'flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm',
              i.tone === 'danger' && 'bg-danger-50 text-danger-700',
              i.tone === 'warning' && 'bg-warning-50 text-warning-700',
              i.tone === 'success' && 'bg-success-50 text-success-700',
            )}
          >
            <Icon name={i.tone === 'success' ? 'check' : 'alert'} size={16} /> {i.text}
          </li>
        ))}
      </ul>
    </Modal>
  );
};

export default Hub;
