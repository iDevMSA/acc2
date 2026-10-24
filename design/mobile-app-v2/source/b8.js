const { ic, phone, topBar, board } = require('./lib');

// Current app's 4-tab nav (kept as-is for existing and new users).
const nav4 = (on) => `<div class="nav">${[['home', 'الرئيسية'], ['book', 'الحسابات'], ['chart', 'التقارير'], ['gear', 'الإعدادات']].map((n, i) => `<div class="it${i === on ? ' on' : ''}">${ic(n[0], 23, 'currentColor', i === on ? 2.2 : 1.8)}<span>${n[1]}</span></div>`).join('')}<div class="hi"></div></div>`;
const steps = (n) => `<div class="fx g6">${[1, 2, 3].map(i => `<div class="f1 prog"><i style="width:${i <= n ? 100 : 0}%"></i></div>`).join('')}</div>`;
const opt = (l, on, sub) => `<div class="card" style="padding:11px 12px;${on ? 'border:2px solid var(--b2);background:#F0F6FF' : ''}"><div class="f13 b6 ${on ? 'bl' : ''}">${l}</div>${sub ? `<div class="f11 mu">${sub}</div>` : ''}</div>`;

const q = phone({
  top: topBar('أهلاً بك 👋'.replace(' 👋', ''), { actions: '<span class="f13 mu b6">1 من 3</span>' }),
  body: `
  ${steps(1)}
  <div><div class="f20 b7">عرّفنا على عملك</div><div class="f13 mu" style="margin-top:3px">3 أسئلة فقط لنجهّز لك التطبيق المناسب</div></div>
  <div class="sec">نوع المنشأة</div>
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">${opt('فرد أو عمل حر', 0)}${opt('شركة صغيرة', 0)}${opt('شركة متوسطة', 1)}${opt('جهة حكومية', 0)}</div>
  <div class="sec">المجال</div>
  <div class="chips" style="flex-wrap:wrap"><span>خدمات</span><span class="on">تجارة تجزئة</span><span>جملة</span><span>مطاعم</span><span>مقاولات</span><span>صناعة</span><span>أخرى</span></div>
  <div class="sec">عدد الأفراد</div>
  <div class="seg"><div>أنا فقط</div><div>2-5</div><div class="on">6-20</div><div>+20</div></div>
  <div class="btn" style="margin-top:auto;margin-bottom:6px">التالي</div>`,
});

const tool = (i, t, n, d, on) => `<div class="li"><div class="av ${t}" style="width:36px;height:36px">${ic(i, 19)}</div><div class="f1"><div class="f13 b6">${n}</div><div class="f11 mu">${d}</div></div><div style="width:24px;height:24px;border-radius:8px;flex:none;${on ? 'background:var(--b2)' : 'border:2px solid #CBD5E1'};display:flex;align-items:center;justify-content:center">${on ? ic('check', 15, '#fff', 3) : ''}</div></div>`;
const pick = phone({
  top: topBar('ماذا تحتاج؟', { actions: '<span class="f13 mu b6">2 من 3</span>' }),
  body: `
  ${steps(2)}
  <div class="f13 mu">اختر ما تحتاجه فقط، ويمكنك التغيير لاحقاً من الإعدادات</div>
  <div class="card fx g10" style="padding:11px 13px;background:#F0FBF6;border-color:#BFEBD8">${ic('check', 18, 'var(--g)', 2.6)}<div class="f1"><div class="f13 b6">الأساسيات مضمّنة دائماً</div><div class="f11 mu">قيود لنا ولهم، صور القيود، كشف الحساب، المطابقة على واتساب</div></div></div>
  <div class="list">
    ${tool('receipt', 't-g', 'الفواتير', 'فواتير بيع وشراء للعملاء', 1)}
    ${tool('tag', 't-r', 'الضرائب', 'ضريبة القيمة المضافة والإقرار', 1)}
    ${tool('cart', 't-g', 'نقطة البيع', 'كاشير بمسح الباركود', 0)}
    ${tool('box', 't-a', 'المخزون والأصناف', 'كميات ومستودعات', 0)}
    ${tool('wallet', 't-t', 'صناديق وبنوك متعددة', 'أكثر من صندوق وعملة', 0)}
    ${tool('users', 't-p', 'الفريق والصلاحيات', 'موظفون بصلاحيات محددة', 0)}
    ${tool('sheet', 't-s', 'الاستيراد من Excel', 'نقل بياناتك القديمة', 0)}
  </div>
  <div class="btn" style="margin-top:auto;margin-bottom:6px">التالي</div>`,
});

const sug = (i, t, n, why, added) => `<div class="card" style="padding:12px;display:flex;gap:11px;align-items:flex-start"><div class="av ${t}" style="width:36px;height:36px">${ic(i, 19)}</div><div class="f1"><div class="f13 b7">${n}</div><div class="f11 mu" style="margin-top:2px;line-height:1.5">${why}</div></div>${added ? `<span class="chip g">${ic('check', 12, 'currentColor', 3)} أُضيفت</span>` : `<span class="chip">${ic('plus', 12, 'currentColor', 2.6)} إضافة</span>`}</div>`;
const review = phone({
  top: topBar('راجعنا اختياراتك', { actions: '<span class="f13 mu b6">3 من 3</span>' }),
  body: `
  ${steps(3)}
  <div class="card" style="padding:12px 14px"><div class="f11 mu">عملك</div><div class="f14 b7" style="margin-top:2px">شركة متوسطة · تجارة تجزئة · 6-20 فرداً</div><div class="fx g6" style="margin-top:8px;flex-wrap:wrap"><span class="chip gr">الأساسيات</span><span class="chip g">الفواتير</span><span class="chip g">الضرائب</span></div></div>
  <div class="fx g8" style="padding:2px 2px 0">${ic('zap', 18, 'var(--a)')}<span class="f14 b7">قد تحتاج أيضاً</span><span class="f12 mu">(اختياري)</span></div>
  ${sug('cart', 't-g', 'نقطة البيع', 'محلات التجزئة تبيع بسرعة عند الكاشير، وتصدر فاتورة مبسطة لكل عميل', 1)}
  ${sug('box', 't-a', 'المخزون والأصناف', 'تبيع بضاعة، والمخزون يعرّفك متى ينفد صنف وكم ربحت منه', 0)}
  ${sug('users', 't-p', 'الفريق والصلاحيات', 'لديك 6-20 فرداً، فامنح الكاشير والمحاسب صلاحيات منفصلة', 0)}
  <div class="f11 mu" style="text-align:center">لم نقترح شيئاً لا يناسب عملك</div>
  <div class="fx col g8" style="margin-top:auto;margin-bottom:6px;display:flex"><div class="btn">ابدأ (4 أدوات)</div><div class="f13 bl b6" style="text-align:center;padding:4px">تخطَّ، أكمل باختياراتي فقط</div></div>`,
});

const home = phone({
  white: true,
  bg: 'background:linear-gradient(180deg,#021B79 0,#0A3BB0 230px,#F3F5FA 230px)',
  top: `<div class="top" style="color:#fff"><div class="fx g10"><div class="av c" style="background:rgba(255,255,255,.18);color:#fff;font-weight:700">ع</div><div><div class="f12" style="opacity:.75">أهلاً بك</div><div class="f15 b7">متجر الريان</div></div></div><div class="ibtn" style="background:rgba(255,255,255,.14);border:none;color:#fff">${ic('bell', 20)}</div></div>`,
  body: `
  <div class="card" style="padding:16px"><div class="f13 mu b5">الرصيد · لنا / لهم</div><div class="fx g8" style="margin-top:8px"><div class="f1" style="background:#F0FBF6;border-radius:12px;padding:10px"><div class="f11 mu">لنا</div><div class="f18 b7 g num">0.00</div></div><div class="f1" style="background:#FEF2F2;border-radius:12px;padding:10px"><div class="f11 mu">لهم</div><div class="f18 b7 r num">0.00</div></div></div></div>
  <div class="fx g8"><div class="btn f1" style="background:#059669">${ic('plus', 18, '#fff', 2.4)} قيد لنا</div><div class="btn f1" style="background:#DC2626">${ic('plus', 18, '#fff', 2.4)} قيد لهم</div></div>
  <div class="card" style="padding:12px 14px"><div class="f13 b7" style="margin-bottom:10px">أدواتك</div><div style="display:grid;grid-template-columns:repeat(4,1fr);gap:6px">${[['receipt', 'الفواتير', 't-g'], ['tag', 'الضرائب', 't-r'], ['cart', 'نقطة البيع', 't-g']].map(([i, l, t]) => `<div class="tile"><div class="av ${t}">${ic(i, 22)}</div>${l}</div>`).join('')}<div class="tile" style="color:var(--mu)"><div class="av" style="border:1.5px dashed #CBD5E1;color:var(--mu)">${ic('plus', 22)}</div>إضافة</div></div></div>
  <div class="card fx g10" style="padding:11px 13px;background:#F7FAFF;border-color:#C9DDFB">${ic('zap', 20, 'var(--b2)')}<div class="f1"><div class="f13 b6">جاهز! أضف أول قيد</div><div class="f11 mu">الأدوات الأخرى مخفية حتى تحتاجها</div></div>${ic('x', 16, '#94A3B8')}</div>`,
  foot: nav4(0),
});

const t2 = (i, t, n, on, tag) => `<div class="li"><div class="av ${t}" style="width:34px;height:34px;border-radius:10px">${ic(i, 18)}</div><div class="f1 f13 b6">${n}${tag ? ` <span class="chip a" style="margin-right:4px">${tag}</span>` : ''}</div><div class="tog${on ? ' on' : ''}"></div></div>`;
const manage = phone({
  top: topBar('أدواتي'),
  body: `
  <div class="f13 mu">فعّل ما تحتاجه فقط، وكل أداة تظهر في الرئيسية عند تفعيلها</div>
  <div class="sec">مفعّلة</div>
  <div class="list" style="flex:none">
    ${t2('receipt', 't-g', 'الفواتير', 1)}${t2('tag', 't-r', 'الضرائب', 1)}${t2('cart', 't-g', 'نقطة البيع', 1)}
  </div>
  <div class="sec">متاحة</div>
  <div class="list" style="flex:none">
    ${t2('box', 't-a', 'المخزون والأصناف', 0, 'مقترحة')}${t2('users', 't-p', 'الفريق والصلاحيات', 0, 'مقترحة')}${t2('wallet', 't-t', 'صناديق وبنوك متعددة', 0)}${t2('zap', 't-s', 'الفوترة الإلكترونية', 0)}${t2('sheet', 't-s', 'الاستيراد من Excel', 0)}
  </div>
  <div class="card fx g10" style="padding:10px 13px">${ic('sync', 18, 'var(--b2)')}<div class="f1 f12">أعد الأسئلة لتصلك اقتراحات جديدة</div>${ic('chev', 16, '#94A3B8')}</div>`,
  nav: 4,
});

module.exports = board('8 · تسجيل المستخدم الجديد', 'المستخدم يختار ما يحتاجه، نراجع اختياره حسب نوع منشأته ومجالها وعدد أفرادها، ونقترح أدوات إضافية بخطوة اختيارية', [
  { html: q, cap: '1. عرّفنا على عملك', note: 'نوع المنشأة والمجال وعدد الأفراد، في شاشة واحدة' },
  { html: pick, cap: '2. ماذا تحتاج؟', note: 'الأساسيات مضمّنة دائماً، والباقي يختاره المستخدم' },
  { html: review, cap: '3. مراجعة واقتراحات', note: 'اقتراحات مع السبب فقط إذا ناقص شيء، ويمكن تخطيها' },
  { html: manage, cap: 'الإعدادات > أدواتي', note: 'تفعيل أو إخفاء أي أداة لاحقاً، للجدد والقدامى' },
]);
