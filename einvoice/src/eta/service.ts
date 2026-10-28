// الربط مع منظومة الفاتورة الإلكترونية المصرية: رمز الدخول، الإرسال، ومتابعة حالة المستند.
import { Fetch } from '../zatca/api';
import { DocRecord } from '../zatca/service';
import { loadDoc } from '../sources';
import { paths, Store } from '../store';
import { signCades, signerFromPfx } from './cades';
import { buildEtaDocument, EtaIssuer, EtaOptions, serialize, validateEta } from './document';

export type EtaEnv = 'preprod' | 'production';

const HOSTS: Record<EtaEnv, { id: string; api: string; portal: string }> = {
  preprod: { id: 'https://id.preprod.eta.gov.eg', api: 'https://api.preprod.invoicing.eta.gov.eg', portal: 'https://preprod.invoicing.eta.gov.eg' },
  production: { id: 'https://id.eta.gov.eg', api: 'https://api.invoicing.eta.gov.eg', portal: 'https://invoicing.eta.gov.eg' },
};

export interface EtaVault {
  env: EtaEnv;
  clientId: string;
  clientSecret: string;
  /** شهادة التوقيع PFX (base64) — بدونها تُرسل نسخة 0.9 غير الموقّعة (للبيئة التجريبية فقط) */
  pfx?: string;
  pfxPassword?: string;
}

export interface EtaSettings {
  etaZeroSubtype?: string;
  etaDefaultItem?: EtaOptions['defaultItem'];
}

const now = () => new Date().toISOString();
const tokens = new Map<string, { token: string; exp: number }>();

export class EtaApi {
  constructor(
    private vault: EtaVault,
    private fetcher: Fetch = fetch,
  ) {}

  async token(): Promise<string> {
    const cacheKey = `${this.vault.env}:${this.vault.clientId}`;
    const c = tokens.get(cacheKey);
    if (c && c.exp > Date.now() + 60_000) return c.token;
    const res = await this.fetcher(`${HOSTS[this.vault.env].id}/connect/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'client_credentials', client_id: this.vault.clientId, client_secret: this.vault.clientSecret, scope: 'InvoicingAPI' }).toString(),
      signal: AbortSignal.timeout(30_000),
    });
    const j: any = await res.json().catch(() => ({}));
    if (res.status !== 200 || !j.access_token) throw new Error(`تعذّر الدخول إلى منظومة ETA: ${j.error_description || j.error || `HTTP ${res.status}`}`);
    tokens.set(cacheKey, { token: j.access_token, exp: Date.now() + (Number(j.expires_in) || 3600) * 1000 });
    return j.access_token;
  }

  private async call(method: string, path: string, body?: unknown) {
    const res = await this.fetcher(`${HOSTS[this.vault.env].api}${path}`, {
      method,
      headers: { Authorization: `Bearer ${await this.token()}`, 'Content-Type': 'application/json', Accept: 'application/json', 'Accept-Language': 'ar' },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(30_000),
    });
    const text = await res.text();
    let json: any = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      json = null;
    }
    return { status: res.status, json, text };
  }

  submit(documents: unknown[]) {
    return this.call('POST', '/api/v1.0/documentsubmissions', { documents });
  }

  details(uuid: string) {
    return this.call('GET', `/api/v1.0/documents/${uuid}/details`);
  }

  publicUrl(uuid: string, longId: string) {
    return `${HOSTS[this.vault.env].portal}/documents/${uuid}/share/${longId}`;
  }
}

/** يجمع رسائل الخطأ المتداخلة التي تعيدها ETA */
const flattenErrors = (e: any, out: string[] = []): string[] => {
  if (!e) return out;
  if (Array.isArray(e)) e.forEach((x) => flattenErrors(x, out));
  else if (typeof e === 'object') {
    const text = e.message || e.error || e.errorAr;
    if (text && !e.details?.length && !e.innerError?.length) out.push(`${e.propertyPath ? `${e.propertyPath}: ` : ''}${text}`);
    flattenErrors(e.details, out);
    flattenErrors(e.innerError, out);
    flattenErrors(e.validationResults?.validationSteps?.filter?.((s: any) => s.status === 'Invalid').map((s: any) => s.error), out);
  } else out.push(String(e));
  return out;
};

export const submitEta = async (store: Store, uid: string, key: string, fetcher?: Fetch): Promise<DocRecord> => {
  const docPath = paths.doc(uid, key);
  const existing = await store.get<DocRecord>(docPath);
  if (existing && ['submitted', 'valid'].includes(existing.status)) return refreshEta(store, uid, key, fetcher);

  const vault = await store.get<EtaVault>(paths.vault(uid, 'eta'));
  if (!vault?.clientId) throw new Error('أدخل بيانات الربط مع ETA أولاً (Client ID و Client Secret)');

  const [doc, issuer, settings] = await Promise.all([
    loadDoc(store, uid, key),
    store.get<EtaIssuer>(`${paths.base(uid)}/seller`),
    store.get<EtaSettings>(`${paths.base(uid)}/settings`),
  ]);
  const signed = !!vault.pfx;
  if (!signed && vault.env === 'production') throw new Error('بيئة الإنتاج تتطلب شهادة التوقيع الإلكتروني (ملف PFX)');
  const opts: EtaOptions = { version: signed ? '1.0' : '0.9', zeroSubtype: settings?.etaZeroSubtype, defaultItem: settings?.etaDefaultItem };
  const errs = validateEta(doc, issuer, opts);
  if (errs.length) {
    const r: DocRecord = { provider: 'eta', status: 'error', number: doc.number, messages: errs.map((t) => ({ level: 'error', text: t })), attemptAt: now(), env: vault.env };
    await store.update({ [docPath]: r });
    return r;
  }

  const body: any = buildEtaDocument(doc, issuer!, opts);
  if (signed) body.signatures = [{ signatureType: 'I', value: signCades(serialize(body), signerFromPfx(vault.pfx!, vault.pfxPassword || '')) }];

  const api = new EtaApi(vault, fetcher);
  const res = await api.submit([body]);
  const accepted = res.json?.acceptedDocuments?.[0];
  const rejected = res.json?.rejectedDocuments?.[0];
  let record: DocRecord;
  if (res.status === 202 && accepted) {
    record = {
      provider: 'eta',
      status: 'submitted',
      number: doc.number,
      uuid: accepted.uuid,
      longId: accepted.longId,
      submissionId: res.json.submissionId,
      total: body.totalAmount,
      tax: body.taxTotals[0].amount,
      publicUrl: accepted.longId ? api.publicUrl(accepted.uuid, accepted.longId) : undefined,
      attemptAt: now(),
      env: vault.env,
    };
  } else {
    const msgs = flattenErrors(rejected?.error || res.json?.error || res.json);
    record = {
      provider: 'eta',
      status: res.status >= 500 ? 'error' : 'rejected',
      number: doc.number,
      messages: (msgs.length ? msgs : [res.text || `HTTP ${res.status}`]).map((t) => ({ level: 'error' as const, text: t })),
      attemptAt: now(),
      env: vault.env,
    };
  }
  await store.update({ [docPath]: record, [paths.xml(uid, key)]: JSON.stringify(body) });
  return record;
};

/** يتابع حالة مستند أُرسل: Valid / Invalid / Cancelled */
export const refreshEta = async (store: Store, uid: string, key: string, fetcher?: Fetch): Promise<DocRecord> => {
  const docPath = paths.doc(uid, key);
  const rec = await store.get<DocRecord>(docPath);
  if (!rec?.uuid) throw new Error('المستند لم يُرسل بعد');
  const vault = await store.get<EtaVault>(paths.vault(uid, 'eta'));
  if (!vault) throw new Error('بيانات الربط مع ETA غير موجودة');
  const api = new EtaApi(vault, fetcher);
  const res = await api.details(rec.uuid);
  if (res.status !== 200 || !res.json) return rec;
  const st = String(res.json.status || '').toLowerCase();
  const next: DocRecord = {
    ...rec,
    status: st === 'valid' ? 'valid' : st === 'invalid' ? 'invalid' : st === 'cancelled' ? 'cancelled' : rec.status,
    longId: res.json.longId || rec.longId,
    publicUrl: res.json.longId ? api.publicUrl(rec.uuid, res.json.longId) : rec.publicUrl,
    messages: st === 'invalid' ? flattenErrors(res.json.validationResults).map((t) => ({ level: 'error' as const, text: t })) : rec.messages,
    acceptedAt: st === 'valid' ? rec.acceptedAt || now() : rec.acceptedAt,
  };
  await store.update({ [docPath]: next });
  return next;
};

/** اختبار بيانات الربط بطلب رمز دخول فقط */
export const testEta = async (vault: EtaVault, fetcher?: Fetch) => {
  await new EtaApi(vault, fetcher).token();
  if (vault.pfx) signerFromPfx(vault.pfx, vault.pfxPassword || '');
  return true;
};
