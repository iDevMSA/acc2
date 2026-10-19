// ملفات الضرائب حسب الدولة
// المعدلات هنا قيم افتراضية قابلة للتعديل من صفحة الضرائب — راجعها مع محاسبك قبل الاعتماد عليها.

export interface TaxCountry {
  code: string;            // ISO 3166-1 alpha-2
  name: string;
  currency: string;
  taxName: string;         // اسم الضريبة كما يظهر في الفاتورة والإقرار
  standardRate: number;    // المعدل الأساسي %
  reducedRates: number[];  // معدلات مخفضة مسموحة %
  hasVat: boolean;         // false = لا توجد ضريبة قيمة مضافة عامة
  trnLabel: string;        // اسم رقم التسجيل الضريبي
  trnPattern?: RegExp;     // تحقق شكلي من الرقم الضريبي
  trnHint?: string;
  authority: string;       // الجهة الضريبية
  filing: 'monthly' | 'quarterly' | 'none';
  eInvoicing?: 'zatca' | 'eta' | 'none';
  notes?: string;
}

export const TAX_COUNTRIES: TaxCountry[] = [
  {
    code: 'SA', name: 'السعودية', currency: 'SAR',
    taxName: 'ضريبة القيمة المضافة', standardRate: 15, reducedRates: [0], hasVat: true,
    trnLabel: 'الرقم الضريبي', trnPattern: /^3\d{13}3$/, trnHint: '15 رقماً يبدأ وينتهي بـ 3',
    authority: 'هيئة الزكاة والضريبة والجمارك (ZATCA)', filing: 'quarterly', eInvoicing: 'zatca',
    notes: 'الفاتورة المبسطة تتطلب رمز QR (المرحلة الأولى من الفوترة الإلكترونية).',
  },
  {
    code: 'AE', name: 'الإمارات', currency: 'AED',
    taxName: 'ضريبة القيمة المضافة', standardRate: 5, reducedRates: [0], hasVat: true,
    trnLabel: 'رقم التسجيل الضريبي (TRN)', trnPattern: /^\d{15}$/, trnHint: '15 رقماً',
    authority: 'الهيئة الاتحادية للضرائب (FTA)', filing: 'quarterly', eInvoicing: 'none',
  },
  {
    code: 'BH', name: 'البحرين', currency: 'BHD',
    taxName: 'ضريبة القيمة المضافة', standardRate: 10, reducedRates: [0], hasVat: true,
    trnLabel: 'رقم حساب ضريبة القيمة المضافة', trnPattern: /^\d{15}$/, trnHint: '15 رقماً',
    authority: 'الجهاز الوطني للإيرادات (NBR)', filing: 'quarterly', eInvoicing: 'none',
  },
  {
    code: 'OM', name: 'عمان', currency: 'OMR',
    taxName: 'ضريبة القيمة المضافة', standardRate: 5, reducedRates: [0], hasVat: true,
    trnLabel: 'رقم التسجيل الضريبي', trnPattern: /^OM\d{10}$/i, trnHint: 'OM متبوعاً بـ 10 أرقام',
    authority: 'جهاز الضرائب', filing: 'quarterly', eInvoicing: 'none',
  },
  {
    code: 'KW', name: 'الكويت', currency: 'KWD',
    taxName: 'ضريبة القيمة المضافة', standardRate: 0, reducedRates: [], hasVat: false,
    trnLabel: 'الرقم الضريبي', authority: '—', filing: 'none', eInvoicing: 'none',
    notes: 'لا تُطبَّق ضريبة قيمة مضافة حالياً.',
  },
  {
    code: 'QA', name: 'قطر', currency: 'QAR',
    taxName: 'ضريبة القيمة المضافة', standardRate: 0, reducedRates: [], hasVat: false,
    trnLabel: 'الرقم الضريبي', authority: 'الهيئة العامة للضرائب', filing: 'none', eInvoicing: 'none',
    notes: 'لا تُطبَّق ضريبة قيمة مضافة حالياً.',
  },
  {
    code: 'EG', name: 'مصر', currency: 'EGP',
    taxName: 'ضريبة القيمة المضافة', standardRate: 14, reducedRates: [5, 0], hasVat: true,
    trnLabel: 'رقم التسجيل الضريبي', trnPattern: /^\d{9}$/, trnHint: '9 أرقام',
    authority: 'مصلحة الضرائب المصرية (ETA)', filing: 'monthly', eInvoicing: 'eta',
    notes: 'الفاتورة والإيصال الإلكتروني يتطلبان ربطاً بمنظومة ETA (غير مضاف بعد).',
  },
  {
    code: 'JO', name: 'الأردن', currency: 'JOD',
    taxName: 'الضريبة العامة على المبيعات', standardRate: 16, reducedRates: [8, 4, 0], hasVat: true,
    trnLabel: 'الرقم الضريبي', authority: 'دائرة ضريبة الدخل والمبيعات', filing: 'monthly', eInvoicing: 'none',
  },
  {
    code: 'IQ', name: 'العراق', currency: 'IQD',
    taxName: 'ضريبة المبيعات', standardRate: 0, reducedRates: [], hasVat: false,
    trnLabel: 'الرقم الضريبي', authority: 'الهيئة العامة للضرائب', filing: 'none', eInvoicing: 'none',
    notes: 'لا توجد ضريبة قيمة مضافة عامة؛ ضريبة المبيعات تُفرض على خدمات وسلع محددة.',
  },
  {
    code: 'LB', name: 'لبنان', currency: 'LBP',
    taxName: 'ضريبة القيمة المضافة', standardRate: 11, reducedRates: [0], hasVat: true,
    trnLabel: 'الرقم المالي', authority: 'وزارة المالية', filing: 'quarterly', eInvoicing: 'none',
  },
  {
    code: 'MA', name: 'المغرب', currency: 'MAD',
    taxName: 'الضريبة على القيمة المضافة', standardRate: 20, reducedRates: [14, 10, 7, 0], hasVat: true,
    trnLabel: 'المعرّف الضريبي (IF)', authority: 'المديرية العامة للضرائب', filing: 'monthly', eInvoicing: 'none',
  },
  {
    code: 'TN', name: 'تونس', currency: 'TND',
    taxName: 'الأداء على القيمة المضافة', standardRate: 19, reducedRates: [13, 7, 0], hasVat: true,
    trnLabel: 'المعرّف الجبائي', authority: 'الإدارة العامة للأداءات', filing: 'monthly', eInvoicing: 'none',
  },
  {
    code: 'DZ', name: 'الجزائر', currency: 'DZD',
    taxName: 'الرسم على القيمة المضافة', standardRate: 19, reducedRates: [9, 0], hasVat: true,
    trnLabel: 'رقم التعريف الجبائي (NIF)', authority: 'المديرية العامة للضرائب', filing: 'monthly', eInvoicing: 'none',
  },
];

export const findTaxCountry = (code?: string | null): TaxCountry | undefined =>
  TAX_COUNTRIES.find((c) => c.code === code);

// الدولة الافتراضية حسب عملة الحساب (نفس العملة المحفوظة في sales/{uid}/settings/currency)
export const countryForCurrency = (currency?: string | null): TaxCountry | undefined =>
  TAX_COUNTRIES.find((c) => c.currency === currency);
