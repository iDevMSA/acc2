// سجل التعديلات: من غيّر ماذا ومتى، مع القيمة قبل التعديل وبعده.
//
// audit/{ownerUid}/{id} ← قيد واحد لكل حفظ من الويب. القواعد تجعله إضافة فقط (لا تعديل ولا حذف)
// وتشترط أن يكون uid هو كاتب القيد، فلا يمكن نسبة تعديل لشخص آخر.
// يُكتب بعد نجاح الحفظ وبمعزل عنه: إن رُفض (قواعد لم تُنشر بعد) لا يتأثر الحفظ نفسه.
import { push, ref, serverTimestamp, set } from 'firebase/database';
import { db } from '../config/firebase';
import { Area, areaOfWrite, TeamRole } from './team';

export interface AuditChange {
  path: string;
  before?: string | null;
  after?: string | null;
}

export interface AuditEntry {
  id: string;
  uid: string;
  name: string;
  role: TeamRole | 'owner';
  at: number;
  area: Area;
  action: string;
  changes: AuditChange[];
  more?: number;
}

export interface Actor {
  uid: string;
  name: string;
  role: TeamRole | 'owner';
}

/** أسماء الكيانات بحسب المسار (نسبي من users/{owner}/ أو sales/{owner}/ ببادئة sales/) */
const ENTITIES: [RegExp, string][] = [
  [/^operations\/([^/]+)/, 'قيد'],
  [/^accounts\/([^/]+)/, 'حساب'],
  [/^companyInfo/, 'معلومات الشركة'],
  [/^accountGroups\/([^/]+)/, 'مجموعة حسابات'],
  [/^erp\/invoices\/([^/]+)/, 'فاتورة'],
  [/^erp\/quotes\/([^/]+)/, 'عرض سعر / طلبية'],
  [/^erp\/notes\/([^/]+)/, 'إشعار مدين/دائن'],
  [/^erp\/vouchers\/([^/]+)/, 'سند'],
  [/^erp\/cheques\/([^/]+)/, 'شيك'],
  [/^erp\/cashboxes\/([^/]+)/, 'صندوق'],
  [/^erp\/stockMoves\/([^/]+)/, 'حركة مخزون'],
  [/^erp\/items\/([^/]+)/, 'صنف'],
  [/^erp\/warehouses\/([^/]+)/, 'مخزن'],
  [/^erp\/payrolls\/([^/]+)/, 'مسير رواتب'],
  [/^erp\/rates\/([^/]+)/, 'سعر صرف'],
  [/^erp\/accountMeta\/([^/]+)/, 'تصنيف حساب'],
  [/^erp\/settings/, 'الإعدادات'],
  [/^erp\/budgets/, 'الموازنة'],
  [/^alerts\/settings/, 'إعدادات التنبيهات'],
  [/^team\/([^/]+)/, 'عضو الفريق'],
  [/^einvoice\//, 'الفوترة الإلكترونية'],
  [/^sales\/products\/([^/]+)/, 'منتج نقطة بيع'],
  [/^sales\/branches\/([^/]+)/, 'فرع'],
  [/^sales\/warehouses\/([^/]+)/, 'مخزن نقطة بيع'],
  [/^sales\/cashRegisters\/([^/]+)/, 'صندوق نقطة بيع'],
  [/^sales\/employees\/([^/]+)/, 'موظف'],
  [/^sales\/invoices\/([^/]+)/, 'فاتورة نقطة بيع'],
  [/^sales\/posSessions\/([^/]+)/, 'جلسة كاشير'],
  [/^sales\/(taxSettings|settings)/, 'إعدادات المبيعات والضريبة'],
];

const entityOf = (path: string) => {
  for (const [re, label] of ENTITIES) {
    const m = path.match(re);
    if (m) return { label, key: m[0] };
  }
  return { label: 'بيانات', key: path.split('/').slice(0, 2).join('/') };
};

const MAX_VALUE = 1500;
const MAX_CHANGES = 12;

const compact = (v: unknown): string | null => {
  if (v === undefined || v === null) return null;
  const s = typeof v === 'string' ? v : JSON.stringify(v);
  return s.length > MAX_VALUE ? s.slice(0, MAX_VALUE) + '…' : s;
};

/** القيمة المحفوظة عند مسار داخل نسخة محلية من الشجرة */
export const valueAt = (tree: unknown, path: string) =>
  path.split('/').reduce<any>((o, k) => (o == null || typeof o !== 'object' ? undefined : o[k]), tree);

/**
 * يلخّص كتابة واحدة: نوع العملية بالعربية والكيانات التي تغيّرت مع قيمها قبل وبعد.
 * before(path) يرجع القيمة الحالية محلياً (قبل الحفظ).
 */
export const describeWrite = (updates: Record<string, unknown>, before: (path: string) => unknown) => {
  const paths = Object.keys(updates);
  const byEntity = new Map<string, { label: string; paths: string[] }>();
  paths.forEach((p) => {
    const e = entityOf(p);
    const cur = byEntity.get(e.key) || { label: e.label, paths: [] };
    cur.paths.push(p);
    byEntity.set(e.key, cur);
  });

  const verbOf = (key: string, ps: string[]) => {
    const whole = ps.includes(key);
    const prev = before(key);
    if (whole && updates[key] === null) return 'حذف';
    if (ps.some((p) => p.endsWith('/deletedAt') && updates[p])) return 'حذف';
    if (whole && (prev === undefined || prev === null)) return 'إضافة';
    return 'تعديل';
  };

  const parts: string[] = [];
  const counts = new Map<string, number>();
  const changes: AuditChange[] = [];
  byEntity.forEach((e, key) => {
    const verb = verbOf(key, e.paths);
    const label = `${verb} ${e.label}`;
    counts.set(label, (counts.get(label) || 0) + 1);
    if (changes.length < MAX_CHANGES)
      changes.push({
        path: key,
        before: compact(before(key)),
        after: compact(e.paths.includes(key) ? updates[key] : Object.fromEntries(e.paths.map((p) => [p.slice(key.length + 1), updates[p]]))),
      });
  });
  counts.forEach((n, label) => parts.push(n > 1 ? `${label} (${n})` : label));
  return { action: parts.join('، '), area: areaOfWrite(paths), changes, more: Math.max(0, byEntity.size - MAX_CHANGES) };
};

export const logAudit = (ownerUid: string, actor: Actor, updates: Record<string, unknown>, before: (path: string) => unknown) => {
  try {
    const d = describeWrite(updates, before);
    if (!d.action) return;
    const entry = JSON.parse(
      JSON.stringify({ uid: actor.uid, name: actor.name, role: actor.role, area: d.area, action: d.action, changes: d.changes, more: d.more || null }),
    );
    set(push(ref(db, `audit/${ownerUid}`)), { ...entry, at: serverTimestamp() }).catch(() => undefined);
  } catch {
    // السجل لا يُفشل الحفظ أبداً
  }
};

export const ROLE_NAMES: Record<string, string> = {
  owner: 'المالك',
  accountant: 'محاسب',
  branchManager: 'مدير فرع',
  cashier: 'كاشير',
  viewer: 'مدقق',
};
