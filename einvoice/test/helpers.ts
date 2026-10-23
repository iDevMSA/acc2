import { execFileSync } from 'child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

/** شهادة ذاتية التوقيع لمفتاح معيّن (تحاكي شهادة ZATCA في الاختبارات) */
export const selfSignedCert = (privateKeyPem: string, subject = '/C=SA/O=Test/CN=TST-EGS'): string => {
  const dir = mkdtempSync(join(tmpdir(), 'einv-'));
  writeFileSync(join(dir, 'k.pem'), privateKeyPem);
  execFileSync('openssl', ['req', '-new', '-x509', '-key', join(dir, 'k.pem'), '-subj', subject, '-days', '30', '-out', join(dir, 'c.pem'), '-sha256']);
  return readFileSync(join(dir, 'c.pem'), 'utf8')
    .replace(/-----(BEGIN|END) CERTIFICATE-----/g, '')
    .replace(/\s/g, '');
};

export const openssl = (args: string[], input?: string) => execFileSync('openssl', args, { input }).toString();

export const seller = {
  name: 'شركة منصتي التجريبية',
  vatNumber: '399999999900003',
  crn: '1010010000',
  street: 'Prince Sultan',
  building: '2322',
  district: 'Al-Murabba',
  city: 'Riyadh',
  postalCode: '23333',
  country: 'SA',
};

/** يصدر شهادة لمفتاح CSR من جهة إصدار تجريبية (يحاكي ZATCA) */
export const issueFromCsr = (csrPem: string): string => {
  const dir = mkdtempSync(join(tmpdir(), 'einv-ca-'));
  const w = (n: string, v: string) => writeFileSync(join(dir, n), v);
  execFileSync('openssl', ['ecparam', '-name', 'secp256k1', '-genkey', '-noout', '-out', join(dir, 'ca.key')]);
  execFileSync('openssl', ['req', '-new', '-x509', '-key', join(dir, 'ca.key'), '-subj', '/CN=TSZEINVOICE-SubCA-1/DC=extgazt/DC=gov/DC=local', '-days', '30', '-out', join(dir, 'ca.pem')]);
  w('r.csr', csrPem);
  execFileSync('openssl', ['x509', '-req', '-in', join(dir, 'r.csr'), '-CA', join(dir, 'ca.pem'), '-CAkey', join(dir, 'ca.key'), '-CAcreateserial', '-days', '30', '-sha256', '-out', join(dir, 'c.pem')], { stdio: 'pipe' });
  return readFileSync(join(dir, 'c.pem'), 'utf8').replace(/-----(BEGIN|END) CERTIFICATE-----/g, '').replace(/\s/g, '');
};
