// نقاط الدخول (codebase: alerts):
//   alertsConfig     المفتاح العام لإشعارات المتصفح (VAPID) — يُولَّد مرة واحدة ويُحفظ في alertsVault
//   alertsRegister   تسجيل الحساب في قائمة الإرسال اليومي (alertsIndex/{uid}) بعد تفعيل البريد أو الإشعارات
//   alertsTest       إرسال فوري بكل التنبيهات الحالية للتأكد من القنوات
//   alertsDigest     كل ساعة: إرسال الملخص اليومي لمن حلّت ساعته المختارة
import { initializeApp } from 'firebase-admin/app';
import { getDatabase } from 'firebase-admin/database';
import { logger } from 'firebase-functions';
import { defineSecret, defineString } from 'firebase-functions/params';
import { CallableRequest, HttpsError, onCall } from 'firebase-functions/v2/https';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import nodemailer from 'nodemailer';
import webpush from 'web-push';
import { Db, runDigest, Senders } from './digest';

initializeApp();
const REGION = 'us-central1';

/** مثال: smtps://user%40gmail.com:app-password@smtp.gmail.com:465 */
const SMTP_URL = defineSecret('ALERTS_SMTP_URL');
const MAIL_FROM = defineString('ALERTS_MAIL_FROM', { default: '' });
const APP_URL = defineString('ALERTS_APP_URL', { default: 'https://inexusdev.com/monsati' });

const adminDb = (): Db => {
  const db = getDatabase();
  return {
    get: async (path) => (await db.ref(path).get()).val(),
    update: async (updates) => {
      await db.ref().update(updates);
    },
  };
};

const uidOf = (req: CallableRequest) => {
  if (!req.auth?.uid) throw new HttpsError('unauthenticated', 'سجّل الدخول أولاً');
  return req.auth.uid;
};

/** عضو الفريق يتعامل مع تنبيهات المالك (نفس ما يفعله الويب) */
const ownerOf = async (uid: string) => {
  const db = getDatabase();
  const owner = (await db.ref(`employeeOwnerMap/${uid}`).get()).val();
  if (typeof owner !== 'string' || !owner) return uid;
  return (await db.ref(`teams/${owner}/${uid}/active`).get()).val() === true ? owner : uid;
};

const vapid = async () => {
  const ref = getDatabase().ref('alertsVault/_vapid');
  let keys = (await ref.get()).val() as { publicKey: string; privateKey: string } | null;
  if (!keys?.publicKey) {
    const fresh = webpush.generateVAPIDKeys();
    const tx = await ref.transaction((cur) => cur || fresh);
    keys = tx.snapshot.val();
  }
  return keys!;
};

const senders = async (): Promise<Senders> => {
  const keys = await vapid();
  const subject = MAIL_FROM.value() ? `mailto:${MAIL_FROM.value().replace(/^.*<|>.*$/g, '')}` : APP_URL.value();
  let smtp = '';
  try {
    smtp = SMTP_URL.value();
  } catch {
    smtp = '';
  }
  const transport = smtp ? nodemailer.createTransport(smtp) : null;
  return {
    email: transport
      ? async (to, subject, html, text) => {
          await transport.sendMail({ from: MAIL_FROM.value() || undefined, to, subject, html, text });
        }
      : null,
    push: async (sub, payload) => {
      try {
        await webpush.sendNotification(sub as webpush.PushSubscription, JSON.stringify(payload), {
          vapidDetails: { subject, publicKey: keys.publicKey, privateKey: keys.privateKey },
          TTL: 86400,
          urgency: 'normal',
        });
        return 'ok';
      } catch (e: any) {
        if (e?.statusCode === 404 || e?.statusCode === 410) return 'gone';
        throw e;
      }
    },
  };
};

export const alertsConfig = onCall({ region: REGION }, async (req) => {
  uidOf(req);
  return { publicKey: (await vapid()).publicKey };
});

export const alertsRegister = onCall({ region: REGION }, async (req) => {
  const uid = await ownerOf(uidOf(req));
  await getDatabase().ref(`alertsIndex/${uid}`).set(true);
  return { ok: true };
});

export const alertsTest = onCall({ region: REGION, secrets: [SMTP_URL], timeoutSeconds: 120 }, async (req) => {
  const uid = await ownerOf(uidOf(req));
  try {
    const r = await runDigest(adminDb(), await senders(), uid, new Date(), { test: true, appUrl: APP_URL.value() });
    if (r.error && !r.email && !r.push) throw new Error(r.error);
    return { email: r.email, push: r.push, alerts: r.alerts };
  } catch (e: any) {
    throw new HttpsError('failed-precondition', e?.message || String(e));
  }
});

export const alertsDigest = onSchedule(
  { region: REGION, schedule: 'every 60 minutes', secrets: [SMTP_URL], timeoutSeconds: 540, memory: '512MiB' },
  async () => {
    const db = adminDb();
    const index = (await db.get<Record<string, boolean>>('alertsIndex')) || {};
    const s = await senders();
    const now = new Date();
    for (const uid of Object.keys(index)) {
      try {
        const r = await runDigest(db, s, uid, now, { appUrl: APP_URL.value() });
        if (r.skipped === 'no-channels') await db.update({ [`alertsIndex/${uid}`]: null });
        else if (!r.skipped) logger.info('alerts digest', { uid, ...r });
      } catch (e: any) {
        logger.error('alerts digest failed', { uid, error: e?.message || String(e) });
      }
    }
  },
);
