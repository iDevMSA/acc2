// الفريق والصلاحيات: أدوار جاهزة (محاسب، مدير فرع، كاشير، مدقق) وصلاحيات مفصلة لكل قسم.
//
// teams/{ownerUid}/{memberUid} ← عضو الفريق (يكتبه المالك وحده — قواعد Firebase)
// employeeOwnerMap/{memberUid} = ownerUid ← كما يكتبه التطبيق للموظفين
// sales/{ownerUid}/employees/{uid} ← لأدوار نقطة البيع فقط (كاشير، مدير فرع) حتى يراهم تطبيق الهاتف
//
// القواعد تمنح العضو النشط (غير الكاشير) قراءة بيانات المالك، وتمنح الكتابة لمن لديه صلاحية تعديل.
// التفصيل لكل قسم يُطبَّق في الواجهة: القوائم والصفحات، وعند كل حفظ في LedgerContext و PosContext.

export type TeamRole = 'accountant' | 'branchManager' | 'cashier' | 'viewer';
export type Area = 'accounts' | 'cash' | 'trade' | 'stock' | 'pos' | 'reports' | 'taxes' | 'payroll' | 'budget' | 'settings' | 'audit';
export type Level = 'none' | 'view' | 'edit';
export type Perms = Record<Area, Level>;

export interface TeamMember {
  uid: string;
  name: string;
  email: string;
  phone?: string | null;
  role: TeamRole;
  perms: Perms;
  /** مدير الفرع وكاشيره مقيّدان بفرع */
  branchId?: string | null;
  cashRegisterId?: string | null;
  active: boolean;
  /** هل لديه أي صلاحية تعديل (تستخدمه قواعد Firebase) */
  canWrite: boolean;
  createdAt: string;
  updatedAt?: string;
}

export const AREAS: { id: Area; label: string; hint: string; viewOnly?: boolean }[] = [
  { id: 'accounts', label: 'الحسابات والقيود', hint: 'دليل الحسابات، القيود، كشوف الحسابات' },
  { id: 'cash', label: 'الصناديق والسندات والشيكات', hint: 'سندات القبض والصرف، الصناديق والبنوك، الشيكات' },
  { id: 'trade', label: 'الفواتير والعروض والإشعارات', hint: 'فواتير البيع والشراء والمرتجعات، العروض والطلبيات' },
  { id: 'stock', label: 'المخازن والأصناف', hint: 'الأصناف، حركات المخزون، الجرد' },
  { id: 'pos', label: 'نقطة البيع', hint: 'إدارة الفروع والصناديق والمنتجات وفواتير نقطة البيع' },
  { id: 'reports', label: 'التقارير والرسوم البيانية', hint: 'كل التقارير المالية والمخزنية', viewOnly: true },
  { id: 'taxes', label: 'الضرائب والفوترة الإلكترونية', hint: 'الإقرار الضريبي وإعدادات الضريبة' },
  { id: 'payroll', label: 'الرواتب', hint: 'مسيرات الرواتب' },
  { id: 'budget', label: 'الموازنة والمشتريات', hint: 'الاعتمادات والمناقلات، طلبات الشراء واعتمادها، الارتباط وأوامر الشراء والصرف' },
  { id: 'settings', label: 'الإعدادات', hint: 'معلومات الشركة، العملة، أسعار الصرف، التنبيهات' },
  { id: 'audit', label: 'سجل التعديلات', hint: 'من غيّر ماذا ومتى', viewOnly: true },
];

const P = (o: Partial<Perms>): Perms => ({
  accounts: 'none',
  cash: 'none',
  trade: 'none',
  stock: 'none',
  pos: 'none',
  reports: 'none',
  taxes: 'none',
  payroll: 'none',
  budget: 'none',
  settings: 'none',
  audit: 'none',
  ...o,
});

export const ROLES: Record<TeamRole, { label: string; description: string; perms: Perms; pos: boolean }> = {
  accountant: {
    label: 'محاسب',
    description: 'القيود والسندات والفواتير والضرائب والرواتب، ويرى التقارير وسجل التعديلات',
    pos: false,
    perms: P({ accounts: 'edit', cash: 'edit', trade: 'edit', stock: 'view', pos: 'view', reports: 'view', taxes: 'edit', payroll: 'edit', budget: 'edit', audit: 'view' }),
  },
  branchManager: {
    label: 'مدير فرع',
    description: 'يدير نقطة البيع والمخزون والفواتير في فرعه، ويقبض ويصرف',
    pos: true,
    perms: P({ accounts: 'view', cash: 'edit', trade: 'edit', stock: 'edit', pos: 'edit', reports: 'view' }),
  },
  cashier: {
    label: 'كاشير',
    description: 'البيع من صندوقه في نقطة البيع فقط',
    pos: true,
    perms: P({ pos: 'edit' }),
  },
  viewer: {
    label: 'مدقق (عرض فقط)',
    description: 'يرى كل شيء ولا يعدّل: مناسب للمراجع أو المدقق الخارجي',
    pos: false,
    perms: P({ accounts: 'view', cash: 'view', trade: 'view', stock: 'view', pos: 'view', reports: 'view', taxes: 'view', payroll: 'view', budget: 'view', settings: 'view', audit: 'view' }),
  },
};

export const LEVEL_LABELS: Record<Level, string> = { none: 'لا', view: 'عرض', edit: 'تعديل' };

const LEVEL_RANK: Record<Level, number> = { none: 0, view: 1, edit: 2 };

export const canWriteAny = (perms: Perms) => Object.values(perms).some((l) => l === 'edit');

export const parseMember = (uid: string, j: any): TeamMember => {
  const role: TeamRole = j?.role in ROLES ? j.role : 'cashier';
  const perms = P({ ...ROLES[role].perms, ...(j?.perms || {}) });
  return {
    uid,
    name: j?.name || '',
    email: j?.email || '',
    phone: j?.phone || null,
    role,
    perms,
    branchId: j?.branchId || null,
    cashRegisterId: j?.cashRegisterId || null,
    active: j?.active !== false,
    canWrite: canWriteAny(perms),
    createdAt: j?.createdAt || '',
    updatedAt: j?.updatedAt || '',
  };
};

/** member = null ⇒ المالك (كل الصلاحيات) */
export const can = (member: TeamMember | null, area: Area, level: Level = 'view') =>
  !member || LEVEL_RANK[member.perms[area]] >= LEVEL_RANK[level];

/* ───────── ربط الصفحات بالأقسام ───────── */

const PATH_AREAS: [RegExp, Area | 'owner' | 'any'][] = [
  [/^\/$/, 'any'],
  [/^\/hub/, 'any'],
  [/^\/alerts/, 'any'],
  [/^\/import/, 'any'],
  [/^\/team/, 'owner'],
  [/^\/einvoice/, 'owner'],
  [/^\/setup/, 'owner'],
  [/^\/settings/, 'settings'],
  [/^\/rates/, 'settings'],
  [/^\/audit/, 'audit'],
  [/^\/(accounts|accounting)/, 'accounts'],
  [/^\/(cashboxes|vouchers|cheques)/, 'cash'],
  [/^\/(trade|notes)/, 'trade'],
  [/^\/warehouses/, 'stock'],
  [/^\/(invoices|pos-admin|pos)/, 'pos'],
  [/^\/(reports|charts)/, 'reports'],
  [/^\/taxes/, 'taxes'],
  [/^\/payroll/, 'payroll'],
  [/^\/(budget|commitments)/, 'budget'],
];

export const areaOfRoute = (pathname: string): Area | 'owner' | 'any' => PATH_AREAS.find(([re]) => re.test(pathname))?.[1] ?? 'any';

export const canOpen = (member: TeamMember | null, pathname: string) => {
  const a = areaOfRoute(pathname);
  if (a === 'any') return true;
  if (a === 'owner') return !member;
  return can(member, a, 'view');
};

/* ───────── ربط مسارات الكتابة بالأقسام ───────── */

/** مسار نسبي من users/{owner}/ أو sales/{owner}/ (بادئة "sales/") ← القسم المسؤول عنه */
const areaOfWritePath = (p: string): Area => {
  if (p.startsWith('sales/')) return /^sales\/(taxSettings|settings)/.test(p) ? 'settings' : 'pos';
  if (/^erp\/(invoices|quotes|notes)\//.test(p)) return 'trade';
  if (/^erp\/(vouchers|cheques|cashboxes)\//.test(p) || p.startsWith('cashboxes')) return 'cash';
  if (/^erp\/(stockMoves|items|warehouses)\//.test(p)) return 'stock';
  if (p.startsWith('erp/payrolls')) return 'payroll';
  if (/^erp\/(budgets|budgetTransfers|commitments|approvalLevels)/.test(p)) return 'budget';
  if (/^erp\/(settings|rates|profile)/.test(p) || p.startsWith('companyInfo') || p.startsWith('alerts/settings') || p.startsWith('team/')) return 'settings';
  if (p.startsWith('einvoice')) return 'taxes';
  return 'accounts';
};

// فاتورة واحدة تكتب الفاتورة والقيود وحركات المخزون معاً: القسم "الأعلى" هو صاحب العملية
const AREA_PRIORITY: Area[] = ['budget', 'trade', 'payroll', 'cash', 'stock', 'pos', 'taxes', 'settings', 'accounts'];

export const areaOfWrite = (paths: string[]): Area => {
  const set = new Set(paths.map(areaOfWritePath));
  return AREA_PRIORITY.find((a) => set.has(a)) || 'accounts';
};

/** يرمي خطأ واضحاً إن لم يكن للعضو صلاحية تعديل هذا القسم */
export const assertCanWrite = (member: TeamMember | null, paths: string[]) => {
  if (!member) return;
  // العضو يدير إشعاراته وتنبيهاته المخفية بنفسه
  if (paths.every((p) => /^alerts\/(dismissed|push)\//.test(p))) return;
  const area = areaOfWrite(paths);
  if (!can(member, area, 'edit')) {
    const label = AREAS.find((a) => a.id === area)?.label || area;
    throw new Error(`ليس لديك صلاحية التعديل في: ${label}`);
  }
};
