const { ic, phone, topBar, board } = require('./lib');

const doc = (no, who, amt, st, kind) => `<div class="li"><div class="av ${kind === 'b2b' ? 't-p' : 't-s'}">${ic('file', 19)}</div><div class="f1"><div class="f13 b6 num" style="text-align:right">${no}</div><div class="f11 mu">${who}</div></div><div style="text-align:left;display:flex;flex-direction:column;align-items:flex-end;gap:3px"><span class="f13 b7 num">${amt}</span>${st}</div></div>`;
const einv = phone({
  top: topBar('الفوترة الإلكترونية', { actions: `<div class="ibtn">${ic('gear', 19)}</div>` }),
  body: `
  <div class="card hero" style="border:none">
    <div class="fx sp"><div class="fx g10"><div class="av" style="background:rgba(255,255,255,.16)">${ic('zap', 21, '#fff')}</div><div><div class="f15 b7">ZATCA · المرحلة الثانية</div><div class="f11" style="opacity:.8">الربط والتكامل · بيئة الإنتاج</div></div></div><span class="chip" style="background:#34D399;color:#053B2C">متصل</span></div>
    <div class="fx g8" style="margin-top:14px">${[['مُبلّغة', '1,284'], ['مُعتمدة', '96'], ['بانتظار', '3'], ['مرفوضة', '1']].map(([l, v]) => `<div class="f1" style="background:rgba(255,255,255,.12);border-radius:12px;padding:8px;text-align:center"><div class="f16 b7 num">${v}</div><div class="f11" style="opacity:.8">${l}</div></div>`).join('')}</div>
  </div>
  <div class="card fx g10" style="padding:10px 13px;background:#FEF2F2;border-color:#FBCFCF">${ic('alert', 20, 'var(--r)')}<div class="f1"><div class="f13 b6">فاتورة واحدة مرفوضة</div><div class="f11 mu">الرقم الضريبي للمشتري غير صحيح · #1097</div></div><span class="f12 r b6">إصلاح</span></div>
  <div class="chips"><span class="on">الكل</span><span>مبسطة B2C</span><span>ضريبية B2B</span><span>إشعارات</span></div>
  <div class="list">
    ${doc('24/10-1102-REG1', 'مبسطة · محمد العتيبي', '604.20', '<span class="chip g">مُبلّغة</span>')}
    ${doc('INV-B-0096', 'ضريبية · شركة النخبة للتجارة', '9,200.00', '<span class="chip g">مُعتمدة</span>', 'b2b')}
    ${doc('24/10-1101-REG1', 'مبسطة · عميل نقدي', '216.20', '<span class="chip a">بانتظار الإرسال</span>')}
    ${doc('INV-B-0097', 'ضريبية · مؤسسة الريان', '3,450.00', '<span class="chip r">مرفوضة</span>', 'b2b')}
    ${doc('CN-0012', 'إشعار دائن · شركة النخبة', '-1,150.00', '<span class="chip g">مُعتمدة</span>', 'b2b')}
  </div>`,
});

const box = (n, l, v, c = '') => `<div class="fx sp" style="padding:9px 0;border-bottom:1px solid #F1F4F8"><div class="fx g8"><span class="num f11 mu b6" style="width:18px">${n}</span><span class="f13">${l}</span></div><span class="num f13 b6 ${c}">${v}</span></div>`;
const vat = phone({
  top: topBar('إقرار ضريبة القيمة المضافة', { actions: `<div class="ibtn">${ic('down', 19)}</div>` }),
  body: `
  <div class="card fx sp" style="padding:11px 14px"><div><div class="f11 mu">الفترة</div><div class="f14 b7">الربع الثالث 2026</div></div><div style="text-align:left"><div class="f11 mu">آخر موعد</div><div class="f13 b7 a">29 أكتوبر · بعد 5 أيام</div></div></div>
  <div class="fx g8">
    <div class="card f1" style="padding:11px"><div class="f11 mu">ضريبة المخرجات</div><div class="f16 b7 num">18,960.00</div><div class="f11 mu">على المبيعات</div></div>
    <div class="card f1" style="padding:11px"><div class="f11 mu">ضريبة المدخلات</div><div class="f16 b7 num">7,415.30</div><div class="f11 mu">على المشتريات</div></div>
  </div>
  <div class="card" style="padding:14px;background:linear-gradient(135deg,#FFF7ED,#FFFBF5);border-color:#FDE3B5"><div class="fx sp"><span class="f13 b6">صافي الضريبة المستحقة</span><span class="chip a">للسداد</span></div><div class="fx g6" style="align-items:baseline;margin-top:4px"><span class="f28 b7 num">11,544.70</span><span class="f13 mu b6">SAR</span></div></div>
  <div class="card" style="padding:4px 14px">
    <div class="f12 b7 mu" style="padding:8px 0 2px">المبيعات</div>
    ${box(1, 'المبيعات الخاضعة للنسبة الأساسية', '126,400.00')}
    ${box(3, 'المبيعات المحلية بنسبة صفر', '4,250.00')}
    ${box(5, 'المبيعات المعفاة', '0.00')}
    <div class="f12 b7 mu" style="padding:10px 0 2px">المشتريات</div>
    ${box(7, 'المشتريات الخاضعة للنسبة الأساسية', '49,435.30')}
    ${box(8, 'الاستيرادات الخاضعة للضريبة', '0.00')}
    ${box(11, 'تصحيحات الفترات السابقة', '0.00')}
  </div>
  <div class="fx g8" style="margin-top:auto;margin-bottom:6px"><div class="btn o sm f1">${ic('eye', 18)} الفواتير المؤثرة</div><div class="btn sm f1">${ic('pdf', 18, '#fff')} تصدير الإقرار</div></div>`,
});

const purchase = phone({
  top: topBar('فاتورة مشتريات', { actions: '<span class="f14 bl b7">حفظ</span>' }),
  body: `
  <div class="card fx g10" style="padding:12px;background:#F7FAFF;border-color:#C9DDFB">${ic('camera', 22, 'var(--b2)')}<div class="f1"><div class="f13 b6">صوّر فاتورة المورد</div><div class="f11 mu">نقرأ رمز QR ونعبّئ الرقم الضريبي والمبالغ تلقائياً</div></div></div>
  <div><div class="lbl">المورد</div><div class="inp sp"><span class="b6">شركة التوابل الذهبية</span>${ic('chevd', 18, 'var(--mu)')}</div></div>
  <div class="fx g8"><div class="f1"><div class="lbl">الرقم الضريبي</div><div class="inp num f12 b6" style="justify-content:flex-end">310245678900003</div></div><div style="width:120px"><div class="lbl">رقم الفاتورة</div><div class="inp num b6">S-7781</div></div></div>
  <div class="list">
    <div class="li"><div class="f1"><div class="f13 b6">زعفران 5 جم × 50</div><div class="f11 mu">مستودع الرئيسي</div></div><span class="num b6 f13">3,250.00</span></div>
    <div class="li"><div class="f1"><div class="f13 b6">هيل حب 250 جم × 40</div><div class="f11 mu">مستودع الرئيسي</div></div><span class="num b6 f13">1,200.00</span></div>
  </div>
  <div class="card" style="padding:6px 14px">
    <div class="fx sp f13" style="padding:7px 0"><span class="mu">المجموع قبل الضريبة</span><span class="num b6">4,450.00</span></div>
    <div class="fx sp f13" style="padding:7px 0"><span class="mu">ضريبة المدخلات 15%</span><span class="num b6">667.50</span></div>
    <div class="fx sp" style="padding:7px 0"><span class="b7">الإجمالي</span><span class="num b7 f16">5,117.50</span></div>
  </div>
  <div class="card fx sp" style="padding:10px 13px"><div><div class="f13 b6">ضريبة قابلة للاسترداد</div><div class="f11 mu">تُحتسب في الإقرار (البند 7)</div></div><div class="tog on"></div></div>
  <div class="card fx sp" style="padding:10px 13px"><div><div class="f13 b6">الدفع</div><div class="f11 mu">آجل · يستحق 23 نوفمبر</div></div><span class="chip a">آجل</span></div>`,
});

const taxset = phone({
  top: topBar('إعدادات الضريبة'),
  body: `
  <div class="card fx g10" style="padding:12px"><div class="av t-t" style="font-weight:700">SA</div><div class="f1"><div class="f14 b7">المملكة العربية السعودية</div><div class="f11 mu">قطاع خاص · تجارة جملة وتجزئة</div></div><span class="f12 bl b6">تغيير</span></div>
  <div><div class="lbl">الرقم الضريبي للمنشأة</div><div class="inp sp"><span class="num b6">300987654300003</span><span class="chip g">${ic('check', 12, 'currentColor', 3)} صالح</span></div></div>
  <div class="sec">النسب</div>
  <div class="list">
    <div class="li"><div class="f1 f13 b6">النسبة الأساسية</div><span class="num b7">15%</span><div class="tog on"></div></div>
    <div class="li"><div class="f1 f13 b6">نسبة صفر (تصدير، أدوية)</div><span class="num b7">0%</span><div class="tog on"></div></div>
    <div class="li"><div class="f1 f13 b6">معفى</div><span class="mu f12">—</span><div class="tog on"></div></div>
  </div>
  <div class="sec">الفوترة الإلكترونية</div>
  <div class="card" style="border:2px solid var(--b2);background:#F7FAFF;display:flex;flex-direction:column;gap:10px">
    <div class="fx sp"><div class="fx g8">${ic('zap', 20, 'var(--b2)')}<span class="f14 b7">ZATCA (السعودية)</span></div><span class="chip g">متصل</span></div>
    <div class="fx sp f12"><span class="mu">شهادة الجهاز CSID</span><span class="b6">سارية حتى 10/2027</span></div>
    <div class="fx sp f12"><span class="mu">الأجهزة المربوطة</span><span class="b6">هذا الهاتف + 2 كاشير</span></div>
    <div class="btn o sm">ربط جهاز جديد برمز OTP</div>
  </div>
  <div class="card fx g10" style="padding:11px 13px;opacity:.75"><div class="av t-gr" style="font-weight:700">EG</div><div class="f1"><div class="f13 b6">منظومة ETA (مصر)</div><div class="f11 mu">تظهر تلقائياً عند اختيار مصر</div></div>${ic('chev', 18, 'var(--mu)')}</div>`,
});

module.exports = board('4 · الضرائب والفوترة الإلكترونية', 'ربط ZATCA المرحلة الثانية ومنظومة ETA المصرية من الهاتف، إقرار الضريبة، وضريبة المشتريات بتصوير فاتورة المورد', [
  { html: einv, cap: 'لوحة الفوترة الإلكترونية', note: 'حالة كل فاتورة لدى الهيئة، والمرفوضة تُصلح من الهاتف' },
  { html: vat, cap: 'إقرار ضريبة القيمة المضافة', note: 'المخرجات والمدخلات وصافي المستحق ببنود نموذج الهيئة' },
  { html: purchase, cap: 'فاتورة مشتريات وضريبة المدخلات', note: 'تصوير فاتورة المورد لقراءة QR وتعبئة الحقول' },
  { html: taxset, cap: 'إعدادات الضريبة', note: 'النسب حسب الدولة، الرقم الضريبي، وربط الأجهزة بالهيئة' },
]);
