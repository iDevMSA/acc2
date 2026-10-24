const { ic, phone, topBar, board } = require('./lib');

const login = phone({
  white: true,
  bg: 'background:linear-gradient(170deg,#021B79 0%,#0A3BB0 38%,#F3F5FA 38.1%)',
  body: `
  <div class="fx col" style="align-items:center;color:#fff;padding:18px 0 8px;gap:10px">
    <div style="width:66px;height:66px;border-radius:20px;background:rgba(255,255,255,.15);display:flex;align-items:center;justify-content:center;border:1px solid rgba(255,255,255,.25)">${ic('chart', 34, '#fff', 2.2)}</div>
    <div class="f24 b7">منصتي المحاسبية</div>
    <div class="f13" style="opacity:.8">حساب واحد للهاتف والويب</div>
  </div>
  <div class="card" style="padding:18px;display:flex;flex-direction:column;gap:13px;box-shadow:0 20px 40px -20px rgba(2,27,121,.35);margin-top:14px">
    <div class="seg"><div class="on">تسجيل الدخول</div><div>حساب جديد</div></div>
    <div><div class="lbl">البريد الإلكتروني</div><div class="inp num" style="justify-content:flex-end">mousa@alaraby.sa</div></div>
    <div><div class="lbl">كلمة المرور</div><div class="inp sp"><span class="b7" style="letter-spacing:3px">••••••••</span>${ic('eye', 18, '#94A3B8')}</div></div>
    <div class="f12 bl b6" style="text-align:left">نسيت كلمة المرور؟</div>
    <div class="btn">دخول</div>
    <div class="fx g8 f12 mu"><div class="hr f1"></div>أو<div class="hr f1"></div></div>
    <div class="btn o" style="color:var(--ink)"><b style="color:#4285F4;font-size:17px">G</b> المتابعة بحساب Google</div>
    <div class="btn o" style="color:var(--ink)">${ic('finger', 19)} الدخول بالبصمة</div>
  </div>
  <div class="f12 mu" style="text-align:center;margin-top:4px">بالمتابعة توافق على الشروط وسياسة الخصوصية</div>`,
});

const setup = phone({
  top: topBar('إعداد المنشأة', { actions: '<span class="f13 mu b6">2 من 4</span>' }),
  body: `
  <div class="prog"><i style="width:50%"></i></div>
  <div><div class="f18 b7">أين تعمل منشأتك؟</div><div class="f13 mu" style="margin-top:3px">نجهّز الضرائب ودليل الحسابات والسنة المالية حسب بلدك وقطاعك</div></div>
  <div class="sec">الدولة</div>
  <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px">
    ${[['PS', 'فلسطين'], ['SA', 'السعودية', 1], ['AE', 'الإمارات'], ['KW', 'الكويت'], ['QA', 'قطر'], ['BH', 'البحرين'], ['OM', 'عُمان'], ['EG', 'مصر'], ['JO', 'الأردن'], ['IQ', 'العراق'], ['LB', 'لبنان'], ['SY', 'سوريا']].map(([c, n, on]) => `<div class="card" style="padding:9px 4px;text-align:center;${on ? 'border:2px solid var(--b2);background:#F0F6FF' : ''}"><div class="b7 f13 ${on ? 'bl' : 'mu'}">${c}</div><div class="f11 b6" style="margin-top:2px">${n}</div></div>`).join('')}
  </div>
  <div class="f12 bl b6" style="text-align:center">+ اليمن</div>
  <div class="sec">القطاع</div>
  <div class="fx g8">
    <div class="card f1" style="border:2px solid var(--b2);background:#F0F6FF"><div class="fx sp">${ic('building', 22, 'var(--b2)')}<span class="chip g">${ic('check', 12, 'currentColor', 3)}</span></div><div class="b7 f14" style="margin-top:6px">قطاع خاص</div><div class="f11 mu">شركات ومؤسسات</div></div>
    <div class="card f1"><div>${ic('shield', 22, 'var(--mu)')}</div><div class="b7 f14" style="margin-top:6px">جهة حكومية</div><div class="f11 mu">موازنة وأبواب صرف</div></div>
  </div>
  <div class="sec">النشاط</div>
  <div class="chips" style="flex-wrap:wrap"><span class="on">تجارة جملة وتجزئة</span><span>خدمات</span><span>مطاعم</span><span>مقاولات</span><span>صناعة</span><span>عيادات</span></div>
  <div class="card fx sp" style="padding:11px 14px"><div><div class="f13 b6">بداية السنة المالية</div><div class="f11 mu">يناير · مع التاريخ الهجري</div></div>${ic('chevd', 18, 'var(--mu)')}</div>
  <div class="btn" style="margin-top:auto;margin-bottom:6px">التالي: دليل الحسابات</div>`,
});

const home = phone({
  white: true,
  bg: 'background:linear-gradient(180deg,#021B79 0,#0A3BB0 250px,#F3F5FA 250px)',
  top: `<div class="top" style="color:#fff"><div class="fx g10"><div class="av c" style="background:rgba(255,255,255,.18);color:#fff;font-weight:700">م</div><div><div class="f12" style="opacity:.75">صباح الخير، موسى</div><div class="f15 b7">مؤسسة العربي التجارية</div></div></div><div class="fx g8"><div class="chip" style="background:rgba(255,255,255,.16);color:#fff">SAR ${ic('chevd', 12, '#fff', 2.5)}</div><div class="ibtn" style="background:rgba(255,255,255,.14);border:none;color:#fff">${ic('bell', 20)}<span class="dot" style="border-color:#0A3BB0"></span></div></div></div>`,
  body: `
  <div class="card" style="padding:16px">
    <div style="text-align:center"><div class="f13 mu b5">صافي الربح · أكتوبر</div>
    <div class="fx g6" style="align-items:baseline;justify-content:center;margin-top:4px"><span class="f28 b7 num">48,230.50</span><span class="f13 mu b6">SAR</span></div><span class="chip g" style="margin-top:6px">▲ 12.4% عن سبتمبر</span></div>
    <div class="fx g8" style="margin-top:12px">
      <div class="f1" style="background:#F0FBF6;border-radius:12px;padding:8px 10px;text-align:center"><div class="f11 mu">الإيرادات</div><div class="f14 b7 g num">126,400</div></div>
      <div class="f1" style="background:#FEF2F2;border-radius:12px;padding:8px 10px;text-align:center"><div class="f11 mu">المصروفات</div><div class="f14 b7 r num">78,169</div></div>
      <div class="f1" style="background:#F0F6FF;border-radius:12px;padding:8px 10px;text-align:center"><div class="f11 mu">النقدية</div><div class="f14 b7 bl num">63,915</div></div>
    </div>
  </div>
  <div class="fx sp" style="padding:0 2px">
    ${[['plus', 'قيد جديد', 't-b'], ['receipt', 'فاتورة', 't-g'], ['down', 'سند قبض', 't-t'], ['up', 'سند صرف', 't-r'], ['scan', 'مسح', 't-p']].map(([i, l, t]) => `<div class="tile"><div class="av ${t}">${ic(i, 22)}</div>${l}</div>`).join('')}
  </div>
  <div class="card fx g10" style="padding:11px 13px;background:#FFF8EB;border-color:#FDE3B5">${ic('alert', 20, 'var(--a)')}<div class="f1"><div class="f13 b6">3 تنبيهات تحتاج انتباهك</div><div class="f11 mu">إقرار الضريبة بعد 5 أيام · مخزون منخفض</div></div>${ic('chev', 18, 'var(--a)')}</div>
  <div class="card" style="padding:13px 14px">
    <div class="fx sp"><span class="f14 b7">المبيعات آخر 7 أيام</span><span class="f12 bl b6">التقارير</span></div>
    <div class="fx" style="align-items:flex-end;gap:10px;height:78px;margin-top:10px">${[45, 62, 38, 80, 55, 72, 92].map((h, i) => `<div class="bar f1" style="height:${h}%;${i === 6 ? 'background:linear-gradient(180deg,#0575E6,#021B79)' : ''}"></div>`).join('')}</div>
    <div class="fx f11 mu" style="gap:10px;margin-top:5px">${['السبت', 'الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'اليوم'].map(d => `<span class="f1" style="text-align:center">${d}</span>`).join('')}</div>
  </div>
  <div class="fx sp"><span class="f14 b7">آخر العمليات</span><span class="f12 bl b6">عرض الكل</span></div>
  <div class="list">
    <div class="li"><div class="av t-g">${ic('receipt', 19)}</div><div class="f1"><div class="f13 b6">فاتورة مبيعات #1102</div><div class="f11 mu">محمد العتيبي · 10:24 ص</div></div><div class="f14 b7 g num">+1,144.25</div></div>
  </div>`,
  nav: 0,
});

const tiles = (arr) => `<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px 6px">${arr.map(([i, l, t, b]) => `<div class="tile" style="position:relative"><div class="av ${t}">${ic(i, 22)}</div>${l}${b ? `<span style="position:absolute;top:-4px;left:8px" class="chip r">${b}</span>` : ''}</div>`).join('')}</div>`;
const more = phone({
  top: topBar('كل الأدوات'),
  body: `
  <div class="inp">${ic('search', 18, '#94A3B8')}<span class="ph">ابحث عن شاشة أو تقرير…</span></div>
  <div class="card" style="display:flex;flex-direction:column;gap:12px"><div class="f13 b7">المحاسبة</div>${tiles([['book', 'دليل الحسابات', 't-b'], ['file', 'القيود', 't-b'], ['wallet', 'الصناديق', 't-t'], ['star', 'المساعد الذكي', 't-p']])}</div>
  <div class="card" style="display:flex;flex-direction:column;gap:12px"><div class="f13 b7">المبيعات والمخزون</div>${tiles([['cart', 'نقطة البيع', 't-g'], ['receipt', 'الفواتير', 't-g'], ['box', 'الأصناف', 't-a'], ['building', 'المستودعات', 't-p']])}</div>
  <div class="card" style="display:flex;flex-direction:column;gap:12px"><div class="f13 b7">الضرائب</div>${tiles([['zap', 'الفوترة الإلكترونية', 't-s'], ['pie', 'إقرار الضريبة', 't-r', '5 أيام'], ['tag', 'ضريبة المشتريات', 't-a'], ['globe', 'الدولة والقطاع', 't-t']])}</div>
  <div class="card" style="display:flex;flex-direction:column;gap:12px"><div class="f13 b7">الإدارة</div>${tiles([['chart', 'التقارير', 't-b'], ['users', 'الفريق', 't-p'], ['shield', 'سجل التدقيق', 't-gr'], ['bell', 'التنبيهات', 't-r', '3'], ['sheet', 'استيراد Excel', 't-g'], ['down', 'تصدير', 't-s'], ['crown', 'الاشتراك', 't-a'], ['layers', 'الموازنة', 't-t']])}</div>`,
});

module.exports = board('1 · الدخول والرئيسية', 'شاشة دخول موحدة مع الويب، معالج إعداد المنشأة، رئيسية جديدة، وشاشة «كل الأدوات»', [
  { html: login, cap: 'تسجيل الدخول وإنشاء حساب', note: 'نفس حساب الويب، Google، والدخول بالبصمة' },
  { html: setup, cap: 'معالج إعداد المنشأة', note: 'الدولة والقطاع والنشاط والسنة المالية، مثل صفحة /setup في الويب' },
  { html: home, cap: 'الرئيسية الجديدة', note: 'ملخص الشهر، أزرار سريعة، تنبيهات، رسم المبيعات وآخر العمليات' },
  { html: more, cap: 'كل الأدوات', note: 'تفتح من الإعدادات أو زر +، وتظهر فيها الأدوات المفعّلة فقط' },
]);
