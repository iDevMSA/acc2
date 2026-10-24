const { ic, phone, topBar, board } = require('./lib');

const rep = (i, t, n, s) => `<div class="li"><div class="av ${t}">${ic(i, 19)}</div><div class="f1"><div class="f13 b6">${n}</div><div class="f11 mu">${s}</div></div>${ic('chev', 17, '#94A3B8')}</div>`;
const reports = phone({
  top: topBar('التقارير', { back: false, actions: `<div class="ibtn">${ic('search', 19)}</div>` }),
  body: `
  <div class="fx g8">
    <div class="card f1 hero" style="border:none;padding:12px"><div>${ic('star', 20, '#FDE68A')}</div><div class="f13 b7" style="margin-top:6px">قائمة الدخل</div><div class="f11" style="opacity:.75">الأكثر استخداماً</div></div>
    <div class="card f1" style="padding:12px"><div>${ic('pie', 20, 'var(--r)')}</div><div class="f13 b7" style="margin-top:6px">تقرير الضريبة</div><div class="f11 mu">الربع الثالث</div></div>
  </div>
  <div class="sec">القوائم المالية</div>
  <div class="list">
    ${rep('chart', 't-b', 'قائمة الدخل', 'الأرباح والخسائر لأي فترة')}
    ${rep('layers', 't-b', 'الميزانية العمومية', 'الأصول والخصوم وحقوق الملكية')}
    ${rep('sheet', 't-b', 'ميزان المراجعة', 'أرصدة وحركات كل الحسابات')}
    ${rep('book', 't-b', 'الأستاذ العام', 'تفاصيل الحركات حسب الحساب')}
  </div>
  <div class="sec">العملاء والموردون</div>
  <div class="list">
    ${rep('users', 't-g', 'المدينون وأعمار الديون', '0-30، 31-60، أكثر من 90 يوماً')}
    ${rep('building', 't-a', 'الدائنون', 'المستحق للموردين')}
  </div>
  <div class="sec">المبيعات والمخزون</div>
  <div class="list">
    ${rep('cart', 't-p', 'تحليل المبيعات والربحية', 'حسب الصنف والفرع والكاشير')}
    ${rep('box', 't-a', 'حركة المخزون', 'وارد وصادر ورصيد')}
  </div>`,
  nav: 3,
});

const rl = (l, v, c = '', b = '') => `<div class="fx sp" style="padding:8px 0;border-bottom:1px solid #F1F4F8"><span class="f13 ${b}">${l}</span><span class="num f13 b6 ${c}">${v}</span></div>`;
const income = phone({
  top: topBar('قائمة الدخل', { actions: `<div class="ibtn">${ic('share', 18)}</div>` }),
  body: `
  <div class="chips"><span>هذا الشهر</span><span class="on">من بداية السنة</span><span>العام الماضي</span><span>${ic('cal', 13)}</span></div>
  <div class="card" style="padding:14px">
    <div class="fx sp"><div><div class="f12 mu">صافي الربح</div><div class="fx g6" style="align-items:baseline"><span class="f24 b7 num g">312,480</span><span class="f12 mu b6">SAR</span></div></div><span class="chip g">▲ 18% عن 2025</span></div>
    <div class="fx" style="align-items:flex-end;gap:5px;height:96px;margin-top:12px">${[[60, 40], [55, 42], [70, 48], [66, 45], [80, 52], [74, 50], [85, 58], [78, 54], [90, 60], [96, 62]].map(([a, b]) => `<div class="f1 fx" style="align-items:flex-end;gap:2px;height:100%"><div class="f1 bar" style="height:${a}%;background:#0575E6"></div><div class="f1 bar" style="height:${b}%;background:#FCA5A5"></div></div>`).join('')}</div>
    <div class="fx g12 f11 mu" style="margin-top:8px"><span class="fx g4"><i style="width:9px;height:9px;border-radius:3px;background:#0575E6;display:inline-block"></i>الإيرادات</span><span class="fx g4"><i style="width:9px;height:9px;border-radius:3px;background:#FCA5A5;display:inline-block"></i>المصروفات</span><span style="margin-right:auto">يناير ← أكتوبر</span></div>
  </div>
  <div class="card" style="padding:4px 14px">
    ${rl('المبيعات', '1,184,250.00', '', 'b6')}
    ${rl('مردودات المبيعات', '(12,400.00)', 'r')}
    ${rl('تكلفة البضاعة المباعة', '(612,300.00)', 'r')}
    ${rl('مجمل الربح', '559,550.00', 'b7', 'b7')}
    ${rl('الرواتب والأجور', '(146,000.00)', 'r')}
    ${rl('الإيجارات', '(65,000.00)', 'r')}
    ${rl('مصروفات تشغيلية أخرى', '(36,070.00)', 'r')}
    <div class="fx sp" style="padding:10px 0"><span class="f14 b7">صافي الربح</span><span class="num f16 b7 g">312,480.00</span></div>
  </div>`,
});

const opt = (l, on) => `<div class="fx sp" style="padding:9px 0"><span class="f13">${l}</span><div class="tog${on ? ' on' : ''}"></div></div>`;
const exp = phone({
  top: topBar('ميزان المراجعة'),
  body: `
  <div class="card" style="padding:6px 12px;opacity:.6"><table class="tbl"><thead><tr><th>الحساب</th><th>مدين</th><th>دائن</th></tr></thead><tbody>
  ${[['الصندوق الرئيسي', '18,420', ''], ['بنك الراجحي', '45,495', ''], ['العملاء', '64,210', ''], ['الموردون', '', '41,880'], ['رأس المال', '', '250,000']].map(r => `<tr><td>${r[0]}</td><td class="num">${r[1]}</td><td class="num">${r[2]}</td></tr>`).join('')}
  </tbody></table></div>`,
  overlay: `<div class="sheet-bg"></div><div class="sheet">
    <div class="grab"></div>
    <div class="f18 b7">تصدير التقرير</div><div class="f12 mu" style="margin-top:2px">ميزان المراجعة · 1 يناير – 24 أكتوبر 2026</div>
    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-top:16px">
      ${[['pdf', 'PDF', 't-r', 1], ['sheet', 'Excel', 't-g'], ['file', 'CSV', 't-gr'], ['print', 'طباعة', 't-b']].map(([i, l, t, on]) => `<div class="card" style="padding:12px 4px;text-align:center;${on ? 'border:2px solid var(--b2);background:#F0F6FF' : ''}"><div class="av ${t}" style="margin:0 auto">${ic(i, 21)}</div><div class="f12 b6" style="margin-top:6px">${l}</div></div>`).join('')}
    </div>
    <div style="margin-top:12px">
      ${opt('شعار المنشأة وبياناتها في الترويسة', 1)}
      ${opt('المبالغ كتابةً بالعربية', 1)}
      ${opt('التاريخ الهجري بجانب الميلادي', 1)}
      ${opt('الاتجاه أفقي', 0)}
    </div>
    <div class="fx g8" style="margin-top:10px"><div class="btn o f1">${ic('whatsapp', 19)} واتساب</div><div class="btn f1">${ic('share', 18, '#fff')} حفظ ومشاركة</div></div>
  </div>`,
});

const imp = phone({
  top: topBar('استيراد من Excel'),
  body: `
  <div class="fx g6">${['الملف', 'مطابقة الأعمدة', 'المراجعة'].map((s, i) => `<div class="f1"><div class="prog"><i style="width:${i < 2 ? 100 : 0}%"></i></div><div class="f11 b6 ${i < 2 ? 'bl' : 'mu'}" style="margin-top:4px">${i + 1}. ${s}</div></div>`).join('')}</div>
  <div class="card fx g10" style="padding:11px 13px">${ic('sheet', 24, 'var(--g)')}<div class="f1"><div class="f13 b6 num" style="text-align:right">accounts_2026.xlsx</div><div class="f11 mu">دليل الحسابات · 142 صف</div></div><span class="f12 bl b6">تغيير</span></div>
  <div class="sec">مطابقة الأعمدة</div>
  <div class="list">
    ${[['A · Code', 'رقم الحساب'], ['B · Name', 'اسم الحساب'], ['C · Type', 'نوع الحساب'], ['D · Parent', 'الحساب الأب'], ['E · Opening', 'الرصيد الافتتاحي']].map(([a, b]) => `<div class="li"><span class="num f12 mu b6" style="width:84px">${a}</span>${ic('chev', 15, '#94A3B8')}<div class="f1 inp" style="padding:7px 10px;justify-content:space-between"><span class="f13 b6">${b}</span>${ic('chevd', 15, 'var(--mu)')}</div></div>`).join('')}
  </div>
  <div class="fx g8">
    <div class="card f1" style="padding:10px;background:#F0FBF6;border-color:#BFEBD8;text-align:center"><div class="f18 b7 g num">138</div><div class="f11 mu">صف جاهز</div></div>
    <div class="card f1" style="padding:10px;background:#FEF2F2;border-color:#FBCFCF;text-align:center"><div class="f18 b7 r num">4</div><div class="f11 mu">بها أخطاء</div></div>
  </div>
  <div class="card" style="padding:10px 13px;background:#FFF8EB;border-color:#FDE3B5"><div class="fx g8">${ic('crown', 18, 'var(--a)')}<span class="f12 b6">الخطة المجانية تسمح بـ 15 حساباً فقط</span></div><div class="f11 mu" style="margin-top:3px">رقِّ اشتراكك لاستيراد الملف كاملاً</div></div>
  <div class="btn" style="margin-top:auto;margin-bottom:6px">مراجعة واستيراد 138 حساباً</div>`,
});

module.exports = board('5 · التقارير والتصدير والاستيراد', 'كل القوائم المالية بقراءة مريحة على الشاشة الصغيرة، تصدير PDF/Excel بترويسة المنشأة، واستيراد Excel بمطابقة الأعمدة', [
  { html: reports, cap: 'مركز التقارير', note: 'القوائم المالية، أعمار الديون، المبيعات والمخزون' },
  { html: income, cap: 'قائمة الدخل', note: 'رسم شهري للإيرادات والمصروفات ومقارنة بالعام الماضي' },
  { html: exp, cap: 'تصدير أي تقرير', note: 'PDF وExcel وCSV وطباعة، مع المبلغ كتابةً والتاريخ الهجري' },
  { html: imp, cap: 'استيراد من Excel', note: 'مطابقة الأعمدة وكشف الأخطاء قبل الحفظ، مع حدود الخطة' },
]);
