const { ic, phone, topBar, board } = require('./lib');

const thumb = (c, i = 'receipt') => `<div style="width:50px;height:50px;border-radius:12px;background:${c};display:flex;align-items:center;justify-content:center;flex:none;border:1px solid var(--li)">${ic(i, 24, 'rgba(15,23,42,.4)')}</div>`;
const entry = phone({
  top: topBar('قيد جديد', { actions: '<span class="f14 bl b7">حفظ</span>' }),
  body: `
  <div class="seg" style="padding:4px"><div class="on" style="color:#fff;background:#059669;padding:10px">لنا</div><div style="padding:10px">لهم</div></div>
  <div><div class="lbl">الحساب</div><div class="inp sp"><div class="fx g8"><div class="av c t-b" style="width:30px;height:30px;font-size:13px;font-weight:700">م</div><span class="b6">محمد العتيبي</span></div>${ic('chevd', 18, 'var(--mu)')}</div></div>
  <div class="card" style="text-align:center;padding:8px"><div class="f12 mu">المبلغ</div><div class="fx g6" style="justify-content:center;align-items:baseline"><span class="num b7" style="font-size:34px;color:#059669">1,250.00</span><span class="f14 mu b6">SAR</span></div></div>
  <div class="fx g8"><div class="f1"><div class="lbl">التاريخ</div><div class="inp"><div><div class="num f13 b6">24/10/2026</div><div class="f11 mu">2 جمادى الأولى 1448</div></div></div></div><div class="f1"><div class="lbl">العملة</div><div class="inp sp" style="height:55px"><span class="b6">SAR</span>${ic('chevd', 16, 'var(--mu)')}</div></div></div>
  <div><div class="lbl">البيان</div><div class="inp">دفعة من حساب بضاعة شهر أكتوبر</div></div>
  <div><div class="lbl">الصور المرفقة</div><div class="fx g8">${thumb('#FEF3C7')}${thumb('#E0F2FE', 'img')}<div style="width:50px;height:50px;border-radius:12px;border:1.5px dashed #B6CCF5;display:flex;flex-direction:column;align-items:center;justify-content:center;color:var(--b2);font-size:10.5px;font-weight:600;gap:2px">${ic('camera', 20)}صورة</div></div></div>
  <div class="card fx sp" style="padding:10px 13px"><div class="fx g8">${ic('whatsapp', 18, '#16A34A')}<span class="f13 b6">رسالة واتساب تلقائية للحساب</span></div><div class="tog on"></div></div>
  <div class="f11 mu" style="background:#E7F5EC;border-radius:12px;padding:9px 11px;line-height:1.7;color:#14532D">تم تسجيل عملية لصالحكم بمبلغ <b class="num">1,250.00</b> ر.س (تعادل <b class="num">333.33</b> $) برقم <b class="num">#E-1042</b> بتاريخ <span class="num">24/10/2026</span> الساعة 10:24 ص.</div>`,
});

const row = (d, desc, amt, c, photo) => `<div class="li"><div class="av ${c === 'g' ? 't-g' : 't-r'}" style="width:34px;height:34px">${ic(c === 'g' ? 'down' : 'up', 17)}</div><div class="f1"><div class="f13 b6">${desc}</div><div class="f11 mu fx g4"><span class="num">${d}</span>${photo ? `· ${ic('img', 12)} ${photo}` : ''}</div></div><span class="f14 b7 num ${c}">${amt}</span></div>`;
const account = phone({
  top: topBar('محمد العتيبي', { actions: `<div class="ibtn">${ic('dots', 19)}</div>` }),
  body: `
  <div class="card" style="text-align:center;padding:16px"><div class="f12 mu">الرصيد</div><div class="fx g6" style="justify-content:center;align-items:baseline;margin-top:2px"><span class="f28 b7 num g">4,250.00</span><span class="f13 mu b6">SAR</span></div><span class="chip g" style="margin-top:6px">لنا عنده</span><div class="f11 mu num" style="margin-top:6px">0558718819 · آخر حركة اليوم</div></div>
  <div class="fx g8"><div class="btn f1 sm" style="background:#059669">${ic('plus', 16, '#fff', 2.4)} قيد لنا</div><div class="btn f1 sm" style="background:#DC2626">${ic('plus', 16, '#fff', 2.4)} قيد لهم</div></div>
  <div class="fx g8"><div class="btn o f1 sm">${ic('file', 17)} كشف الحساب</div><div class="btn o f1 sm" style="color:#16A34A">${ic('whatsapp', 17, '#16A34A')} مطابقة واتساب</div></div>
  <div class="fx sp"><span class="f14 b7">الحركات</span><span class="chips"><span class="on" style="padding:4px 10px">الكل</span><span style="padding:4px 10px">بالصور</span></span></div>
  <div class="list">
    ${row('24/10/2026', 'دفعة بضاعة أكتوبر', '+1,250.00', 'g', '2 صور')}
    ${row('18/10/2026', 'تسديد نقدي', '-3,000.00', 'r', '')}
    ${row('09/10/2026', 'بضاعة: زعفران وهيل', '+4,800.00', 'g', 'صورة')}
    ${row('01/10/2026', 'رصيد افتتاحي', '+1,200.00', 'g', '')}
  </div>`,
});

const recon = phone({
  top: topBar('مطابقة الرصيد'),
  body: `
  <div class="chips"><span>هذا الشهر</span><span class="on">الربع الحالي</span><span>السنة</span></div>
  <div class="card" style="background:#E7F5EC;border-color:#CDEBD8;padding:12px">
    <div class="fx g8" style="margin-bottom:8px">${ic('whatsapp', 18, '#16A34A')}<span class="f12 b6" style="color:#166534">معاينة الرسالة</span></div>
    <div style="background:#fff;border-radius:14px 4px 14px 14px;padding:12px;font-size:13px;line-height:1.7;box-shadow:0 1px 2px rgba(0,0,0,.06)">
      السلام عليكم أ. محمد العتيبي،<br>نرجو مطابقة رصيدكم لدى <b>مؤسسة العربي التجارية</b> حتى 24/10/2026:<br><b class="num">4,250.00 ريال</b> لصالحنا.<br>مرفق كشف الحساب. يرجى الرد بـ «موافق» أو إرسال ملاحظاتكم.
      <div class="fx g8" style="margin-top:10px;background:#F8FAFC;border-radius:10px;padding:8px">${ic('pdf', 22, 'var(--r)')}<div class="f1"><div class="f12 b6">كشف حساب - محمد العتيبي.pdf</div><div class="f11 mu">صفحتان · 84 KB</div></div></div>
    </div>
  </div>
  <div class="card" style="padding:4px 14px">
    <div class="fx sp" style="padding:9px 0;border-bottom:1px solid #F1F4F8"><span class="f13">إرفاق كشف الحساب PDF</span><div class="tog on"></div></div>
    <div class="fx sp" style="padding:9px 0;border-bottom:1px solid #F1F4F8"><span class="f13">إظهار الحركات بالصور</span><div class="tog"></div></div>
    <div class="fx sp" style="padding:9px 0"><span class="f13">رابط تأكيد الرصيد بضغطة</span><div class="tog on"></div></div>
  </div>
  <div class="card fx g10" style="padding:10px 13px">${ic('check', 18, 'var(--g)', 2.6)}<div class="f1 f12">آخر مطابقة: 30 سبتمبر · <b class="g">أكّدها العميل</b></div></div>
  <div class="btn" style="background:#16A34A;margin-top:auto;margin-bottom:6px">${ic('whatsapp', 20, '#fff')} إرسال عبر واتساب</div>`,
});

const ch = (n, l, used, total, pct, c) => `<div style="padding:10px 0;border-bottom:1px solid #F1F4F8"><div class="fx sp"><div class="fx g8"><span class="chip gr num">${n}</span><span class="f13 b6">${l}</span></div><span class="f12 b7 num ${c}">${pct}%</span></div><div class="prog" style="margin-top:7px"><i style="width:${pct}%;${c === 'a' ? 'background:linear-gradient(90deg,#FBBF24,#D97706)' : ''}"></i></div><div class="fx sp f11 mu" style="margin-top:4px"><span class="num">مصروف ${used}</span><span class="num">المعتمد ${total}</span></div></div>`;
const budget = phone({
  top: topBar('الموازنة 2026', { actions: `<div class="ibtn">${ic('down', 19)}</div>` }),
  body: `
  <div class="card hero" style="border:none;text-align:center"><div class="f12" style="opacity:.8">إجمالي الاعتمادات</div><div class="f28 b7 num">12,400,000</div><div class="fx g8" style="justify-content:center;margin-top:8px"><span class="chip" style="background:rgba(255,255,255,.18);color:#fff">مصروف 54%</span><span class="chip" style="background:rgba(255,255,255,.18);color:#fff">مرتبط 11%</span></div></div>
  <div class="card" style="padding:4px 14px">
    ${ch('1', 'الباب الأول · الرواتب', '4,960,000', '7,200,000', 69, '')}
    ${ch('2', 'الباب الثاني · المستلزمات', '1,010,000', '2,600,000', 39, '')}
    ${ch('3', 'الباب الثالث · المشاريع', '540,000', '2,000,000', 27, '')}
    ${ch('4', 'الباب الرابع · المنح', '520,000', '600,000', 87, 'a')}
  </div>
  <div class="fx sp"><span class="f14 b7">الارتباطات</span><span class="f12 bl b6">الكل</span></div>
  <div class="list">
    <div class="li"><div class="f1"><div class="f13 b6">توريد أجهزة حاسب</div><div class="f11 mu">الباب الثاني · بانتظار اعتماد المدير المالي</div></div><span class="chip a">مطلوب</span></div>
    <div class="li"><div class="f1"><div class="f13 b6">صيانة المبنى الرئيسي</div><div class="f11 mu">الباب الثالث · أمر شراء #PO-118</div></div><span class="chip">مرتبط</span></div>
  </div>
  <div class="btn" style="margin-top:auto;margin-bottom:6px">${ic('plus', 18, '#fff', 2.4)} طلب ارتباط جديد</div>`,
});

module.exports = board('9 · الأساسيات كما هي', 'قيد لنا ولهم بالصور، صفحة العميل وكشف الحساب، والمطابقة على واتساب تبقى بنفس الخطوات، وشاشة الموازنة للجهات الحكومية', [
  { html: entry, cap: 'قيد لنا / لهم', note: 'نفس الخطوات الحالية: الحساب، المبلغ، البيان، والصور' },
  { html: account, cap: 'صفحة العميل', note: 'الرصيد في المنتصف، الحركات بالصور، وكشف الحساب والمطابقة بضغطة' },
  { html: recon, cap: 'المطابقة على واتساب', note: 'معاينة الرسالة وكشف PDF مرفق، ورابط تأكيد الرصيد' },
  { html: budget, cap: 'الموازنة (جهات حكومية)', note: 'الأبواب الأربعة ونسب الصرف والارتباطات، تظهر للجهات الحكومية فقط' },
]);
