// واجهة ZATCA (Fatoora): الشهادات، فحص المطابقة، الإبلاغ عن المبسطة، واعتماد القياسية.
import { ZATCA_BASE, ZatcaEnv } from './csr';

export interface Csid {
  /** binarySecurityToken كما أعادته ZATCA (base64 لنص الشهادة) */
  token: string;
  secret: string;
  requestId: string;
}

export interface ValidationResults {
  status?: string;
  infoMessages?: Message[];
  warningMessages?: Message[];
  errorMessages?: Message[];
}

export interface Message {
  type?: string;
  code?: string;
  category?: string;
  message?: string;
  status?: string;
}

export interface SubmitResult {
  httpStatus: number;
  validationResults?: ValidationResults;
  reportingStatus?: string;
  clearanceStatus?: string;
  /** للقياسية: الفاتورة بعد ختم ZATCA (base64) */
  clearedInvoice?: string;
  /** نص الخطأ عند فشل لا يحمل نتائج تحقق */
  error?: string;
}

export type Fetch = typeof fetch;

export class ZatcaApi {
  constructor(
    private env: ZatcaEnv,
    private fetcher: Fetch = fetch,
  ) {}

  private async post(path: string, body: unknown, headers: Record<string, string>) {
    const res = await this.fetcher(`${ZATCA_BASE[this.env]}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'Accept-Version': 'V2', 'Accept-Language': 'en', ...headers },
      body: JSON.stringify(body),
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

  private static basic(c: Pick<Csid, 'token' | 'secret'>) {
    return `Basic ${Buffer.from(`${c.token}:${c.secret}`).toString('base64')}`;
  }

  private static toCsid(r: { status: number; json: any; text: string }, what: string): Csid {
    if (r.status !== 200 || !r.json?.binarySecurityToken) {
      const msg = r.json?.errors?.map?.((e: any) => e.message || e).join('، ') || r.json?.message || r.text || `HTTP ${r.status}`;
      throw new Error(`${what}: ${msg}`);
    }
    return { token: r.json.binarySecurityToken, secret: r.json.secret, requestId: String(r.json.requestID) };
  }

  /** شهادة الامتثال (CCSID) باستخدام رمز OTP من بوابة فاتورة */
  async complianceCsid(csrPem: string, otp: string): Promise<Csid> {
    const r = await this.post('/compliance', { csr: Buffer.from(csrPem).toString('base64') }, { OTP: otp });
    return ZatcaApi.toCsid(r, 'تعذّر إصدار شهادة الامتثال');
  }

  async productionCsid(compliance: Csid): Promise<Csid> {
    const r = await this.post('/production/csids', { compliance_request_id: compliance.requestId }, { Authorization: ZatcaApi.basic(compliance) });
    return ZatcaApi.toCsid(r, 'تعذّر إصدار شهادة الإنتاج');
  }

  private async submit(path: string, auth: Pick<Csid, 'token' | 'secret'>, xml: string, hash: string, uuid: string, extra: Record<string, string> = {}) {
    const r = await this.post(path, { invoiceHash: hash, uuid, invoice: Buffer.from(xml, 'utf8').toString('base64') }, { Authorization: ZatcaApi.basic(auth), ...extra });
    const j = r.json || {};
    const result: SubmitResult = {
      httpStatus: r.status,
      validationResults: j.validationResults,
      reportingStatus: j.reportingStatus,
      clearanceStatus: j.clearanceStatus,
      clearedInvoice: j.clearedInvoice,
    };
    if (!j.validationResults) result.error = j.message || j.errors?.map?.((e: any) => e.message || e).join('، ') || r.text || `HTTP ${r.status}`;
    return result;
  }

  complianceCheck(auth: Csid, xml: string, hash: string, uuid: string) {
    return this.submit('/compliance/invoices', auth, xml, hash, uuid);
  }

  report(auth: Csid, xml: string, hash: string, uuid: string) {
    return this.submit('/invoices/reporting/single', auth, xml, hash, uuid, { 'Clearance-Status': '0' });
  }

  clear(auth: Csid, xml: string, hash: string, uuid: string) {
    return this.submit('/invoices/clearance/single', auth, xml, hash, uuid, { 'Clearance-Status': '1' });
  }
}

/** نص الشهادة base64 من binarySecurityToken */
export const certFromToken = (token: string) => Buffer.from(token, 'base64').toString('utf8');
