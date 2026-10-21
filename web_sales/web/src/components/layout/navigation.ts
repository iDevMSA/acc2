import { IconName } from '../ui/Icon';

export interface NavItem {
  path: string;
  label: string;
  icon: IconName;
  description: string;
  /** يظهر في شريط التنقل السفلي على الهاتف */
  mobile?: boolean;
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

// قائمة التنقل الوحيدة: الشريط الجانبي والترويسة يقرآن منها، فإضافة صفحة جديدة = سطر واحد هنا.
export const NAV_GROUPS: NavGroup[] = [
  {
    label: 'عام',
    items: [
      { path: '/', label: 'الرئيسية', icon: 'home', description: 'نظرة عامة على أداء اليوم', mobile: true },
      { path: '/hub', label: 'الأقسام', icon: 'grid', description: 'كل النوافذ والأدوات مرتبة حسب القسم' },
      { path: '/settings', label: 'الإعدادات', icon: 'settings', description: 'معلومات الشركة والعملة والمزامنة' },
    ],
  },
  {
    label: 'المحاسبة',
    items: [
      { path: '/accounts', label: 'الحسابات', icon: 'ledger', description: 'دليل الحسابات وكشوفها', mobile: true },
      { path: '/accounting', label: 'القيود', icon: 'receipt', description: 'سجل القيود العام' },
      { path: '/reports', label: 'التقارير', icon: 'chart', description: 'مركز التقارير المالية', mobile: true },
      { path: '/charts', label: 'الرسوم البيانية', icon: 'trendUp', description: 'تحليل الأداء عبر الأشهر' },
    ],
  },
  {
    label: 'النقدية',
    items: [
      { path: '/cashboxes', label: 'الصناديق', icon: 'wallet', description: 'الصناديق وربطها بالحسابات', mobile: true },
      { path: '/vouchers', label: 'القبض والصرف', icon: 'swap', description: 'سندات القبض والصرف والتحويل' },
      { path: '/cheques', label: 'الشيكات', icon: 'cheque', description: 'الشيكات الواردة والصادرة' },
      { path: '/notes', label: 'الإشعارات', icon: 'mail', description: 'الإشعارات المدينة والدائنة' },
      { path: '/rates', label: 'أسعار العملات', icon: 'coins', description: 'أسعار الصرف حسب التاريخ' },
    ],
  },
  {
    label: 'المخزون والمبيعات',
    items: [
      { path: '/warehouses', label: 'المخازن', icon: 'warehouse', description: 'المخازن والأصناف وحركاتها' },
      { path: '/trade', label: 'الفواتير والعروض', icon: 'tag', description: 'فواتير البيع والشراء ومرتجعاتها والعروض والطلبيات' },
      { path: '/invoices', label: 'فواتير نقاط البيع', icon: 'receipt', description: 'فواتير نقاط البيع وتحليل الربحية' },
    ],
  },
  {
    label: 'الموظفون',
    items: [{ path: '/payroll', label: 'الرواتب والأجور', icon: 'users', description: 'بيانات الموظفين وكشوف الرواتب' }],
  },
];

const ALL = NAV_GROUPS.flatMap((g) => g.items);

/** أطول مسار يطابق بداية الرابط (حتى تُعلَّم "الحسابات" في صفحة حساب محدد) */
export const findNavItem = (pathname: string): NavItem | undefined =>
  ALL.filter((i) => (i.path === '/' ? pathname === '/' : pathname === i.path || pathname.startsWith(`${i.path}/`))).sort(
    (a, b) => b.path.length - a.path.length,
  )[0];
