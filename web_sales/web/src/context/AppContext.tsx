import React, { createContext, useContext, useEffect, useState } from 'react';
import { auth, db } from '../config/firebase';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { ref, onValue } from 'firebase/database';

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

        // تحميل بيانات الشركة
        const settingsRef = ref(db, `users/${currentUser.uid}/settings`);
        onValue(settingsRef, (snapshot) => {
          const data = snapshot.val();
          if (data) {
            setCompanyInfo(data);
            setCurrency(data.currency || 'SAR');
          }
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
