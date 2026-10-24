// Builds a single-file clickable simulator from all board modules.
const fs = require('fs');
const path = require('path');
global.__cells = [];
const boards = ['b1', 'b9', 'b10', 'b11', 'b2', 'b3', 'b4', 'b5', 'b6', 'b7', 'b8'];
for (const b of boards) require('./' + b);

const IDS = {
  'تسجيل الدخول وإنشاء حساب': 'login', 'معالج إعداد المنشأة': 'setup', 'الرئيسية الجديدة': 'home', 'كل الأدوات': 'tools',
  'دليل الحسابات': 'accounts', 'قيد يومية جديد': 'journal', 'كشف حساب': 'statement', 'الصناديق والبنوك والمستودعات': 'cash',
  'نقطة البيع': 'pos', 'الدفع': 'checkout', 'تفاصيل الفاتورة': 'invoice', 'الأصناف والمخزون': 'products',
  'لوحة الفوترة الإلكترونية': 'einv', 'إقرار ضريبة القيمة المضافة': 'vat', 'فاتورة مشتريات وضريبة المدخلات': 'purchase', 'إعدادات الضريبة': 'taxset',
  'مركز التقارير': 'reports', 'قائمة الدخل': 'income', 'تصدير أي تقرير': 'export', 'استيراد من Excel': 'import',
  'مركز التنبيهات': 'alerts', 'الفريق والصلاحيات': 'team', 'سجل التدقيق': 'audit', 'الإعدادات': 'settings',
  'الاشتراك': 'sub', 'الإضافة السريعة (زر +)': 'quick', 'العمل بدون إنترنت': 'offline', 'الوضع الليلي': 'dark',
  '1. عرّفنا على عملك': 'ob1', '2. ماذا تحتاج؟': 'ob2', '3. مراجعة واقتراحات': 'ob3', 'الإعدادات > أدواتي': 'mytools',
  'قيد لنا / لهم': 'entry', 'بيانات شركتك': 'company', 'قيود متعددة دفعة واحدة': 'batch', 'المساعد الذكي': 'ai', 'رسائل واتساب التلقائية': 'autowa', 'الإشعارات على شاشة القفل': 'lock', 'إعدادات الإشعارات الذكية': 'smart', 'صفحة العميل': 'customer', 'المطابقة على واتساب': 'recon', 'الموازنة (جهات حكومية)': 'budget',
};

// Take the phone CSS from lib, minus the board page styling and local font files.
let css = fs.readFileSync(path.join(__dirname, 'lib.js'), 'utf8');
css = css.slice(css.indexOf('const CSS = `') + 13);
css = css.slice(0, css.indexOf('`;\n'));
css = css.replace(/\$\{font\(\d+\)\}/g, '').replace(/body\{[^}]*\}/, '').replace(/\.board-h[^}]*\}/g, '').replace(/\.row\{[^}]*\}/, '').replace(/\.cell\{[^}]*\}/, '').replace(/\.cap[^}]*\}/g, '')
  .replace('font-family:Plex,sans-serif;', '');
css = css.replace(/^\s*\*\{box-sizing:border-box;margin:0;padding:0\}/m, '.phone,.phone *{box-sizing:border-box;margin:0;padding:0}');

const groups = [];
const screens = [];
for (const g of global.__cells) {
  const items = [];
  for (const c of g.cells) {
    const id = IDS[c.cap];
    if (!id) throw new Error('no id for ' + c.cap);
    items.push({ id, cap: c.cap.replace(/^\d\. /, ''), note: c.note || '' });
    screens.push(`<section class="sim-screen" data-id="${id}" hidden>${c.html}</section>`);
  }
  groups.push({ title: g.title.replace(/^\d+ · /, ''), items });
}

const tpl = fs.readFileSync(path.join(__dirname, 'sim-template.html'), 'utf8');
const out = tpl.replace('/*PHONE_CSS*/', css).replace('<!--SCREENS-->', screens.join('\n')).replace('/*GROUPS*/', JSON.stringify(groups));
fs.writeFileSync(path.join(__dirname, 'sim.html'), out);
console.log('screens', screens.length, 'bytes', out.length);
