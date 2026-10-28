// إدارة الفريق من حساب المالك: إنشاء حسابات الأعضاء، تعديل أدوارهم وصلاحياتهم، وإيقافهم.
import { useEffect, useState } from 'react';
import { createUserWithEmailAndPassword, sendPasswordResetEmail, signOut, updateProfile } from 'firebase/auth';
import { ref, remove, set, update } from 'firebase/database';
import { auth, db, secondaryAuth } from '../config/firebase';
import { watchValue } from './offlineStore';
import { canWriteAny, parseMember, Perms, ROLES, TeamMember, TeamRole } from './team';
import { Actor, logAudit } from './audit';
import { playSound } from './sounds';

export const useTeam = (ownerUid: string | null) => {
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [denied, setDenied] = useState(false);
  useEffect(() => {
    if (!ownerUid) return;
    return watchValue(
      `teams/${ownerUid}`,
      (v) => {
        setMembers(
          Object.entries((v as Record<string, any>) || {})
            .filter(([k, m]) => !k.startsWith('_') && m && typeof m === 'object')
            .map(([k, m]) => parseMember(k, m))
            .sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
        );
        setLoading(false);
        setDenied(false);
      },
      () => {
        setDenied(true);
        setLoading(false);
      },
    );
  }, [ownerUid]);
  return { members, loading, denied };
};

export interface MemberDraft {
  name: string;
  email: string;
  phone?: string;
  role: TeamRole;
  perms: Perms;
  branchId?: string | null;
  cashRegisterId?: string | null;
}

const RULES_MSG = 'قواعد الفريق لم تُنشر بعد على Firebase. انشر ملف firebase/database.rules.json ثم أعد المحاولة';

/** قبل إنشاء حساب في Firebase Auth: نتأكد أن القواعد الجديدة منشورة حتى لا يبقى حساب بلا سجل */
const assertRulesDeployed = async (ownerUid: string) => {
  try {
    await set(ref(db, `teams/${ownerUid}/_check`), Date.now());
    await remove(ref(db, `teams/${ownerUid}/_check`));
  } catch {
    throw new Error(RULES_MSG);
  }
};

const memberRecord = (d: MemberDraft, prev?: TeamMember) => ({
  name: d.name.trim(),
  email: d.email.trim(),
  phone: d.phone?.trim() || null,
  role: d.role,
  // كل الأقسام تُحفظ صراحة لأن قواعد Firebase تقرأ perms/audit و canWrite مباشرة
  perms: d.perms,
  canWrite: canWriteAny(d.perms),
  branchId: d.branchId || null,
  cashRegisterId: d.role === 'cashier' ? d.cashRegisterId || null : null,
  active: prev ? prev.active : true,
  createdAt: prev?.createdAt || new Date().toISOString(),
  updatedAt: new Date().toISOString(),
});

/** سجل الموظف كما يكتبه تطبيق الهاتف (لأدوار نقطة البيع فقط) */
const posEmployee = (ownerUid: string, uid: string, d: MemberDraft) =>
  ROLES[d.role].pos
    ? {
        uid,
        name: d.name.trim(),
        email: d.email.trim(),
        role: d.role === 'branchManager' ? 'manager' : 'cashier',
        branchId: d.branchId || null,
        cashRegisterId: d.role === 'cashier' ? d.cashRegisterId || null : null,
        ownerUid,
        phone: d.phone?.trim() || null,
      }
    : null;

const authError = (e: any) => {
  const code = e?.code || '';
  return new Error(
    code === 'auth/email-already-in-use'
      ? 'الإيميل مستخدم مسبقاً بحساب آخر'
      : code === 'auth/weak-password'
        ? 'كلمة المرور ضعيفة (6 أحرف على الأقل)'
        : code === 'auth/invalid-email'
          ? 'إيميل غير صحيح'
          : e?.message || 'تعذّر إنشاء الحساب',
  );
};

export const createMember = async (ownerUid: string, actor: Actor, d: MemberDraft, password: string) => {
  await assertRulesDeployed(ownerUid);
  const a = secondaryAuth();
  let uid: string;
  try {
    const cred = await createUserWithEmailAndPassword(a, d.email.trim(), password);
    await updateProfile(cred.user, { displayName: d.name.trim() });
    uid = cred.user.uid;
  } catch (e) {
    throw authError(e);
  } finally {
    await signOut(a).catch(() => undefined);
  }
  const rec = memberRecord(d);
  await update(ref(db), {
    [`teams/${ownerUid}/${uid}`]: rec,
    [`employeeOwnerMap/${uid}`]: ownerUid,
    [`sales/${ownerUid}/employees/${uid}`]: posEmployee(ownerUid, uid, d),
  });
  playSound('success');
  logAudit(ownerUid, actor, { [`team/${uid}`]: rec }, () => undefined);
  return uid;
};

/** تعديل عضو، أو منح صلاحيات لموظف نقطة بيع موجود (له حساب و employeeOwnerMap مسبقاً) */
export const saveMember = async (ownerUid: string, actor: Actor, uid: string, d: MemberDraft, prev?: TeamMember) => {
  if (!prev) await assertRulesDeployed(ownerUid);
  const rec = memberRecord(d, prev);
  await update(ref(db), {
    [`teams/${ownerUid}/${uid}`]: rec,
    [`sales/${ownerUid}/employees/${uid}`]: posEmployee(ownerUid, uid, d),
  });
  playSound('success');
  logAudit(ownerUid, actor, { [`team/${uid}`]: rec }, () => prev);
};

/** الإيقاف يمنع الدخول لبيانات المالك (القواعد تشترط active) دون حذف الحساب أو سجله */
export const setMemberActive = async (ownerUid: string, actor: Actor, m: TeamMember, active: boolean) => {
  await update(ref(db, `teams/${ownerUid}/${m.uid}`), { active, updatedAt: new Date().toISOString() });
  playSound('success');
  logAudit(ownerUid, actor, { [`team/${m.uid}/active`]: active }, () => m.active);
};

export const resetPassword = (email: string) => sendPasswordResetEmail(auth, email);
