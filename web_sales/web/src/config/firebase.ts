import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getDatabase } from 'firebase/database';

// نفس الـ config من web_sales
const firebaseConfig = {
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
