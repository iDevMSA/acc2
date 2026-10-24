const { ic, phone, topBar, board } = require('./lib');

const field = (l, v, opt, ltr) => `<div><div class="lbl fx sp"><span>${l}</span>${opt ? '<span class="chip gr" style="padding:1px 8px;font-size:10.5px">إن وُجد</span>' : ''}</div><div class="inp ${ltr ? 'num' : ''}" style="${ltr ? 'justify-content:flex-end' : ''}">${v}</div></div>`;
const company = phone({
  top: topBar('بيانات شركتك', { back: false, actions: '<span class="f13 mu b6">خطوة أخيرة</span>' }),
  body: `
  <div class="f13 mu">تظهر هذه البيانات في الفواتير والتقارير وكشوف الحساب</div>
  <div class="fx g12"><div style="width:68px;height:68px;border-radius:20px;border:1.5px dashed #B6CCF5;background:#F7FAFF;display:flex;flex-direction:column;align-items:center;justify-content:center;color:var(--b2);font-size:10.5px;font-weight:600;gap:2px;flex:none">${ic('camera', 22)}الشعار</div><div class="f1 fx col g8" style="display:flex">${field('اسم المنشأة', 'مؤسسة العربي التجارية')}</div></div>
  ${field('الاسم بالإنجليزية', 'Al-Araby Trading Est.', 0, 1)}
  <div class="fx g8"><div class="f1">${field('الرقم الضريبي', '300987654300003', 1, 1)}</div><div class="f1">${field('السجل التجاري', '1010456789', 1, 1)}</div></div>
  <div class="fx g8"><div class="f1">${field('الجوال', '0558718819', 0, 1)}</div><div class="f1">${field('البريد', 'info@alaraby.sa', 0, 1)}</div></div>
  ${field('العنوان', 'الرياض · حي العليا · شارع التحلية')}
  <div class="card" style="padding:12px;background:#F8FAFC"><div class="f11 mu b6" style="margin-bottom:8px">هكذا تظهر في رأس التقارير</div><div class="fx g10" style="background:#fff;border:1px solid var(--li);border-radius:12px;padding:10px"><div class="av" style="background:linear-gradient(135deg,var(--b),var(--b2));color:#fff">${ic('building', 20, '#fff')}</div><div class="f1"><div class="f13 b7">مؤسسة العربي التجارية</div><div class="f11 mu num" style="text-align:right">ض: 300987654300003 · س.ت: 1010456789</div></div></div></div>
  <div class="fx col g8" style="display:flex;margin-top:auto;margin-bottom:6px"><div class="btn">حفظ ومتابعة</div><div class="f13 bl b6" style="text-align:center;padding:2px">أكمل لاحقاً من الإعدادات</div></div>`,
});

const brow = (acc, side, amt, photo) => `<div class="card" style="padding:10px 12px;display:flex;flex-direction:column;gap:8px"><div class="fx sp"><div class="fx g8"><div class="av c t-b" style="width:28px;height:28px;font-size:12px;font-weight:700">${acc[0]}</div><span class="f13 b6">${acc}</span></div>${ic('x', 15, '#94A3B8')}</div><div class="fx g8"><div class="seg" style="width:118px;padding:2px">${['لنا', 'لهم'].map(x => `<div class="${x === side ? 'on' : ''}" style="padding:5px 2px;${x === side ? `color:${side === 'لنا' ? '#059669' : '#DC2626'}` : ''}">${x}</div>`).join('')}</div><div class="inp f1 num b7" style="padding:7px 10px;justify-content:flex-end;color:${side === 'لنا' ? '#059669' : '#DC2626'}">${amt}</div><div class="ibtn" style="width:36px;height:36px;${photo ? 'background:#E0F2FE;color:var(--b2);border-color:#BAE6FD' : ''}">${ic(photo ? 'img' : 'camera', 17)}</div></div></div>`;
const batch = phone({
  top: topBar('قيود متعددة', { actions: '<span class="f14 bl b7">حفظ الكل</span>' }),
  body: `
  <div class="card fx g8" style="padding:9px 12px;background:#FFF8EB;border-color:#FDE3B5">${ic('lock', 16, 'var(--a)')}<span class="f12 b6">توضيح فقط: الشاشة تبقى كما هي في التطبيق الحالي بالضبط</span></div>
  <div class="fx g8"><div class="f1"><div class="lbl">التاريخ للكل</div><div class="inp num b6">24/10/2026</div></div><div class="f1"><div class="lbl">البيان العام</div><div class="inp">تحصيلات اليوم</div></div></div>
  ${brow('محمد العتيبي', 'لنا', '1,250.00', 1)}
  ${brow('شركة النخبة للتجارة', 'لنا', '2,200.00', 0)}
  ${brow('أحمد سالم', 'لهم', '500.00', 1)}
  ${brow('مؤسسة الريان', 'لهم', '700.00', 0)}
  <div class="fx g8 f13 bl b6" style="justify-content:center;padding:2px">${ic('plus', 16)} سطر جديد</div>
  <div class="card fx sp" style="padding:11px 14px"><div><div class="f11 mu">4 قيود</div><div class="f12 b6"><span class="g num">لنا 3,450.00</span> · <span class="r num">لهم 1,200.00</span></div></div><div class="fx g6">${ic('whatsapp', 16, '#16A34A')}<span class="f11 b6">رسالة لكل حساب</span><div class="tog on"></div></div></div>`,
});

const bub = (me, html) => `<div style="display:flex;justify-content:${me ? 'flex-start' : 'flex-end'}"><div style="max-width:82%;padding:10px 12px;font-size:13px;line-height:1.7;border-radius:${me ? '16px 4px 16px 16px' : '4px 16px 16px 16px'};background:${me ? 'linear-gradient(135deg,#021B79,#0575E6)' : '#fff'};color:${me ? '#fff' : 'var(--ink)'};${me ? '' : 'border:1px solid var(--li)'}">${html}</div></div>`;
const ai = phone({
  top: `<div class="top"><div class="fx g10"><div class="ibtn bk">${ic('back', 20)}</div><div class="av" style="background:linear-gradient(135deg,#7C3AED,#0575E6);color:#fff;width:38px;height:38px">${ic('star', 19, '#fff')}</div><div><div class="f15 b7">المساعد الذكي</div><div class="f11 g b6">● يعرف حساباتك وقيودك</div></div></div><div class="ibtn">${ic('dots', 19)}</div></div>`,
  body: `
  ${bub(1, 'كم رصيد محمد العتيبي؟')}
  ${bub(0, `رصيد <b>محمد العتيبي</b> هو <b class="num g">4,250.00</b> ر.س لصالحك. آخر حركة اليوم: دفعة 1,250.00 مع صورتين.<div class="fx g6" style="margin-top:8px;flex-wrap:wrap"><span class="chip">${ic('file', 12)} كشف الحساب</span><span class="chip g">${ic('whatsapp', 12)} إرسال مطابقة</span></div>`)}
  ${bub(1, 'سجّل لهم 500 لأحمد سالم أجرة نقل')}
  ${bub(0, `جهّزت القيد، راجعه قبل الحفظ:<div style="margin-top:8px;background:#F8FAFC;border:1px solid var(--li);border-radius:12px;padding:9px 10px"><div class="fx sp f12"><span class="mu">الحساب</span><b>أحمد سالم</b></div><div class="fx sp f12" style="margin-top:4px"><span class="mu">النوع</span><b class="r">لهم</b></div><div class="fx sp f12" style="margin-top:4px"><span class="mu">المبلغ</span><b class="num">500.00 ر.س</b></div><div class="fx sp f12" style="margin-top:4px"><span class="mu">البيان</span><b>أجرة نقل</b></div></div><div class="fx g6" style="margin-top:8px"><span class="chip g">${ic('check', 12, 'currentColor', 3)} تأكيد</span><span class="chip gr">تعديل</span></div>`)}
  <div class="chips" style="margin-top:auto;flex-wrap:wrap"><span>من لم يسدد هذا الشهر؟</span><span>أرباح أكتوبر</span><span>أكبر المصروفات</span></div>`,
  foot: `<div style="flex:none;padding:10px 14px 30px;background:#fff;border-top:1px solid var(--li);position:relative"><div class="fx g8"><div class="inp f1"><span class="ph">اكتب سؤالك أو اطلب قيداً…</span></div><div class="ibtn" style="width:44px;height:44px;border-radius:50%">${ic('camera', 19)}</div><div class="ibtn" style="width:44px;height:44px;border-radius:50%;background:var(--b);color:#fff;border:none"><svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="9" y="3" width="6" height="12" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/></svg></div></div><div class="hi"></div></div>`,
});

module.exports = board('10 · بيانات الشركة والقيود المتعددة والمساعد', 'خطوة بيانات الشركة بعد التسجيل، القيود المتعددة بدون أي تغيير، والمساعد الذكي الموجود حالياً بقدرات أكبر', [
  { html: company, cap: 'بيانات شركتك', note: 'بعد التسجيل مباشرة: الاسم والشعار والرقم الضريبي والسجل التجاري، وتظهر في كل التقارير' },
  { html: batch, cap: 'قيود متعددة دفعة واحدة', note: 'بدون أي تغيير: نفس الشاشة والخطوات الحالية بالضبط' },
  { html: ai, cap: 'المساعد الذكي', note: 'الدردشة الموجودة تبقى، ويضاف لها تسجيل القيود وإرسال المطابقات من المحادثة' },
]);
