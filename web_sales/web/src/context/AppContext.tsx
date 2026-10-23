import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { auth } from '../config/firebase';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { clearOfflineCache, watchValue } from '../lib/offlineStore';
import { parseMember, TeamMember } from '../lib/team';
import { Actor } from '../lib/audit';
import { SubscriptionInfo, WebAccess, parseSubscription, webAccessOf } from '../lib/subscription';

interface User {
  uid: string;
  email?: string;
  displayName?: string;
}

interface AppContextType {
  user: User | null;
  loading: boolean;
  logout: () => Promise<void>;
  companyInfo: any;
  currency: string;
  /**
   * صاحب البيانات: للمالك هو نفسه، وللكاشير هو المالك المسجّل في employeeOwnerMap
   * (نفس آلية تطبيق الهاتف). الكاشير لا يرى إلا واجهة نقطة البيع.
   */
  ownerUid: string | null;
  isCashier: boolean;
  /**
   * عضو الفريق (محاسب، مدير فرع، مدقق) المسجّل في teams/{owner}/{uid}: يرى واجهة المنصة حسب صلاحياته.
   * null للمالك، وللكاشير (ومدير الفرع القديم) الذي ليس له سجل في الفريق.
   */
  member: TeamMember | null;
  /** عضو أوقفه المالك */
  suspended: boolean;
  /** من يقوم بالتعديل (لسجل التعديلات) */
  actor: Actor | null;
  /** اشتراك الموبايل (users/{uid}/subscription) واشتراك المتصفح (users/{uid}/webSubscription) */
  mobileSubscription: SubscriptionInfo | null;
  webSubscription: SubscriptionInfo | null;
  webAccess: WebAccess;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [companyInfo, setCompanyInfo] = useState<any>(null);
  const [currency, setCurrency] = useState('SAR');
  // undefined = لم يصل الرد بعد، null = ليس موظفاً (مالك)
  const [employerUid, setEmployerUid] = useState<string | null | undefined>(undefined);
  // undefined = لم يصل بعد، null = لا يوجد سجل في الفريق
  const [memberRaw, setMemberRaw] = useState<any>(undefined);

  useEffect(() => {
    let subs: Array<() => void> = [];
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      subs.forEach((u) => u());
      subs = [];
      if (currentUser) {
        setUser({
          uid: currentUser.uid,
          email: currentUser.email || undefined,
          displayName: currentUser.displayName || undefined,
        });
        setEmployerUid(undefined);
        subs.push(
          watchValue(`employeeOwnerMap/${currentUser.uid}`, (v) => setEmployerUid(typeof v === 'string' && v ? v : null)),
        );
        // بدون اتصال وبدون نسخة محلية: لا ننتظر للأبد — نعامله كمالك حتى يصل الرد
        const t = setTimeout(() => setEmployerUid((v) => (v === undefined ? null : v)), 6000);
        subs.push(() => clearTimeout(t));
        // بيانات الشركة كما يكتبها التطبيق (CompanyInfo) وعملة نقاط البيع من إعدادات المبيعات
      } else {
        setUser(null);
        setEmployerUid(null);
      }
      setAuthLoading(false);
    });

    return () => {
      subs.forEach((u) => u());
      unsubscribe();
    };
  }, []);

  const ownerUid = user ? employerUid || user.uid : null;

  useEffect(() => {
    if (!ownerUid || employerUid === undefined) return;
    return watchValue(`users/${ownerUid}/companyInfo`, (data) => data && setCompanyInfo(data), () => undefined);
  }, [ownerUid, employerUid]);

  // سجل العضو في الفريق (قبل نشر قواعد الفريق يُرفض الطلب فيُعامل ككاشير كما كان)
  useEffect(() => {
    if (!user || !employerUid) {
      setMemberRaw(null);
      return;
    }
    setMemberRaw(undefined);
    return watchValue(`teams/${employerUid}/${user.uid}`, (v) => setMemberRaw(v ?? null), () => setMemberRaw(null));
  }, [user, employerUid]);

  const teamEntry = useMemo(() => (user && memberRaw ? parseMember(user.uid, memberRaw) : null), [user, memberRaw]);
  const suspended = !!teamEntry && !teamEntry.active;
  const member = teamEntry && teamEntry.active && teamEntry.role !== 'cashier' ? teamEntry : null;
  const actor: Actor | null = useMemo(
    () =>
      user
        ? {
            uid: user.uid,
            name: teamEntry?.name || user.displayName || user.email || '',
            role: employerUid ? teamEntry?.role || 'cashier' : 'owner',
          }
        : null,
    [user, teamEntry, employerUid],
  );

  useEffect(() => {
    if (!ownerUid || employerUid === undefined) return;
    return watchValue(`sales/${ownerUid}/settings/currency`, (value) => {
      if (typeof value === 'string' && value) setCurrency(value);
    });
  }, [ownerUid, employerUid]);

  const [mobileSubscription, setMobileSubscription] = useState<SubscriptionInfo | null>(null);
  const [webSubscription, setWebSubscription] = useState<SubscriptionInfo | null>(null);
  const [subLoaded, setSubLoaded] = useState({ mobile: false, web: false });
  const subUid = user && employerUid === null ? user.uid : null;

  // الكاشير لا يقرأ عقدة المالك (قواعد Firebase) — الحدود تخص المالك فقط
  useEffect(() => {
    setMobileSubscription(null);
    setWebSubscription(null);
    setSubLoaded({ mobile: false, web: false });
    if (!subUid) return;
    const subs = [
      watchValue(`users/${subUid}/subscription`, (v) => {
        setMobileSubscription(v ? parseSubscription(v) : null);
        setSubLoaded((l) => ({ ...l, mobile: true }));
      }),
      watchValue(`users/${subUid}/webSubscription`, (v) => {
        setWebSubscription(v ? parseSubscription(v) : null);
        setSubLoaded((l) => ({ ...l, web: true }));
      }),
    ];
    return () => subs.forEach((u) => u());
  }, [subUid]);

  // قبل وصول الاشتراك (بدون اتصال ولا نسخة محلية) لا نمنع الكتابة — الحدود تُطبَّق حين نعرف الخطة
  const webAccess = useMemo(
    () =>
      subLoaded.mobile && subLoaded.web
        ? webAccessOf(subUid, mobileSubscription, webSubscription)
        : { source: null, kind: null, unlimited: true, expired: null },
    [subUid, mobileSubscription, webSubscription, subLoaded],
  );

  const logout = async () => {
    await signOut(auth);
    await clearOfflineCache();
  };

  const loading = authLoading || (!!user && (employerUid === undefined || (!!employerUid && memberRaw === undefined)));

  return (
    <AppContext.Provider
      value={{
        user,
        loading,
        logout,
        companyInfo,
        currency,
        ownerUid: loading ? null : ownerUid,
        isCashier: !!employerUid && !member,
        member,
        suspended,
        actor,
        mobileSubscription,
        webSubscription,
        webAccess,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within AppProvider');
  }
  return context;
};
