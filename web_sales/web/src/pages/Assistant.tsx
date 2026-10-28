import React, { useEffect, useMemo, useState } from 'react';
import { ref, update } from 'firebase/database';
import { db } from '../config/firebase';
import { useApp } from '../context/AppContext';
import { watchValue } from '../lib/offlineStore';
import { Badge, Button, Card, CardHeader, EmptyState, PageHeader, cx } from '../components/ui/primitives';
import { formatDate } from '../lib/format';

// جلسات «المدقق» من تطبيق الهاتف: users/{uid}/assistant/chatIndex و chats/{id}.
// التسمية والأرشفة والحذف الناعم تُكتب في نفس العقد فتظهر في الهاتف فوراً.

interface ChatMeta {
  id: string;
  title: string;
  updatedAt: string;
  archived?: boolean;
  deleted?: boolean;
  count?: number;
}

interface Msg {
  role: 'user' | 'assistant';
  text: string;
  attachmentNames?: string[];
}

const Assistant: React.FC = () => {
  const { user } = useApp();
  const uid = user?.uid;
  const [index, setIndex] = useState<Record<string, any> | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [msgs, setMsgs] = useState<Msg[] | null>(null);
  const [showArchived, setShowArchived] = useState(false);

  useEffect(() => (uid ? watchValue(`users/${uid}/assistant/chatIndex`, (v) => setIndex(v || {})) : undefined), [uid]);
  useEffect(() => {
    if (!uid || !selected) return;
    setMsgs(null);
    return watchValue(`users/${uid}/assistant/chats/${selected}`, (v) => {
      const list = Array.isArray(v) ? v : v ? Object.values(v) : [];
      setMsgs(list.filter(Boolean) as Msg[]);
    });
  }, [uid, selected]);

  const chats = useMemo<ChatMeta[]>(
    () =>
      Object.entries(index || {})
        .map(([id, v]: [string, any]) => ({ id, ...v }))
        .filter((c) => !c.deleted)
        .sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt))),
    [index],
  );
  const shown = chats.filter((c) => !!c.archived === showArchived);
  const current = chats.find((c) => c.id === selected);

  const patch = (id: string, v: Partial<ChatMeta>) =>
    uid ? update(ref(db, `users/${uid}/assistant/chatIndex/${id}`), v) : Promise.resolve();

  const rename = (c: ChatMeta) => {
    const t = window.prompt('اسم المحادثة', c.title);
    if (t && t.trim()) patch(c.id, { title: t.trim() });
  };
  const remove = (c: ChatMeta) => {
    if (window.confirm(`حذف «${c.title}»؟`)) {
      patch(c.id, { deleted: true });
      if (selected === c.id) setSelected(null);
    }
  };

  return (
    <>
      <PageHeader title="المدقق" description="جلسات المحادثة مع المساعد من تطبيق الهاتف" />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card>
          <CardHeader
            title={showArchived ? 'المؤرشفة' : 'المحادثات'}
            actions={
              <Button size="sm" variant="secondary" onClick={() => setShowArchived((v) => !v)}>
                {showArchived ? 'النشطة' : 'المؤرشفة'}
              </Button>
            }
          />
          {index === null ? (
            <p className="p-5 text-sm text-ink-subtle">جاري التحميل…</p>
          ) : shown.length === 0 ? (
            <EmptyState icon="sparkle" title="لا محادثات" description="ابدأ محادثة مع «المدقق» من تطبيق الهاتف" />
          ) : (
            <ul className="divide-y divide-slate-100">
              {shown.map((c) => (
                <li key={c.id}>
                  <button
                    onClick={() => setSelected(c.id)}
                    className={cx(
                      'flex w-full items-center justify-between gap-2 px-5 py-3 text-right hover:bg-slate-50',
                      selected === c.id && 'bg-brand-50',
                    )}
                  >
                    <span className="min-w-0">
                      <span className="block truncate font-medium text-ink">{c.title}</span>
                      <span className="text-xs text-ink-subtle">
                        {c.updatedAt ? formatDate(c.updatedAt, { dateStyle: 'medium', timeStyle: 'short' }) : ''} · {c.count || 0} رسالة
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="lg:col-span-2">
          {!current ? (
            <EmptyState icon="sparkle" title="اختر محادثة" description="لعرض رسائلها هنا" />
          ) : (
            <>
              <CardHeader
                title={current.title}
                actions={
                  <div className="flex flex-wrap gap-2">
                    {current.archived && <Badge tone="neutral">مؤرشفة</Badge>}
                    <Button size="sm" variant="secondary" onClick={() => rename(current)}>
                      إعادة تسمية
                    </Button>
                    <Button size="sm" variant="secondary" onClick={() => patch(current.id, { archived: !current.archived })}>
                      {current.archived ? 'إلغاء الأرشفة' : 'أرشفة'}
                    </Button>
                    <Button size="sm" variant="danger" onClick={() => remove(current)}>
                      حذف
                    </Button>
                  </div>
                }
              />
              <div className="max-h-[70vh] space-y-3 overflow-y-auto p-5">
                {msgs === null && <p className="text-sm text-ink-subtle">جاري التحميل…</p>}
                {msgs?.map((m, i) => (
                  <div key={i} className={cx('flex', m.role === 'user' ? 'justify-start' : 'justify-end')}>
                    <div
                      className={cx(
                        'max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-3 text-sm leading-6',
                        m.role === 'user' ? 'bg-brand-600 text-white' : 'bg-slate-100 text-ink',
                      )}
                    >
                      {m.text}
                      {m.attachmentNames?.length ? (
                        <p className="mt-1 text-xs opacity-75">📎 {m.attachmentNames.join('، ')}</p>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </Card>
      </div>
    </>
  );
};

export default Assistant;
