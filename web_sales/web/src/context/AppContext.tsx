import React, { createContext, useContext, useEffect, useState } from 'react';
import { auth } from '../config/firebase';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { clearOfflineCache, watchValue } from '../lib/offlineStore';

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
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [companyInfo, setCompanyInfo] = useState<any>(null);
  const [currency, setCurrency] = useState('SAR');
  // undefined = لم يصل الرد بعد، null = ليس موظفاً (مالك)
  const [employerUid, setEmployerUid] = useState<string | null | undefined>(undefined);

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
        subs.push(
          watchValue(`users/${currentUser.uid}/companyInfo`, (data) => {
            if (data) setCompanyInfo(data);
          }),
        );
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
    return watchValue(`sales/${ownerUid}/settings/currency`, (value) => {
      if (typeof value === 'string' && value) setCurrency(value);
    });
  }, [ownerUid, employerUid]);

  const logout = async () => {
    await signOut(auth);
    await clearOfflineCache();
  };

  const loading = authLoading || (!!user && employerUid === undefined);

  return (
    <AppContext.Provider
      value={{ user, loading, logout, companyInfo, currency, ownerUid: loading ? null : ownerUid, isCashier: !!employerUid }}
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
