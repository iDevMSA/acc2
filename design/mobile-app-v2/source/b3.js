const { ic, qr, phone, topBar, board } = require('./lib');

const prod = (n, p, c, sel) => `<div class="card" style="padding:8px;${sel ? 'border:2px solid var(--b2)' : ''}"><div style="height:62px;border-radius:12px;background:${c};display:flex;align-items:center;justify-content:center;position:relative">${ic('box', 26, 'rgba(15,23,42,.35)')}${sel ? `<span class="chip" style="position:absolute;top:5px;left:5px;background:var(--b2);color:#fff;padding:2px 8px">${sel}</span>` : ''}</div><div class="f12 b6" style="margin-top:6px;white-space:nowrap;overflow:hidden">${n}</div><div class="f13 b7 bl num" style="text-align:right">${p}</div></div>`;
const pos = phone({
  top: `<div class="top"><div class="fx g10"><div class="ibtn">${ic('back', 20)}</div><div><div class="f16 b7">نقطة البيع</div><div class="f11 mu">الفرع الرئيسي · صندوق 1 · أحمد</div></div></div><div class="fx g8"><span class="chip g">● مفتوحة</span></div></div>`,
  body: `
  <div class="fx g8"><div class="inp f1">${ic('search', 18, '#94A3B8')}<span class="ph">صنف أو باركود</span></div><div class="ibtn" style="width:46px;height:46px;background:var(--b);color:#fff;border:none">${ic('scan', 22)}</div></div>
  <div class="chips"><span class="on">الكل</span><span>بهارات</span><span>قهوة</span><span>تمور</span><span>عطور</span></div>
  <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px">
    ${prod('زعفران 5 جم', '94.00', '#FEF3C7', '2')}${prod('قهوة خولاني', '62.50', '#E7E5E4')}${prod('تمر سكري 1 كجم', '38.00', '#FDE68A', '1')}
    ${prod('هيل حب 250 جم', '45.00', '#DCFCE7')}${prod('عود كمبودي', '320.00', '#EDE9FE', '1')}${prod('بخور معمول', '28.00', '#FCE7F3')}
    ${prod('ماء ورد طائفي', '55.00', '#FFE4E6')}${prod('عسل سدر', '180.00', '#FEF9C3')}${prod('شاي أخضر', '24.00', '#D1FAE5')}
  </div>`,
  foot: `<div style="flex:none;background:#fff;border-radius:24px 24px 0 0;box-shadow:0 -10px 30px -10px rgba(2,27,121,.25);padding:14px 18px 30px;position:relative">
    <div class="fx sp"><div class="fx g8"><div class="av t-b" style="width:34px;height:34px">${ic('cart', 18)}</div><div><div class="f13 b6">4 أصناف في السلة</div><div class="f11 mu">شامل ضريبة 15%</div></div></div><div style="text-align:left"><div class="f20 b7 num">604.20</div><div class="f11 mu">SAR</div></div></div>
    <div class="fx g8" style="margin-top:12px"><div class="btn o sm" style="width:90px">تعليق</div><div class="btn f1">الدفع ${ic('chev', 18, '#fff', 2.4)}</div></div><div class="hi"></div></div>`,
});

const pm = (i, l, on) => `<div class="card f1" style="padding:12px 6px;text-align:center;${on ? 'border:2px solid var(--b2);background:#F0F6FF' : ''}"><div style="display:flex;justify-content:center">${ic(i, 24, on ? 'var(--b2)' : 'var(--mu)')}</div><div class="f12 b6" style="margin-top:4px">${l}</div></div>`;
const checkout = phone({
  top: topBar('الدفع'),
  body: `
  <div class="card" style="text-align:center;padding:18px"><div class="f13 mu">المبلغ المستحق</div><div class="fx g6" style="justify-content:center;align-items:baseline"><span class="f28 b7 num">604.20</span><span class="f14 mu b6">SAR</span></div><div class="f12 mu" style="margin-top:2px">ستمائة وأربعة ريالات وعشرون هللة</div></div>
  <div class="card" style="padding:6px 14px">
    <div class="fx sp f13" style="padding:7px 0"><span class="mu">المجموع قبل الضريبة</span><span class="num b6">525.39</span></div>
    <div class="fx sp f13" style="padding:7px 0"><span class="mu">ضريبة القيمة المضافة 15%</span><span class="num b6">78.81</span></div>
    <div class="fx sp f13" style="padding:7px 0"><span class="mu">خصم</span><span class="num b6 r">0.00</span></div>
  </div>
  <div class="sec">طريقة الدفع</div>
  <div class="fx g8">${pm('coin', 'نقداً', 1)}${pm('wallet', 'بطاقة')}${pm('transfer', 'تحويل')}${pm('layers', 'مجزأ')}</div>
  <div class="fx g8"><div class="f1"><div class="lbl">المستلم</div><div class="inp num b6" style="justify-content:flex-end">700.00</div></div><div class="f1"><div class="lbl">الباقي</div><div class="inp num b7 g" style="justify-content:flex-end">95.80</div></div></div>
  <div class="card fx g10" style="padding:10px 13px">${ic('users', 20, 'var(--mu)')}<div class="f1"><div class="f13 b6">محمد العتيبي</div><div class="f11 mu num" style="text-align:right">0558718819</div></div><span class="f12 bl b6">تغيير</span></div>
  <div class="card fx g10" style="padding:10px 13px;background:#F0F6FF;border-color:#C9DDFB">${ic('zap', 20, 'var(--b2)')}<div class="f1"><div class="f13 b6">فاتورة ضريبية مبسطة</div><div class="f11 mu">تُوقّع وتُرسل لهيئة الزكاة تلقائياً</div></div></div>
  <div class="btn" style="margin-top:auto;margin-bottom:6px">${ic('check', 18, '#fff', 2.6)} إتمام البيع وطباعة</div>`,
});

const invoice = phone({
  top: topBar('فاتورة #1102', { actions: `<div class="ibtn">${ic('dots', 19)}</div>` }),
  body: `
  <div class="card fx g12">
    <div style="padding:4px;border:1px solid var(--li);border-radius:12px">${qr(104, 11)}</div>
    <div class="f1 fx col g6">
      <div class="fx g6"><span class="chip g">مغلقة</span><span class="chip g">${ic('check', 12, 'currentColor', 3)} مُبلّغة ZATCA</span></div>
      <div class="f11 mu">رقم الفاتورة</div><div class="num b7 f13" style="text-align:right">24/10-1102-REG1</div>
      <div class="f11 mu">التاريخ</div><div class="f12 b6">24 أكتوبر 2026 · 10:24 ص</div>
    </div>
  </div>
  <div class="card" style="padding:6px 12px">
    <table class="tbl"><thead><tr><th>الصنف</th><th>الكمية</th><th>السعر</th><th>الإجمالي</th></tr></thead><tbody>
      <tr><td class="b6">زعفران 5 جم</td><td class="num">2</td><td class="num">94.00</td><td class="num b6">216.20</td></tr>
      <tr><td class="b6">تمر سكري 1 كجم</td><td class="num">1</td><td class="num">38.00</td><td class="num b6">43.70</td></tr>
      <tr><td class="b6">عود كمبودي</td><td class="num">1</td><td class="num">320.00</td><td class="num b6">368.00</td></tr>
    </tbody></table>
    <div class="fx sp f13" style="padding:8px 4px 2px"><span class="mu">الضريبة</span><span class="num b6">78.81</span></div>
    <div class="fx sp" style="padding:4px 4px 6px"><span class="b7 f14">الإجمالي</span><span class="num b7 f18">604.20 SAR</span></div>
  </div>
  <div class="card" style="padding:10px 13px"><div class="fx sp f12"><span class="mu">الكاشير</span><span class="b6">أحمد · صندوق 1</span></div><div class="fx sp f12" style="margin-top:6px"><span class="mu">الدفع</span><span class="b6">نقداً</span></div><div class="fx sp f12" style="margin-top:6px"><span class="mu">UUID</span><span class="num mu">8e1f…c42a</span></div></div>
  <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px">${[['print', 'طباعة'], ['pdf', 'PDF'], ['whatsapp', 'واتساب'], ['transfer', 'إشعار دائن']].map(([i, l]) => `<div class="tile"><div class="av t-b">${ic(i, 21)}</div>${l}</div>`).join('')}</div>`,
});

const item = (n, code, stock, price, st) => `<div class="li"><div class="av t-a">${ic('box', 19)}</div><div class="f1"><div class="f13 b6">${n}</div><div class="f11 mu num" style="text-align:right">${code}</div></div><div style="text-align:left"><div class="f13 b7 num">${price}</div>${st}</div></div>`;
const products = phone({
  top: topBar('الأصناف والمخزون', { actions: `<div class="ibtn">${ic('scan', 19)}</div><div class="ibtn">${ic('plus', 20)}</div>` }),
  body: `
  <div class="seg"><div class="on">الأصناف</div><div>المستودعات</div><div>الفروع</div></div>
  <div class="fx g8">
    <div class="card f1" style="padding:10px 12px"><div class="f11 mu">قيمة المخزون</div><div class="f16 b7 num">170,325</div></div>
    <div class="card f1" style="padding:10px 12px;background:#FFF8EB;border-color:#FDE3B5"><div class="f11 mu">منخفض</div><div class="f16 b7 a num">6 أصناف</div></div>
  </div>
  <div class="card fx g10" style="padding:10px 12px;border-style:dashed;border-color:#B6CCF5;background:#F7FAFF">${ic('zap', 20, 'var(--b2)')}<div class="f1"><div class="f13 b6">امسح باركود صنف جديد</div><div class="f11 mu">نجلب الاسم والصورة تلقائياً من Open Food Facts</div></div></div>
  <div class="chips"><span class="on">كل المستودعات</span><span>الرئيسي</span><span>جدة</span><span>المعرض</span></div>
  <div class="list">
    ${item('زعفران 5 جم', '6281000012345', 4, '94.00', '<span class="chip a">متبقي 4</span>')}
    ${item('قهوة خولاني 500 جم', '6281000067890', 38, '62.50', '<span class="f11 g b6">38 متوفر</span>')}
    ${item('تمر سكري 1 كجم', '6281000033221', 120, '38.00', '<span class="f11 g b6">120 متوفر</span>')}
    ${item('عود كمبودي 12 جم', '6281000099887', 0, '320.00', '<span class="chip r">نفد</span>')}
    ${item('هيل حب 250 جم', '6281000044556', 22, '45.00', '<span class="f11 g b6">22 متوفر</span>')}
  </div>`,
});

module.exports = board('3 · المبيعات ونقطة البيع', 'كاشير سريع بمسح الباركود بالكاميرا، دفع نقدي وبطاقة ومجزأ، فاتورة ضريبية برمز QR، وأصناف ومستودعات وفروع', [
  { html: pos, cap: 'نقطة البيع', note: 'شبكة أصناف، مسح بالكاميرا، وسلة ثابتة أسفل الشاشة' },
  { html: checkout, cap: 'الدفع', note: 'المبلغ كتابةً، طرق دفع متعددة، وتوقيع الفاتورة تلقائياً' },
  { html: invoice, cap: 'تفاصيل الفاتورة', note: 'رمز QR وحالة الإبلاغ للهيئة، طباعة ومشاركة وإشعار دائن' },
  { html: products, cap: 'الأصناف والمخزون', note: 'تنبيه المخزون المنخفض، والبحث عن الباركود في Open Food Facts' },
]);
