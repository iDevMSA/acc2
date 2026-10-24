const { ic, phone, topBar, board } = require('./lib');

const acc = (lvl, code, name, bal, opts = {}) => `<div class="li" style="padding-right:${14 + lvl * 18}px">${opts.folder ? ic(opts.open ? 'chevd' : 'chev', 16, 'var(--mu)', 2.2) : '<span style="width:16px"></span>'}<span class="num f12 mu b6" style="width:40px;text-align:right">${code}</span><div class="f1 f13 ${opts.folder ? 'b7' : 'b5'}">${name}</div><span class="f13 b6 num ${opts.c || ''}">${bal}</span></div>`;
const accounts = phone({
  top: topBar('دليل الحسابات', { back: false, actions: `<div class="ibtn">${ic('down', 19)}</div><div class="ibtn">${ic('filter', 19)}</div>` }),
  body: `
  <div class="inp">${ic('search', 18, '#94A3B8')}<span class="ph">ابحث بالاسم أو الرقم</span></div>
  <div class="chips"><span class="on">الكل</span><span>أصول</span><span>خصوم</span><span>إيرادات</span><span>مصروفات</span></div>
  <div class="fx g8">
    <div class="card f1" style="padding:10px 12px"><div class="f11 mu">إجمالي الأصول</div><div class="f16 b7 num">412,880</div></div>
    <div class="card f1" style="padding:10px 12px"><div class="f11 mu">إجمالي الخصوم</div><div class="f16 b7 num">96,340</div></div>
  </div>
  <div class="list">
    ${acc(0, '1', 'الأصول', '412,880', { folder: 1, open: 1 })}
    ${acc(1, '11', 'الأصول المتداولة', '298,450', { folder: 1, open: 1 })}
    ${acc(2, '1101', 'الصندوق الرئيسي', '18,420')}
    ${acc(2, '1102', 'بنك الراجحي', '45,495')}
    ${acc(2, '1103', 'العملاء', '64,210')}
    ${acc(2, '1104', 'المخزون', '170,325')}
    ${acc(1, '12', 'الأصول الثابتة', '114,430', { folder: 1 })}
    ${acc(0, '2', 'الخصوم', '96,340', { folder: 1 })}
    ${acc(0, '3', 'حقوق الملكية', '250,000', { folder: 1 })}
    ${acc(0, '4', 'الإيرادات', '126,400', { folder: 1, c: 'g' })}
    ${acc(0, '5', 'المصروفات', '78,169', { folder: 1, c: 'r' })}
  </div>`,
  nav: 1,
});

const line = (acct, dr, cr, tag) => `<div class="card" style="padding:10px 12px;display:flex;flex-direction:column;gap:8px"><div class="fx sp"><div class="fx g6"><span class="f13 b6">${acct}</span>${tag || ''}</div>${ic('x', 16, '#94A3B8')}</div><div class="fx g8"><div class="f1 inp" style="padding:8px 10px"><span class="f11 mu">مدين</span><span class="f1 num b6" style="text-align:left">${dr}</span></div><div class="f1 inp" style="padding:8px 10px"><span class="f11 mu">دائن</span><span class="f1 num b6" style="text-align:left">${cr}</span></div></div></div>`;
const entry = phone({
  top: topBar('قيد جديد', { actions: '<span class="f14 bl b7">حفظ</span>' }),
  body: `
  <div class="fx g8">
    <div class="f1"><div class="lbl">التاريخ</div><div class="inp sp"><div><div class="num f13 b6">24/10/2026</div><div class="f11 mu">2 جمادى الأولى 1448</div></div>${ic('cal', 18, 'var(--mu)')}</div></div>
    <div style="width:110px"><div class="lbl">رقم القيد</div><div class="inp num b6" style="height:55px">JE-0418</div></div>
  </div>
  <div><div class="lbl">البيان</div><div class="inp">شراء أدوات مكتبية من مكتبة جرير</div></div>
  ${line('مصروفات مكتبية · 5203', '1,000.00', '0.00')}
  ${line('ضريبة المدخلات · 1150', '150.00', '0.00', '<span class="chip a">تلقائي 15%</span>')}
  ${line('الصندوق الرئيسي · 1101', '0.00', '1,150.00')}
  <div class="card fx sp" style="padding:10px 13px"><div class="fx g8">${ic('tag', 18, 'var(--a)')}<span class="f13 b6">المبلغ يشمل ضريبة 15%</span></div><div class="tog on"></div></div>
  <div class="card fx g10" style="padding:10px 13px;border-style:dashed">${ic('camera', 20, 'var(--b2)')}<span class="f13 b6 bl f1">إرفاق صورة الفاتورة</span><span class="f13 bl b6 fx g4">${ic('plus', 15)} سطر</span></div>
  <div class="card fx sp" style="padding:10px 13px;background:#F0FBF6;border-color:#BFEBD8"><span class="f13 b6 g fx g6">${ic('check', 16, 'currentColor', 2.6)} القيد متوازن</span><span class="num f13 b7">1,150.00 = 1,150.00</span></div>`,
});

const row = (d, desc, dr, cr, bal) => `<tr><td><div class="b6 f12">${desc}</div><div class="f11 mu num" style="text-align:right">${d}</div></td><td class="num g b6">${dr}</td><td class="num r b6">${cr}</td><td class="num b7">${bal}</td></tr>`;
const statement = phone({
  top: topBar('كشف حساب', { actions: `<div class="ibtn">${ic('share', 18)}</div>` }),
  body: `
  <div class="card hero" style="border:none"><div class="fx sp"><div><div class="f12" style="opacity:.75">1103 · العملاء</div><div class="f16 b7">شركة النخبة للتجارة</div></div><div class="av" style="background:rgba(255,255,255,.15)">${ic('users', 20, '#fff')}</div></div><div class="fx sp" style="margin-top:12px"><div><div class="f11" style="opacity:.7">الرصيد الحالي</div><div class="f24 b7 num">23,640.00</div></div><span class="chip" style="background:rgba(255,255,255,.18);color:#fff">مدين</span></div></div>
  <div class="chips"><span>هذا الشهر</span><span class="on">الربع الحالي</span><span>السنة</span><span>${ic('cal', 13)} مخصص</span></div>
  <div class="card" style="padding:6px 10px">
    <table class="tbl"><thead><tr><th>البيان</th><th>مدين</th><th>دائن</th><th>الرصيد</th></tr></thead><tbody>
    <tr><td colspan="3" class="b6 f12 mu">رصيد أول المدة</td><td class="num b7">12,400.00</td></tr>
    ${row('03/07/2026', 'فاتورة #1021', '8,050.00', '', '20,450.00')}
    ${row('19/07/2026', 'سند قبض #208', '', '6,000.00', '14,450.00')}
    ${row('02/08/2026', 'فاتورة #1047', '5,290.00', '', '19,740.00')}
    ${row('28/08/2026', 'مرتجع #12', '', '1,150.00', '18,590.00')}
    ${row('14/09/2026', 'فاتورة #1088', '9,200.00', '', '27,790.00')}
    ${row('30/09/2026', 'سند قبض #231', '', '4,150.00', '23,640.00')}
    </tbody></table>
  </div>
  <div class="fx g8" style="margin-top:auto;margin-bottom:6px"><div class="btn o sm f1">${ic('pdf', 18)} PDF</div><div class="btn o sm f1">${ic('sheet', 18)} Excel</div><div class="btn sm f1">${ic('whatsapp', 18, '#fff')} واتساب</div></div>`,
});

const box = (n, sub, bal, cur, t, i) => `<div class="li"><div class="av ${t}">${ic(i, 20)}</div><div class="f1"><div class="f13 b6">${n}</div><div class="f11 mu">${sub}</div></div><div style="text-align:left"><div class="f14 b7 num">${bal}</div><div class="f11 mu">${cur}</div></div></div>`;
const cash = phone({
  top: topBar('الصناديق والمستودعات', { back: false, actions: `<div class="ibtn">${ic('plus', 20)}</div>` }),
  body: `
  <div class="seg"><div class="on">الصناديق</div><div>البنوك</div><div>المستودعات</div></div>
  <div class="card" style="background:linear-gradient(135deg,#0F766E,#14B8A6);color:#fff;border:none"><div class="f12" style="opacity:.8">إجمالي النقدية بالعملة الرئيسية</div><div class="fx g6" style="align-items:baseline"><span class="f28 b7 num">63,915.00</span><span class="f13 b6">SAR</span></div><div class="fx g8" style="margin-top:10px"><div class="chip" style="background:rgba(255,255,255,.2);color:#fff">${ic('transfer', 13, '#fff')} تحويل بين الصناديق</div><div class="chip" style="background:rgba(255,255,255,.2);color:#fff">${ic('cal', 13, '#fff')} جرد يومي</div></div></div>
  <div class="list">
    ${box('الصندوق الرئيسي', 'الفرع الرئيسي · كاشير أحمد', '18,420.00', 'SAR', 't-t', 'wallet')}
    ${box('صندوق فرع جدة', 'فرع جدة · كاشير سالم', '7,860.50', 'SAR', 't-t', 'wallet')}
    ${box('صندوق الدولار', 'عملة أجنبية · سعر 3.75', '2,140.00', 'USD', 't-a', 'coin')}
    ${box('بنك الراجحي', 'حساب جاري ···· 4471', '45,495.00', 'SAR', 't-s', 'building')}
  </div>
  <div class="fx sp"><span class="f14 b7">حركة اليوم</span><span class="f12 bl b6">كل الحركات</span></div>
  <div class="list">
    <div class="li"><div class="av t-g">${ic('down', 18)}</div><div class="f1"><div class="f13 b6">مبيعات نقطة البيع</div><div class="f11 mu">الصندوق الرئيسي · 14 فاتورة</div></div><span class="f14 b7 g num">+4,982.50</span></div>
    <div class="li"><div class="av t-r">${ic('up', 18)}</div><div class="f1"><div class="f13 b6">صرف إيجار المحل</div><div class="f11 mu">بنك الراجحي</div></div><span class="f14 b7 r num">-6,500.00</span></div>
  </div>`,
  nav: 1,
});

module.exports = board('2 · المحاسبة', 'دليل حسابات شجري، قيد بضريبة تلقائية وصورة مرفقة، كشف حساب قابل للتصدير، والصناديق والبنوك والمستودعات', [
  { html: accounts, cap: 'دليل الحسابات', note: 'شجرة قابلة للطي مع أرصدة حية وفلترة حسب النوع' },
  { html: entry, cap: 'قيد يومية جديد', note: 'تاريخ هجري، سطر ضريبة المدخلات يُضاف تلقائياً، وإرفاق صورة' },
  { html: statement, cap: 'كشف حساب', note: 'رصيد متحرك وتصدير PDF/Excel أو إرسال مباشر عبر واتساب' },
  { html: cash, cap: 'الصناديق والبنوك والمستودعات', note: 'أرصدة متعددة العملات محوّلة للعملة الرئيسية' },
]);
