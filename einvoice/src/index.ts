// نقاط الدخول (codebase: einvoice):
//   einvoiceZatcaOnboard    ربط وحدة الإصدار مع ZATCA برمز OTP (يولّد المفتاح والشهادات ويجري فحص المطابقة)
//   einvoiceEtaConnect      حفظ بيانات الربط مع ETA وشهادة التوقيع بعد اختبارها
//   einvoiceSubmit          إرسال مستند واحد (أو إعادة إرساله) للجهة المختارة
//   einvoiceRefresh         تحديث حالة مستند أُرسل إلى ETA
//   einvoiceAuto            كل 15 دقيقة: إرسال المستندات الجديدة لمن فعّل الإرسال التلقائي ومتابعة حالات ETA
import { initializeApp } from 'firebase-admin/app';
import { getDatabase } from 'firebase-admin/database';
import { logger } from 'firebase-functions';
import { CallableRequest, HttpsError, onCall } from 'firebase-functions/v2/https';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { EtaVault, refreshEta, submitEta, testEta } from './eta/service';
import { paths, Store } from './store';
import { DocRecord, onboard, submitZatca } from './zatca/service';

initializeApp();
const REGION = 'us-central1';

const adminStore = (): Store => {
  const db = getDatabase();
  return {
    get: async (path) => (await db.ref(path).get()).val(),
    update: async (updates) => {
      await db.ref().update(updates);
    },
    transaction: async (path, fn) => (await db.ref(path).transaction((cur) => fn(cur))).committed,
  };
};

const uidOf = (req: CallableRequest) => {
  if (!req.auth?.uid) throw new HttpsError('unauthenticated', 'سجّل الدخول أولاً');
  return req.auth.uid;
};

const fail = (e: any): never => {
  if (e instanceof HttpsError) throw e;
  throw new HttpsError('failed-precondition', e?.message || String(e));
};

export interface EinvoiceSettings {
  /** الجهة المعتمدة لهذا الحساب */
  provider?: 'zatca' | 'eta';
  auto?: { enabled?: boolean; since?: string; pos?: boolean; trade?: boolean; notes?: boolean };
}

const submitOne = async (store: Store, uid: string, key: string) => {
  const settings = await store.get<EinvoiceSettings>(`${paths.base(uid)}/settings`);
  return settings?.provider === 'eta' ? submitEta(store, uid, key) : submitZatca(store, uid, key);
};

export const einvoiceZatcaOnboard = onCall({ region: REGION, timeoutSeconds: 300 }, async (req) => {
  const uid = uidOf(req);
  const { env, otp, egs } = req.data || {};
  if (!['sandbox', 'simulation', 'production'].includes(env)) throw new HttpsError('invalid-argument', 'بيئة غير صالحة');
  try {
    return await onboard(adminStore(), uid, { env, otp: String(otp || ''), egs: egs || {} });
  } catch (e) {
    return fail(e);
  }
});

export const einvoiceEtaConnect = onCall({ region: REGION }, async (req) => {
  const uid = uidOf(req);
  const d = req.data || {};
  const store = adminStore();
  const prev = (await store.get<EtaVault>(paths.vault(uid, 'eta'))) || ({} as EtaVault);
  const vault: EtaVault = {
    env: d.env === 'production' ? 'production' : 'preprod',
    clientId: String(d.clientId || prev.clientId || '').trim(),
    // الحقول السرية الفارغة تعني "أبقِ القيمة المحفوظة"
    clientSecret: String(d.clientSecret || prev.clientSecret || '').trim(),
    pfx: d.removeCertificate ? undefined : d.pfx || prev.pfx,
    pfxPassword: d.removeCertificate ? undefined : d.pfx ? String(d.pfxPassword || '') : prev.pfxPassword,
  };
  if (!vault.clientId || !vault.clientSecret) throw new HttpsError('invalid-argument', 'أدخل Client ID و Client Secret');
  try {
    await testEta(vault);
  } catch (e) {
    return fail(e);
  }
  const status = { env: vault.env, status: 'ready', clientId: vault.clientId, hasCertificate: !!vault.pfx, updatedAt: new Date().toISOString() };
  await store.update({ [paths.vault(uid, 'eta')]: JSON.parse(JSON.stringify(vault)), [`${paths.base(uid)}/eta`]: status });
  return status;
});

export const einvoiceSubmit = onCall({ region: REGION, timeoutSeconds: 120 }, async (req): Promise<DocRecord> => {
  const uid = uidOf(req);
  const key = String(req.data?.key || '');
  try {
    return await submitOne(adminStore(), uid, key);
  } catch (e) {
    return fail(e);
  }
});

export const einvoiceRefresh = onCall({ region: REGION }, async (req) => {
  const uid = uidOf(req);
  try {
    return await refreshEta(adminStore(), uid, String(req.data?.key || ''));
  } catch (e) {
    return fail(e);
  }
});

/** المستندات المؤهلة للإرسال التلقائي: الجديدة منذ تفعيله، ولم تُقبل بعد ولم تُرفض */
export const pendingKeys = async (store: Store, uid: string, s: NonNullable<EinvoiceSettings['auto']>) => {
  const since = s.since || new Date().toISOString();
  const docs = (await store.get<Record<string, DocRecord>>(`${paths.base(uid)}/docs`)) || {};
  const open = (key: string) => !docs[key] || docs[key].status === 'signed';
  const keys: string[] = [];
  if (s.pos !== false) {
    const pos = (await store.get<Record<string, any>>(`sales/${uid}/invoices`)) || {};
    for (const [id, inv] of Object.entries(pos)) {
      if ((inv.status && inv.status !== 'closed') || !(String(inv.createdAt || '') >= since)) continue;
      if (open(`pos_${id}`)) keys.push(`pos_${id}`);
    }
  }
  if (s.trade !== false) {
    const inv = (await store.get<Record<string, any>>(`users/${uid}/erp/invoices`)) || {};
    for (const [id, v] of Object.entries(inv)) {
      if ((v.kind === 'sale' || v.kind === 'saleReturn') && String(v.createdAt || '') >= since && open(`trade_${id}`)) keys.push(`trade_${id}`);
    }
  }
  if (s.notes) {
    const notes = (await store.get<Record<string, any>>(`users/${uid}/erp/notes`)) || {};
    for (const [id, v] of Object.entries(notes)) if (String(v.createdAt || '') >= since && open(`note_${id}`)) keys.push(`note_${id}`);
  }
  const toRefresh = Object.entries(docs)
    .filter(([, d]) => d.provider === 'eta' && d.status === 'submitted')
    .map(([k]) => k);
  return { keys: keys.slice(0, 50), toRefresh: toRefresh.slice(0, 50) };
};

export const einvoiceAuto = onSchedule({ region: REGION, schedule: 'every 15 minutes', timeoutSeconds: 540 }, async () => {
  const db = getDatabase();
  const store = adminStore();
  const uids = Object.keys((await db.ref('einvoiceVault').get()).val() || {});
  for (const uid of uids) {
    const settings = await store.get<EinvoiceSettings>(`${paths.base(uid)}/settings`);
    const { keys, toRefresh } = await pendingKeys(store, uid, settings?.auto?.enabled ? settings.auto : { pos: false, trade: false });
    for (const key of keys) {
      try {
        await submitOne(store, uid, key);
      } catch (e: any) {
        logger.warn('einvoice auto submit failed', { uid, key, error: e?.message });
      }
    }
    for (const key of toRefresh) {
      try {
        await refreshEta(store, uid, key);
      } catch (e: any) {
        logger.warn('einvoice refresh failed', { uid, key, error: e?.message });
      }
    }
  }
});
