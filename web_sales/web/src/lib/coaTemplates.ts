// قوالب دليل الحسابات حسب الدولة والقطاع والنشاط.
// القالب يُنشئ حسابات جديدة فقط (بنفس شكل حسابات الهاتف) ولا يعدّل أي حساب موجود؛
// الحساب الموجود بنفس الكود أو الاسم يُعتبر مطابقاً ويُتخطّى.

import { Account, AccountCategory, AccountRole } from './ledger';
import { ErpSettings } from './erp';
import { Activity, BusinessProfile, findCountryProfile } from './localization';
import { findTaxCountry } from '../tax/countries';

/** أبواب الموازنة الحكومية (تصنيف إحصاءات مالية الحكومة GFS المعتمد في أغلب الدول العربية) */
export type BudgetChapter = '1' | '2' | '3' | '4';

export const CHAPTER_LABELS: Record<BudgetChapter, string> = {
  '1': 'الباب الأول: تعويضات العاملين',
  '2': 'الباب الثاني: السلع والخدمات',
  '3': 'الباب الثالث: الإعانات والمنح والمنافع الاجتماعية',
  '4': 'الباب الرابع: الأصول غير المالية (المشاريع)',
};

/** حسابات الإعدادات التي يربطها القالب تلقائياً إن لم تكن محددة */
export type SettingKey = Extract<
  keyof ErpSettings,
  | 'salesAccountId'
  | 'purchasesAccountId'
  | 'cogsAccountId'
  | 'vatAccountId'
  | 'salariesAccountId'
  | 'payrollDeductionsAccountId'
  | 'retainedEarningsAccountId'
  | 'chequesInAccountId'
  | 'chequesOutAccountId'
>;

export interface TemplateAccount {
  code: string;
  name: string;
  category: AccountCategory;
  type?: 'cash' | 'bank';
  role?: AccountRole;
  setting?: SettingKey;
  chapter?: BudgetChapter;
}

const a = (code: string, name: string, category: AccountCategory, extra: Partial<TemplateAccount> = {}): TemplateAccount => ({
  code,
  name,
  category,
  ...extra,
});

const tradingLike: Activity[] = ['trading', 'restaurant', 'manufacturing'];

const privateTemplate = (p: BusinessProfile): TemplateAccount[] => {
  const c = findCountryProfile(p.country);
  const tax = findTaxCountry(p.country);
  const act = p.activity;
  const out: TemplateAccount[] = [
    // الأصول
    a('1101', 'الصندوق الرئيسي', 'asset', { type: 'cash', role: 'cash' }),
    a('1102', 'البنك', 'asset', { type: 'bank', role: 'bank' }),
    a('1301', 'أوراق القبض (شيكات واردة)', 'asset', { setting: 'chequesInAccountId' }),
    a('1501', 'الأثاث والتجهيزات', 'asset'),
    a('1502', 'السيارات', 'asset'),
    a('1503', 'الأجهزة والمعدات', 'asset'),
    a('1509', 'مجمع الإهلاك', 'asset'),
    // الخصوم
    a('2101', 'أوراق الدفع (شيكات صادرة)', 'liability', { setting: 'chequesOutAccountId' }),
    a('2201', 'استقطاعات الرواتب المستحقة', 'liability', { setting: 'payrollDeductionsAccountId' }),
    a('2203', `${c?.socialInsurance || 'التأمينات الاجتماعية'} المستحقة`, 'liability'),
    // حقوق الملكية
    a('3101', 'رأس المال', 'equity'),
    a('3201', 'الأرباح المحتجزة', 'equity', { setting: 'retainedEarningsAccountId' }),
    a('3301', 'جاري المالك / الشركاء', 'equity'),
    // الإيرادات
    a(
      '4101',
      act === 'services' ? 'إيرادات الخدمات' : act === 'contracting' ? 'إيرادات العقود والمستخلصات' : act === 'restaurant' ? 'مبيعات الطعام والمشروبات' : 'المبيعات',
      'revenue',
      { setting: 'salesAccountId' },
    ),
    a('4901', 'إيرادات أخرى', 'revenue'),
    // المصروفات
    a('5201', 'الرواتب والأجور', 'expense', { setting: 'salariesAccountId' }),
    a('5202', 'الإيجار', 'expense'),
    a('5203', 'الكهرباء والماء', 'expense'),
    a('5204', 'الاتصالات والإنترنت', 'expense'),
    a('5205', 'مصروف الإهلاك', 'expense'),
    a('5206', 'العمولات والمصاريف البنكية', 'expense'),
    a('5207', 'الدعاية والتسويق', 'expense'),
    a('5208', 'الرسوم الحكومية والتراخيص', 'expense'),
    a('5209', `حصة المنشأة في ${c?.socialInsurance || 'التأمينات الاجتماعية'}`, 'expense'),
    a('5299', 'مصروفات متنوعة', 'expense'),
  ];
  if (tax?.hasVat) out.push(a('2301', tax.taxName, 'liability', { setting: 'vatAccountId' }));
  if (c?.endOfService) {
    out.push(a('2401', 'مخصص مكافأة نهاية الخدمة', 'liability'));
    out.push(a('5210', 'مصروف مكافأة نهاية الخدمة', 'expense'));
  }
  if (c?.zakat) {
    out.push(a('2402', 'الزكاة المستحقة', 'liability'));
    out.push(a('5211', 'مصروف الزكاة', 'expense'));
  }
  if (tradingLike.includes(act)) {
    out.push(a('1201', 'المخزون', 'asset'));
    out.push(a('5101', 'المشتريات', 'expense', { setting: 'purchasesAccountId' }));
    out.push(a('5102', 'تكلفة البضاعة المباعة', 'expense', { setting: 'cogsAccountId' }));
  }
  if (act === 'manufacturing') {
    out.push(a('1202', 'المواد الخام', 'asset'));
    out.push(a('1203', 'إنتاج تحت التشغيل', 'asset'));
    out.push(a('5301', 'المواد الخام المستخدمة', 'expense'));
    out.push(a('5302', 'الأجور المباشرة', 'expense'));
    out.push(a('5303', 'مصاريف صناعية غير مباشرة', 'expense'));
  }
  if (act === 'restaurant') {
    out.push(a('5401', 'مصاريف التوصيل وتطبيقات الطلب', 'expense'));
    out.push(a('5402', 'مواد التغليف', 'expense'));
  }
  if (act === 'contracting') {
    out.push(a('1204', 'محتجزات ضمان لدى العملاء', 'asset'));
    out.push(a('2501', 'محتجزات ضمان مقاولي الباطن', 'liability'));
    out.push(a('5101', 'مواد المشاريع', 'expense', { setting: 'purchasesAccountId' }));
    out.push(a('5501', 'مقاولو الباطن', 'expense'));
    out.push(a('5502', 'إيجار المعدات والآليات', 'expense'));
  }
  if (act === 'services') out.push(a('5101', 'تكاليف تقديم الخدمات', 'expense', { setting: 'purchasesAccountId' }));
  return out;
};

const governmentTemplate = (p: BusinessProfile): TemplateAccount[] => {
  const c = findCountryProfile(p.country);
  return [
    a('1101', 'الصندوق (العهد النقدية)', 'asset', { type: 'cash', role: 'cash' }),
    a('1102', 'حساب الجهة لدى البنك', 'asset', { type: 'bank', role: 'bank' }),
    a('1201', 'السلف المستديمة والعهد', 'asset'),
    a('1501', 'الأصول الثابتة', 'asset'),
    a('2101', 'الأمانات والتأمينات المحتجزة', 'liability'),
    a('2201', 'استقطاعات الرواتب المستحقة', 'liability', { setting: 'payrollDeductionsAccountId' }),
    a('2202', `اشتراكات ${c?.socialInsurance || 'التقاعد'} المستحقة`, 'liability'),
    a('3101', 'صافي الأصول (الفائض المتراكم)', 'equity', { setting: 'retainedEarningsAccountId' }),
    a('4101', 'التمويل من الموازنة العامة', 'revenue'),
    a('4102', 'الرسوم ومقابل الخدمات', 'revenue', { setting: 'salesAccountId' }),
    a('4103', 'المنح والتبرعات', 'revenue'),
    a('4901', 'إيرادات أخرى', 'revenue'),
    // الباب الأول
    a('5101', 'الرواتب الأساسية', 'expense', { setting: 'salariesAccountId', chapter: '1' }),
    a('5102', 'البدلات', 'expense', { chapter: '1' }),
    a('5103', 'المكافآت والأجور الإضافية', 'expense', { chapter: '1' }),
    a('5104', `مساهمة الجهة في ${c?.socialInsurance || 'التقاعد'}`, 'expense', { chapter: '1' }),
    // الباب الثاني
    a('5201', 'المستلزمات المكتبية والمطبوعات', 'expense', { setting: 'purchasesAccountId', chapter: '2' }),
    a('5202', 'الكهرباء والماء والاتصالات', 'expense', { chapter: '2' }),
    a('5203', 'الإيجارات', 'expense', { chapter: '2' }),
    a('5204', 'الصيانة والتشغيل والنظافة', 'expense', { chapter: '2' }),
    a('5205', 'السفر والمهمات الرسمية', 'expense', { chapter: '2' }),
    a('5206', 'الخدمات الاستشارية والتدريب', 'expense', { chapter: '2' }),
    // الباب الثالث
    a('5301', 'الإعانات والمنح المدفوعة', 'expense', { chapter: '3' }),
    a('5302', 'المنافع الاجتماعية', 'expense', { chapter: '3' }),
    // الباب الرابع
    a('5401', 'المشاريع والإنشاءات', 'expense', { chapter: '4' }),
    a('5402', 'الأجهزة والمعدات', 'expense', { chapter: '4' }),
    a('5403', 'السيارات ووسائل النقل', 'expense', { chapter: '4' }),
  ];
};

export const buildChartTemplate = (p: BusinessProfile): TemplateAccount[] =>
  (p.sector === 'government' ? governmentTemplate(p) : privateTemplate(p)).sort((x, y) => x.code.localeCompare(y.code));

const norm = (s: string) =>
  s
    .trim()
    .replace(/[أإآ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/^ال/, '')
    .replace(/\s+/g, ' ');

export interface ChartPlanRow {
  tpl: TemplateAccount;
  /** حساب موجود مطابق: نفس الاسم، أو نفس الكود ونفس التصنيف */
  existing?: Account;
  /** الكود مستخدم لحساب آخر غير مطابق: يُنشأ الحساب بلا كود */
  codeTaken?: boolean;
}

export const planChart = (tpl: TemplateAccount[], accounts: Account[]): ChartPlanRow[] => {
  const byCode = new Map(accounts.filter((x) => x.code).map((x) => [x.code.trim(), x]));
  const byName = new Map(accounts.map((x) => [norm(x.name), x]));
  return tpl.map((t) => {
    const sameCode = byCode.get(t.code);
    const existing = byName.get(norm(t.name)) || (sameCode && sameCode.category === t.category ? sameCode : undefined);
    return { tpl: t, existing, codeTaken: !existing && !!sameCode };
  });
};
