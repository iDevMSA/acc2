const { ic, phone, topBar, board } = require('./lib');

const opt = (l, sub, on) => `<div class="fx sp g10" style="padding:10px 0;border-bottom:1px solid #F1F4F8"><div class="f1"><div class="f13 b6">${l}</div>${sub ? `<div class="f11 mu" style="margin-top:2px">${sub}</div>` : ''}</div><div class="tog${on ? ' on' : ''}"></div></div>`;
const autowa = phone({
  top: topBar('رسائل واتساب التلقائية'),
  body: `
  <div class="card fx sp g10" style="padding:13px 14px;border:2px solid #16A34A;background:#F0FBF4"><div class="fx g10">${ic('whatsapp', 24, '#16A34A')}<div><div class="f14 b7">إرسال رسالة عند كل قيد</div><div class="f11 mu">تُرسل في الخلفية لرقم الحساب</div></div></div><div class="tog on" style="background:#16A34A"></div></div>
  <div class="card" style="background:#E7F5EC;border-color:#CDEBD8;padding:12px"><div class="f11 b6" style="color:#166534;margin-bottom:6px">نص الرسالة</div><div style="background:#fff;border-radius:14px 4px 14px 14px;padding:11px;font-size:12.5px;line-height:1.8">
    <b>مؤسسة العربي التجارية</b><br>تم تسجيل عملية لصالحكم بمبلغ <b class="num">1,250.00</b> ر.س (تعادل <b class="num">333.33</b> $) برقم <b class="num">#E-1042</b> بتاريخ <span class="num">24/10/2026</span> الساعة 10:24 ص.<br>رصيدكم الحالي: <b class="num">4,250.00</b> ر.س
    <div class="f11 mu" style="text-align:left;margin-top:2px">10:24 ✓✓</div></div>
    <div class="f12 bl b6" style="margin-top:8px">${ic('edit', 13)} تعديل النص</div></div>
  <div class="card" style="padding:2px 14px">
    ${opt('إظهار المبلغ المعادل', 'بعملة الحساب أو الدولار', 1)}
    ${opt('إضافة الرصيد الحالي', '', 1)}
    ${opt('إرسال صور القيد', '', 0)}
    <div class="fx sp" style="padding:10px 0"><div class="f13 b6">حسابات مستثناة</div><span class="f12 mu">3 حسابات ${ic('chev', 14)}</span></div>
  </div>
  <div class="card fx sp" style="padding:10px 14px"><div class="f12"><b>اليوم:</b> أُرسلت 14 رسالة · <span class="r">1 فشلت</span></div><span class="f12 bl b6">السجل</span></div>`,
});

const note = (t, b, time, i = 'chart', c = 'linear-gradient(135deg,#021B79,#0575E6)') => `<div class="nt" style="background:rgba(255,255,255,.72);backdrop-filter:blur(10px);border-radius:20px;padding:11px 13px;display:flex;gap:10px;color:#0F172A"><div style="width:36px;height:36px;border-radius:10px;background:${c};display:flex;align-items:center;justify-content:center;flex:none">${ic(i, 18, '#fff', 2.2)}</div><div class="f1"><div class="fx sp"><span class="f11 b6" style="opacity:.6">منصتي</span><span class="f11" style="opacity:.6">${time}</span></div><div class="f13 b7">${t}</div><div class="f12" style="line-height:1.5;opacity:.85">${b}</div></div></div>`;
const lock = phone({
  white: true,
  bg: 'background:linear-gradient(165deg,#0B1B4D 0%,#1E3A8A 45%,#6D28D9 100%)',
  body: `
  <div style="text-align:center;color:#fff;margin:6px 0 10px">${ic('lock', 18, '#fff')}<div class="f13 b6" style="opacity:.85;margin-top:4px">السبت 24 أكتوبر</div><div class="num" style="font-size:72px;font-weight:600;line-height:1.05">9:41</div></div>
  ${note('لم تسجّل قيود اليوم', 'عادةً تسجّل قيودك بين 9 و11 صباحاً. هل نسيت تحصيلات أمس؟', 'الآن', 'clock', 'linear-gradient(135deg,#D97706,#F59E0B)')}
  ${note('قيد مكرر محتمل', 'قيدان بنفس المبلغ 1,250 لمحمد العتيبي خلال دقيقتين. افتح للمراجعة.', 'قبل 20 د', 'alert', 'linear-gradient(135deg,#DC2626,#F87171)')}
  ${note('محمد العتيبي أكّد المطابقة', 'رصيد 4,250.00 ر.س مطابق ✓', '8:12 ص', 'check', 'linear-gradient(135deg,#059669,#34D399)')}
  ${note('إقرار الضريبة بعد 5 أيام', 'المستحق المتوقع 11,544.70 ر.س', 'أمس')}`,
  foot: `<div style="flex:none;height:60px;position:relative;display:flex;justify-content:space-between;align-items:center;padding:0 40px 14px"><div class="ibtn" style="background:rgba(255,255,255,.18);border:none;color:#fff;border-radius:50%;width:44px;height:44px">${ic('camera', 20)}</div><div class="ibtn" style="background:rgba(255,255,255,.18);border:none;color:#fff;border-radius:50%;width:44px;height:44px">${ic('zap', 20)}</div><div class="hi" style="background:#fff"></div></div>`,
});

const smart = phone({
  top: topBar('الإشعارات الذكية'),
  body: `
  <div class="card" style="padding:13px 14px;background:linear-gradient(135deg,#F5F3FF,#EFF6FF);border-color:#DDD6FE"><div class="fx g8">${ic('star', 18, 'var(--p)')}<span class="f13 b7">تعلّمنا روتينك</span></div><div class="f12" style="margin-top:6px;line-height:1.7">تسجّل قيودك عادةً <b>9–11 ص</b>، وترسل المطابقات <b>آخر الشهر</b>، وتفتح التطبيق <b>6 أيام</b> في الأسبوع.</div></div>
  <div class="card" style="padding:2px 14px">
    ${opt('تذكير إذا تأخرت عن روتينك', 'مثلاً لم تسجّل شيئاً حتى 12 ظهراً', 1)}
    ${opt('كشف الأخطاء', 'قيد مكرر، مبلغ غير معتاد، قيد بلا صورة', 1)}
    ${opt('أرصدة وتجاوزات', 'صندوق بالسالب، عميل تجاوز حده', 1)}
    ${opt('الاستحقاقات', 'الضريبة والفواتير والاشتراك', 1)}
    ${opt('ردود العملاء على واتساب', 'تأكيد المطابقة أو الاعتراض', 1)}
    ${opt('ملخص يومي', 'الساعة 8 م', 0)}
  </div>
  <div class="card fx sp" style="padding:10px 14px"><div><div class="f13 b6">وقت الهدوء</div><div class="f11 mu">لا إشعارات من 11 م إلى 7 ص</div></div>${ic('moon', 18, 'var(--p)')}</div>
  <div class="f11 mu fx g6" style="justify-content:center">${ic('bell', 13)} <span>تصلك حتى لو كان التطبيق مغلقاً · معاينة</span></div>`,
});

module.exports = board('11 · واتساب التلقائي والإشعارات الذكية', 'رسالة تلقائية لكل حساب عند تسجيل قيد (تُشغّل وتُطفأ)، وإشعارات تتعلم روتينك وتكشف الأخطاء وتصلك والتطبيق مغلق', [
  { html: autowa, cap: 'رسائل واتساب التلقائية', note: 'المبلغ ومعادله ورقم العملية والتاريخ والوقت، مع زر تشغيل وإيقاف واستثناء حسابات' },
  { html: lock, cap: 'الإشعارات على شاشة القفل', note: 'تذكير عند كسر الروتين، أخطاء محتملة، وردود العملاء' },
  { html: smart, cap: 'إعدادات الإشعارات الذكية', note: 'المستخدم يختار ما يصله، مع وقت هدوء' },
]);
