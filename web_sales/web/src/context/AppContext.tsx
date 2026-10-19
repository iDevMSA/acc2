import React, { createContext, useContext, useEffect, useState } from 'react';
import { auth } from '../config/firebase';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { clearOfflineCache, watchValue } from '../lib/offlineStore';

interface User {
  uid: string;
  email?: string;
}

interface AppContextType {
  user: User | null;
  loading: boolean;
  logout: () => Promise<void>;
  companyInfo: any;
  currency: string;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [companyInfo, setCompanyInfo] = useState<any>(null);
  const [currency, setCurrency] = useState('SAR');

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (currentUser) {
        setUser({
          uid: currentUser.uid,
          email: currentUser.email || undefined,
        });

        // بيانات الشركة كما يكتبها التطبيق (CompanyInfo) وعملة نقاط البيع من إعدادات المبيعات
        watchValue(`users/${currentUser.uid}/companyInfo`, (data) => {
          if (data) setCompanyInfo(data);
        });
        watchValue(`sales/${currentUser.uid}/settings/currency`, (value) => {
          if (typeof value === 'string' && value) setCurrency(value);
        });
      } else {
        setUser(null);
      }
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const logout = async () => {
    await signOut(auth);
    await clearOfflineCache();
  };

  return (
    <AppContext.Provider value={{ user, loading, logout, companyInfo, currency }}>
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
