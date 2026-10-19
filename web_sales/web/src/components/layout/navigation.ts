import { IconName } from '../ui/Icon';

export interface NavItem {
  path: string;
  label: string;
  icon: IconName;
  description: string;
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

// قائمة التنقل الوحيدة: الشريط الجانبي والترويسة يقرآن منها، فإضافة صفحة جديدة = سطر واحد هنا.
export const NAV_GROUPS: NavGroup[] = [
  {
    label: 'عام',
    items: [{ path: '/', label: 'الرئيسية', icon: 'home', description: 'نظرة عامة على أداء اليوم' }],
  },
  {
    label: 'المبيعات',
    items: [{ path: '/invoices', label: 'الفواتير', icon: 'receipt', description: 'الفواتير وتحليل الربحية' }],
  },
  {
    label: 'المحاسبة',
    items: [
      { path: '/accounting', label: 'المحاسبة', icon: 'ledger', description: 'دليل الحسابات والسجل العام' },
      { path: '/reports', label: 'التقارير', icon: 'chart', description: 'القوائم المالية' },
    ],
  },
];

export const findNavItem = (pathname: string): NavItem | undefined =>
  NAV_GROUPS.flatMap((g) => g.items).find((item) => item.path === pathname);
