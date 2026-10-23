// الاشتراكات: نفس نموذج التطبيق (SubscriptionInfo في lib/main.dart) مع نوع ثالث.
//
// - users/{uid}/subscription     ← اشتراك الموبايل كما يكتبه التطبيق ولوحة الإدارة (لا نغيّر شكله).
//   حقل اختياري kind: 'mobile' | 'bundle' تكتبه لوحة الإدارة؛ التطبيق يتجاهله فيبقى يعمل كما هو.
//   'bundle' (متصفح + موبايل) = نفس العقدة، فيتعرّف عليه الهاتف والمتصفح معاً.
// - users/{uid}/webSubscription  ← اشتراك المتصفح وحده (عقدة جديدة لا يقرؤها التطبيق).

export type PlanType = 'free' | 'monthly' | 'yearly' | 'lifetime';
export type SubKind = 'mobile' | 'web' | 'bundle';

export interface SubscriptionInfo {
  plan: PlanType;
  expiresAt: string | null;
  lifetimeGranted: boolean;
  kind?: string;
}

export const ADMIN_UID = 'yDNRRh5Ua5TcgPZMA8WJHhHbR3g1';
export const SUBSCRIBE_WHATSAPP = '972569988062';

// حدود الحساب المجاني — نفس SubscriptionInfo.freeMaxAccounts / freeMaxOperations في التطبيق
export const FREE_MAX_ACCOUNTS = 15;
export const FREE_MAX_OPERATIONS = 100;

/**
 * اشتراك موبايل مدفوع كُتب قبل وجود أنواع الاشتراك (بلا kind) يفتح المتصفح أيضاً
 * حتى ينتهي؛ عند التجديد تحدد لوحة الإدارة نوعه فيُطبَّق النظام الجديد.
 */
export const LEGACY_MOBILE_UNLOCKS_WEB = true;

export const PLAN_LABELS: Record<PlanType, string> = {
  free: 'مجاني',
  monthly: 'شهري',
  yearly: 'سنوي',
  lifetime: 'مدى الحياة',
};

export const KIND_LABELS: Record<SubKind, string> = {
  mobile: 'الموبايل',
  web: 'المتصفح',
  bundle: 'المتصفح + الموبايل',
};

// أسعار الموبايل من SubscriptionScreen في التطبيق؛ المتصفح بنفس الأسعار
export const PRICES: Record<SubKind, Record<Exclude<PlanType, 'free'>, number>> = {
  mobile: { monthly: 49.99, yearly: 449.99, lifetime: 999.99 },
  web: { monthly: 49.99, yearly: 449.99, lifetime: 999.99 },
  bundle: { monthly: 79.99, yearly: 949.99, lifetime: 1999.99 },
};

const PLANS: PlanType[] = ['free', 'monthly', 'yearly', 'lifetime'];

export const parseSubscription = (j: any): SubscriptionInfo => ({
  plan: PLANS.includes(j?.plan) ? j.plan : 'free',
  expiresAt: typeof j?.expiresAt === 'string' && j.expiresAt ? j.expiresAt : null,
  lifetimeGranted: j?.lifetimeGranted === true,
  kind: typeof j?.kind === 'string' ? j.kind : undefined,
});

/** نفس SubscriptionInfo.isActive */
export const isActive = (s: SubscriptionInfo, now = Date.now()) => {
  if (s.plan === 'free' || s.plan === 'lifetime') return true;
  if (!s.expiresAt) return true;
  const t = Date.parse(s.expiresAt);
  return Number.isNaN(t) || t > now;
};

export const isPaidActive = (s: SubscriptionInfo | null | undefined, now = Date.now()) =>
  !!s && s.plan !== 'free' && isActive(s, now);

export const daysLeft = (s: SubscriptionInfo, now = Date.now()) => {
  if (!s.expiresAt) return -1;
  return Math.floor((Date.parse(s.expiresAt) - now) / 86400000);
};

export interface WebAccess {
  /** الاشتراك الذي يفتح المتصفح، أو null = الحساب المجاني */
  source: SubscriptionInfo | null;
  kind: SubKind | null;
  unlimited: boolean;
  /** اشتراك مدفوع انتهى (لعرض تنبيه التجديد) */
  expired: SubscriptionInfo | null;
}

export const webAccessOf = (
  uid: string | null | undefined,
  mobile: SubscriptionInfo | null,
  web: SubscriptionInfo | null,
  now = Date.now(),
): WebAccess => {
  if (uid === ADMIN_UID) return { source: null, kind: null, unlimited: true, expired: null };
  const mobileOpensWeb = !!mobile && (mobile.kind === 'bundle' || (LEGACY_MOBILE_UNLOCKS_WEB && !mobile.kind));
  if (mobileOpensWeb && isPaidActive(mobile, now)) {
    return { source: mobile, kind: 'bundle', unlimited: true, expired: null };
  }
  if (isPaidActive(web, now)) return { source: web, kind: 'web', unlimited: true, expired: null };
  const expired =
    web && web.plan !== 'free' ? web : mobile && mobile.kind === 'bundle' && mobile.plan !== 'free' ? mobile : null;
  return { source: null, kind: null, unlimited: false, expired };
};

/** يرجع null إذا سُمح، أو رسالة الحد — نفس صياغة DataService.canAddAccount */
export const accountLimitError = (access: WebAccess, currentCount: number, adding = 1) =>
  access.unlimited || currentCount + adding <= FREE_MAX_ACCOUNTS
    ? null
    : `وصلت للحد الأقصى في الخطة المجانية (${FREE_MAX_ACCOUNTS} حساب) — اشترك في المتصفح لإضافة المزيد`;

export const operationLimitError = (access: WebAccess, currentCount: number, adding = 1) =>
  access.unlimited || currentCount + adding <= FREE_MAX_OPERATIONS
    ? null
    : `وصلت للحد الأقصى في الخطة المجانية (${FREE_MAX_OPERATIONS} قيد) — اشترك في المتصفح لإضافة المزيد`;

export const whatsappLink = (kind: SubKind, plan: PlanType) => {
  const price = plan === 'free' ? '' : ` — $${PRICES[kind][plan]}`;
  const msg = `مرحباً، أريد الاشتراك في خطة ${KIND_LABELS[kind]} ${PLAN_LABELS[plan]}${price} في منصتي المحاسبية`;
  return `https://wa.me/${SUBSCRIBE_WHATSAPP}?text=${encodeURIComponent(msg)}`;
};

/** سجل المستخدم الجديد بنفس شكل DataService.initUserInFirebaseWithCompany */
export const newUserRecord = (
  uid: string,
  email: string,
  company: { name: string; phone: string; email: string; address: string },
  now = new Date(),
) => ({
  uid,
  email,
  createdAt: now.toISOString(),
  companyInfo: company,
  subscription: { plan: 'free', lifetimeGranted: false },
});

export const AUTH_ERRORS: Record<string, string> = {
  'auth/user-not-found': 'البريد الإلكتروني غير مسجّل',
  'auth/wrong-password': 'كلمة المرور غير صحيحة',
  'auth/invalid-credential': 'خطأ في البريد أو كلمة المرور',
  'auth/email-already-in-use': 'البريد مستخدم بالفعل',
  'auth/weak-password': 'كلمة المرور ضعيفة جداً',
  'auth/invalid-email': 'صيغة البريد الإلكتروني غير صحيحة',
  'auth/too-many-requests': 'محاولات كثيرة، حاول لاحقاً',
  'auth/network-request-failed': 'لا يوجد اتصال بالإنترنت',
};

export const authErrorText = (e: any) => AUTH_ERRORS[e?.code] || `خطأ: ${e?.code || e?.message || e}`;
