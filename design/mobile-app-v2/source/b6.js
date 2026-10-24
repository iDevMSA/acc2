const { ic, phone, topBar, board } = require('./lib');

const al = (i, t, title, sub, time, act, unread) => `<div class="card" style="padding:12px;display:flex;gap:11px;${unread ? 'border-right:4px solid var(--b2)' : ''}"><div class="av ${t}">${ic(i, 20)}</div><div class="f1"><div class="fx sp"><span class="f13 b7">${title}</span><span class="f11 mu">${time}</span></div><div class="f12 mu" style="margin-top:2px;line-height:1.5">${sub}</div>${act ? `<div class="fx g8" style="margin-top:8px">${act}</div>` : ''}</div></div>`;
const alerts = phone({
  top: topBar('التنبيهات', { actions: `<div class="ibtn">${ic('gear', 19)}</div>` }),
  body: `
  <div class="seg"><div class="on">الكل · 5</div><div>غير مقروءة</div><div>تم التعامل</div></div>
  ${al('pie', 't-r', 'إقرار الضريبة بعد 5 أيام', 'الربع الثالث 2026 · المستحق 11,544.70 ريال', 'الآن', '<span class="chip">فتح الإقرار</span>', 1)}
  ${al('box', 't-a', 'مخزون منخفض: 6 أصناف', 'زعفران 5 جم (4 متبقية)، عود كمبودي (نفد)…', '8:00 ص', '<span class="chip">عرض الأصناف</span><span class="chip gr">تذكير غداً</span>', 1)}
  ${al('receipt', 't-p', 'فواتير متأخرة السداد', '3 عملاء تجاوزوا 30 يوماً · إجمالي 18,240 ريال', 'أمس', `<span class="chip">${ic('whatsapp', 12)} تذكير العملاء</span>`, 1)}
  ${al('wallet', 't-t', 'صندوق فرع جدة تجاوز الحد', 'الرصيد 7,860 ريال · الحد الأقصى 5,000', 'أمس')}
  ${al('crown', 't-a', 'الاشتراك ينتهي خلال 14 يوماً', 'جدّد خطة الهاتف + الويب لتستمر المزامنة', '22 أكتوبر')}
  <div class="card fx g10" style="padding:10px 13px;background:#F7FAFF;border-color:#C9DDFB">${ic('bell', 19, 'var(--b2)')}<div class="f1 f12"><b>إشعارات فورية على الهاتف</b><div class="mu f11">بالإضافة إلى البريد وملخص يومي الساعة 8 ص</div></div><div class="tog on"></div></div>`,
});

const mem = (av, n, role, rc, sub, on = true) => `<div class="li"><div class="av c ${rc.replace('chip ', 't-')}" style="font-weight:700">${av}</div><div class="f1"><div class="f13 b6">${n}</div><div class="f11 mu">${sub}</div></div><span class="${rc}">${role}</span></div>`;
const perm = (l, v) => `<div class="fx sp" style="padding:7px 0;border-bottom:1px solid #F1F4F8"><span class="f13">${l}</span><div class="seg" style="width:150px;padding:2px">${['لا', 'عرض', 'تعديل'].map(x => `<div class="${x === v ? 'on' : ''}" style="padding:4px 2px;font-size:11px">${x}</div>`).join('')}</div></div>`;
const team = phone({
  top: topBar('الفريق والصلاحيات', { actions: `<div class="ibtn" style="background:var(--b);color:#fff;border:none">${ic('plus', 20)}</div>` }),
  body: `
  <div class="list">
    ${mem('م', 'موسى (أنت)', 'المالك', 'chip', 'كل الصلاحيات')}
    ${mem('س', 'سارة الأحمد', 'محاسب', 'chip p', 'آخر نشاط: قبل 10 دقائق · ويب')}
    ${mem('خ', 'خالد العمري', 'مدير فرع', 'chip g', 'فرع جدة · هاتف')}
    ${mem('أ', 'أحمد', 'كاشير', 'chip a', 'صندوق 1 · نقطة البيع فقط')}
    ${mem('ن', 'نورة', 'مشاهد', 'chip gr', 'دعوة بانتظار القبول')}
  </div>
  <div class="card" style="padding:12px 14px">
    <div class="fx sp"><div class="fx g8"><div class="av c t-p" style="width:32px;height:32px;font-weight:700">س</div><span class="f14 b7">صلاحيات سارة</span></div><span class="chip p">محاسب</span></div>
    <div style="margin-top:6px">
      ${perm('القيود والحسابات', 'تعديل')}
      ${perm('الفواتير والمبيعات', 'عرض')}
      ${perm('الضرائب والإقرارات', 'تعديل')}
      ${perm('الصناديق والبنوك', 'عرض')}
      ${perm('الفريق والإعدادات', 'لا')}
    </div>
    <div class="fx sp" style="padding:9px 0 0"><span class="f13">إيقاف الحساب مؤقتاً</span><div class="tog"></div></div>
  </div>`,
});

const ev = (av, who, what, where, time, dev, diff) => `<div class="fx g10" style="position:relative"><div class="fx col" style="align-items:center"><div class="av c t-b" style="width:34px;height:34px;font-weight:700;font-size:13px">${av}</div><div style="flex:1;width:2px;background:var(--li);margin-top:4px"></div></div><div class="card f1" style="padding:10px 12px;margin-bottom:10px"><div class="fx sp"><span class="f13 b6">${who} <span class="mu b5">${what}</span></span><span class="f11 mu">${time}</span></div><div class="f12 b6" style="margin-top:3px">${where}</div>${diff ? `<div class="f11" style="margin-top:6px;background:#F8FAFC;border-radius:8px;padding:6px 8px"><span class="r num" style="text-decoration:line-through">${diff[0]}</span> ← <span class="g num b6">${diff[1]}</span></div>` : ''}<div class="fx g4 f11 mu" style="margin-top:5px">${ic(dev === 'هاتف' ? 'phone' : 'monitor', 12)} ${dev}</div></div></div>`;
const audit = phone({
  top: topBar('سجل التدقيق', { actions: `<div class="ibtn">${ic('filter', 19)}</div>` }),
  body: `
  <div class="chips"><span class="on">الكل</span><span>سارة</span><span>خالد</span><span>أحمد</span><span>اليوم</span></div>
  <div class="f12 b7 mu">اليوم</div>
  <div>
  ${ev('س', 'سارة', 'عدّلت قيداً', 'JE-0412 · مصروفات صيانة', '10:42 ص', 'ويب', ['1,200.00', '1,450.00'])}
  ${ev('أ', 'أحمد', 'ألغى فاتورة', '#1099 · عميل نقدي · 216.20', '10:05 ص', 'هاتف')}
  ${ev('خ', 'خالد', 'أضاف صنفاً', 'هيل حب 250 جم · مستودع جدة', '9:31 ص', 'هاتف')}
  ${ev('م', 'موسى', 'غيّر صلاحيات', 'سارة: الضرائب ← تعديل', '9:02 ص', 'هاتف')}
  ${ev('س', 'سارة', 'صدّرت تقريراً', 'ميزان المراجعة · Excel', '8:47 ص', 'ويب')}
  </div>`,
});

const set = (i, t, l, v) => `<div class="li"><div class="av ${t}" style="width:34px;height:34px;border-radius:10px">${ic(i, 18)}</div><div class="f1 f13 b6">${l}</div>${v}${ic('chev', 16, '#94A3B8')}</div>`;
const settings = phone({
  top: topBar('الإعدادات', { back: false }),
  body: `
  <div class="card fx g12"><div class="av" style="width:52px;height:52px;border-radius:16px;background:linear-gradient(135deg,var(--b),var(--b2));color:#fff">${ic('building', 26, '#fff')}</div><div class="f1"><div class="f15 b7">مؤسسة العربي التجارية</div><div class="f12 mu num" style="text-align:right">mousa@alaraby.sa</div></div><span class="chip p">${ic('crown', 12)} هاتف + ويب</span></div>
  <div class="list">
    ${set('building', 't-b', 'بيانات المنشأة والشعار', '')}
    ${set('globe', 't-t', 'الدولة والقطاع والسنة المالية', '<span class="f12 mu">السعودية</span>')}
    ${set('coin', 't-a', 'العملة الرئيسية', '<span class="chip g">SAR · متزامنة مع الويب</span>')}
    ${set('tag', 't-r', 'الضرائب والفوترة الإلكترونية', '')}
    ${set('layers', 't-g', 'كل الأدوات', '')}
  </div>
  <div class="list">
    ${set('bell', 't-r', 'الإشعارات الذكية', '<span class="f12 mu">مفعّلة</span>')}
    ${set('whatsapp', 't-g', 'رسائل واتساب التلقائية', '<span class="chip g">تعمل</span>')}
    ${set('grid', 't-b', 'أدواتي', '<span class="f12 mu">4 مفعّلة</span>')}
        <div class="li"><div class="av t-p" style="width:34px;height:34px;border-radius:10px">${ic('moon', 18)}</div><div class="f1 f13 b6">الوضع الليلي</div><div class="tog"></div></div>
    <div class="li"><div class="av t-g" style="width:34px;height:34px;border-radius:10px">${ic('finger', 18)}</div><div class="f1 f13 b6">قفل التطبيق بالبصمة</div><div class="tog on"></div></div>
  </div>
  <div class="list">
    ${set('cloud', 't-s', 'المزامنة', '<span class="f12 g b6">قبل دقيقة</span>')}
    ${set('crown', 't-a', 'الاشتراك', '<span class="f12 mu">حتى 7 نوفمبر</span>')}
  </div>`,
  nav: 4,
});

module.exports = board('6 · التنبيهات والفريق والإعدادات', 'تنبيهات ذكية بإشعارات فورية، أدوار وصلاحيات لكل منطقة، سجل تدقيق يشمل الهاتف والويب، وإعدادات موحدة', [
  { html: alerts, cap: 'مركز التنبيهات', note: 'إقرار قريب، مخزون منخفض، فواتير متأخرة، مع إجراء مباشر من التنبيه' },
  { html: team, cap: 'الفريق والصلاحيات', note: 'محاسب، مدير فرع، كاشير، مشاهد، مع تعديل كل منطقة على حدة' },
  { html: audit, cap: 'سجل التدقيق', note: 'من فعل ماذا ومتى ومن أي جهاز، مع القيمة قبل وبعد' },
  { html: settings, cap: 'الإعدادات', note: 'العملة الرئيسية متزامنة مع الويب، البصمة، الوضع الليلي' },
]);
