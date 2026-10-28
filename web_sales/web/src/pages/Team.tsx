import React, { useEffect, useMemo, useState } from 'react';
import { Badge, Button, Card, CardHeader, PageHeader, cx } from '../components/ui/primitives';
import { Field, Input, Select } from '../components/ui/Form';
import Modal from '../components/ui/Modal';
import DataTable, { Column } from '../components/ui/DataTable';
import { useApp } from '../context/AppContext';
import { usePos } from '../context/PosContext';
import { AREAS, Level, LEVEL_LABELS, Perms, ROLES, TeamMember, TeamRole } from '../lib/team';
import { createMember, MemberDraft, resetPassword, saveMember, setMemberActive, useTeam } from '../lib/teamApi';

interface Row {
  uid: string;
  name: string;
  email: string;
  member?: TeamMember;
  /** موظف نقطة بيع بلا سجل في الفريق */
  posRole?: string;
  branchId?: string | null;
}

const ROLE_ORDER: TeamRole[] = ['accountant', 'branchManager', 'cashier', 'viewer'];
const ROLE_TONE: Record<TeamRole, 'brand' | 'info' | 'warning' | 'neutral'> = {
  accountant: 'brand',
  branchManager: 'info',
  cashier: 'warning',
  viewer: 'neutral',
};

const PermMatrix: React.FC<{ perms: Perms; onChange: (p: Perms) => void; disabled?: boolean }> = ({ perms, onChange, disabled }) => (
  <div className="divide-y divide-line rounded-lg border border-line">
    {AREAS.map((a) => (
      <div key={a.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5">
        <div className="min-w-0">
          <p className="text-sm font-medium text-ink">{a.label}</p>
          <p className="text-xs text-ink-subtle">{a.hint}</p>
        </div>
        <div className="inline-flex rounded-lg border border-line bg-slate-50 p-0.5">
          {(a.viewOnly ? (['none', 'view'] as Level[]) : (['none', 'view', 'edit'] as Level[])).map((l) => (
            <button
              key={l}
              type="button"
              disabled={disabled}
              onClick={() => onChange({ ...perms, [a.id]: l })}
              className={cx(
                'h-7 rounded-md px-3 text-xs font-medium transition',
                perms[a.id] === l ? (l === 'edit' ? 'bg-brand-600 text-white' : l === 'view' ? 'bg-white text-ink shadow-sm' : 'bg-slate-200 text-ink') : 'text-ink-muted',
              )}
            >
              {LEVEL_LABELS[l]}
            </button>
          ))}
        </div>
      </div>
    ))}
  </div>
);

const MemberModal: React.FC<{ open: boolean; onClose: () => void; row: Row | null }> = ({ open, onClose, row }) => {
  const { ownerUid, actor } = useApp();
  const { branches, registers } = usePos();
  const existing = row?.member;
  const isNew = !row;
  const [d, setD] = useState<MemberDraft>({ name: '', email: '', role: 'accountant', perms: ROLES.accountant.perms });
  const [password, setPassword] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setErr('');
    setPassword('');
    if (existing)
      setD({ name: existing.name, email: existing.email, phone: existing.phone || '', role: existing.role, perms: existing.perms, branchId: existing.branchId, cashRegisterId: existing.cashRegisterId });
    else if (row) {
      const role: TeamRole = row.posRole === 'manager' ? 'branchManager' : 'cashier';
      setD({ name: row.name, email: row.email, role, perms: ROLES[role].perms, branchId: row.branchId });
    } else setD({ name: '', email: '', phone: '', role: 'accountant', perms: ROLES.accountant.perms, branchId: null, cashRegisterId: null });
  }, [open, existing, row]);

  const needsBranch = d.role === 'branchManager' || d.role === 'cashier';
  const branchRegisters = registers.filter((r) => r.branchId === d.branchId);

  const submit = async () => {
    setErr('');
    if (!d.name.trim()) return setErr('أدخل الاسم');
    if (isNew && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(d.email.trim())) return setErr('أدخل إيميلاً صحيحاً');
    if (isNew && password.length < 6) return setErr('كلمة المرور 6 أحرف على الأقل');
    if (needsBranch && !d.branchId) return setErr('اختر الفرع');
    if (d.role === 'cashier' && !d.cashRegisterId) return setErr('اختر صندوق الكاشير');
    if (!ownerUid || !actor) return;
    setBusy(true);
    try {
      if (isNew) await createMember(ownerUid, actor, d, password);
      else await saveMember(ownerUid, actor, row!.uid, d, existing);
      onClose();
    } catch (e: any) {
      setErr(e?.message || 'تعذّر الحفظ');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title={isNew ? 'إضافة عضو للفريق' : `صلاحيات ${row?.name || ''}`}
      subtitle={isNew ? 'يُنشأ له حساب دخول بالإيميل وكلمة المرور، ويرى بياناتك حسب الصلاحيات التي تحددها' : row?.email}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            إلغاء
          </Button>
          <Button onClick={submit} disabled={busy}>
            {busy ? 'جارٍ الحفظ...' : isNew ? 'إنشاء الحساب' : 'حفظ'}
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        {isNew && (
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="الاسم">
              <Input value={d.name} onChange={(e) => setD({ ...d, name: e.target.value })} />
            </Field>
            <Field label="الهاتف (اختياري)">
              <Input dir="ltr" value={d.phone || ''} onChange={(e) => setD({ ...d, phone: e.target.value })} />
            </Field>
            <Field label="الإيميل">
              <Input dir="ltr" type="email" value={d.email} onChange={(e) => setD({ ...d, email: e.target.value })} />
            </Field>
            <Field label="كلمة المرور">
              <Input dir="ltr" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
            </Field>
          </div>
        )}

        <div>
          <p className="mb-2 text-sm font-medium text-ink">الدور</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {ROLE_ORDER.map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setD({ ...d, role: r, perms: ROLES[r].perms })}
                className={cx(
                  'rounded-lg border p-3 text-start transition',
                  d.role === r ? 'border-brand-500 bg-brand-50 ring-1 ring-brand-500' : 'border-line hover:bg-slate-50',
                )}
              >
                <span className="block text-sm font-semibold text-ink">{ROLES[r].label}</span>
                <span className="block text-xs text-ink-subtle">{ROLES[r].description}</span>
              </button>
            ))}
          </div>
        </div>

        {needsBranch && (
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="الفرع">
              <Select value={d.branchId || ''} onChange={(e) => setD({ ...d, branchId: e.target.value || null, cashRegisterId: null })}>
                <option value="">— اختر —</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </Select>
            </Field>
            {d.role === 'cashier' && (
              <Field label="الصندوق">
                <Select value={d.cashRegisterId || ''} onChange={(e) => setD({ ...d, cashRegisterId: e.target.value || null })}>
                  <option value="">— اختر —</option>
                  {branchRegisters.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </Select>
              </Field>
            )}
          </div>
        )}

        {d.role === 'cashier' ? (
          <p className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-ink-muted">الكاشير يرى شاشة البيع على صندوقه فقط، من الويب أو تطبيق الهاتف.</p>
        ) : (
          <div>
            <p className="mb-2 text-sm font-medium text-ink">الصلاحيات المفصلة</p>
            <PermMatrix perms={d.perms} onChange={(perms) => setD({ ...d, perms })} />
          </div>
        )}
        {err && <p className="rounded-lg bg-danger-50 px-3 py-2 text-sm text-danger-700">{err}</p>}
      </div>
    </Modal>
  );
};

// الفريق والصلاحيات: حسابات المحاسب ومدير الفرع والكاشير والمدقق (للمالك فقط)
const Team: React.FC = () => {
  const { ownerUid, actor } = useApp();
  const { employees, branches } = usePos();
  const { members, denied } = useTeam(ownerUid);
  const [edit, setEdit] = useState<{ row: Row | null } | null>(null);
  const [msg, setMsg] = useState('');

  const rows: Row[] = useMemo(() => {
    const byUid = new Map(members.map((m) => [m.uid, m]));
    const out: Row[] = members.map((m) => ({ uid: m.uid, name: m.name, email: m.email, member: m, branchId: m.branchId }));
    employees
      .filter((e) => e.role !== 'owner' && !byUid.has(e.uid))
      .forEach((e) => out.push({ uid: e.uid, name: e.name, email: e.email, posRole: e.role, branchId: e.branchId }));
    return out;
  }, [members, employees]);

  const branchName = (id?: string | null) => branches.find((b) => b.id === id)?.name || '';

  const columns: Column<Row>[] = [
    {
      key: 'n',
      header: 'العضو',
      render: (r) => (
        <div>
          <p className="font-medium text-ink">{r.name || '—'}</p>
          <p className="text-xs text-ink-subtle" dir="ltr">
            {r.email}
          </p>
        </div>
      ),
    },
    {
      key: 'r',
      header: 'الدور',
      render: (r) =>
        r.member ? (
          <Badge tone={ROLE_TONE[r.member.role]}>{ROLES[r.member.role].label}</Badge>
        ) : (
          <Badge tone="neutral">{r.posRole === 'manager' ? 'مدير فرع (نقطة بيع)' : 'كاشير (نقطة بيع)'}</Badge>
        ),
    },
    { key: 'b', header: 'الفرع', render: (r) => branchName(r.branchId) || '—' },
    {
      key: 's',
      header: 'الحالة',
      render: (r) => (r.member ? <Badge tone={r.member.active ? 'success' : 'danger'}>{r.member.active ? 'نشط' : 'موقوف'}</Badge> : <span className="text-xs text-ink-subtle">صلاحيات نقطة البيع</span>),
    },
    {
      key: 'a',
      header: '',
      render: (r) => (
        <div className="flex flex-wrap justify-end gap-1">
          <Button size="sm" variant="secondary" onClick={() => setEdit({ row: r })}>
            {r.member ? 'الصلاحيات' : 'منح صلاحيات'}
          </Button>
          {r.member && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => ownerUid && actor && setMemberActive(ownerUid, actor, r.member!, !r.member!.active).catch((e) => setMsg(e.message))}
            >
              {r.member.active ? 'إيقاف' : 'تفعيل'}
            </Button>
          )}
          {r.email && (
            <Button
              size="sm"
              variant="ghost"
              title="يصله رابط لتعيين كلمة مرور جديدة"
              onClick={() =>
                resetPassword(r.email)
                  .then(() => setMsg(`أُرسل رابط تغيير كلمة المرور إلى ${r.email}`))
                  .catch((e) => setMsg(e.message))
              }
            >
              كلمة المرور
            </Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="الفريق والصلاحيات"
        description="أضف محاسباً أو مدير فرع أو كاشيراً أو مدققاً، وحدد ما يراه وما يعدّله. كل تعديل يُسجَّل باسم صاحبه في سجل التعديلات"
        actions={
          <Button icon="plus" onClick={() => setEdit({ row: null })}>
            إضافة عضو
          </Button>
        }
      />
      {denied && (
        <Card className="mb-6 border-warning-100 bg-warning-50 p-4 text-sm text-warning-700">
          قواعد الفريق لم تُنشر بعد على Firebase، فلا يمكن إضافة أعضاء ولا يعمل سجل التعديلات. انشر ملف <span dir="ltr">firebase/database.rules.json</span> (
          <span dir="ltr">firebase deploy --only database</span>).
        </Card>
      )}
      {msg && <p className="mb-4 rounded-lg bg-info-50 px-3 py-2 text-sm text-info-700">{msg}</p>}
      <Card>
        <CardHeader title={`الأعضاء (${rows.length})`} subtitle="موظفو نقطة البيع الحاليون يظهرون هنا أيضاً، ويمكنك منحهم صلاحيات أوسع" />
        <DataTable
          columns={columns}
          rows={rows}
          rowKey={(r) => r.uid}
          empty={{ title: 'لا يوجد أعضاء بعد', description: 'أضف أول عضو في فريقك', icon: 'users' }}
          mobileCard={(r) => (
            <div className="space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-medium text-ink">{r.name}</p>
                  <p className="text-xs text-ink-subtle" dir="ltr">
                    {r.email}
                  </p>
                </div>
                {r.member ? <Badge tone={ROLE_TONE[r.member.role]}>{ROLES[r.member.role].label}</Badge> : <Badge>نقطة بيع</Badge>}
              </div>
              <Button size="sm" variant="secondary" onClick={() => setEdit({ row: r })}>
                {r.member ? 'الصلاحيات' : 'منح صلاحيات'}
              </Button>
            </div>
          )}
        />
      </Card>

      <Card className="mt-6">
        <CardHeader title="الأدوار الجاهزة" subtitle="نقطة بداية: يمكنك تعديل صلاحيات أي عضو قسماً قسماً" />
        <div className="grid gap-3 p-5 sm:grid-cols-2 xl:grid-cols-4">
          {ROLE_ORDER.map((r) => (
            <div key={r} className="rounded-lg border border-line p-4">
              <Badge tone={ROLE_TONE[r]}>{ROLES[r].label}</Badge>
              <p className="mt-2 text-sm text-ink-muted">{ROLES[r].description}</p>
              <ul className="mt-3 space-y-1 text-xs text-ink-subtle">
                {AREAS.filter((a) => ROLES[r].perms[a.id] !== 'none').map((a) => (
                  <li key={a.id}>
                    {a.label}: <span className={ROLES[r].perms[a.id] === 'edit' ? 'font-semibold text-brand-700' : ''}>{LEVEL_LABELS[ROLES[r].perms[a.id]]}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </Card>

      <MemberModal open={!!edit} onClose={() => setEdit(null)} row={edit?.row || null} />
    </>
  );
};

export default Team;
