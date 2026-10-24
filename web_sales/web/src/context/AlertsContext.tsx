// التنبيهات داخل الويب (الجرس وصفحة /alerts) وإعداداتها وقنوات إرسالها.
// تُحسب من نفس بيانات الدفتر ونقطة البيع بمحرك src/lib/alerts.ts الذي تستخدمه خدمة السحابة alerts/
// لإرسال الملخص اليومي بالبريد وإشعارات الهاتف. كل ما يخصها تحت users/{uid}/alerts (عقدة جديدة).
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { ref, update } from 'firebase/database';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '../config/firebase';
import { watchValue } from '../lib/offlineStore';
import { Alert, AlertSettings, buildAlerts, todayIn, withDefaults } from '../lib/alerts';
import { assertCanWrite } from '../lib/team';
import { useApp } from './AppContext';
import { useLedger } from './LedgerContext';
import { usePos } from './PosContext';

export interface AlertsStatus {
  lastRunAt?: string;
  lastSentAt?: string;
  sent?: { email?: number; push?: number };
  error?: string | null;
}

interface AlertsContextType {
  alerts: Alert[];
  dismissedAlerts: Alert[];
  settings: AlertSettings;
  status: AlertsStatus | null;
  pushDevices: number;
  thisDeviceSubscribed: boolean;
  saveSettings: (s: Partial<AlertSettings>) => Promise<void>;
  dismiss: (id: string) => Promise<void>;
  restore: (id: string) => Promise<void>;
  enablePush: () => Promise<void>;
  disablePush: () => Promise<void>;
  sendTest: () => Promise<{ email?: number; push?: number }>;
}

const AlertsContext = createContext<AlertsContextType | undefined>(undefined);

const call = async <T,>(name: string, data: unknown): Promise<T> => {
  try {
    return (await httpsCallable(functions, name)(data)).data as T;
  } catch (e: any) {
    if (e?.code === 'functions/not-found' || (e?.code === 'functions/internal' && /not found|404/i.test(e?.message || '')))
      throw new Error('خدمة التنبيهات غير منشورة بعد على Firebase');
    throw new Error(e?.message || 'تعذّر الاتصال بخدمة التنبيهات');
  }
};

const b64ToBytes = (b64: string) => {
  const s = atob((b64 + '='.repeat((4 - (b64.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(s, (c) => c.charCodeAt(0));
};

/** مفتاح ثابت للاشتراك داخل RTDB (لا تُقبل النقاط والشرطات المائلة في المفاتيح) */
const subKey = (endpoint: string) => {
  let h = 0;
  for (let i = 0; i < endpoint.length; i++) h = (Math.imul(31, h) + endpoint.charCodeAt(i)) | 0;
  return 'd' + (h >>> 0).toString(36) + endpoint.length.toString(36);
};

/** مفاتيح RTDB لا تقبل . # $ / [ ] */
const dkey = (id: string) => id.replace(/[.#$/[\]]/g, '_');

const swRegistration = async () => {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) throw new Error('هذا المتصفح لا يدعم الإشعارات');
  const reg = await navigator.serviceWorker.getRegistration();
  if (!reg) throw new Error('ثبّت التطبيق أو أعد تحميل الصفحة ثم حاول مجدداً');
  return reg;
};

export const AlertsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { ownerUid, member } = useApp();
  const uid = ownerUid;
  const ledger = useLedger();
  const { products } = usePos();
  const [raw, setRaw] = useState<{ settings?: AlertSettings | null; dismissed?: Record<string, boolean> | null; status?: AlertsStatus | null; push?: Record<string, unknown> | null }>({});
  const [subscribedKey, setSubscribedKey] = useState<string | null>(null);

  useEffect(() => {
    if (!uid) return;
    const subs = (['settings', 'dismissed', 'status', 'push'] as const).map((n) =>
      watchValue(`users/${uid}/alerts/${n}`, (v) => setRaw((r) => ({ ...r, [n]: v }))),
    );
    return () => subs.forEach((u) => u());
  }, [uid]);

  useEffect(() => {
    navigator.serviceWorker
      ?.getRegistration()
      .then((reg) => reg?.pushManager?.getSubscription())
      .then((s) => setSubscribedKey(s ? subKey(s.endpoint) : null))
      .catch(() => undefined);
  }, []);

  const settings = useMemo(() => raw.settings || {}, [raw.settings]);
  const { accounts, opsByAccount, accountMeta, cashboxes, warehouses, items, moves, invoices, cheques, mainCurrency } = ledger;

  const all = useMemo(() => {
    const stockQty: Record<string, number> = {};
    moves.forEach((m) => {
      if (m.type === 'in' || m.type === 'adjust') stockQty[m.itemId] = (stockQty[m.itemId] || 0) + m.qty;
      else if (m.type === 'out') stockQty[m.itemId] = (stockQty[m.itemId] || 0) - Math.abs(m.qty);
    });
    const roles = Object.fromEntries(Object.entries(accountMeta).map(([k, m]) => [k, m?.role]));
    return buildAlerts(
      {
        mainCurrency,
        accounts,
        opsByAccount,
        roles,
        systemAccountIds: [
          ...cashboxes.flatMap((b) => [...b.linkedAccountIds, b.cashAccountId || '']),
          ...warehouses.map((w) => w.inventoryAccountId || ''),
        ].filter(Boolean),
        items,
        stockQty,
        posProducts: products,
        invoices,
        cheques,
      },
      settings,
      todayIn(withDefaults(settings).timeZone),
    );
  }, [accounts, opsByAccount, accountMeta, cashboxes, warehouses, items, moves, invoices, cheques, mainCurrency, products, settings]);

  const dismissedIds = useMemo(() => raw.dismissed || {}, [raw.dismissed]);
  const alerts = useMemo(() => all.filter((a) => !dismissedIds[dkey(a.id)]), [all, dismissedIds]);
  const dismissedAlerts = useMemo(() => all.filter((a) => dismissedIds[dkey(a.id)]), [all, dismissedIds]);

  const write = useCallback(
    (updates: Record<string, unknown>) => {
      if (!uid) return Promise.reject(new Error('لم يتم تسجيل الدخول'));
      try {
        assertCanWrite(member, Object.keys(updates).map((k) => `alerts/${k}`));
      } catch (e) {
        return Promise.reject(e);
      }
      return update(ref(db, `users/${uid}/alerts`), updates);
    },
    [uid, member],
  );

  const saveSettings = useCallback<AlertsContextType['saveSettings']>(
    async (s) => {
      const next = JSON.parse(JSON.stringify({ ...settings, ...s }));
      await write({ settings: next });
      // تسجيل الحساب لدى خدمة الإرسال اليومي (أفضل محاولة: الإعدادات تُحفظ حتى لو لم تُنشر الخدمة بعد)
      if (next.email?.enabled || next.push?.enabled)
        await call('alertsRegister', {}).catch((e: Error) => {
          throw new Error(`حُفظت الإعدادات، لكن ${e.message}`);
        });
    },
    [settings, write],
  );

  const dismiss = useCallback((id: string) => write({ [`dismissed/${dkey(id)}`]: true }), [write]);
  const restore = useCallback((id: string) => write({ [`dismissed/${dkey(id)}`]: null }), [write]);

  const enablePush = useCallback(async () => {
    const reg = await swRegistration();
    const perm = await Notification.requestPermission();
    if (perm !== 'granted') throw new Error('لم يُسمح بالإشعارات من إعدادات المتصفح');
    const { publicKey } = await call<{ publicKey: string }>('alertsConfig', {});
    const sub =
      (await reg.pushManager.getSubscription()) ||
      (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToBytes(publicKey) }));
    const key = subKey(sub.endpoint);
    await write({ [`push/${key}`]: { subscription: sub.toJSON(), ua: navigator.userAgent.slice(0, 200), at: new Date().toISOString() } });
    setSubscribedKey(key);
    await saveSettings({ push: { enabled: true } });
  }, [write, saveSettings]);

  const disablePush = useCallback(async () => {
    const reg = await navigator.serviceWorker?.getRegistration();
    const sub = await reg?.pushManager?.getSubscription();
    if (sub) {
      await write({ [`push/${subKey(sub.endpoint)}`]: null });
      await sub.unsubscribe().catch(() => undefined);
    }
    setSubscribedKey(null);
  }, [write]);

  const sendTest = useCallback(() => call<{ email?: number; push?: number }>('alertsTest', {}), []);

  const pushDevices = Object.keys(raw.push || {}).length;
  const thisDeviceSubscribed = !!subscribedKey && !!raw.push && subscribedKey in raw.push;

  return (
    <AlertsContext.Provider
      value={{
        alerts,
        dismissedAlerts,
        settings,
        status: raw.status || null,
        pushDevices,
        thisDeviceSubscribed,
        saveSettings,
        dismiss,
        restore,
        enablePush,
        disablePush,
        sendTest,
      }}
    >
      {children}
    </AlertsContext.Provider>
  );
};

export const useAlerts = () => {
  const ctx = useContext(AlertsContext);
  if (!ctx) throw new Error('useAlerts must be used inside AlertsProvider');
  return ctx;
};
