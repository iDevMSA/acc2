/* Service worker للمنصة المحاسبية: يجعل الواجهة تعمل بدون اتصال.
 * قائمة الملفات تُحقن تلقائياً بعد البناء (scripts/inject-sw-manifest.js)،
 * فكل بناء جديد يغيّر محتوى هذا الملف ويُطلق تحديثاً للتطبيق المثبّت.
 * بيانات Firebase لا تمر من هنا: تُحفظ محلياً في IndexedDB عبر src/lib/offlineStore.ts. */

const BUILD = '__BUILD_ID__';
const PRECACHE = [] /* __PRECACHE__ */;

const SHELL_CACHE = 'erp-shell-' + BUILD;
// مسار التطبيق: '' في جذر الموقع، أو /monsati عند استضافته داخل موقع خوارزم.
// النطاق يُسجَّل بلا شرطة أخيرة (/monsati) لأن Next.js يحوّل /monsati/ إلى /monsati،
// ولو كان النطاق /monsati/ لما مرّ فتح التطبيق بهذا الـService Worker وظهرت صفحة "لا يوجد اتصال".
const ROOT = new URL(self.registration.scope).pathname.replace(/\/$/, '');
const BASE = ROOT + '/';
const INDEX = BASE + 'index.html';
const RUNTIME_CACHE = 'erp-runtime';

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(SHELL_CACHE).then((cache) => cache.addAll(PRECACHE)));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('erp-shell-') && k !== SHELL_CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// الواجهة تطلب التفعيل الفوري عندما يضغط المستخدم "تحديث"
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});

const fromShell = (request) => caches.open(SHELL_CACHE).then((c) => c.match(request, { ignoreSearch: true }));

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return; // Firebase وغيره يمرون مباشرة
  if (url.pathname !== ROOT && !url.pathname.startsWith(BASE)) return; // صفحات الموقع المضيف خارج التطبيق
  // صفحات HTML مستقلة في نفس المجلد (admin.html، privacy.html ...) ليست من التطبيق
  if (/\.html$/.test(url.pathname) && url.pathname !== INDEX) return;

  // التنقل بين الصفحات: الشبكة أولاً، وعند انقطاعها نعرض الواجهة المحفوظة
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((res) => {
          if (res.ok) caches.open(SHELL_CACHE).then((c) => c.put(INDEX, res.clone()));
          return res;
        })
        .catch(() => fromShell(INDEX).then((hit) => hit || fromShell(BASE)))
    );
    return;
  }

  // ملفات البناء (أسماؤها فيها بصمة، لا تتغير): من الذاكرة أولاً
  event.respondWith(
    fromShell(request).then(
      (hit) =>
        hit ||
        fetch(request)
          .then((res) => {
            if (res.ok && res.type === 'basic') {
              const copy = res.clone();
              caches.open(RUNTIME_CACHE).then((c) => c.put(request, copy));
            }
            return res;
          })
          .catch(() => caches.open(RUNTIME_CACHE).then((c) => c.match(request)).then((r) => r || Response.error()))
    )
  );
});
