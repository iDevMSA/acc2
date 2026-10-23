import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Badge, Button, Card, CardHeader, PageHeader, cx } from '../components/ui/primitives';
import { Input } from '../components/ui/Form';
import { ConfirmModal } from '../components/ui/Modal';
import Icon from '../components/ui/Icon';
import Kbd from '../components/ui/Kbd';
import { useShortcuts } from '../context/ShortcutsContext';
import { SHORTCUT_ACTIONS, SHORTCUT_GROUPS, ShortcutAction, actionById, comboFromEvent, validateCombo } from '../lib/shortcuts';

// نافذة اختصارات لوحة المفاتيح: عرض كل الأوامر، تسجيل اختصار جديد بالضغط عليه، كشف التعارض، والعودة للافتراضي.

interface Pending {
  id: string;
  combo: string;
  /** الأمر الذي يستخدم نفس الاختصار حالياً */
  takenBy: string;
}

const ShortcutsSettings: React.FC = () => {
  const { bindings, conflicts, setBinding, resetBinding, resetAll, setPaused } = useShortcuts();
  const [recording, setRecording] = useState<string | null>(null);
  const [error, setError] = useState<{ id: string; message: string } | null>(null);
  const [pending, setPending] = useState<Pending | null>(null);
  const [q, setQ] = useState('');
  const [confirmReset, setConfirmReset] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);

  const say = (m: string) => {
    setFlash(m);
    setTimeout(() => setFlash(null), 2500);
  };

  const run = (p: Promise<void>, m: string) =>
    p.then(() => say(m)).catch((e) => setError({ id: recording || '', message: e?.message || 'تعذّر الحفظ' }));

  // أثناء التسجيل: نلتقط أول اختصار كامل ونوقف بقية الاختصارات حتى لا يُنفَّذ ما يضغطه المستخدم
  useEffect(() => {
    if (!recording) return;
    setPaused(true);
    const onKey = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (e.code === 'Escape' && !e.ctrlKey && !e.altKey && !e.shiftKey && !e.metaKey) {
        setRecording(null);
        return;
      }
      const combo = comboFromEvent(e);
      if (!combo) return; // مفتاح تعديل وحده: ننتظر بقية الاختصار
      const invalid = validateCombo(combo);
      if (invalid) {
        setError({ id: recording, message: `${combo}: ${invalid}` });
        return;
      }
      setError(null);
      setRecording(null);
      if (bindings[recording] === combo) return;
      const takenBy = Object.keys(bindings).find((k) => k !== recording && bindings[k] === combo);
      if (takenBy) setPending({ id: recording, combo, takenBy });
      else run(setBinding(recording, combo), 'تم حفظ الاختصار');
    };
    window.addEventListener('keydown', onKey, true);
    return () => {
      window.removeEventListener('keydown', onKey, true);
      setPaused(false);
    };
  }, [recording, bindings]); // eslint-disable-line react-hooks/exhaustive-deps

  const conflictIds = useMemo(() => new Set(Object.values(conflicts).flat()), [conflicts]);
  const changedCount = SHORTCUT_ACTIONS.filter((a) => bindings[a.id] !== a.defaultCombo).length;

  const visible = (a: ShortcutAction) => {
    const s = q.trim().toLowerCase();
    return !s || a.label.toLowerCase().includes(s) || (bindings[a.id] || '').toLowerCase().includes(s);
  };

  const startRecording = (id: string) => {
    setPending(null);
    setError(null);
    setRecording(id);
  };

  return (
    <>
      <PageHeader
        title="اختصارات لوحة المفاتيح"
        description="غيّر اختصار أي أمر بالضغط على «تعديل» ثم على المفاتيح الجديدة. تُحفظ الاختصارات لحسابك وتعمل على أي جهاز تدخل منه."
        actions={
          <>
            <Link to="/settings" className="inline-flex h-10 items-center gap-2 rounded-lg px-3 text-sm text-ink-muted hover:bg-slate-100">
              <Icon name="chevronLeft" size={16} className="rotate-180" />
              الإعدادات
            </Link>
            <Button variant="secondary" icon="refresh" disabled={!changedCount} onClick={() => setConfirmReset(true)}>
              استعادة الافتراضي
            </Button>
          </>
        }
      />

      {flash && (
        <p className="mb-4 flex items-center gap-2 rounded-lg bg-success-50 px-4 py-3 text-sm text-success-700">
          <Icon name="check" size={16} /> {flash}
        </p>
      )}

      {Object.keys(conflicts).length > 0 && (
        <div className="mb-4 flex items-start gap-3 rounded-xl border border-warning-100 bg-warning-50 p-4 text-sm text-warning-700">
          <Icon name="alert" size={18} className="mt-0.5 shrink-0" />
          <div>
            <p className="font-semibold">يوجد اختصار مستخدم لأكثر من أمر</p>
            <ul className="mt-1 space-y-0.5 text-xs">
              {Object.entries(conflicts).map(([c, ids]) => (
                <li key={c}>
                  <span dir="ltr" className="num font-semibold">
                    {c}
                  </span>{' '}
                  : {ids.map((i) => actionById(i)?.label).join('، ')} — يُنفَّذ الأول فقط، عدّل أحدها.
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative w-full max-w-xs">
          <Icon name="search" size={16} className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-ink-subtle" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="ابحث عن أمر أو اختصار" className="ps-9" />
        </div>
        <p className="text-xs text-ink-subtle">
          اضغط <Kbd combo={bindings.help || 'Ctrl+/'} size="sm" /> في أي مكان لعرض الاختصارات.
          {changedCount > 0 && <> · غيّرت {changedCount} اختصار</>}
        </p>
      </div>

      <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-2">
        {[SHORTCUT_GROUPS.filter((g) => g !== 'التنقل'), ['التنقل' as const]].map((col, ci) => (
          <div key={ci} className="space-y-6">
            {col.map((g) => {
              const rows = SHORTCUT_ACTIONS.filter((a) => a.group === g && visible(a));
              if (!rows.length) return null;
              return (
                <Card key={g}>
                  <CardHeader title={g} subtitle={GROUP_HINTS[g]} />
                  <ul className="divide-y divide-line">
                    {rows.map((a) => {
                      const combo = bindings[a.id];
                      const isRec = recording === a.id;
                      const changed = combo !== a.defaultCombo;
                      const rowPending = pending?.id === a.id ? pending : null;
                      const rowError = error?.id === a.id ? error.message : null;
                      return (
                        <li key={a.id} className={cx('px-5 py-3', isRec && 'bg-brand-50/60')}>
                          <div className="flex flex-wrap items-center gap-3">
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-medium text-ink">{a.label}</p>
                              <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11px] text-ink-subtle">
                                {changed && <Badge tone="info">معدّل</Badge>}
                                {conflictIds.has(a.id) && <Badge tone="warning">متعارض</Badge>}
                                {changed && (
                                  <span>الافتراضي: {a.defaultCombo ? <Kbd combo={a.defaultCombo} size="sm" /> : 'بلا اختصار'}</span>
                                )}
                              </div>
                            </div>
                            <button
                              onClick={() => (isRec ? setRecording(null) : startRecording(a.id))}
                              title="اضغط ثم اكتب الاختصار الجديد"
                              className={cx(
                                'flex h-9 min-w-[9rem] items-center justify-center rounded-lg border px-3 text-xs transition',
                                isRec
                                  ? 'animate-pulse border-brand-400 bg-surface text-brand-700 ring-2 ring-brand-100'
                                  : 'border-line hover:border-brand-300',
                              )}
                            >
                              {isRec ? (
                                'اضغط الاختصار الآن…'
                              ) : combo ? (
                                <Kbd combo={combo} />
                              ) : (
                                <span className="text-ink-faint">بلا اختصار</span>
                              )}
                            </button>
                            <div className="flex items-center gap-1">
                              <IconBtn icon="edit" label="تعديل" onClick={() => startRecording(a.id)} />
                              {combo && (
                                <IconBtn icon="trash" label="إزالة الاختصار" onClick={() => run(setBinding(a.id, ''), 'أُزيل الاختصار')} />
                              )}
                              {changed && (
                                <IconBtn
                                  icon="refresh"
                                  label="الافتراضي"
                                  onClick={() => run(resetBinding(a.id), 'أُعيد الاختصار الافتراضي')}
                                />
                              )}
                            </div>
                          </div>
                          {isRec && (
                            <p className="mt-2 text-xs text-brand-700">اضغط المفاتيح معاً (مثل Ctrl+Shift+N أو F2) — Esc للإلغاء</p>
                          )}
                          {rowError && <p className="mt-2 text-xs text-danger-600">{rowError}</p>}
                          {rowPending && (
                            <div className="mt-2 flex flex-wrap items-center gap-2 rounded-lg bg-warning-50 px-3 py-2 text-xs text-warning-700">
                              <Kbd combo={rowPending.combo} size="sm" />
                              <span>مستخدم لـ «{actionById(rowPending.takenBy)?.label}».</span>
                              <Button
                                size="sm"
                                onClick={() => {
                                  setPending(null);
                                  run(setBinding(rowPending.id, rowPending.combo, { replace: true }), 'تم نقل الاختصار لهذا الأمر');
                                }}
                              >
                                استخدمه هنا وأزله من هناك
                              </Button>
                              <Button size="sm" variant="ghost" onClick={() => setPending(null)}>
                                إلغاء
                              </Button>
                            </div>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </Card>
              );
            })}
          </div>
        ))}
      </div>

      <p className="mt-6 text-xs leading-5 text-ink-subtle">
        تعمل الاختصارات التي فيها Ctrl أو Alt أو مفاتيح F1–F12 حتى أثناء الكتابة في الحقول. بعض الاختصارات يحجزها المتصفح (مثل Ctrl+W و
        Ctrl+T و F5) فلا يمكن استخدامها. على ماك يقوم ⌘ مقام Ctrl.
      </p>

      <ConfirmModal
        open={confirmReset}
        onClose={() => setConfirmReset(false)}
        title="استعادة الاختصارات الافتراضية"
        message={`ستُلغى تعديلاتك على ${changedCount} اختصار وتعود كل الاختصارات كما كانت.`}
        confirmLabel="استعادة"
        onConfirm={() => run(resetAll(), 'عادت كل الاختصارات للافتراضي')}
      />
    </>
  );
};

const GROUP_HINTS: Record<string, string> = {
  عام: 'البحث والحفظ وعرض الاختصارات',
  إنشاء: 'فتح نموذج جديد مباشرة من أي صفحة',
  التنقل: 'الانتقال إلى أي نافذة',
};

const IconBtn: React.FC<{
  icon: 'edit' | 'trash' | 'refresh';
  label: string;
  onClick: () => void;
}> = ({ icon, label, onClick }) => (
  <button
    onClick={onClick}
    title={label}
    aria-label={label}
    className="grid h-8 w-8 place-items-center rounded-lg text-ink-subtle hover:bg-slate-100 hover:text-ink"
  >
    <Icon name={icon} size={15} />
  </button>
);

export default ShortcutsSettings;
