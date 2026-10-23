import { useEffect, useState } from 'react';
import { ref, onValue } from 'firebase/database';
import { db } from '../config/firebase';

// كل ما يخص تشغيل المنصة كتطبيق مثبّت (PWA): تسجيل الـService Worker، التحديثات، التثبيت، وحالة الاتصال.

/* ───────── تحديث التطبيق ───────── */

let waitingWorker: ServiceWorker | null = null;
const updateListeners = new Set<(ready: boolean) => void>();
const setWaiting = (w: ServiceWorker | null) => {
  waitingWorker = w;
  updateListeners.forEach((l) => l(!!w));
};

// داخل موقع خوارزم يفتح التطبيق على /monsati (Next.js يحذف الشرطة الأخيرة)، بينما النطاق الافتراضي
// لـ /monsati/sw.js هو /monsati/ فلا يشمل صفحة البداية ولا تفتح بدون اتصال. لذلك نسجّله بنطاق /monsati
// (يسمح به الخادم عبر ترويسة Service-Worker-Allowed)، ونحذف التسجيل القديم بنطاق /monsati/.
const registerWithAppScope = async () => {
  const base = process.env.PUBLIC_URL;
  const script = `${base}/sw.js`;
  if (!base) return navigator.serviceWorker.register(script);
  try {
    const reg = await navigator.serviceWorker.register(script, { scope: base });
    const old = await navigator.serviceWorker.getRegistration(`${base}/`);
    if (old && old.scope !== reg.scope) await old.unregister();
    return reg;
  } catch {
    // الخادم لم يُحدَّث بعد بالترويسة: نبقى على النطاق الافتراضي حتى يُنشر
    return navigator.serviceWorker.register(script);
  }
};

export const registerServiceWorker = () => {
  if (process.env.NODE_ENV !== 'production' || !('serviceWorker' in navigator)) return;

  window.addEventListener('load', async () => {
    try {
      const reg = await registerWithAppScope();
      // وُجدت نسخة جديدة سابقاً ولم تُفعّل بعد
      if (reg.waiting && navigator.serviceWorker.controller) setWaiting(reg.waiting);
      reg.addEventListener('updatefound', () => {
        const worker = reg.installing;
        worker?.addEventListener('statechange', () => {
          // أول تثبيت لا يحتاج تنبيهاً؛ التنبيه فقط عند استبدال نسخة تعمل
          if (worker.state === 'installed' && navigator.serviceWorker.controller) setWaiting(worker);
        });
      });
      // فحص التحديثات كل ساعة للتطبيق المفتوح طويلاً
      setInterval(() => reg.update().catch(() => undefined), 60 * 60 * 1000);
    } catch (err) {
      console.warn('تعذّر تسجيل Service Worker', err);
    }

    let reloading = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (reloading) return;
      reloading = true;
      window.location.reload();
    });
  });
};

export const applyUpdate = () => waitingWorker?.postMessage({ type: 'SKIP_WAITING' });

export const useUpdateAvailable = () => {
  const [ready, setReady] = useState(!!waitingWorker);
  useEffect(() => {
    updateListeners.add(setReady);
    return () => {
      updateListeners.delete(setReady);
    };
  }, []);
  return ready;
};

/* ───────── التثبيت ───────── */

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

let deferredPrompt: BeforeInstallPromptEvent | null = null;
const installListeners = new Set<() => void>();
const notifyInstall = () => installListeners.forEach((l) => l());

if (typeof window !== 'undefined') {
  // يجب التقاط الحدث مبكراً (قبل أن يُرسم أي مكوّن)
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e as BeforeInstallPromptEvent;
    notifyInstall();
  });
  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    notifyInstall();
  });
}

const isStandalone = () =>
  window.matchMedia?.('(display-mode: standalone)').matches || (navigator as any).standalone === true;

// iPhone و iPad (iPadOS يقدّم نفسه كـMac لكن بشاشة لمس). Safari لا يدعم زر تثبيت برمجي.
const isIos = () =>
  /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

export type InstallMode = 'prompt' | 'ios' | null;

export const useInstall = () => {
  const compute = (): InstallMode => {
    if (typeof window === 'undefined' || isStandalone()) return null;
    if (deferredPrompt) return 'prompt';
    return isIos() ? 'ios' : null;
  };
  const [mode, setMode] = useState<InstallMode>(compute);

  useEffect(() => {
    const l = () => setMode(compute());
    installListeners.add(l);
    return () => {
      installListeners.delete(l);
    };
  }, []);

  const promptInstall = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    await deferredPrompt.userChoice.catch(() => undefined);
    deferredPrompt = null;
    notifyInstall();
  };

  return { mode, promptInstall };
};

/* ───────── حالة الاتصال ───────── */

export const useOnline = () => {
  const [browserOnline, setBrowserOnline] = useState(() => navigator.onLine);
  // .info/connected يكشف انقطاع خادم Firebase حتى لو كان المتصفح "متصلاً"
  const [firebaseDown, setFirebaseDown] = useState(false);

  useEffect(() => {
    const on = () => setBrowserOnline(true);
    const off = () => setBrowserOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);

    let wasConnected = false;
    const unsub = onValue(ref(db, '.info/connected'), (snap) => {
      const connected = snap.val() === true;
      if (connected) wasConnected = true;
      // لا نعتبره منقطعاً قبل أول اتصال ناجح، حتى لا يظهر الشريط لحظة فتح الصفحة
      setFirebaseDown(wasConnected && !connected);
    });

    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
      unsub();
    };
  }, []);

  return browserOnline && !firebaseDown;
};
