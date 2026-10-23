import React, { useMemo, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Badge, Button, Card, cx } from '../ui/primitives';
import { Field, Input, Select } from '../ui/Form';
import DataTable, { Column } from '../ui/DataTable';
import Modal from '../ui/Modal';
import Icon from '../ui/Icon';
import { useLedger } from '../../context/LedgerContext';
import { invoiceAmounts, useSalesInvoices } from '../../lib/salesInvoices';
import { formatDate, formatNumber } from '../../lib/format';
import { downloadFile } from '../../lib/export';
import {
  DocRecord,
  EinvoiceData,
  Provider,
  STATUS_META,
  SourceType,
  isDone,
  loadDocFile,
  refreshDoc,
  saveEinvoice,
  sourceLabel,
  submitDoc,
} from '../../lib/einvoice';

export interface DocRow {
  key: string;
  source: SourceType;
  number: string;
  kindLabel: string;
  date: string;
  party: string;
  total: number;
  currency: string;
  /** إشعار أو مرتجع: يحتاج مرجع الفاتورة الأصلية */
  needsRef: boolean;
  record?: DocRecord;
}

const FILTERS: { value: string; label: string }[] = [
  { value: 'all', label: 'كل الحالات' },
  { value: 'none', label: 'لم يُرسل' },
  { value: 'problem', label: 'مرفوض أو ناقص' },
  { value: 'pending', label: 'بانتظار الإرسال' },
  { value: 'done', label: 'مقبول' },
];

const DocumentsTab: React.FC<{ uid: string; data: EinvoiceData; provider: Provider; connected: boolean }> = ({ uid, data, provider, connected }) => {
  const { invoices, notes, accountsById, mainCurrency } = useLedger();
  const { invoices: pos, loading } = useSalesInvoices(uid);
  const [source, setSource] = useState<'all' | SourceType>('all');
  const [filter, setFilter] = useState('all');
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState<Set<string>>(new Set());
  const [detail, setDetail] = useState<DocRow | null>(null);
  const [error, setError] = useState<string | null>(null);

  const rows = useMemo<DocRow[]>(() => {
    const out: DocRow[] = [];
    for (const inv of pos) {
      if (inv.status && inv.status !== 'closed') continue;
      out.push({
        key: `pos_${inv.id}`,
        source: 'pos',
        number: String(inv.number || inv.id),
        kindLabel: 'فاتورة نقطة بيع',
        date: inv.createdAt || inv.date || '',
        party: inv.customerName || 'عميل نقدي',
        total: invoiceAmounts(inv).total,
        currency: mainCurrency,
        needsRef: false,
      });
    }
    for (const inv of invoices) {
      if (inv.kind !== 'sale' && inv.kind !== 'saleReturn') continue;
      out.push({
        key: `trade_${inv.id}`,
        source: 'trade',
        number: `${inv.kind === 'sale' ? 'S' : 'SR'}-${inv.number}`,
        kindLabel: inv.kind === 'sale' ? 'فاتورة بيع' : 'مرتجع بيع (إشعار دائن)',
        date: inv.date,
        party: accountsById[inv.partyId]?.name || '—',
        total: inv.totals?.total || 0,
        currency: inv.currency,
        needsRef: inv.kind === 'saleReturn',
      });
    }
    for (const n of notes) {
      out.push({
        key: `note_${n.id}`,
        source: 'note',
        number: `${n.kind === 'debit' ? 'DN' : 'CN'}-${n.number}`,
        kindLabel: n.kind === 'debit' ? 'إشعار مدين' : 'إشعار دائن',
        date: n.date,
        party: accountsById[n.partyId]?.name || '—',
        total: n.amount * (1 + (n.vatPct || 0) / 100),
        currency: n.currency,
        needsRef: true,
      });
    }
    return out
      .map((r) => ({ ...r, record: data.docs[r.key] }))
      .sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  }, [pos, invoices, notes, accountsById, mainCurrency, data.docs]);

  const visible = rows.filter((r) => {
    if (source !== 'all' && r.source !== source) return false;
    const s = r.record?.status;
    if (filter === 'none' && s) return false;
    if (filter === 'problem' && !(s && ['rejected', 'error', 'invalid'].includes(s))) return false;
    if (filter === 'pending' && s !== 'signed') return false;
    if (filter === 'done' && !isDone(s)) return false;
    if (q && !`${r.number} ${r.party}`.toLowerCase().includes(q.toLowerCase())) return false;
    return true;
  });

  const counts = useMemo(() => {
    let done = 0;
    let problems = 0;
    let none = 0;
    for (const r of rows) {
      const s = r.record?.status;
      if (isDone(s)) done++;
      else if (s && ['rejected', 'error', 'invalid'].includes(s)) problems++;
      else none++;
    }
    return { done, problems, none };
  }, [rows]);

  const send = async (r: DocRow) => {
    setError(null);
    setBusy((b) => new Set(b).add(r.key));
    try {
      const rec = r.record?.status === 'submitted' ? await refreshDoc(r.key) : await submitDoc(r.key);
      if (detail?.key === r.key) setDetail({ ...r, record: rec });
    } catch (e: any) {
      setError(`${r.number}: ${e.message}`);
    } finally {
      setBusy((b) => {
        const n = new Set(b);
        n.delete(r.key);
        return n;
      });
    }
  };

  const columns: Array<Column<DocRow>> = [
    {
      key: 'n',
      header: 'المستند',
      render: (r) => (
        <div>
          <span className="num font-medium text-ink">{r.number}</span>
          <span className="block text-[11px] text-ink-subtle">{r.kindLabel}</span>
        </div>
      ),
    },
    { key: 'd', header: 'التاريخ', className: 'w-32', render: (r) => <span className="text-ink-muted">{formatDate(r.date)}</span> },
    { key: 'p', header: 'العميل', render: (r) => r.party },
    {
      key: 't',
      header: 'الإجمالي',
      numeric: true,
      render: (r) => (
        <>
          {formatNumber(r.total)} <span className="text-xs text-ink-subtle">{r.currency}</span>
        </>
      ),
    },
    { key: 's', header: 'الحالة', className: 'w-48', render: (r) => <StatusBadge record={r.record} /> },
    {
      key: 'a',
      header: '',
      className: 'w-44',
      render: (r) => (
        <div className="flex justify-end gap-1">
          <RowAction row={r} connected={connected} busy={busy.has(r.key)} onSend={() => send(r)} />
          <Button size="sm" variant="ghost" icon="search" onClick={() => setDetail(r)} aria-label="التفاصيل" />
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        <Summary label="مقبولة لدى الجهة" value={counts.done} tone="text-success-700" />
        <Summary label="مرفوضة أو بيانات ناقصة" value={counts.problems} tone="text-danger-700" />
        <Summary label="لم تُرسل بعد" value={counts.none} tone="text-ink" />
      </div>

      {!connected && (
        <Card className="flex items-start gap-3 border-warning-200 bg-warning-50 p-4 text-sm text-warning-800">
          <Icon name="alert" size={18} className="mt-0.5 shrink-0" />
          <span>أكمل بيانات المنشأة ثم الربط مع {provider === 'zatca' ? 'ZATCA' : 'منظومة ETA'} من التبويبات أعلاه حتى تتمكن من إرسال المستندات.</span>
        </Card>
      )}
      {error && (
        <Card className="border-danger-200 bg-danger-50 p-3 text-sm text-danger-700" role="alert">
          {error}
        </Card>
      )}

      <Card>
        <div className="flex flex-wrap items-end gap-3 border-b border-line p-4">
          <Field label="المصدر" className="w-[calc(50%-0.375rem)] sm:w-40">
            <Select value={source} onChange={(e) => setSource(e.target.value as any)}>
              <option value="all">الكل</option>
              <option value="pos">نقاط البيع</option>
              <option value="trade">فواتير البيع</option>
              <option value="note">الإشعارات</option>
            </Select>
          </Field>
          <Field label="الحالة" className="w-[calc(50%-0.375rem)] sm:w-44">
            <Select value={filter} onChange={(e) => setFilter(e.target.value)}>
              {FILTERS.map((f) => (
                <option key={f.value} value={f.value}>
                  {f.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="بحث" className="min-w-[12rem] flex-1">
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="رقم المستند أو اسم العميل" />
          </Field>
        </div>
        <DataTable
          columns={columns}
          rows={visible}
          rowKey={(r) => r.key}
          loading={loading}
          maxHeight="65vh"
          empty={{ title: 'لا توجد مستندات', description: 'فواتير البيع ومرتجعاتها والإشعارات وفواتير نقاط البيع تظهر هنا', icon: 'receipt' }}
          mobileCard={(r) => (
            <div className="flex items-center justify-between gap-3 p-3">
              <div className="min-w-0">
                <p className="num font-medium text-ink">{r.number}</p>
                <p className="truncate text-xs text-ink-subtle">
                  {r.party} · {formatDate(r.date)}
                </p>
                <div className="mt-1">
                  <StatusBadge record={r.record} />
                </div>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1">
                <span className="num text-sm">{formatNumber(r.total)}</span>
                <RowAction row={r} connected={connected} busy={busy.has(r.key)} onSend={() => send(r)} />
                <button className="text-xs text-brand-700" onClick={() => setDetail(r)}>
                  التفاصيل
                </button>
              </div>
            </div>
          )}
        />
      </Card>

      {detail && (
        <DocDetail
          uid={uid}
          row={{ ...detail, record: data.docs[detail.key] }}
          override={data.overrides[detail.key] || {}}
          provider={provider}
          connected={connected}
          busy={busy.has(detail.key)}
          onSend={() => send({ ...detail, record: data.docs[detail.key] })}
          onClose={() => setDetail(null)}
        />
      )}
    </div>
  );
};

const Summary: React.FC<{ label: string; value: number; tone: string }> = ({ label, value, tone }) => (
  <Card className="p-3 sm:p-4">
    <p className="text-[11px] leading-tight text-ink-subtle sm:text-xs">{label}</p>
    <p className={cx('num mt-1 text-xl font-semibold sm:text-2xl', tone)}>{value}</p>
  </Card>
);

export const StatusBadge: React.FC<{ record?: DocRecord }> = ({ record }) => {
  const meta = STATUS_META[record?.status || 'none'];
  return (
    <Badge tone={meta.tone} className="whitespace-nowrap">
      {meta.label}
      {record?.profile && <span className="opacity-70">· {record.profile === 'standard' ? 'قياسية' : 'مبسطة'}</span>}
    </Badge>
  );
};

const RowAction: React.FC<{ row: DocRow; connected: boolean; busy: boolean; onSend: () => void }> = ({ row, connected, busy, onSend }) => {
  const s = row.record?.status;
  if (s && ['reported', 'cleared', 'warning', 'valid', 'cancelled'].includes(s)) return null;
  const label = s === 'submitted' ? 'تحديث الحالة' : s === 'signed' ? 'إعادة الإرسال' : s ? 'إرسال مجدداً' : 'إرسال';
  return (
    <Button size="sm" className="whitespace-nowrap" variant={s ? 'secondary' : 'primary'} icon={s === 'submitted' ? 'refresh' : 'share'} disabled={!connected || busy} onClick={onSend}>
      {busy ? 'جارٍ…' : label}
    </Button>
  );
};

const DocDetail: React.FC<{
  uid: string;
  row: DocRow;
  override: { billingRef?: string; billingRefUuid?: string; reason?: string };
  provider: Provider;
  connected: boolean;
  busy: boolean;
  onSend: () => void;
  onClose: () => void;
}> = ({ uid, row, override, provider, connected, busy, onSend, onClose }) => {
  const r = row.record;
  const [ref, setRef] = useState(override.billingRef || '');
  const [refUuid, setRefUuid] = useState(override.billingRefUuid || '');
  const [reason, setReason] = useState(override.reason || '');
  const [saved, setSaved] = useState(false);
  const editable = !r || !isDone(r.status);

  const saveOverride = async () => {
    await saveEinvoice(uid, { [`overrides/${row.key}`]: { billingRef: ref.trim(), billingRefUuid: refUuid.trim(), reason: reason.trim() } });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const download = async () => {
    const content = await loadDocFile(uid, row.key);
    if (!content) return;
    const isJson = r?.provider === 'eta';
    downloadFile(`${row.number}.${isJson ? 'json' : 'xml'}`, content, isJson ? 'application/json' : 'application/xml');
  };

  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      title={`${row.kindLabel} ${row.number}`}
      subtitle={`${sourceLabel[row.source]} · ${row.party} · ${formatNumber(row.total)} ${row.currency}`}
      footer={
        <>
          {r?.hash || r?.uuid ? (
            <Button variant="secondary" icon="download" onClick={download}>
              تنزيل الملف المرسل
            </Button>
          ) : null}
          {editable && (
            <Button icon="share" disabled={!connected || busy} onClick={onSend}>
              {busy ? 'جارٍ الإرسال…' : r ? 'إرسال مجدداً' : 'إرسال الآن'}
            </Button>
          )}
        </>
      }
    >
      <div className="space-y-5">
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge record={r} />
          {r?.env && <Badge tone="neutral">{envLabel(r.env)}</Badge>}
        </div>

        {r?.messages?.length ? (
          <ul className="space-y-1.5">
            {r.messages.map((m, i) => (
              <li
                key={i}
                className={cx(
                  'rounded-lg px-3 py-2 text-sm',
                  m.level === 'error' ? 'bg-danger-50 text-danger-800' : m.level === 'warning' ? 'bg-warning-50 text-warning-800' : 'bg-slate-50 text-ink-muted',
                )}
              >
                {m.code && <span className="num me-1 font-medium" dir="ltr">{m.code}</span>}
                {m.text}
              </li>
            ))}
          </ul>
        ) : null}

        {r && (
          <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
            {r.uuid && <Info label="المعرّف (UUID)" value={r.uuid} mono />}
            {r.icv && <Info label="عدّاد الفاتورة (ICV)" value={String(r.icv)} mono />}
            {r.hash && <Info label="البصمة (Hash)" value={r.hash} mono />}
            {r.longId && <Info label="Long ID" value={r.longId} mono />}
            {r.total !== undefined && <Info label="الإجمالي المرسل" value={formatNumber(r.total)} />}
            {r.tax !== undefined && <Info label="الضريبة" value={formatNumber(r.tax)} />}
            {r.acceptedAt && <Info label="وقت القبول" value={formatDate(r.acceptedAt, { dateStyle: 'medium', timeStyle: 'short' })} />}
          </dl>
        )}

        {(r?.qr || r?.publicUrl) && (
          <div className="flex flex-wrap items-center gap-5 rounded-xl border border-line p-4">
            <QRCodeSVG value={r.qr || r.publicUrl!} size={150} />
            <div className="text-sm text-ink-muted">
              <p className="font-medium text-ink">رمز QR للطباعة</p>
              <p className="mt-1">{provider === 'zatca' ? 'يتضمن التوقيع الإلكتروني (المرحلة الثانية) ويُطبع على الفاتورة.' : 'رابط المستند في بوابة منظومة الفاتورة الإلكترونية.'}</p>
              {r.publicUrl && (
                <a href={r.publicUrl} target="_blank" rel="noreferrer" className="mt-2 inline-block text-brand-700 hover:underline">
                  فتح في بوابة ETA
                </a>
              )}
            </div>
          </div>
        )}

        {row.needsRef && editable && (
          <div className="rounded-xl border border-line p-4">
            <p className="mb-3 text-sm font-medium text-ink">مرجع الفاتورة الأصلية</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="رقم الفاتورة الأصلية">
                <Input value={ref} onChange={(e) => setRef(e.target.value)} placeholder="مثل S-12" />
              </Field>
              {provider === 'eta' && (
                <Field label="UUID الفاتورة الأصلية في ETA">
                  <Input value={refUuid} onChange={(e) => setRefUuid(e.target.value)} dir="ltr" />
                </Field>
              )}
              <Field label="سبب الإشعار" className="sm:col-span-2">
                <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="مثل: إرجاع بضاعة، تعديل سعر" />
              </Field>
            </div>
            <div className="mt-3 flex items-center gap-3">
              <Button size="sm" variant="secondary" onClick={saveOverride}>
                حفظ
              </Button>
              {saved && <span className="text-xs text-success-700">تم الحفظ</span>}
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
};

const envLabel = (env: string) =>
  ({ sandbox: 'بيئة المطورين', simulation: 'بيئة المحاكاة', production: 'الإنتاج', preprod: 'البيئة التجريبية' })[env] || env;

const Info: React.FC<{ label: string; value: string; mono?: boolean }> = ({ label, value, mono }) => (
  <div className="min-w-0">
    <dt className="text-xs text-ink-subtle">{label}</dt>
    <dd className={cx('truncate text-ink', mono && 'num text-xs')} dir={mono ? 'ltr' : undefined} title={value}>
      {value}
    </dd>
  </div>
);

export default DocumentsTab;
