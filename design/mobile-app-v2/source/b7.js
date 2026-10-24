const { ic, phone, topBar, board, nav } = require('./lib');

const plan = (n, p, per, note, on, badge) => `<div class="card" style="padding:12px 14px;${on ? 'border:2px solid var(--b2);background:#F7FAFF' : ''}"><div class="fx sp"><div class="fx g8"><div style="width:20px;height:20px;border-radius:50%;border:2px solid ${on ? 'var(--b2)' : '#CBD5E1'};display:flex;align-items:center;justify-content:center">${on ? '<i style="width:10px;height:10px;border-radius:50%;background:var(--b2);display:block"></i>' : ''}</div><span class="f14 b7">${n}</span>${badge ? `<span class="chip g">${badge}</span>` : ''}</div><div style="text-align:left"><span class="f18 b7 num">$${p}</span><span class="f11 mu"> / ${per}</span></div></div><div class="f11 mu" style="margin-top:4px;margin-right:28px">${note}</div></div>`;
const sub = phone({
  top: topBar('الاشتراك'),
  body: `
  <div class="card" style="padding:12px 14px;background:linear-gradient(135deg,#FEF3C7,#FFFBEB);border-color:#FDE3B5"><div class="fx sp"><div><div class="f11 mu">خطتك الحالية</div><div class="f15 b7">هاتف + ويب · شهري</div></div><div style="text-align:left"><div class="f11 mu">تنتهي</div><div class="f13 b7 a">7 نوفمبر 2026</div></div></div></div>
  <div class="seg"><div>${ic('phone', 13)} الهاتف</div><div>${ic('monitor', 13)} الويب</div><div class="on">الهاتف + الويب</div></div>
  <div class="card" style="padding:10px 14px"><div class="f12 b7" style="margin-bottom:6px">يشمل</div>${['كل مميزات التطبيق ومنصة الويب', 'حسابات وقيود بلا حدود', 'الفوترة الإلكترونية ZATCA وETA', 'الفريق والصلاحيات وسجل التدقيق', 'نقطة البيع وفروع ومستودعات'].map(x => `<div class="fx g8 f12" style="padding:3px 0">${ic('check', 15, 'var(--g)', 2.6)}${x}</div>`).join('')}</div>
  ${plan('شهري', '79.99', 'شهر', 'يُجدَّد كل شهر', 1)}
  ${plan('سنوي', '949.99', 'سنة', 'وفّر مقارنة بالشهري', 0, 'الأكثر طلباً')}
  ${plan('مدى الحياة', '1,999.99', 'مرة واحدة', 'دفعة واحدة بلا تجديد', 0)}
  <div class="btn" style="background:#16A34A;margin-top:auto;margin-bottom:6px">${ic('whatsapp', 20, '#fff')} اشترك عبر واتساب</div>`,
});

const qa = (i, l, t, k) => `<div class="tile"><div class="av ${t}" style="position:relative">${ic(i, 22)}${k ? `<span style="position:absolute;bottom:-6px;left:-6px;background:#0F172A;color:#fff;font-size:9px;border-radius:6px;padding:1px 5px" class="num">${k}</span>` : ''}</div>${l}</div>`;
const quick = phone({
  white: true,
  bg: 'background:linear-gradient(180deg,#021B79 0,#0A3BB0 250px,#F3F5FA 250px)',
  body: '',
  nav: 0,
  overlay: `<div class="sheet-bg"></div><div class="sheet" style="padding-bottom:100px">
    <div class="grab"></div>
    <div class="fx sp"><div class="f18 b7">إضافة سريعة</div><span class="f12 bl b6">${ic('edit', 13)} تخصيص</span></div>
    <div class="f12 mu" style="margin-top:2px">نفس اختصارات لوحة المفاتيح في الويب، بلمسة واحدة</div>
    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:16px 6px;margin-top:16px">
      ${qa('layers', 'قيود متعددة', 't-b')}${qa('receipt', 'فاتورة بيع', 't-g')}${qa('tag', 'فاتورة شراء', 't-a')}${qa('cart', 'نقطة البيع', 't-g')}
      ${qa('down', 'سند قبض', 't-t')}${qa('up', 'سند صرف', 't-r')}${qa('transfer', 'تحويل نقدية', 't-s')}${qa('scan', 'مسح باركود', 't-p')}
      ${qa('users', 'عميل جديد', 't-b')}${qa('box', 'صنف جديد', 't-a')}${qa('camera', 'تصوير فاتورة', 't-s')}${qa('star', 'المساعد الذكي', 't-p')}
    </div>
    <div class="card fx g10" style="margin-top:16px;padding:10px 12px;background:#F8FAFC">${ic('phone', 20, 'var(--b2)')}<div class="f1 f12"><b>اختصارات أيقونة التطبيق</b><div class="mu f11">اضغط مطولاً على الأيقونة لفتح «فاتورة بيع» أو «قيد» مباشرة، أو أضف ودجت للشاشة الرئيسية</div></div></div>
  </div>
  <div style="position:absolute;bottom:0;left:0;right:0">${nav(0).replace('class="fab">', 'class="fab"><style>.fabx svg{transform:rotate(45deg)}</style><span class="fabx" style="display:flex">').replace('</svg></div><div class="it"><svg', '</svg></span></div><div class="it"><svg')}</div>`,
});

const off = phone({
  top: topBar('المزامنة', { actions: `<div class="ibtn">${ic('sync', 19)}</div>` }),
  body: `
  <div class="card fx g10" style="background:#1E293B;color:#fff;border:none">${ic('wifioff', 22, '#FCD34D')}<div class="f1"><div class="f14 b7">أنت غير متصل</div><div class="f11" style="opacity:.75">استمر بالعمل، نحفظ كل شيء على الجهاز</div></div></div>
  <div class="card" style="padding:14px"><div class="fx sp"><span class="f13 b6">بانتظار الرفع</span><span class="f20 b7 num a">4</span></div><div class="prog" style="margin-top:8px"><i style="width:35%;background:linear-gradient(90deg,#FBBF24,#D97706)"></i></div><div class="f11 mu" style="margin-top:6px">تُرفع تلقائياً عند عودة الإنترنت · آخر مزامنة 9:12 ص</div></div>
  <div class="list">
    <div class="li"><div class="av t-g">${ic('receipt', 18)}</div><div class="f1"><div class="f13 b6">فاتورة #1103</div><div class="f11 mu">نقطة البيع · 9:30 ص</div></div><span class="chip a">${ic('clock', 11)} محلية</span></div>
    <div class="li"><div class="av t-g">${ic('receipt', 18)}</div><div class="f1"><div class="f13 b6">فاتورة #1104</div><div class="f11 mu">نقطة البيع · 9:41 ص</div></div><span class="chip a">${ic('clock', 11)} محلية</span></div>
    <div class="li"><div class="av t-b">${ic('file', 18)}</div><div class="f1"><div class="f13 b6">قيد JE-0419</div><div class="f11 mu">مصروفات نقل</div></div><span class="chip a">${ic('clock', 11)} محلية</span></div>
    <div class="li"><div class="av t-r">${ic('up', 18)}</div><div class="f1"><div class="f13 b6">سند صرف #77</div><div class="f11 mu">الصندوق الرئيسي</div></div><span class="chip a">${ic('clock', 11)} محلية</span></div>
  </div>
  <div class="sec">ما يتم عند الاتصال</div>
  <div class="list">
    <div class="li">${ic('cloud', 19, 'var(--b2)')}<div class="f1 f12">رفع العمليات وتنزيل تعديلات الويب والفريق</div></div>
    <div class="li">${ic('zap', 19, 'var(--b2)')}<div class="f1 f12">إرسال الفواتير المعلّقة لهيئة الزكاة</div></div>
    <div class="li">${ic('coin', 19, 'var(--b2)')}<div class="f1 f12">مطابقة العملة الرئيسية (الأحدث يفوز)</div></div>
  </div>`,
});

// Dark mode home: override tokens inside this phone only.
const dark = phone({
  white: true,
  bg: '--bg:#0B1220;--card:#131C2E;--ink:#E2E8F0;--mu:#94A3B8;--li:#1F2A3F;color:#E2E8F0;background:#0B1220',
  top: `<div class="top" style="color:#fff"><div class="fx g10"><div class="av c" style="background:#1E293B;color:#fff;font-weight:700">م</div><div><div class="f12" style="opacity:.7">مساء الخير، موسى</div><div class="f15 b7">مؤسسة العربي التجارية</div></div></div><div class="ibtn" style="background:#131C2E;border-color:#1F2A3F;color:#fff">${ic('bell', 20)}<span class="dot" style="border-color:#131C2E"></span></div></div>`,
  body: `
  <div class="card" style="padding:16px;background:linear-gradient(135deg,#0A2A8F,#0575E6);border:none;color:#fff"><div class="fx sp"><span class="f13" style="opacity:.8">صافي الربح · أكتوبر</span><span class="chip" style="background:rgba(52,211,153,.2);color:#6EE7B7">▲ 12.4%</span></div><div class="fx g6" style="align-items:baseline;margin-top:4px"><span class="f28 b7 num">48,230.50</span><span class="f13 b6" style="opacity:.8">SAR</span></div></div>
  <div class="fx g8">
    <div class="card f1" style="padding:10px"><div class="f11 mu">الإيرادات</div><div class="f15 b7 num" style="color:#34D399">126,400</div></div>
    <div class="card f1" style="padding:10px"><div class="f11 mu">المصروفات</div><div class="f15 b7 num" style="color:#F87171">78,169</div></div>
    <div class="card f1" style="padding:10px"><div class="f11 mu">النقدية</div><div class="f15 b7 num" style="color:#60A5FA">63,915</div></div>
  </div>
  <div class="fx sp" style="padding:0 2px">${[['plus', 'قيد جديد'], ['receipt', 'فاتورة'], ['down', 'سند قبض'], ['up', 'سند صرف'], ['scan', 'مسح']].map(([i, l]) => `<div class="tile" style="color:#E2E8F0"><div class="av" style="background:#131C2E;border:1px solid #1F2A3F;color:#60A5FA">${ic(i, 22)}</div>${l}</div>`).join('')}</div>
  <div class="card" style="padding:13px 14px"><div class="fx sp"><span class="f14 b7">المبيعات آخر 7 أيام</span><span class="f12 b6" style="color:#60A5FA">التقارير</span></div><div class="fx" style="align-items:flex-end;gap:10px;height:90px;margin-top:10px">${[45, 62, 38, 80, 55, 72, 92].map((h, i) => `<div class="bar f1" style="height:${h}%;background:${i === 6 ? '#3B82F6' : '#1E3A8A'}"></div>`).join('')}</div></div>
  <div class="list" style="background:#131C2E;border-color:#1F2A3F">
    <div class="li" style="border-color:#1F2A3F"><div class="av" style="background:#0F2A22;color:#34D399">${ic('receipt', 19)}</div><div class="f1"><div class="f13 b6">فاتورة مبيعات #1102</div><div class="f11 mu">محمد العتيبي · 10:24 ص</div></div><div class="f14 b7 num" style="color:#34D399">+1,144.25</div></div>
    <div class="li" style="border-color:#1F2A3F"><div class="av" style="background:#2A1414;color:#F87171">${ic('up', 19)}</div><div class="f1"><div class="f13 b6">صرف إيجار المحل</div><div class="f11 mu">بنك الراجحي · 9:10 ص</div></div><div class="f14 b7 num" style="color:#F87171">-6,500.00</div></div>
  </div>`,
  nav: 0,
}).replace('<div class="nav">', '<div class="nav" style="background:#0F1729;border-color:#1F2A3F"><style>.dk .nav .it.on{color:#60A5FA}</style>').replace('<div class="phone">', '<div class="phone dk">').replace('border:4px solid var(--bg)', 'border:4px solid #0B1220').replace('<div class="hi"></div></div></div></div>', '<div class="hi" style="background:#E2E8F0"></div></div></div></div>');

module.exports = board('7 · الاشتراك والتجربة', 'الاشتراك بالأنواع الثلاثة، زر «+» بدل اختصارات لوحة المفاتيح، العمل بدون إنترنت، والوضع الليلي', [
  { html: sub, cap: 'الاشتراك', note: 'هاتف، ويب، أو الاثنين معاً بنفس أسعار المنصة' },
  { html: quick, cap: 'الإضافة السريعة (زر +)', note: 'بديل اختصارات لوحة المفاتيح، قابل للتخصيص، مع اختصارات الأيقونة والودجت' },
  { html: off, cap: 'العمل بدون إنترنت', note: 'كل العمليات تُحفظ محلياً وتُرفع تلقائياً، مع إرسال الفواتير للهيئة' },
  { html: dark, cap: 'الوضع الليلي', note: 'نفس التصميم بألوان داكنة مريحة للعين' },
]);
