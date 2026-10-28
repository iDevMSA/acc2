import { ref, onValue } from 'firebase/database';
import { db } from '../config/firebase';

// قراءة بيانات Firebase مع نسخة محلية دائمة (IndexedDB).
// نسخة الويب من Realtime Database لا تحفظ البيانات على الجهاز، فنحفظ آخر قيمة لكل مسار بأنفسنا:
// عند الفتح بدون اتصال تظهر آخر بيانات تمت مزامنتها، وعند عودة الاتصال تُستبدل بالقيمة الحية.
// قراءة فقط — لا نكتب شيئاً إلى Firebase من هنا.

const DB_NAME = 'erp-offline';
const STORE = 'snapshots';

interface CachedSnapshot {
  value: unknown;
  savedAt: number;
}

let dbPromise: Promise<IDBDatabase | null> | null = null;

const openDb = (): Promise<IDBDatabase | null> => {
  if (!dbPromise) {
    dbPromise = new Promise((resolve) => {
      try {
        if (typeof indexedDB === 'undefined') return resolve(null);
        const req = indexedDB.open(DB_NAME, 1);
        req.onupgradeneeded = () => req.result.createObjectStore(STORE);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => resolve(null);
      } catch {
        resolve(null);
      }
    });
  }
  return dbPromise;
};

const readCache = async (key: string): Promise<CachedSnapshot | undefined> => {
  const idb = await openDb();
  if (!idb) return undefined;
  return new Promise((resolve) => {
    try {
      const req = idb.transaction(STORE, 'readonly').objectStore(STORE).get(key);
      req.onsuccess = () => resolve(req.result as CachedSnapshot | undefined);
      req.onerror = () => resolve(undefined);
    } catch {
      resolve(undefined);
    }
  });
};

const writeCache = async (key: string, value: unknown) => {
  const idb = await openDb();
  if (!idb) return;
  try {
    idb
      .transaction(STORE, 'readwrite')
      .objectStore(STORE)
      .put({ value, savedAt: Date.now() } as CachedSnapshot, key);
  } catch {
    // مساحة التخزين ممتلئة أو غير متاحة — نكمل بالبيانات الحية فقط
  }
};

/** يُمسح عند تسجيل الخروج حتى لا تبقى بيانات الحساب على جهاز مشترك */
export const clearOfflineCache = async () => {
  const idb = await openDb();
  if (!idb) return;
  try {
    idb.transaction(STORE, 'readwrite').objectStore(STORE).clear();
  } catch {
    // لا شيء
  }
  lastSyncListeners.forEach((l) => l(null));
};

/* ───────── آخر مزامنة ───────── */

let lastSync: number | null = null;
const lastSyncListeners = new Set<(t: number | null) => void>();

const markSynced = (t: number) => {
  if (lastSync !== null && t <= lastSync) return;
  lastSync = t;
  lastSyncListeners.forEach((l) => l(t));
};

export const onLastSync = (listener: (t: number | null) => void) => {
  lastSyncListeners.add(listener);
  listener(lastSync);
  return () => {
    lastSyncListeners.delete(listener);
  };
};

/**
 * مثل onValue لكن يبدأ فوراً بالنسخة المحلية إن وُجدت، ثم يتابع القيمة الحية ويحفظها.
 * cb تستقبل القيمة الخام (snapshot.val()) أو null.
 */
export const watchValue = (path: string, cb: (value: any) => void, onError?: (e: Error) => void): (() => void) => {
  let live = false;
  let active = true;

  readCache(path).then((cached) => {
    if (!active || live || !cached) return;
    cb(cached.value ?? null);
    markSynced(cached.savedAt);
  });

  const unsubscribe = onValue(ref(db, path), (snapshot) => {
    live = true;
    const value = snapshot.val();
    cb(value);
    writeCache(path, value);
    markSynced(Date.now());
  }, (e) => onError?.(e));

  return () => {
    active = false;
    unsubscribe();
  };
};
