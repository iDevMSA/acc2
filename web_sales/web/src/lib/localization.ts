// ملاءمة المنصة للدولة والقطاع: السنة المالية، التقويم الهجري، المبلغ كتابةً بالعربية،
// وبيانات كل دولة التي يضبطها معالج إعداد المنشأة (صفحة /setup).
// القيم افتراضية قابلة للتعديل — راجعها مع محاسبك قبل الاعتماد عليها.

export type Sector = 'private' | 'government';
export type Activity = 'trading' | 'services' | 'manufacturing' | 'restaurant' | 'contracting';
export type CalendarMode = 'gregorian' | 'both';

/** إعداد المنشأة — users/{owner}/erp/profile (عقدة للويب وحده) */
export interface BusinessProfile {
  country: string;
  sector: Sector;
  activity: Activity;
  /** شهر بداية السنة المالية 1..12 */
  fiscalYearStartMonth: number;
  calendar: CalendarMode;
  /** السجل التجاري (خاص) أو رمز الجهة (حكومي) — يظهر في ترويسة المستندات */
  crNumber?: string;
  setupAt?: string;
}

export const SECTOR_LABELS: Record<Sector, string> = { private: 'القطاع الخاص', government: 'القطاع الحكومي' };

export const ACTIVITY_LABELS: Record<Activity, string> = {
  trading: 'تجاري (بيع وشراء بضائع)',
  services: 'خدمي (استشارات، صيانة، وكالات)',
  manufacturing: 'صناعي',
  restaurant: 'مطاعم ومقاهٍ',
  contracting: 'مقاولات',
};

export const MONTHS_AR = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];

export interface CountryProfile {
  code: string;
  name: string;
  currency: string;
  /** شهر بداية السنة المالية للجهات الحكومية */
  govFiscalStartMonth: number;
  defaultCalendar: CalendarMode;
  /** اسم نظام التأمينات أو الضمان الاجتماعي */
  socialInsurance: string;
  /** مخصص مكافأة نهاية الخدمة معتاد في الدولة */
  endOfService: boolean;
  /** الزكاة على المنشآت */
  zakat: boolean;
  /** حالة الفوترة الإلكترونية كما تظهر في المعالج */
  eInvoicing: string;
}

// الدول التي اختارها المستخدم للقطاعين الخاص والحكومي
export const COUNTRY_PROFILES: CountryProfile[] = [
  { code: 'SA', name: 'السعودية', currency: 'SAR', govFiscalStartMonth: 1, defaultCalendar: 'both', socialInsurance: 'التأمينات الاجتماعية', endOfService: true, zakat: true, eInvoicing: 'ZATCA المرحلة الثانية — متاحة في صفحة الفوترة الإلكترونية' },
  { code: 'AE', name: 'الإمارات', currency: 'AED', govFiscalStartMonth: 1, defaultCalendar: 'gregorian', socialInsurance: 'المعاشات والتأمينات', endOfService: true, zakat: false, eInvoicing: 'منظومة قادمة (Peppol) — تُضاف عند صدور مواصفاتها النهائية' },
  { code: 'KW', name: 'الكويت', currency: 'KWD', govFiscalStartMonth: 4, defaultCalendar: 'gregorian', socialInsurance: 'التأمينات الاجتماعية', endOfService: true, zakat: false, eInvoicing: 'لا توجد حالياً' },
  { code: 'BH', name: 'البحرين', currency: 'BHD', govFiscalStartMonth: 1, defaultCalendar: 'gregorian', socialInsurance: 'التأمين الاجتماعي', endOfService: true, zakat: false, eInvoicing: 'لا توجد حالياً' },
  { code: 'QA', name: 'قطر', currency: 'QAR', govFiscalStartMonth: 1, defaultCalendar: 'gregorian', socialInsurance: 'التقاعد والمعاشات', endOfService: true, zakat: false, eInvoicing: 'لا توجد حالياً' },
  { code: 'EG', name: 'مصر', currency: 'EGP', govFiscalStartMonth: 7, defaultCalendar: 'gregorian', socialInsurance: 'التأمينات الاجتماعية', endOfService: false, zakat: false, eInvoicing: 'منظومة ETA — متاحة في صفحة الفوترة الإلكترونية' },
  { code: 'JO', name: 'الأردن', currency: 'JOD', govFiscalStartMonth: 1, defaultCalendar: 'gregorian', socialInsurance: 'الضمان الاجتماعي', endOfService: false, zakat: false, eInvoicing: 'نظام JoFotara — يُضاف لاحقاً' },
  { code: 'LB', name: 'لبنان', currency: 'LBP', govFiscalStartMonth: 1, defaultCalendar: 'gregorian', socialInsurance: 'الضمان الاجتماعي', endOfService: true, zakat: false, eInvoicing: 'لا توجد حالياً' },
  { code: 'SY', name: 'سوريا', currency: 'SYP', govFiscalStartMonth: 1, defaultCalendar: 'gregorian', socialInsurance: 'التأمينات الاجتماعية', endOfService: false, zakat: false, eInvoicing: 'لا توجد حالياً' },
];

export const findCountryProfile = (code?: string | null) => COUNTRY_PROFILES.find((c) => c.code === code);

/** القيم التي يقترحها المعالج عند اختيار دولة وقطاع */
export const suggestedProfile = (country: string, sector: Sector, activity: Activity = 'trading'): BusinessProfile => {
  const c = findCountryProfile(country);
  return {
    country,
    sector,
    activity,
    fiscalYearStartMonth: sector === 'government' ? c?.govFiscalStartMonth ?? 1 : 1,
    calendar: c?.defaultCalendar ?? 'gregorian',
  };
};

export const parseProfile = (j: any): BusinessProfile | null => {
  if (!j || typeof j !== 'object' || !j.country) return null;
  const m = Number(j.fiscalYearStartMonth);
  return {
    country: String(j.country),
    sector: j.sector === 'government' ? 'government' : 'private',
    activity: (Object.keys(ACTIVITY_LABELS) as Activity[]).includes(j.activity) ? j.activity : 'trading',
    fiscalYearStartMonth: Number.isInteger(m) && m >= 1 && m <= 12 ? m : 1,
    calendar: j.calendar === 'both' ? 'both' : 'gregorian',
    crNumber: j.crNumber ? String(j.crNumber) : '',
    setupAt: j.setupAt ? String(j.setupAt) : '',
  };
};

/* ───────── السنة المالية ───────── */

const pad = (n: number) => String(n).padStart(2, '0');
const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/** السنة المالية التي يقع فيها التاريخ: من أول شهر البداية حتى آخر يوم قبل بدايتها التالية */
export const fiscalYearOf = (date: Date | string, startMonth = 1) => {
  const d = typeof date === 'string' ? new Date(`${date.slice(0, 10)}T12:00:00`) : date;
  const s = Math.min(Math.max(Math.round(startMonth) || 1, 1), 12) - 1;
  const y = d.getMonth() >= s ? d.getFullYear() : d.getFullYear() - 1;
  const from = new Date(y, s, 1);
  const to = new Date(y + 1, s, 0);
  return { from: ymd(from), to: ymd(to), label: s === 0 ? String(y) : `${y}/${y + 1}` };
};

/* ───────── التقويم الهجري ───────── */

const hijriFmt = new Intl.DateTimeFormat('ar-SA-u-ca-islamic-umalqura-nu-latn', { day: 'numeric', month: 'long', year: 'numeric' });
const gregFmt = new Intl.DateTimeFormat('ar-u-nu-latn-ca-gregory', { day: 'numeric', month: 'long', year: 'numeric' });

const asDate = (v: Date | string) => (typeof v === 'string' ? new Date(v.length <= 10 ? `${v}T12:00:00` : v) : v);

/** "13 جمادى الأولى 1448 هـ" (تقويم أم القرى) */
export const formatHijri = (v: Date | string) => {
  const d = asDate(v);
  return Number.isNaN(d.getTime()) ? '' : hijriFmt.format(d);
};

/** التاريخ الميلادي، ومعه الهجري إذا اختارت المنشأة التقويمين */
export const formatOfficialDate = (v: Date | string, calendar: CalendarMode = 'gregorian') => {
  const d = asDate(v);
  if (Number.isNaN(d.getTime())) return '';
  const g = `${gregFmt.format(d)} م`;
  return calendar === 'both' ? `${g} — ${hijriFmt.format(d)}` : g;
};

/* ───────── المبلغ كتابةً ───────── */

interface Noun {
  one: string;
  two: string;
  /** 3..10 */
  few: string;
  /** 11..99 (تمييز منصوب) */
  many: string;
  fem?: boolean;
}

interface CurrencyWords {
  major: Noun;
  minor: Noun;
  /** عدد الوحدات الصغرى في الوحدة: 100 أو 1000 */
  base: number;
}

const n = (one: string, two: string, few: string, many: string, fem = false): Noun => ({ one, two, few, many, fem });
const fils = n('فلس', 'فلسان', 'فلوس', 'فلساً');
const qirsh = n('قرش', 'قرشان', 'قروش', 'قرشاً');

export const CURRENCY_WORDS: Record<string, CurrencyWords> = {
  SAR: { major: n('ريال سعودي', 'ريالان سعوديان', 'ريالات سعودية', 'ريالاً سعودياً'), minor: n('هللة', 'هللتان', 'هللات', 'هللة', true), base: 100 },
  AED: { major: n('درهم إماراتي', 'درهمان إماراتيان', 'دراهم إماراتية', 'درهماً إماراتياً'), minor: fils, base: 100 },
  KWD: { major: n('دينار كويتي', 'ديناران كويتيان', 'دنانير كويتية', 'ديناراً كويتياً'), minor: fils, base: 1000 },
  BHD: { major: n('دينار بحريني', 'ديناران بحرينيان', 'دنانير بحرينية', 'ديناراً بحرينياً'), minor: fils, base: 1000 },
  QAR: { major: n('ريال قطري', 'ريالان قطريان', 'ريالات قطرية', 'ريالاً قطرياً'), minor: n('درهم', 'درهمان', 'دراهم', 'درهماً'), base: 100 },
  EGP: { major: n('جنيه مصري', 'جنيهان مصريان', 'جنيهات مصرية', 'جنيهاً مصرياً'), minor: qirsh, base: 100 },
  JOD: { major: n('دينار أردني', 'ديناران أردنيان', 'دنانير أردنية', 'ديناراً أردنياً'), minor: fils, base: 1000 },
  LBP: { major: n('ليرة لبنانية', 'ليرتان لبنانيتان', 'ليرات لبنانية', 'ليرة لبنانية', true), minor: qirsh, base: 100 },
  SYP: { major: n('ليرة سورية', 'ليرتان سوريتان', 'ليرات سورية', 'ليرة سورية', true), minor: qirsh, base: 100 },
  OMR: { major: n('ريال عماني', 'ريالان عمانيان', 'ريالات عمانية', 'ريالاً عمانياً'), minor: n('بيسة', 'بيستان', 'بيسات', 'بيسة', true), base: 1000 },
  IQD: { major: n('دينار عراقي', 'ديناران عراقيان', 'دنانير عراقية', 'ديناراً عراقياً'), minor: fils, base: 1000 },
  YER: { major: n('ريال يمني', 'ريالان يمنيان', 'ريالات يمنية', 'ريالاً يمنياً'), minor: fils, base: 100 },
  ILS: { major: n('شيكل', 'شيكلان', 'شواكل', 'شيكلاً'), minor: n('أغورة', 'أغورتان', 'أغورات', 'أغورة', true), base: 100 },
  USD: { major: n('دولار أمريكي', 'دولاران أمريكيان', 'دولارات أمريكية', 'دولاراً أمريكياً'), minor: n('سنت', 'سنتان', 'سنتات', 'سنتاً'), base: 100 },
  EUR: { major: n('يورو', 'يورو', 'يورو', 'يورو'), minor: n('سنت', 'سنتان', 'سنتات', 'سنتاً'), base: 100 },
};

const UNITS_M = ['', 'واحد', 'اثنان', 'ثلاثة', 'أربعة', 'خمسة', 'ستة', 'سبعة', 'ثمانية', 'تسعة', 'عشرة'];
const UNITS_F = ['', 'واحدة', 'اثنتان', 'ثلاث', 'أربع', 'خمس', 'ست', 'سبع', 'ثماني', 'تسع', 'عشر'];
const TENS = ['', '', 'عشرون', 'ثلاثون', 'أربعون', 'خمسون', 'ستون', 'سبعون', 'ثمانون', 'تسعون'];
const HUNDREDS = ['', 'مائة', 'مئتان', 'ثلاثمائة', 'أربعمائة', 'خمسمائة', 'ستمائة', 'سبعمائة', 'ثمانمائة', 'تسعمائة'];

/** رقم من 1 إلى 999 بالكلمات؛ fem = المعدود مؤنث (ليرة، هللة) */
const below1000 = (x: number, fem: boolean): string => {
  const parts: string[] = [];
  const h = Math.floor(x / 100);
  const r = x % 100;
  if (h) parts.push(HUNDREDS[h]);
  if (r) {
    // الأعداد 3..10 تخالف المعدود: ثلاثة ريالات، ثلاث ليرات
    if (r <= 10) parts.push((fem ? UNITS_F : UNITS_M)[r]);
    else if (r === 11) parts.push(fem ? 'إحدى عشرة' : 'أحد عشر');
    else if (r === 12) parts.push(fem ? 'اثنتا عشرة' : 'اثنا عشر');
    else if (r < 20) parts.push(`${(fem ? UNITS_F : UNITS_M)[r - 10]} ${fem ? 'عشرة' : 'عشر'}`);
    else {
      const t = Math.floor(r / 10);
      const o = r % 10;
      parts.push(o ? `${(fem ? UNITS_F : UNITS_M)[o]} و${TENS[t]}` : TENS[t]);
    }
  }
  return parts.join(' و');
};

const SCALES: Noun[] = [
  n('ألف', 'ألفان', 'آلاف', 'ألفاً'),
  n('مليون', 'مليونان', 'ملايين', 'مليوناً'),
  n('مليار', 'ملياران', 'مليارات', 'ملياراً'),
];

/** العدد مع معدوده: "ريال سعودي واحد"، "ريالان"، "ثلاثة ريالات"، "أحد عشر ريالاً"، "مائة ريال" */
const counted = (x: number, noun: Noun): string => {
  if (x === 1) return `${noun.one} ${noun.fem ? 'واحدة' : 'واحد'}`;
  if (x === 2) return noun.two;
  const words = integerWords(x, !!noun.fem);
  const r = x % 100;
  if (r >= 3 && r <= 10) return `${words} ${noun.few}`;
  if (r >= 11) return `${words} ${noun.many}`;
  // ألفا ريال، مليونا دينار (المثنى المضاف)
  return `${words.replace(/(ألف|مليون|مليار)ان$/, '$1ا')} ${noun.one}`;
};

/** عدد صحيح بالكلمات (حتى مئات المليارات) */
export const integerWords = (value: number, fem = false): string => {
  let x = Math.floor(Math.abs(value));
  if (x === 0) return 'صفر';
  const groups: number[] = [];
  while (x > 0) {
    groups.push(x % 1000);
    x = Math.floor(x / 1000);
  }
  const parts: string[] = [];
  for (let i = groups.length - 1; i >= 0; i--) {
    const g = groups[i];
    if (!g) continue;
    if (i === 0) parts.push(below1000(g, fem));
    else {
      const scale = SCALES[i - 1] || SCALES[SCALES.length - 1];
      if (g === 1) parts.push(scale.one);
      else if (g === 2) parts.push(scale.two);
      else {
        const r = g % 100;
        const w = below1000(g, false);
        parts.push(`${w} ${r >= 3 && r <= 10 ? scale.few : r >= 11 ? scale.many : scale.one}`);
      }
    }
  }
  return parts.join(' و');
};

/**
 * المبلغ كتابةً كما يُكتب في الفواتير والسندات:
 * 1250.5 SAR ← "فقط ألف ومئتان وخمسون ريالاً سعودياً وخمسون هللة لا غير"
 */
export const amountInWords = (amount: number, currency: string): string => {
  const cw = CURRENCY_WORDS[currency];
  const base = cw?.base ?? 100;
  const total = Math.round(Math.abs(Number(amount) || 0) * base);
  const major = Math.floor(total / base);
  const minor = total % base;
  const majorText = cw ? (major ? counted(major, cw.major) : `صفر ${cw.major.one}`) : `${integerWords(major)} ${currency}`;
  const minorText = minor ? (cw ? counted(minor, cw.minor) : `${integerWords(minor)} من ${base}`) : '';
  return `فقط ${majorText}${minorText ? ` و${minorText}` : ''} لا غير`;
};
