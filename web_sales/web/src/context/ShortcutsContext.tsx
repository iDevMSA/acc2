import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useLedger } from './LedgerContext';
import {
  ShortcutOverrides,
  comboFromEvent,
  findConflicts,
  isTypingTarget,
  resolveBindings,
  shouldHandleWhileTyping,
  toOverrides,
} from '../lib/shortcuts';

// اختصارات المستخدم: تُحفظ في السحابة تحت users/{uid}/erp/settings/shortcuts (عقدة يكتبها الويب وحده)
// فتتبع المستخدم على أي جهاز، ويُستمع لها من مكان واحد في الصفحة.

interface ShortcutsContextType {
  /** id → الاختصار الفعلي ("" = بلا اختصار) */
  bindings: Record<string, string>;
  conflicts: Record<string, string[]>;
  setBinding: (id: string, combo: string, opts?: { replace?: boolean }) => Promise<void>;
  resetBinding: (id: string) => Promise<void>;
  resetAll: () => Promise<void>;
  /** إيقاف الاستماع مؤقتاً (أثناء تسجيل اختصار جديد) */
  setPaused: (paused: boolean) => void;
  paused: React.MutableRefObject<boolean>;
}

const ShortcutsContext = createContext<ShortcutsContextType | null>(null);

export const ShortcutsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { settings, saveSettings } = useLedger();
  const cloud = settings.shortcuts as ShortcutOverrides | undefined;
  // نسخة محلية حتى يظهر التعديل فوراً قبل أن ترجع من السحابة
  const [local, setLocal] = useState<ShortcutOverrides | undefined>(cloud);
  useEffect(() => setLocal(cloud), [cloud]);

  const bindings = useMemo(() => resolveBindings(local), [local]);
  const conflicts = useMemo(() => findConflicts(bindings), [bindings]);
  const paused = useRef(false);

  const save = useCallback(
    async (next: Record<string, string>) => {
      const overrides = toOverrides(next);
      setLocal(overrides);
      await saveSettings({ shortcuts: Object.keys(overrides).length ? overrides : undefined });
    },
    [saveSettings],
  );

  const setBinding = useCallback<ShortcutsContextType['setBinding']>(
    (id, combo, opts) => {
      const next = { ...bindings, [id]: combo };
      if (opts?.replace && combo)
        Object.keys(next).forEach((k) => {
          if (k !== id && next[k] === combo) next[k] = '';
        });
      return save(next);
    },
    [bindings, save],
  );

  const resetBinding = useCallback<ShortcutsContextType['resetBinding']>(
    (id) => {
      const next = { ...local };
      delete next[id];
      return save(resolveBindings(next));
    },
    [local, save],
  );

  const resetAll = useCallback(() => save(resolveBindings(undefined)), [save]);
  const setPaused = useCallback((p: boolean) => (paused.current = p), []);

  const value = useMemo(
    () => ({ bindings, conflicts, setBinding, resetBinding, resetAll, setPaused, paused }),
    [bindings, conflicts, setBinding, resetBinding, resetAll, setPaused],
  );

  return <ShortcutsContext.Provider value={value}>{children}</ShortcutsContext.Provider>;
};

export const useShortcuts = () => {
  const ctx = useContext(ShortcutsContext);
  if (!ctx) throw new Error('useShortcuts must be used within ShortcutsProvider');
  return ctx;
};

/** الاختصار الحالي لأمر (للعرض بجانب الأزرار) */
export const useShortcutFor = (id: string) => useContext(ShortcutsContext)?.bindings[id] || '';

/** يستمع لضغطات المفاتيح وينفّذ الأمر المرتبط بها */
export const useShortcutListener = (run: (id: string) => void) => {
  const ctx = useContext(ShortcutsContext);
  const runRef = useRef(run);
  runRef.current = run;
  const byCombo = useMemo(() => {
    const m: Record<string, string> = {};
    // عند التعارض يفوز أول أمر في القائمة (ونُنبّه المستخدم في نافذة الإعداد)
    Object.entries(ctx?.bindings || {}).forEach(([id, c]) => c && !(c in m) && (m[c] = id));
    return m;
  }, [ctx?.bindings]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (ctx?.paused.current || e.repeat || e.isComposing) return;
      const combo = comboFromEvent(e);
      const id = combo && byCombo[combo];
      if (!combo || !id) return;
      if (isTypingTarget(e.target) && !shouldHandleWhileTyping(combo)) return;
      e.preventDefault();
      e.stopPropagation();
      runRef.current(id);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [byCombo, ctx]);
};
