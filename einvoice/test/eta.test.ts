import { execFileSync } from 'child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { describe, expect, it } from 'vitest';
import { signCades, signerFromPfx } from '../src/eta/cades';
import { buildEtaDocument, serialize, validateEta } from '../src/eta/document';
import { submitEta } from '../src/eta/service';
import { EDoc } from '../src/model';
import { MemoryStore } from '../src/store';

const issuer = { name: 'شركة منصتي', vatNumber: '100324932', activityCode: '4620', governate: 'Cairo', city: 'Nasr City', street: 'Abbas El Akkad', building: '12', country: 'EG' };

const doc: EDoc = {
  key: 'trade_1',
  kind: 'invoice',
  number: 'S-15',
  issuedAt: '2026-10-23T09:30:00.000Z',
  currency: 'EGP',
  rateToTaxCurrency: 1,
  lines: [
    { name: 'لاب توب', qty: 2, unitPrice: 1000, discountPct: 10, vatRate: 14, itemType: 'EGS', itemCode: 'EG-100324932-1', unitType: 'EA' },
    { name: 'خدمة', qty: 1, unitPrice: 200, discountPct: 0, vatRate: 14, itemType: 'EGS', itemCode: 'EG-100324932-2', unitType: 'EA' },
  ],
  allowances: [{ rate: 14, amount: 100 }],
  buyer: { name: 'عميل', vatNumber: '200000000', type: 'B', city: 'Giza', governate: 'Giza', street: 'Haram', building: '3', country: 'EG' },
  payment: 'credit',
};

describe('ETA document', () => {
  it('serializes with upper-case names and repeated array names', () => {
    expect(serialize({ issuer: { type: 'B', id: '1' }, lines: [{ a: 1 }, { a: 2.5 }], signatures: [{ x: 1 }] })).toBe(
      '"ISSUER""TYPE""B""ID""1""LINES""LINES""A""1""LINES""A""2.5"',
    );
  });

  it('computes line and document totals', () => {
    const d = buildEtaDocument(doc, issuer, { version: '1.0' });
    // البند 1: 2000 - 200 خصم بند - 90 نصيب خصم المستند (1800 من 2000 صافي) = 1710
    expect(d.invoiceLines[0]).toMatchObject({ salesTotal: 2000, netTotal: 1710, total: 1949.4 });
    expect(d.invoiceLines[1]).toMatchObject({ salesTotal: 200, netTotal: 190, total: 216.6 });
    expect(d).toMatchObject({ totalSalesAmount: 2200, totalDiscountAmount: 300, netAmount: 1900, totalAmount: 2166, documentType: 'I', dateTimeIssued: '2026-10-23T09:30:00Z' });
    expect(d.taxTotals[0].amount).toBe(266);
    expect(validateEta(doc, issuer, { version: '1.0' })).toEqual([]);
  });

  it('requires the original UUID for credit notes', () => {
    expect(validateEta({ ...doc, kind: 'credit' }, issuer, { version: '1.0' }).join()).toContain('UUID');
  });
});

describe('ETA CAdES signature', () => {
  it('produces a detached CMS that openssl verifies against the serialized document', () => {
    const dir = mkdtempSync(join(tmpdir(), 'eta-'));
    const p = (n: string) => join(dir, n);
    execFileSync('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-keyout', p('k.pem'), '-out', p('c.pem'), '-subj', '/C=EG/O=Test/CN=Signer', '-days', '10'], { stdio: 'pipe' });
    execFileSync('openssl', ['pkcs12', '-export', '-inkey', p('k.pem'), '-in', p('c.pem'), '-out', p('s.p12'), '-passout', 'pass:1234'], { stdio: 'pipe' });
    const signer = signerFromPfx(readFileSync(p('s.p12')).toString('base64'), '1234');
    const content = serialize(buildEtaDocument(doc, issuer, { version: '1.0' }));
    const sig = signCades(content, signer);
    writeFileSync(p('sig.der'), Buffer.from(sig, 'base64'));
    writeFileSync(p('content.txt'), content);
    const out = execFileSync('openssl', ['cms', '-verify', '-binary', '-inform', 'DER', '-in', p('sig.der'), '-content', p('content.txt'), '-noverify', '-out', '/dev/null'], { stdio: 'pipe' });
    void out;
    const dump = execFileSync('openssl', ['cms', '-cmsout', '-print', '-inform', 'DER', '-in', p('sig.der')]).toString();
    expect(dump).toContain('id-smime-aa-signingCertificateV2');
    expect(dump).toContain('pkcs7-digestData');
  });
});

describe('ETA submit', () => {
  it('sends a 0.9 document in preprod without a certificate and stores the UUID', async () => {
    const store = new MemoryStore();
    await store.update({
      'einvoiceVault/u1/eta': { env: 'preprod', clientId: 'id', clientSecret: 'sec' },
      'users/u1/einvoice/seller': issuer,
      'users/u1/einvoice/settings': { etaDefaultItem: { itemType: 'EGS', itemCode: 'EG-100324932-1', unitType: 'EA' } },
      'users/u1/erp/settings/mainCurrency': 'EGP',
      'users/u1/erp/invoices/i1': { kind: 'sale', number: 15, partyId: 'a1', date: '2026-10-23', currency: 'EGP', exchangeRate: 1, vatPct: 14, discountPct: 0, paid: 0, lines: [{ description: 'لاب توب', qty: 1, unitPrice: 1000, discountPct: 0 }], totals: { total: 1140 } },
      'users/u1/accounts/a1': { name: 'عميل' },
      'users/u1/einvoice/parties/a1': { vatNumber: '200000000', city: 'Giza', governate: 'Giza', street: 'Haram', building: '3' },
    });
    const calls: any[] = [];
    const fetcher = (async (url: string, init: any) => {
      calls.push({ url, init });
      if (url.endsWith('/connect/token')) return { status: 200, json: async () => ({ access_token: 'tok', expires_in: 3600 }) };
      return { status: 202, text: async () => JSON.stringify({ submissionId: 'sub1', acceptedDocuments: [{ uuid: 'UUID1', longId: 'LONG1', internalId: 'S-15' }], rejectedDocuments: [] }) };
    }) as any;
    const r = await submitEta(store, 'u1', 'trade_i1', fetcher);
    expect(r).toMatchObject({ status: 'submitted', uuid: 'UUID1', publicUrl: 'https://preprod.invoicing.eta.gov.eg/documents/UUID1/share/LONG1' });
    const sent = JSON.parse(calls[1].init.body).documents[0];
    expect(sent.documentTypeVersion).toBe('0.9');
    expect(sent.signatures).toBeUndefined();
    expect(sent.totalAmount).toBe(1140);
    expect(calls[1].init.headers.Authorization).toBe('Bearer tok');
  });
});
