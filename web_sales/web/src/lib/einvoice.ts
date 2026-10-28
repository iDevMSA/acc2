// الفوترة الإلكترونية في الويب: قراءة الحالة من users/{uid}/einvoice والكتابة في الإعدادات وبيانات العملاء،
// واستدعاء دوال السحابة (einvoice/) للتسجيل والإرسال. الأسرار (المفاتيح والشهادات وبيانات ETA)
// لا تمر على الويب إلا عند إدخالها، وتُحفظ في الخادم فقط.
import { useEffect, useState } from 'react';
import { get, ref, update } from 'firebase/database';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '../config/firebase';
import { watchValue } from './offlineStore';
import { Tone } from '../components/ui/primitives';

export type Provider = 'zatca' | 'eta';
export type SourceType = 'pos' | 'trade' | 'note';

export interface Party {
  name?: string;
  vatNumber?: string;
  crn?: string;
  nationalId?: string;
  street?: string;
  building?: string;
  district?: string;
  city?: string;
  postalCode?: string;
  governate?: string;
  country?: string;
  type?: 'B' | 'P' | 'F';
}

export interface Seller extends Party {
  /** ETA */
  activityCode?: string;
  branchId?: string;
}

export interface ItemCode {
  itemType?: 'EGS' | 'GS1';
  itemCode?: string;
  unitType?: string;
}

export interface EinvoiceSettings {
  provider?: Provider;
  auto?: { enabled?: boolean; since?: string; pos?: boolean; trade?: boolean; notes?: boolean };
  zatcaExemption?: { category: 'Z' | 'E'; code: string; reason: string };
  etaZeroSubtype?: string;
  etaDefaultItem?: ItemCode;
}

export interface CheckResult {
  name: string;
  status: 'pass' | 'warning' | 'fail' | string;
  messages?: string[];
}

export interface ZatcaStatus {
  env: 'sandbox' | 'simulation' | 'production';
  status: 'onboarding' | 'ready' | 'error';
  message?: string;
  invoiceTypes?: string;
  egsSerial?: string;
  certExpiresAt?: string;
  onboardedAt?: string;
  checks?: CheckResult[];
  updatedAt: string;
}

export interface EtaStatus {
  env: 'preprod' | 'production';
  status: 'ready';
  clientId: string;
  hasCertificate: boolean;
  updatedAt: string;
}

export type DocStatus = 'signed' | 'reported' | 'cleared' | 'warning' | 'rejected' | 'error' | 'submitted' | 'valid' | 'invalid' | 'cancelled';

export interface DocRecord {
  provider: Provider;
  status: DocStatus;
  profile?: 'standard' | 'simplified';
  number: string;
  uuid?: string;
  icv?: number;
  hash?: string;
  qr?: string;
  total?: number;
  tax?: number;
  messages?: { level: 'error' | 'warning' | 'info'; code?: string; text: string }[];
  signedAt?: string;
  attemptAt?: string;
  acceptedAt?: string;
  env?: string;
  longId?: string;
  submissionId?: string;
  publicUrl?: string;
}

export interface Override {
  billingRef?: string;
  billingRefUuid?: string;
  reason?: string;
}

export interface EinvoiceData {
  seller: Seller | null;
  settings: EinvoiceSettings;
  parties: Record<string, Party>;
  itemCodes: Record<string, ItemCode>;
  overrides: Record<string, Override>;
  zatca: ZatcaStatus | null;
  eta: EtaStatus | null;
  docs: Record<string, DocRecord>;
  loading: boolean;
}

const NODES = ['seller', 'settings', 'parties', 'itemCodes', 'overrides', 'zatca', 'eta', 'docs'] as const;

/** كل عقدة على حدة حتى لا نحمّل ملفات XML المحفوظة بجانبها */
export const useEinvoice = (uid: string | null): EinvoiceData => {
  const [data, setData] = useState<Omit<EinvoiceData, 'loading'>>({
    seller: null,
    settings: {},
    parties: {},
    itemCodes: {},
    overrides: {},
    zatca: null,
    eta: null,
    docs: {},
  });
  const [loaded, setLoaded] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!uid) return;
    const unsubs = NODES.map((n) =>
      watchValue(`users/${uid}/einvoice/${n}`, (v) => {
        setData((d) => ({ ...d, [n]: v ?? (n === 'seller' || n === 'zatca' || n === 'eta' ? null : {}) }));
        setLoaded((s) => new Set(s).add(n));
      }),
    );
    return () => unsubs.forEach((u) => u());
  }, [uid]);

  return { ...data, loading: loaded.size < NODES.length };
};

const clean = (o: unknown) => JSON.parse(JSON.stringify(o ?? null));

export const saveEinvoice = (uid: string, updates: Record<string, unknown>) =>
  update(
    ref(db),
    Object.fromEntries(Object.entries(updates).map(([k, v]) => [`users/${uid}/einvoice/${k}`, v === null ? null : clean(v)])),
  );

export const loadDocFile = async (uid: string, key: string): Promise<string | null> =>
  (await get(ref(db, `users/${uid}/einvoice/xml/${key}`))).val();

const call = async <T,>(name: string, data: unknown): Promise<T> => {
  try {
    const res = await httpsCallable(functions, name)(data);
    return res.data as T;
  } catch (e: any) {
    if (e?.code === 'functions/not-found' || (e?.code === 'functions/internal' && /not found|404/i.test(e?.message || '')))
      throw new Error('خدمة الفوترة الإلكترونية غير منشورة بعد على Firebase');
    throw new Error(e?.message || 'تعذّر الاتصال بخدمة الفوترة الإلكترونية');
  }
};

export const zatcaOnboard = (input: {
  env: ZatcaStatus['env'];
  otp: string;
  egs: { model: string; orgName: string; branchName: string; commonName: string; invoiceTypes: string; location: string; industry: string };
}) => call<ZatcaStatus>('einvoiceZatcaOnboard', input);

export const etaConnect = (input: { env: EtaStatus['env']; clientId: string; clientSecret?: string; pfx?: string; pfxPassword?: string; removeCertificate?: boolean }) =>
  call<EtaStatus>('einvoiceEtaConnect', input);

export const submitDoc = (key: string) => call<DocRecord>('einvoiceSubmit', { key });
export const refreshDoc = (key: string) => call<DocRecord>('einvoiceRefresh', { key });

/* ───────── عرض ───────── */

export const STATUS_META: Record<DocStatus | 'none', { label: string; tone: Tone }> = {
  none: { label: 'لم يُرسل', tone: 'neutral' },
  signed: { label: 'بانتظار الإرسال', tone: 'warning' },
  reported: { label: 'تم الإبلاغ', tone: 'success' },
  cleared: { label: 'معتمدة', tone: 'success' },
  warning: { label: 'مقبولة مع ملاحظات', tone: 'info' },
  rejected: { label: 'مرفوضة', tone: 'danger' },
  error: { label: 'بيانات ناقصة', tone: 'danger' },
  submitted: { label: 'قيد التحقق', tone: 'info' },
  valid: { label: 'صالحة', tone: 'success' },
  invalid: { label: 'غير صالحة', tone: 'danger' },
  cancelled: { label: 'ملغاة', tone: 'neutral' },
};

export const isDone = (s?: DocStatus) => !!s && ['reported', 'cleared', 'warning', 'valid', 'submitted'].includes(s);

/** أسباب النسبة الصفرية والإعفاء المعتمدة لدى ZATCA */
export const VATEX: { code: string; category: 'Z' | 'E'; reason: string; label: string }[] = [
  { code: 'VATEX-SA-32', category: 'Z', reason: 'Export of goods', label: 'تصدير سلع' },
  { code: 'VATEX-SA-33', category: 'Z', reason: 'Export of services', label: 'تصدير خدمات' },
  { code: 'VATEX-SA-34-1', category: 'Z', reason: 'The international transport of Goods', label: 'النقل الدولي للبضائع' },
  { code: 'VATEX-SA-34-2', category: 'Z', reason: 'International transport of passengers', label: 'النقل الدولي للركاب' },
  { code: 'VATEX-SA-35', category: 'Z', reason: 'Medicines and medical equipment', label: 'الأدوية والمعدات الطبية' },
  { code: 'VATEX-SA-36', category: 'Z', reason: 'Qualifying metals', label: 'المعادن المؤهلة' },
  { code: 'VATEX-SA-EDU', category: 'Z', reason: 'Private education to citizen', label: 'التعليم الأهلي للمواطنين' },
  { code: 'VATEX-SA-HEA', category: 'Z', reason: 'Private healthcare to citizen', label: 'الرعاية الصحية الخاصة للمواطنين' },
  { code: 'VATEX-SA-MLTRY', category: 'Z', reason: 'Supply of qualified military goods', label: 'السلع العسكرية المؤهلة' },
  { code: 'VATEX-SA-29', category: 'E', reason: 'Financial services mentioned in Article 29 of the VAT Regulations', label: 'خدمات مالية (معفاة)' },
  { code: 'VATEX-SA-29-7', category: 'E', reason: 'Life insurance services mentioned in Article 29 of the VAT Regulations', label: 'تأمين على الحياة (معفى)' },
  { code: 'VATEX-SA-30', category: 'E', reason: 'Real estate transactions mentioned in Article 30 of the VAT Regulations', label: 'عقارات سكنية (معفاة)' },
];

/** الأنواع الفرعية لضريبة القيمة المضافة بنسبة 0% في ETA */
export const ETA_ZERO_SUBTYPES = [
  { code: 'V001', label: 'تصدير' },
  { code: 'V002', label: 'تصدير لمناطق حرة وأخرى' },
  { code: 'V003', label: 'سلعة أو خدمة معفاة' },
  { code: 'V004', label: 'سلعة أو خدمة غير خاضعة للضريبة' },
  { code: 'V005', label: 'إعفاءات دبلوماسيين والقنصليات' },
  { code: 'V006', label: 'إعفاءات الدفاع والأمن القومي' },
  { code: 'V007', label: 'إعفاءات اتفاقيات' },
  { code: 'V008', label: 'إعفاءات خاصة وأخرى' },
];

export const sourceLabel: Record<SourceType, string> = { pos: 'نقطة بيع', trade: 'فاتورة بيع', note: 'إشعار' };
