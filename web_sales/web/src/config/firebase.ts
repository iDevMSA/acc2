import { FirebaseApp, getApps, initializeApp } from 'firebase/app';
import { connectAuthEmulator, getAuth } from 'firebase/auth';
import { connectDatabaseEmulator, getDatabase } from 'firebase/database';

// نفس الـ config من web_sales
export const firebaseConfig = {
  apiKey: "AIzaSyDz-jDwiRUoJWd0_oHsZCLnlw--0PcDOXk",
  authDomain: "alaraby-4ccdd.firebaseapp.com",
  databaseURL: "https://alaraby-4ccdd-default-rtdb.firebaseio.com",
  projectId: "alaraby-4ccdd",
  storageBucket: "alaraby-4ccdd.firebasestorage.app",
  messagingSenderId: "633240001820",
  appId: "1:633240001820:web:alaraby4ccdd",
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getDatabase(app);

// للتطوير فقط: REACT_APP_FIREBASE_EMULATOR=1 يوجّه المنصة إلى محاكيات Firebase المحلية
// (firebase emulators:start --only auth,database) بدل البيانات الحقيقية.
if (process.env.REACT_APP_FIREBASE_EMULATOR === '1') {
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
  connectDatabaseEmulator(db, '127.0.0.1', 9000);
}

/**
 * Auth ثانوي لإنشاء حسابات الكاشير من لوحة المالك دون تسجيل خروج المالك
 * (createUserWithEmailAndPassword على الـ Auth الأساسي يبدّل المستخدم الحالي).
 */
export const secondaryAuth = () => {
  const existing = getApps().find((a) => a.name === 'cashier-admin');
  const second: FirebaseApp = existing || initializeApp(firebaseConfig, 'cashier-admin');
  const a = getAuth(second);
  if (!existing && process.env.REACT_APP_FIREBASE_EMULATOR === '1') {
    connectAuthEmulator(a, 'http://127.0.0.1:9099', { disableWarnings: true });
  }
  return a;
};
