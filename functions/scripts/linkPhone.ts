// ينشئ رمز ربط لمستخدم منصتي إلى أن تُضاف شاشة الربط في إعدادات الويب.
// الاستخدام (بعد npm run build وتسجيل الدخول بـ gcloud auth application-default login):
//   npm run link-phone -- <uid>
// ثم يرسل المستخدم الرمز المكوّن من 6 أرقام إلى رقم البوت على واتساب خلال 30 دقيقة.
import { randomInt } from 'crypto';
import { initializeApp } from 'firebase-admin/app';
import { getDatabase } from 'firebase-admin/database';

const DB_URL = 'https://alaraby-4ccdd-default-rtdb.firebaseio.com';

const main = async () => {
  const uid = process.argv[2];
  if (!uid) throw new Error('usage: npm run link-phone -- <uid>');
  initializeApp({ databaseURL: DB_URL });
  const code = String(randomInt(100000, 1000000));
  const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();
  await getDatabase().ref(`whatsappBot/linkCodes/${code}`).set({ uid, expiresAt });
  console.log(`رمز الربط: ${code} (صالح حتى ${expiresAt})`);
  process.exit(0);
};

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
