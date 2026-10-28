import React, { useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Badge, Button, Card, CardHeader, PageHeader, StatCard, cx } from '../components/ui/primitives';
import { Field, Input, Select } from '../components/ui/Form';
import DataTable, { Column } from '../components/ui/DataTable';
import { useApp } from '../context/AppContext';
import { useLedger } from '../context/LedgerContext';
import { usePos } from '../context/PosContext';
import { downloadTemplate, readSheet, SheetData } from '../lib/excel';
import { autoMap, Existing, IMPORT_KINDS, ImportKind, ImportRow, prepareImport } from '../lib/importer';
import { Area, can } from '../lib/team';
import { localIso } from '../lib/ledger';

const KIND_AREA: Record<ImportKind, Area> = { customers: 'accounts', suppliers: 'accounts', items: 'stock', products: 'pos' };
const KIND_LINK: Record<ImportKind, string> = { customers: '/accounts', suppliers: '/accounts', items: '/warehouses', products: '/pos-admin' };
const STATUS: Record<ImportRow['status'], { label: string; tone: 'success' | 'info' | 'neutral' | 'danger' }> = {
  new: { label: 'جديد', tone: 'success' },
  update: { label: 'تحديث', tone: 'info' },
  skip: { label: 'تخطٍّ', tone: 'neutral' },
  error: { label: 'خطأ', tone: 'danger' },
};

// استيراد الزبائن والموردين والأصناف ومنتجات نقطة البيع من Excel أو CSV، مع معاينة قبل الحفظ
const Import: React.FC = () => {
  const { member } = useApp();
  const { accounts, items, roleOf, importParties, importItems } = useLedger();
  const { products, warehouses, importProducts } = usePos();
  const [params, setParams] = useSearchParams();
  const kinds = (Object.keys(IMPORT_KINDS) as ImportKind[]).filter((k) => can(member, KIND_AREA[k], 'edit'));
  const kind: ImportKind = kinds.includes(params.get('kind') as ImportKind) ? (params.get('kind') as ImportKind) : kinds[0];
  const def = kind ? IMPORT_KINDS[kind] : null;

  const [sheet, setSheet] = useState<SheetData | null>(null);
  const [fileName, setFileName] = useState('');
  const [mapping, setMapping] = useState<Record<string, number>>({});
  const [mode, setMode] = useState<'skip' | 'update'>('skip');
  const [warehouseId, setWarehouseId] = useState('');
  const [openingDate, setOpeningDate] = useState(localIso().slice(0, 10));
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  const pickKind = (k: ImportKind) => {
    setParams({ kind: k }, { replace: true });
    setMsg(null);
    if (sheet) setMapping(autoMap(sheet.headers, IMPORT_KINDS[k].fields));
  };

  const onFile = async (f?: File) => {
    if (!f || !def) return;
    setMsg(null);
    try {
      const s = await readSheet(f);
      setSheet(s);
      setFileName(f.name);
      setMapping(autoMap(s.headers, def.fields));
    } catch (e: any) {
      setSheet(null);
      setMsg({ ok: false, text: e?.message || 'تعذّرت قراءة الملف' });
    }
  };

  const existing: Existing[] = useMemo(() => {
    if (kind === 'customers' || kind === 'suppliers') {
      const want = kind === 'customers' ? ['customer', 'merchant'] : ['supplier'];
      return accounts.filter((a) => want.includes(roleOf(a.id))).map((a) => ({ id: a.id, name: a.name, code: a.code, phone: a.phone }));
    }
    if (kind === 'items') return items.map((i) => ({ id: i.id, name: i.name, code: i.code, barcode: i.barcode }));
    return products.filter((p) => !warehouseId || p.warehouseId === warehouseId).map((p) => ({ id: p.id, name: p.name, barcode: p.barcode }));
  }, [kind, accounts, items, products, warehouseId, roleOf]);

  const prepared = useMemo(() => (sheet && kind ? prepareImport(kind, sheet.rows, mapping, existing, mode) : []), [sheet, kind, mapping, existing, mode]);
  const count = (s: ImportRow['status']) => prepared.filter((r) => r.status === s).length;
  const toWrite = count('new') + count('update');

  const run = async () => {
    if (!kind) return;
    if (kind === 'products' && !warehouseId) return setMsg({ ok: false, text: 'اختر المخزن' });
    setBusy(true);
    setMsg(null);
    try {
      const res =
        kind === 'items'
          ? await importItems(prepared)
          : kind === 'products'
            ? await importProducts(prepared, warehouseId)
            : await importParties(prepared, kind === 'customers' ? 'customer' : 'supplier', openingDate);
      setMsg({ ok: true, text: `تم: أُضيف ${res.added}${res.updated ? ` وحُدِّث ${res.updated}` : ''}` });
      setSheet(null);
      setFileName('');
      if (input.current) input.current.value = '';
    } catch (e: any) {
      setMsg({ ok: false, text: e?.message || 'تعذّر الاستيراد' });
    } finally {
      setBusy(false);
    }
  };

  if (!def || !kind)
    return <PageHeader title="استيراد من Excel" description="ليس لديك صلاحية إضافة زبائن أو أصناف أو منتجات" />;

  const fieldCols: Column<ImportRow>[] = [
    { key: 'l', header: 'السطر', render: (r) => <span className="num text-xs text-ink-subtle">{r.line}</span> },
    { key: 's', header: 'الحالة', render: (r) => <Badge tone={STATUS[r.status].tone}>{STATUS[r.status].label}</Badge> },
    {
      key: 'm',
      header: 'ملاحظة',
      className: 'min-w-[11rem]',
      render: (r) => <span className={cx('text-xs', r.status === 'error' ? 'text-danger-700' : 'text-ink-subtle')}>{r.message || ''}</span>,
    },
    ...def.fields
      .filter((f) => mapping[f.key] >= 0)
      .map<Column<ImportRow>>((f) => ({
        key: f.key,
        header: f.label,
        numeric: f.type === 'number',
        render: (r) => <span className={f.type === 'number' ? 'num' : ''}>{r.values[f.key] ?? ''}</span>,
      })),
  ];

  return (
    <>
      <PageHeader title="استيراد من Excel" description="أضف الزبائن والموردين والأصناف ومنتجات نقطة البيع دفعة واحدة من ملف Excel أو CSV، مع معاينة كاملة قبل الحفظ" />

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {kinds.map((k) => (
          <button
            key={k}
            onClick={() => pickKind(k)}
            className={cx(
              'rounded-xl border p-4 text-start transition',
              k === kind ? 'border-brand-500 bg-brand-50 ring-1 ring-brand-500' : 'border-line bg-surface hover:bg-slate-50',
            )}
          >
            <span className="block text-sm font-semibold text-ink">{IMPORT_KINDS[k].label}</span>
            <span className="mt-1 block text-xs text-ink-subtle">{IMPORT_KINDS[k].fields.map((f) => f.label).slice(0, 4).join('، ')}…</span>
          </button>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-1">
          <CardHeader title="1. الملف" subtitle={def.hint} />
          <div className="space-y-4 p-5">
            <Button
              variant="secondary"
              icon="download"
              onClick={() =>
                downloadTemplate(
                  `قالب ${def.label}`,
                  def.fields.map((f) => f.label),
                  def.example,
                )
              }
            >
              تنزيل قالب {def.label}
            </Button>
            <label className="flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed border-line-strong px-4 py-8 text-center hover:bg-slate-50">
              <span className="text-sm font-medium text-ink">{fileName || 'اختر ملف Excel أو CSV'}</span>
              <span className="text-xs text-ink-subtle">.xlsx أو .csv — أول صف هو عناوين الأعمدة</span>
              <input ref={input} type="file" accept=".xlsx,.csv,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
            </label>

            {sheet && (
              <>
                <div className="space-y-3">
                  <p className="text-sm font-medium text-ink">2. مطابقة الأعمدة</p>
                  {def.fields.map((f) => (
                    <Field key={f.key} label={`${f.label}${f.required ? ' *' : ''}`}>
                      <Select value={mapping[f.key] ?? -1} onChange={(e) => setMapping({ ...mapping, [f.key]: Number(e.target.value) })}>
                        <option value={-1}>— لا يوجد —</option>
                        {sheet.headers.map((h, i) => (
                          <option key={i} value={i}>
                            {h || `عمود ${i + 1}`}
                          </option>
                        ))}
                      </Select>
                    </Field>
                  ))}
                </div>
                <Field label="السجلات الموجودة مسبقاً" hint="تُعرف بالكود أو الباركود أو الهاتف أو الاسم">
                  <Select value={mode} onChange={(e) => setMode(e.target.value as 'skip' | 'update')}>
                    <option value="skip">تخطّيها</option>
                    <option value="update">تحديث بياناتها من الملف</option>
                  </Select>
                </Field>
                {kind === 'products' && (
                  <Field label="المخزن">
                    <Select value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)}>
                      <option value="">— اختر —</option>
                      {warehouses.map((w) => (
                        <option key={w.id} value={w.id}>
                          {w.name}
                        </option>
                      ))}
                    </Select>
                  </Field>
                )}
                {(kind === 'customers' || kind === 'suppliers') && mapping.opening >= 0 && (
                  <Field label="تاريخ الرصيد الافتتاحي">
                    <Input type="date" className="num" value={openingDate} onChange={(e) => setOpeningDate(e.target.value)} />
                  </Field>
                )}
              </>
            )}
          </div>
        </Card>

        <div className="space-y-4 xl:col-span-2">
          {msg && (
            <div className={cx('flex flex-wrap items-center justify-between gap-2 rounded-lg px-4 py-3 text-sm', msg.ok ? 'bg-success-50 text-success-700' : 'bg-danger-50 text-danger-700')}>
              <span>{msg.text}</span>
              {msg.ok && (
                <Link to={KIND_LINK[kind]} className="font-medium underline">
                  عرض {def.label}
                </Link>
              )}
            </div>
          )}
          {sheet ? (
            <>
              <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                <StatCard label="جديد" value={count('new')} tone="success" icon="plus" />
                <StatCard label="تحديث" value={count('update')} tone="info" icon="edit" />
                <StatCard label="تخطٍّ" value={count('skip')} tone="neutral" icon="check" />
                <StatCard label="أخطاء" value={count('error')} tone={count('error') ? 'danger' : 'success'} icon="alert" />
              </div>
              <Card>
                <CardHeader
                  title="3. المعاينة"
                  subtitle={`${prepared.length} سطر في الملف${prepared.length > 300 ? ' — تُعرض أول 300' : ''}. الأسطر التي فيها أخطاء لا تُستورد`}
                  actions={
                    <Button onClick={run} disabled={busy || !toWrite}>
                      {busy ? 'جارٍ الاستيراد...' : `استيراد ${toWrite}`}
                    </Button>
                  }
                />
                <DataTable columns={fieldCols} rows={prepared.slice(0, 300)} rowKey={(r) => String(r.line)} maxHeight="32rem" />
              </Card>
            </>
          ) : (
            <Card className="p-8 text-center text-sm text-ink-subtle">
              نزّل القالب واملأه، أو اختر أي ملف Excel عندك: نطابق أعمدته تلقائياً (بالعربية أو الإنجليزية) وتراجع كل سطر قبل الحفظ.
            </Card>
          )}
        </div>
      </div>
    </>
  );
};

export default Import;
