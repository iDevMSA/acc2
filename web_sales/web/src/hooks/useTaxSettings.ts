import { useEffect, useState } from 'react';
import { db } from '../config/firebase';
import { ref, onValue, set } from 'firebase/database';
import { TaxSettings } from '../tax/taxEngine';

// عقدة مستقلة sales/{uid}/taxSettings — إضافة فقط، لا تمس settings التي يكتبها تطبيق الهاتف
export const useTaxSettings = (userId: string | null) => {
  const [settings, setSettings] = useState<TaxSettings | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) return;
    const unsubscribe = onValue(ref(db, `sales/${userId}/taxSettings`), (snapshot) => {
      setSettings(snapshot.val());
      setLoading(false);
    });
    return unsubscribe;
  }, [userId]);

  const save = async (next: TaxSettings) => {
    if (!userId) return;
    await set(ref(db, `sales/${userId}/taxSettings`), next);
  };

  return { settings, loading, save };
};
