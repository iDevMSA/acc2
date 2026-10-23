// تسجيل وحدة الإصدار لدى ZATCA وإرسال المستندات مع الحفاظ على تسلسل العدّاد (ICV) وسلسلة الـ hash (PIH).
import { randomUUID, X509Certificate } from 'crypto';
import { EDoc, Party } from '../model';
import { loadDoc } from '../sources';
import { paths, Store, withLock } from '../store';
import { certFromToken, Csid, Fetch, Message, SubmitResult, ZatcaApi } from './api';
import { buildCsr, EgsInfo, generateKey, ZatcaEnv } from './csr';
import { Exemption, INITIAL_PIH, signInvoice } from './invoice';

export interface ZatcaVault {
  env: ZatcaEnv;
  privateKey: string;
  egs: EgsInfo;
  compliance?: Csid;
  production?: Csid;
  icv: number;
  pih: string;
}

/** ما يُعرض في الويب عن حالة الربط */
export interface ZatcaStatus {
  env: ZatcaEnv;
  status: 'onboarding' | 'ready' | 'error';
  message?: string;
  invoiceTypes?: string;
  egsSerial?: string;
  certExpiresAt?: string;
  onboardedAt?: string;
  checks?: { name: string; status: string; messages?: string[] }[];
  updatedAt: string;
}

export type DocStatus = 'signed' | 'reported' | 'cleared' | 'warning' | 'rejected' | 'error';

export interface DocRecord {
  provider: 'zatca' | 'eta';
  status: DocStatus | 'submitted' | 'valid' | 'invalid' | 'cancelled';
  profile?: 'standard' | 'simplified';
  number: string;
  uuid?: string;
  icv?: number;
  hash?: string;
  qr?: string;
  total?: number;
  tax?: number;
  messages?: { level: 'error' | 'warning' | 'info'; code?: string; text: string }[];
  /** وقت التوقيع / آخر محاولة / القبول */
  signedAt?: string;
  attemptAt?: string;
  acceptedAt?: string;
  env?: string;
  /** ETA */
  longId?: string;
  submissionId?: string;
  publicUrl?: string;
}

export const sellerOf = async (store: Store, uid: string): Promise<Party | null> => store.get<Party>(`users/${uid}/einvoice/seller`);

const now = () => new Date().toISOString();

const messagesOf = (r: SubmitResult): DocRecord['messages'] => {
  const map = (level: 'error' | 'warning' | 'info', list?: Message[]) =>
    (list || []).map((m) => ({ level, code: m.code, text: m.message || m.code || '' }));
  const out: NonNullable<DocRecord['messages']> = [...map('error', r.validationResults?.errorMessages), ...map('warning', r.validationResults?.warningMessages)];
  if (r.error && !out.length) out.push({ level: 'error', text: r.error });
  return out;
};

/* ───────── عينات فحص المطابقة ───────── */

const SAMPLE_BUYER: Party = {
  name: 'Sample Buyer Co.',
  vatNumber: '399999999800003',
  street: 'King Fahd Road',
  building: '1234',
  district: 'Al Olaya',
  city: 'Riyadh',
  postalCode: '12211',
  country: 'SA',
};

export const sampleDocs = (types: EgsInfo['invoiceTypes']) => {
  const profiles: ('standard' | 'simplified')[] = [];
  if (types[0] === '1') profiles.push('standard');
  if (types[1] === '1') profiles.push('simplified');
  const out: { name: string; profile: 'standard' | 'simplified'; doc: EDoc }[] = [];
  for (const profile of profiles) {
    for (const kind of ['invoice', 'credit', 'debit'] as const) {
      out.push({
        name: `${profile === 'standard' ? 'قياسية' : 'مبسطة'} — ${kind === 'invoice' ? 'فاتورة' : kind === 'credit' ? 'إشعار دائن' : 'إشعار مدين'}`,
        profile,
        doc: {
          key: `sample_${profile}_${kind}`,
          kind,
          number: `SME-${profile[0].toUpperCase()}${kind[0].toUpperCase()}-${Date.now() % 100000}`,
          issuedAt: new Date().toISOString(),
          currency: 'SAR',
          rateToTaxCurrency: 1,
          lines: [
            { name: 'صنف تجريبي', qty: 2, unitPrice: 50, discountPct: 0, vatRate: 15 },
            { name: 'خدمة تجريبية', qty: 1, unitPrice: 30, discountPct: 10, vatRate: 15 },
          ],
          allowances: [],
          buyer: profile === 'standard' ? SAMPLE_BUYER : undefined,
          billingRef: kind === 'invoice' ? undefined : 'SME-0001',
          reason: kind === 'invoice' ? undefined : 'تعديل الكمية',
          payment: 'cash',
        },
      });
    }
  }
  return out;
};

/* ───────── التسجيل ───────── */

export interface OnboardInput {
  env: ZatcaEnv;
  otp: string;
  egs: Omit<EgsInfo, 'solutionName' | 'serial'> & { serial?: string };
}

export const validateSeller = (s: Party | null): string[] => {
  const errs: string[] = [];
  if (!s?.name) errs.push('اسم المنشأة');
  if (!s?.vatNumber || !/^3\d{13}3$/.test(s.vatNumber)) errs.push('الرقم الضريبي (15 رقماً يبدأ وينتهي بـ 3)');
  if (!s?.crn) errs.push('رقم السجل التجاري');
  if (!s?.street) errs.push('الشارع');
  if (!s?.building || !/^\d{4}$/.test(s.building)) errs.push('رقم المبنى (4 أرقام)');
  if (!s?.district) errs.push('الحي');
  if (!s?.city) errs.push('المدينة');
  if (!s?.postalCode || !/^\d{5}$/.test(s.postalCode)) errs.push('الرمز البريدي (5 أرقام)');
  return errs;
};

export const onboard = async (store: Store, uid: string, input: OnboardInput, fetcher?: Fetch): Promise<ZatcaStatus> => {
  const seller = await sellerOf(store, uid);
  const missing = validateSeller(seller);
  if (missing.length) throw new Error(`أكمل بيانات المنشأة أولاً: ${missing.join('، ')}`);
  if (!/^\d{6}$/.test(input.otp.trim())) throw new Error('رمز OTP يتكون من 6 أرقام');

  const statusPath = `${paths.base(uid)}/zatca`;
  const setStatus = (s: Omit<ZatcaStatus, 'updatedAt' | 'env'>) =>
    store.update({ [statusPath]: { env: input.env, ...s, updatedAt: now() } });

  return withLock(store, `${paths.vault(uid, 'zatca')}Lock`, async () => {
    const egs: EgsInfo = {
      ...input.egs,
      solutionName: 'Monsati',
      vatNumber: seller!.vatNumber!,
      orgName: input.egs.orgName || seller!.name,
      serial: input.egs.serial || randomUUID(),
    };
    await setStatus({ status: 'onboarding', message: 'جارٍ إصدار شهادة الامتثال', invoiceTypes: egs.invoiceTypes });
    const api = new ZatcaApi(input.env, fetcher);
    const privateKey = generateKey();
    try {
      const csr = buildCsr(privateKey, egs, input.env);
      const compliance = await api.complianceCsid(csr, input.otp.trim());
      const cert = certFromToken(compliance.token);

      // فحص المطابقة: ZATCA تشترط نجاح مستند من كل نوع مسموح قبل إصدار شهادة الإنتاج
      const checks: NonNullable<ZatcaStatus['checks']> = [];
      let pih = INITIAL_PIH;
      let icv = 0;
      for (const s of sampleDocs(egs.invoiceTypes)) {
        icv += 1;
        const uuid = randomUUID();
        const signed = signInvoice({ doc: s.doc, profile: s.profile, seller: seller!, uuid, icv, pih }, privateKey, cert);
        pih = signed.hash;
        const r = await api.complianceCheck(compliance, signed.xml, signed.hash, uuid);
        const msgs = messagesOf(r) || [];
        const ok = r.httpStatus === 200 || r.httpStatus === 202;
        checks.push({ name: s.name, status: ok ? (msgs.length ? 'warning' : 'pass') : 'fail', messages: msgs.map((m) => `${m.code ? `${m.code}: ` : ''}${m.text}`) });
        await setStatus({ status: 'onboarding', message: `فحص المطابقة: ${s.name}`, invoiceTypes: egs.invoiceTypes, checks });
      }
      if (checks.some((c) => c.status === 'fail')) {
        const status: ZatcaStatus = { env: input.env, status: 'error', message: 'رفضت ZATCA بعض مستندات الفحص', invoiceTypes: egs.invoiceTypes, checks, updatedAt: now() };
        await store.update({ [statusPath]: status });
        return status;
      }

      const production = await api.productionCsid(compliance);
      const prodCert = new X509Certificate(Buffer.from(certFromToken(production.token), 'base64'));
      const vault: ZatcaVault = { env: input.env, privateKey, egs, compliance, production, icv: 0, pih: INITIAL_PIH };
      const status: ZatcaStatus = {
        env: input.env,
        status: 'ready',
        message: 'تم الربط وأصبحت الفواتير تُرسل إلى ZATCA',
        invoiceTypes: egs.invoiceTypes,
        egsSerial: egs.serial,
        certExpiresAt: new Date(prodCert.validTo).toISOString(),
        onboardedAt: now(),
        checks,
        updatedAt: now(),
      };
      await store.update({ [paths.vault(uid, 'zatca')]: vault, [statusPath]: status });
      return status;
    } catch (e: any) {
      const status: ZatcaStatus = { env: input.env, status: 'error', message: e?.message || String(e), invoiceTypes: egs.invoiceTypes, updatedAt: now() };
      await store.update({ [statusPath]: status });
      return status;
    }
  });
};

/* ───────── الإرسال ───────── */

export const profileFor = (doc: EDoc, types: string): 'standard' | 'simplified' => {
  const b2b = !!doc.buyer?.vatNumber;
  if (b2b && types[0] === '1') return 'standard';
  if (!b2b && types[1] === '1') return 'simplified';
  if (types[0] === '1') return 'standard';
  return 'simplified';
};

const validateDoc = (doc: EDoc, profile: 'standard' | 'simplified', exemption?: Exemption): string[] => {
  const errs: string[] = [];
  if (profile === 'standard') {
    const b = doc.buyer;
    if (!b) errs.push('الفاتورة الضريبية تحتاج بيانات المشتري');
    else {
      if (!b.vatNumber || !/^3\d{13}3$/.test(b.vatNumber)) errs.push('الرقم الضريبي للمشتري غير صالح');
      if (!b.street || !b.city || !b.district || !b.postalCode || !b.building) errs.push('عنوان المشتري ناقص (الشارع، رقم المبنى، الحي، المدينة، الرمز البريدي)');
    }
  }
  if (doc.lines.some((l) => l.vatRate === 0) && !exemption) errs.push('بعض البنود بنسبة 0%: اختر سبب الإعفاء أو النسبة الصفرية في إعدادات الفوترة الإلكترونية');
  if (doc.kind !== 'invoice' && !doc.billingRef) errs.push('أدخل رقم الفاتورة الأصلية لهذا الإشعار');
  if (doc.currency !== 'SAR' && doc.rateToTaxCurrency === 1) errs.push('عملة الفاتورة ليست الريال السعودي ولا يوجد سعر صرف إليه');
  return errs;
};

const FINAL: DocRecord['status'][] = ['reported', 'cleared', 'warning'];

export const submitZatca = async (store: Store, uid: string, key: string, fetcher?: Fetch): Promise<DocRecord> => {
  const vaultPath = paths.vault(uid, 'zatca');
  const docPath = paths.doc(uid, key);
  const existing = await store.get<DocRecord>(docPath);
  if (existing && FINAL.includes(existing.status)) return existing;

  const vault = await store.get<ZatcaVault>(vaultPath);
  if (!vault?.production) throw new Error('أكمل ربط ZATCA أولاً من صفحة الفوترة الإلكترونية');
  const api = new ZatcaApi(vault.env, fetcher);

  return withLock(store, `${vaultPath}Lock`, async () => {
    let record = existing;
    let xml: string | null = null;

    // مستند موقّع لم يصل ردّه (انقطاع أو خطأ خادم): يُعاد إرسال الملف نفسه كما تشترط ZATCA
    if (record?.status === 'signed' || (record?.status === 'error' && record.hash)) xml = await store.get<string>(paths.xml(uid, key));

    if (!xml) {
      const [doc, seller, settings] = await Promise.all([
        loadDoc(store, uid, key),
        sellerOf(store, uid),
        store.get<{ zatcaExemption?: Exemption }>(`${paths.base(uid)}/settings`),
      ]);
      const profile = profileFor(doc, vault.egs.invoiceTypes);
      const errs = validateDoc(doc, profile, settings?.zatcaExemption);
      if (errs.length) {
        const r: DocRecord = { provider: 'zatca', status: 'error', profile, number: doc.number, messages: errs.map((t) => ({ level: 'error', text: t })), attemptAt: now(), env: vault.env };
        await store.update({ [docPath]: r });
        return r;
      }
      const uuid = randomUUID();
      const icv = (vault.icv || 0) + 1;
      const signed = signInvoice(
        { doc, profile, seller: seller!, uuid, icv, pih: vault.pih || INITIAL_PIH, exemption: settings?.zatcaExemption },
        vault.privateKey,
        certFromToken(vault.production!.token),
      );
      xml = signed.xml;
      record = {
        provider: 'zatca',
        status: 'signed',
        profile,
        number: doc.number,
        uuid,
        icv,
        hash: signed.hash,
        qr: signed.qr,
        total: signed.totals.taxInclusive,
        tax: signed.totals.tax,
        signedAt: now(),
        env: vault.env,
      };
      // العدّاد والسلسلة يتقدمان مع كل مستند موقّع، حتى لو رُفض لاحقاً
      await store.update({
        [`${vaultPath}/icv`]: icv,
        [`${vaultPath}/pih`]: signed.hash,
        [docPath]: record,
        [paths.xml(uid, key)]: xml,
      });
    }

    const r = record!;
    let res: SubmitResult;
    try {
      res = r.profile === 'standard' ? await api.clear(vault.production!, xml, r.hash!, r.uuid!) : await api.report(vault.production!, xml, r.hash!, r.uuid!);
    } catch (e: any) {
      const next: DocRecord = { ...r, status: 'signed', attemptAt: now(), messages: [{ level: 'warning', text: `تعذّر الاتصال بـ ZATCA وسيُعاد الإرسال: ${e?.message || e}` }] };
      await store.update({ [docPath]: next });
      return next;
    }

    const messages = messagesOf(res);
    let next: DocRecord;
    const updates: Record<string, unknown> = {};
    if (res.httpStatus === 200 || res.httpStatus === 202) {
      next = {
        ...r,
        status: messages?.some((m) => m.level === 'warning') ? 'warning' : r.profile === 'standard' ? 'cleared' : 'reported',
        messages,
        attemptAt: now(),
        acceptedAt: now(),
      };
      if (res.clearedInvoice) {
        const cleared = Buffer.from(res.clearedInvoice, 'base64').toString('utf8');
        updates[paths.xml(uid, key)] = cleared;
        const qr = /<cbc:ID>QR<\/cbc:ID>\s*<cac:Attachment>\s*<cbc:EmbeddedDocumentBinaryObject[^>]*>([^<]+)</.exec(cleared)?.[1];
        if (qr) next.qr = qr;
      }
    } else if (res.httpStatus === 400) {
      next = { ...r, status: 'rejected', messages, attemptAt: now() };
    } else if (res.httpStatus === 409) {
      // سبق قبوله (إعادة إرسال بعد انقطاع)
      next = { ...r, status: r.profile === 'standard' ? 'cleared' : 'reported', messages, attemptAt: now(), acceptedAt: now() };
    } else {
      next = { ...r, status: 'signed', messages, attemptAt: now() };
    }
    updates[docPath] = next;
    await store.update(updates);
    return next;
  });
};
