import { DOMParser } from '@xmldom/xmldom';
import { createHash, createPrivateKey, createPublicKey, verify } from 'crypto';
import { describe, expect, it } from 'vitest';
import { XmlCanonicalizer } from 'xmldsigjs';
import { EDoc } from '../src/model';
import { MemoryStore } from '../src/store';
import { buildCsr, generateKey } from '../src/zatca/csr';
import { decodeQr, INITIAL_PIH, signInvoice } from '../src/zatca/invoice';
import { onboard, submitZatca } from '../src/zatca/service';
import { issueFromCsr, openssl, seller, selfSignedCert } from './helpers';

const doc = (over: Partial<EDoc> = {}): EDoc => ({
  key: 'trade_1',
  kind: 'invoice',
  number: 'S-1',
  issuedAt: '2026-10-23T09:30:00.000Z',
  currency: 'SAR',
  rateToTaxCurrency: 1,
  lines: [
    { name: 'قلم & دفتر <A4>', qty: 3, unitPrice: 12.5, discountPct: 0, vatRate: 15 },
    { name: 'خدمة', qty: 1, unitPrice: 100, discountPct: 10, vatRate: 15 },
  ],
  allowances: [{ rate: 15, amount: 5 }],
  payment: 'cash',
  ...over,
});

/** hash مستقل: DOM + حذف العناصر + C14N من مكتبة xmldsigjs */
const independentHash = (xml: string) => {
  const d = new DOMParser().parseFromString(xml, 'text/xml');
  const root = d.documentElement!;
  const kill: any[] = [];
  for (let n = root.firstChild; n; n = n.nextSibling) {
    const e = n as any;
    if (e.nodeName === 'ext:UBLExtensions' || e.nodeName === 'cac:Signature') kill.push(e);
    if (e.nodeName === 'cac:AdditionalDocumentReference' && e.getElementsByTagName('cbc:ID')[0]?.textContent === 'QR') kill.push(e);
  }
  kill.forEach((k) => root.removeChild(k));
  const c14n = new XmlCanonicalizer(false, false).Canonicalize(d as any);
  return createHash('sha256').update(c14n, 'utf8').digest('base64');
};

describe('ZATCA signing', () => {
  const key = generateKey();
  const cert = selfSignedCert(key);

  it('produces a hash that matches an independent C14N, a valid signature and phase-2 QR', () => {
    const s = signInvoice({ doc: doc(), profile: 'simplified', seller, uuid: '3cf5ee18-ee25-44ea-a444-2c37ba7f28be', icv: 7, pih: INITIAL_PIH }, key, cert);
    expect(independentHash(s.xml)).toBe(s.hash);

    const sigValue = /<ds:SignatureValue>([^<]+)</.exec(s.xml)![1];
    expect(verify('sha256', Buffer.from(s.hash, 'base64'), createPublicKey(createPrivateKey(key)), Buffer.from(sigValue, 'base64'))).toBe(true);

    const qr = decodeQr(s.qr!);
    expect(qr[1].toString()).toBe(seller.name);
    expect(qr[2].toString()).toBe(seller.vatNumber);
    expect(qr[3].toString()).toBe('2026-10-23T12:30:00');
    expect(qr[6].toString()).toBe(s.hash);
    expect(qr[7].toString()).toBe(sigValue);
    expect(qr[9]).toBeDefined();
    expect(s.xml).toContain(`<cbc:EmbeddedDocumentBinaryObject mimeCode="text/plain">${s.qr}</cbc:EmbeddedDocumentBinaryObject>`);
  });

  it('computes totals with ZATCA rounding (line discount + document allowance)', () => {
    const s = signInvoice({ doc: doc(), profile: 'standard', seller, uuid: 'u', icv: 1, pih: INITIAL_PIH }, key, cert);
    // 37.50 + 90.00 = 127.50، خصم 5 ← 122.50، ضريبة 18.38
    expect(s.totals).toMatchObject({ lineExtension: 127.5, allowance: 5, taxExclusive: 122.5, tax: 18.38, taxInclusive: 140.88 });
    expect(s.xml).toContain('<cbc:PayableAmount currencyID="SAR">140.88</cbc:PayableAmount>');
    expect(s.xml).toContain('<cbc:InvoiceTypeCode name="0100000">388</cbc:InvoiceTypeCode>');
    expect(s.xml).toContain('<cbc:Name>قلم &amp; دفتر &lt;A4&gt;</cbc:Name>');
    expect(s.qr).toBeUndefined();
    // الفاتورة قابلة للتحليل
    expect(new DOMParser().parseFromString(s.xml, 'text/xml').documentElement!.nodeName).toBe('Invoice');
  });

  it('builds credit notes with billing reference and reason', () => {
    const s = signInvoice({ doc: doc({ kind: 'credit', billingRef: 'S-9', reason: 'مرتجع' }), profile: 'simplified', seller, uuid: 'u', icv: 2, pih: INITIAL_PIH }, key, cert);
    expect(s.xml).toContain('<cbc:InvoiceTypeCode name="0200000">381</cbc:InvoiceTypeCode>');
    expect(s.xml).toContain('<cac:BillingReference><cac:InvoiceDocumentReference><cbc:ID>S-9</cbc:ID>');
    expect(s.xml).toContain('<cbc:InstructionNote>مرتجع</cbc:InstructionNote>');
  });

  it('builds a CSR that openssl accepts, with ZATCA extensions', () => {
    const csr = buildCsr(
      key,
      { solutionName: 'Monsati', model: 'Web', serial: 'abc-123', vatNumber: seller.vatNumber, orgName: 'Org', branchName: 'Main Branch', commonName: 'TST-1', invoiceTypes: '1100', location: 'Riyadh', industry: 'Retail' },
      'sandbox',
    );
    const out = openssl(['req', '-verify', '-noout', '-text'], csr);
    expect(out).toContain('TSTZATCA-Code-Signing');
    expect(out).toMatch(/1-Monsati\|2-Web\|3-abc-123/);
    expect(out).toContain('secp256k1');
  });
});

/* ───────── خدمة التسجيل والإرسال مع ZATCA وهمية ───────── */

const fakeZatca = (opts: { rejectReport?: boolean; failNetwork?: boolean } = {}) => {
  const calls: { path: string; body: any; headers: any }[] = [];
  let cert = '';
  const fetcher = (async (url: string, init: any) => {
    const path = new URL(url).pathname.replace(/^\/e-invoicing\/[^/]+/, '');
    const body = JSON.parse(init.body);
    calls.push({ path, body, headers: init.headers });
    const json = (status: number, j: unknown) => ({ status, text: async () => JSON.stringify(j) });
    if (path === '/compliance' || path === '/production/csids') {
      if (path === '/compliance') cert = issueFromCsr(Buffer.from(body.csr, 'base64').toString());
      return json(200, { binarySecurityToken: Buffer.from(cert).toString('base64'), secret: 's3cret', requestID: 1234 });
    }
    if (opts.failNetwork) throw new Error('ECONNRESET');
    if (path === '/compliance/invoices') return json(200, { validationResults: { status: 'PASS', warningMessages: [], errorMessages: [] } });
    if (opts.rejectReport) return json(400, { validationResults: { status: 'ERROR', errorMessages: [{ code: 'BR-KSA-01', message: 'bad' }] } });
    return json(200, { validationResults: { status: 'PASS', warningMessages: [], errorMessages: [] }, reportingStatus: 'REPORTED' });
  }) as any;
  return { fetcher, calls };
};

describe('ZATCA service', () => {
  const setup = async () => {
    const store = new MemoryStore();
    await store.update({
      'users/u1/einvoice/seller': seller,
      'users/u1/erp/settings/mainCurrency': 'SAR',
      'sales/u1/invoices/p1': { number: 'POS-1', status: 'closed', createdAt: '2026-10-23T08:00:00Z', paymentMethod: 'card', discount: 2.3, items: [{ productName: 'ماء', quantity: 2, unitPrice: 10, vatRate: 15 }] },
    });
    return store;
  };


  it('onboards: CSR → compliance CSID → 6 checks → production CSID', async () => {
    const store = await setup();
    const { fetcher, calls } = fakeZatca();
    const st = await onboard(store, 'u1', { env: 'sandbox', otp: '123345', egs: { model: 'Web', vatNumber: '', orgName: '', branchName: 'Main', commonName: 'TST-1', invoiceTypes: '1100', location: 'Riyadh', industry: 'Retail' } }, fetcher);
    expect(st.status).toBe('ready');
    expect(calls.map((c) => c.path)).toEqual(['/compliance', ...Array(6).fill('/compliance/invoices'), '/production/csids']);
    expect(calls[0].headers.OTP).toBe('123345');
    // سلسلة PIH متصلة في مستندات الفحص
    const xmls = calls.slice(1, 7).map((c) => Buffer.from(c.body.invoice, 'base64').toString());
    for (let i = 1; i < xmls.length; i++) expect(xmls[i]).toContain(calls[i].body.invoiceHash);
    const vault = await store.get('einvoiceVault/u1/zatca');
    expect(vault.production.secret).toBe('s3cret');
    expect((await store.get('users/u1/einvoice/zatca')).status).toBe('ready');
    // لا أسرار في العقدة التي يقرؤها الويب
    expect(JSON.stringify(await store.get('users/u1/einvoice'))).not.toContain('PRIVATE KEY');
  });

  it('reports a POS invoice, advances ICV/PIH, and does not resend a reported one', async () => {
    const store = await setup();
    const { fetcher, calls } = fakeZatca();
    await onboard(store, 'u1', { env: 'sandbox', otp: '123345', egs: { model: 'Web', vatNumber: '', orgName: '', branchName: 'Main', commonName: 'TST-1', invoiceTypes: '1100', location: 'Riyadh', industry: 'Retail' } }, fetcher);
    const r = await submitZatca(store, 'u1', 'pos_p1', fetcher);
    expect(r.status).toBe('reported');
    expect(r.profile).toBe('simplified');
    expect(r.icv).toBe(1);
    expect(calls[calls.length - 1].path).toBe('/invoices/reporting/single');
    const xml = Buffer.from(calls[calls.length - 1].body.invoice, 'base64').toString();
    expect(xml).toContain(INITIAL_PIH);
    // 2×10 = 20، خصم 2.30 شامل ← 2.00 قبل الضريبة
    expect(xml).toContain('<cbc:TaxExclusiveAmount currencyID="SAR">18.00</cbc:TaxExclusiveAmount>');
    expect((await store.get('einvoiceVault/u1/zatca')).pih).toBe(r.hash);
    const n = calls.length;
    await submitZatca(store, 'u1', 'pos_p1', fetcher);
    expect(calls.length).toBe(n);
  });

  it('keeps the same signed XML after a network failure and resends it', async () => {
    const store = await setup();
    const ok = fakeZatca();
    await onboard(store, 'u1', { env: 'sandbox', otp: '123345', egs: { model: 'Web', vatNumber: '', orgName: '', branchName: 'Main', commonName: 'TST-1', invoiceTypes: '0100', location: 'Riyadh', industry: 'Retail' } }, ok.fetcher);
    const down = fakeZatca({ failNetwork: true });
    const first = await submitZatca(store, 'u1', 'pos_p1', down.fetcher);
    expect(first.status).toBe('signed');
    const second = await submitZatca(store, 'u1', 'pos_p1', ok.fetcher);
    expect(second.status).toBe('reported');
    expect(second.icv).toBe(first.icv);
    expect(ok.calls[ok.calls.length - 1].body.invoiceHash).toBe(first.hash);
    expect((await store.get('einvoiceVault/u1/zatca')).icv).toBe(1);
  });

  it('stores rejection messages and re-signs with a new counter on retry', async () => {
    const store = await setup();
    const ok = fakeZatca();
    await onboard(store, 'u1', { env: 'sandbox', otp: '123345', egs: { model: 'Web', vatNumber: '', orgName: '', branchName: 'Main', commonName: 'TST-1', invoiceTypes: '0100', location: 'Riyadh', industry: 'Retail' } }, ok.fetcher);
    const bad = fakeZatca({ rejectReport: true });
    const r = await submitZatca(store, 'u1', 'pos_p1', bad.fetcher);
    expect(r.status).toBe('rejected');
    expect(r.messages?.[0]).toMatchObject({ level: 'error', code: 'BR-KSA-01' });
    const again = await submitZatca(store, 'u1', 'pos_p1', ok.fetcher);
    expect(again.status).toBe('reported');
    expect(again.icv).toBe(2);
  });

  it('refuses a standard invoice without buyer data', async () => {
    const store = await setup();
    const ok = fakeZatca();
    await onboard(store, 'u1', { env: 'sandbox', otp: '123345', egs: { model: 'Web', vatNumber: '', orgName: '', branchName: 'Main', commonName: 'TST-1', invoiceTypes: '1000', location: 'Riyadh', industry: 'Retail' } }, ok.fetcher);
    const r = await submitZatca(store, 'u1', 'pos_p1', ok.fetcher);
    expect(r.status).toBe('error');
    expect(r.messages?.[0].text).toContain('بيانات المشتري');
    expect((await store.get('einvoiceVault/u1/zatca')).icv).toBe(0);
  });
});
