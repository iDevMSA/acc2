// نقطتا الدخول:
//  whatsappWebhook: الرابط الذي يُسجَّل في Meta (GET للتحقق، POST للرسائل). يحفظ الرسالة ويرد 200 فوراً.
//  whatsappProcess: يعالج كل رسالة محفوظة في whatsappBot/inbox (Claude + الرد) بعيداً عن مهلة Meta.
import { initializeApp } from 'firebase-admin/app';
import { getDatabase } from 'firebase-admin/database';
import { logger } from 'firebase-functions';
import { defineSecret, defineString } from 'firebase-functions/params';
import { onValueCreated } from 'firebase-functions/v2/database';
import { onRequest } from 'firebase-functions/v2/https';
import { Bot, Store } from './bot';
import { ReceiptParser } from './parser';
import { extractMessages, Incoming, verifySignature, WhatsApp } from './whatsapp';

initializeApp();

const WHATSAPP_TOKEN = defineSecret('WHATSAPP_TOKEN');
const WHATSAPP_APP_SECRET = defineSecret('WHATSAPP_APP_SECRET');
const WHATSAPP_VERIFY_TOKEN = defineSecret('WHATSAPP_VERIFY_TOKEN');
const ANTHROPIC_API_KEY = defineSecret('ANTHROPIC_API_KEY');
const WHATSAPP_PHONE_NUMBER_ID = defineString('WHATSAPP_PHONE_NUMBER_ID');
const BOT_TIMEZONE = defineString('BOT_TIMEZONE', { default: 'Asia/Riyadh' });
const REGION = 'us-central1';

const adminStore = (): Store => {
  const db = getDatabase();
  return {
    get: async (path) => (await db.ref(path).get()).val(),
    update: async (updates) => {
      await db.ref().update(updates);
    },
    claimDraft: async (uid, draftId) => {
      const res = await db.ref(`whatsappBot/drafts/${uid}/${draftId}/status`).transaction((s) => (s === 'pending' ? 'posting' : undefined));
      return res.committed;
    },
  };
};

export const whatsappWebhook = onRequest(
  { region: REGION, secrets: [WHATSAPP_APP_SECRET, WHATSAPP_VERIFY_TOKEN], maxInstances: 5 },
  async (req, res) => {
    if (req.method === 'GET') {
      // التحقق الذي تجريه Meta مرة واحدة عند تسجيل الرابط
      const ok = req.query['hub.mode'] === 'subscribe' && req.query['hub.verify_token'] === WHATSAPP_VERIFY_TOKEN.value();
      res.status(ok ? 200 : 403).send(ok ? String(req.query['hub.challenge'] ?? '') : 'forbidden');
      return;
    }
    if (req.method !== 'POST') {
      res.status(405).send('method not allowed');
      return;
    }
    if (!verifySignature(req.rawBody, req.get('x-hub-signature-256'), WHATSAPP_APP_SECRET.value())) {
      logger.warn('whatsapp webhook: bad signature');
      res.status(401).send('bad signature');
      return;
    }
    const messages = extractMessages(req.body);
    const db = getDatabase();
    // معرّف رسالة واتساب مفتاحٌ للعقدة، فإعادة الإرسال من Meta لا تُنشئ معالجة ثانية
    await Promise.all(
      messages.map((m) =>
        db.ref(`whatsappBot/inbox/${m.id.replace(/[.#$\[\]/]/g, '_')}`).transaction((cur) => (cur === null ? { ...m, receivedAt: Date.now() } : undefined)),
      ),
    );
    res.status(200).send('ok');
  },
);

export const whatsappProcess = onValueCreated(
  {
    ref: '/whatsappBot/inbox/{msgId}',
    region: REGION,
    secrets: [WHATSAPP_TOKEN, ANTHROPIC_API_KEY],
    timeoutSeconds: 300,
    memory: '512MiB',
  },
  async (event) => {
    const msg = event.data.val() as Incoming;
    if (!msg?.from) return;
    process.env.TZ = BOT_TIMEZONE.value();
    const wa = new WhatsApp({ token: WHATSAPP_TOKEN.value(), phoneNumberId: WHATSAPP_PHONE_NUMBER_ID.value() });
    const bot = new Bot({
      store: adminStore(),
      wa,
      parser: new ReceiptParser(ANTHROPIC_API_KEY.value()),
      timeZone: BOT_TIMEZONE.value(),
    });
    await wa.markRead(msg.id);
    try {
      await bot.handle(msg);
    } catch (e) {
      logger.error('whatsapp bot failed', e);
      await wa.sendText(msg.from, 'حدث خطأ أثناء معالجة رسالتك ولم يُسجَّل شيء. حاول مرة أخرى بعد قليل.').catch(() => undefined);
    } finally {
      await event.data.ref.update({ processedAt: Date.now() });
    }
  },
);
