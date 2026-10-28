import React, { useEffect, useMemo, useState } from 'react';
import { limitToLast, onValue, orderByChild, query, ref } from 'firebase/database';
import { Badge, Button, Card, PageHeader } from '../components/ui/primitives';
import { Field, Input, Select } from '../components/ui/Form';
import Modal from '../components/ui/Modal';
import DataTable, { Column } from '../components/ui/DataTable';
import { db } from '../config/firebase';
import { useApp } from '../context/AppContext';
import { AuditEntry, ROLE_NAMES } from '../lib/audit';
import { AREAS } from '../lib/team';
import { formatDate } from '../lib/format';
import { downloadFile } from '../lib/export';

const PAGE = 300;

const pretty = (s?: string | null) => {
  if (s == null) return '—';
  try {
    return JSON.stringify(JSON.parse(s), null, 2);
  } catch {
    return s;
  }
};

const areaLabel = (a: string) => AREAS.find((x) => x.id === a)?.label || a;

const DetailModal: React.FC<{ entry: AuditEntry | null; onClose: () => void }> = ({ entry, onClose }) => (
  <Modal
    open={!!entry}
    onClose={onClose}
    size="xl"
    title={entry?.action || ''}
    subtitle={entry ? `${entry.name || entry.uid} · ${ROLE_NAMES[entry.role] || entry.role} · ${formatDate(entry.at, { dateStyle: 'medium', timeStyle: 'medium' })}` : ''}
  >
    <div className="space-y-4">
      {entry?.changes?.map((c) => (
        <div key={c.path} className="rounded-lg border border-line">
          <p className="border-b border-line px-3 py-2 text-xs text-ink-subtle" dir="ltr">
            {c.path}
          </p>
          <div className="grid gap-px bg-line md:grid-cols-2">
            <div className="bg-danger-50/40 p-3">
              <p className="mb-1 text-xs font-semibold text-danger-700">قبل</p>
              <pre className="max-h-72 overflow-auto whitespace-pre-wrap break-all text-xs text-ink" dir="ltr">
                {pretty(c.before)}
              </pre>
            </div>
            <div className="bg-success-50/40 p-3">
              <p className="mb-1 text-xs font-semibold text-success-700">بعد</p>
              <pre className="max-h-72 overflow-auto whitespace-pre-wrap break-all text-xs text-ink" dir="ltr">
                {pretty(c.after)}
              </pre>
            </div>
          </div>
        </div>
      ))}
      {!!entry?.more && <p className="text-xs text-ink-subtle">و {entry.more} تغييرات أخرى في نفس العملية</p>}
    </div>
  </Modal>
);

// سجل التعديلات: كل حفظ من الويب باسم صاحبه، مع القيمة قبل وبعد
const Audit: React.FC = () => {
  const { ownerUid } = useApp();
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [denied, setDenied] = useState(false);
  const [who, setWho] = useState('');
  const [area, setArea] = useState('');
  const [q, setQ] = useState('');
  const [open, setOpen] = useState<AuditEntry | null>(null);

  useEffect(() => {
    if (!ownerUid) return;
    return onValue(
      query(ref(db, `audit/${ownerUid}`), orderByChild('at'), limitToLast(PAGE)),
      (snap) => {
        const list: AuditEntry[] = [];
        snap.forEach((c) => {
          list.push({ ...(c.val() as AuditEntry), id: c.key! });
        });
        setEntries(list.reverse());
        setLoading(false);
        setDenied(false);
      },
      () => {
        setDenied(true);
        setLoading(false);
      },
    );
  }, [ownerUid]);

  const people = useMemo(() => Array.from(new Map(entries.map((e) => [e.uid, e.name || e.uid])).entries()), [entries]);
  const shown = entries.filter(
    (e) => (!who || e.uid === who) && (!area || e.area === area) && (!q || `${e.action} ${e.name} ${JSON.stringify(e.changes || [])}`.includes(q)),
  );

  const exportCsv = () => {
    const rows = [['الوقت', 'المستخدم', 'الدور', 'القسم', 'العملية'], ...shown.map((e) => [new Date(e.at).toISOString(), e.name, ROLE_NAMES[e.role] || e.role, areaLabel(e.area), e.action])];
    const csv = '﻿' + rows.map((r) => r.map((c) => `"${String(c ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
    downloadFile('audit-log.csv', csv, 'text/csv;charset=utf-8');
  };

  const columns: Column<AuditEntry>[] = [
    {
      key: 't',
      header: 'الوقت',
      render: (e) => (
        <div className="num whitespace-nowrap text-xs">
          <p className="text-ink">{formatDate(e.at, { dateStyle: 'medium' })}</p>
          <p className="text-ink-subtle">{formatDate(e.at, { timeStyle: 'short' })}</p>
        </div>
      ),
    },
    {
      key: 'u',
      header: 'المستخدم',
      render: (e) => (
        <div>
          <p className="text-sm text-ink">{e.name || '—'}</p>
          <p className="text-xs text-ink-subtle">{ROLE_NAMES[e.role] || e.role}</p>
        </div>
      ),
    },
    { key: 'a', header: 'القسم', render: (e) => <Badge>{areaLabel(e.area)}</Badge> },
    { key: 'x', header: 'العملية', render: (e) => <span className="text-sm text-ink">{e.action}</span> },
  ];

  return (
    <>
      <PageHeader
        title="سجل التعديلات"
        description="من غيّر ماذا ومتى من الويب، مع القيمة قبل التعديل وبعده. السجل للإضافة فقط ولا يمكن تعديله أو حذفه"
        actions={
          <Button variant="secondary" icon="download" onClick={exportCsv} disabled={!shown.length}>
            تصدير
          </Button>
        }
      />
      {denied && (
        <Card className="mb-6 border-warning-100 bg-warning-50 p-4 text-sm text-warning-700">
          لا يمكن قراءة السجل: قواعد Firebase الجديدة لم تُنشر بعد (<span dir="ltr">firebase deploy --only database</span>)، أو ليس لديك صلاحية عرضه.
        </Card>
      )}
      <Card className="mb-4 p-4">
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="المستخدم">
            <Select value={who} onChange={(e) => setWho(e.target.value)}>
              <option value="">الكل</option>
              {people.map(([uid, name]) => (
                <option key={uid} value={uid}>
                  {name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="القسم">
            <Select value={area} onChange={(e) => setArea(e.target.value)}>
              <option value="">الكل</option>
              {AREAS.filter((a) => a.id !== 'audit' && a.id !== 'reports').map((a) => (
                <option key={a.id} value={a.id}>
                  {a.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="بحث">
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="اسم حساب، رقم فاتورة، مبلغ..." />
          </Field>
        </div>
      </Card>
      <Card>
        <DataTable
          columns={columns}
          rows={shown}
          rowKey={(e) => e.id}
          loading={loading}
          onRowClick={setOpen}
          empty={{ title: 'لا توجد تعديلات مسجلة', description: 'تظهر هنا كل عملية حفظ من الويب', icon: 'history' }}
          mobileCard={(e) => (
            <div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium text-ink">{e.action}</span>
                <Badge>{areaLabel(e.area)}</Badge>
              </div>
              <p className="mt-1 text-xs text-ink-subtle">
                {e.name} · {formatDate(e.at, { dateStyle: 'short', timeStyle: 'short' })}
              </p>
            </div>
          )}
        />
        {entries.length >= PAGE && <p className="border-t border-line px-4 py-2 text-xs text-ink-subtle">يُعرض آخر {PAGE} تعديل</p>}
      </Card>
      <DetailModal entry={open} onClose={() => setOpen(null)} />
    </>
  );
};

export default Audit;
