// بعد `react-scripts build`: يكتب قائمة ملفات البناء داخل build/sw.js حتى تُحفظ كلها للعمل بدون اتصال.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const buildDir = path.join(__dirname, '..', 'build');
const manifest = JSON.parse(fs.readFileSync(path.join(buildDir, 'asset-manifest.json'), 'utf8'));

// PUBLIC_URL يحدد مسار الاستضافة (فارغ = جذر الموقع، أو /monsati/erp داخل موقع خوارزم)
const base = (process.env.PUBLIC_URL || '').replace(/\/$/, '');
const files = new Set(
  ['/', '/index.html', '/manifest.json', '/favicon.ico', '/icon-192.png', '/icon-512.png', '/icon-maskable-512.png', '/apple-touch-icon.png'].map(
    (f) => base + f,
  ),
);
for (const file of Object.values(manifest.files)) {
  if (file.endsWith('.map') || file.endsWith('.LICENSE.txt')) continue;
  // الخطوط: woff2 يكفي لكل المتصفحات الحديثة، ونحفظ مسبقاً الحروف العربية واللاتينية فقط
  if (/\.woff$/.test(file)) continue;
  if (/\.woff2$/.test(file) && !/-(arabic|latin)-\d+-normal\./.test(file)) continue;
  files.add(file);
}

const list = [...files].sort();
const buildId = crypto.createHash('sha256').update(list.join('\n')).digest('hex').slice(0, 12);

const swPath = path.join(buildDir, 'sw.js');
const sw = fs
  .readFileSync(swPath, 'utf8')
  .replace('__BUILD_ID__', buildId)
  .replace('[] /* __PRECACHE__ */', JSON.stringify(list, null, 2));
fs.writeFileSync(swPath, sw);
console.log(`sw.js: ${list.length} files precached (build ${buildId})`);

// داخل موقع آخر يُفتح التطبيق على /monsati بلا شرطة أخيرة: نجعل بداية التطبيق المثبّت ونطاقه
// بنفس الشكل حتى يبقى داخل نطاق الـService Worker ولا يظهر شريط "خارج التطبيق". المعرّف (id) لا يتغيّر
// كي لا يعتبره المتصفح تطبيقاً جديداً.
if (base) {
  const manifestPath = path.join(buildDir, 'manifest.json');
  const appManifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  appManifest.start_url = base;
  appManifest.scope = base;
  fs.writeFileSync(manifestPath, JSON.stringify(appManifest, null, 2) + '\n');
}
