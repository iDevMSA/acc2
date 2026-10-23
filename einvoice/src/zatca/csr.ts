// مفتاح secp256k1 وطلب شهادة (CSR) بالامتدادات التي تشترطها ZATCA لوحدة إصدار الفواتير (EGS).
import { createPrivateKey, createPublicKey, generateKeyPairSync, sign } from 'crypto';
import { bits, ctx, int, octets, oid, printable, seq, set, utf8 } from '../der';

export type ZatcaEnv = 'sandbox' | 'simulation' | 'production';

export const ZATCA_BASE: Record<ZatcaEnv, string> = {
  sandbox: 'https://gw-fatoora.zatca.gov.sa/e-invoicing/developer-portal',
  simulation: 'https://gw-fatoora.zatca.gov.sa/e-invoicing/simulation',
  production: 'https://gw-fatoora.zatca.gov.sa/e-invoicing/core',
};

const TEMPLATE: Record<ZatcaEnv, string> = {
  sandbox: 'TSTZATCA-Code-Signing',
  simulation: 'PREZATCA-Code-Signing',
  production: 'ZATCA-Code-Signing',
};

export interface EgsInfo {
  /** اسم الحل التقني ونموذجه ومعرّف الجهاز: 1-الحل|2-النموذج|3-المعرف */
  solutionName: string;
  model: string;
  serial: string;
  /** الرقم الضريبي للمنشأة (15 رقماً) */
  vatNumber: string;
  /** الاسم القانوني للمنشأة */
  orgName: string;
  /** اسم الفرع، أو الرقم الضريبي الموحد (10 أرقام) لمجموعة ضريبية */
  branchName: string;
  /** اسم ظاهر لوحدة الإصدار */
  commonName: string;
  /** أنواع الفواتير: 1100 قياسية ومبسطة، 1000 قياسية فقط، 0100 مبسطة فقط */
  invoiceTypes: '1100' | '1000' | '0100';
  /** عنوان الفرع */
  location: string;
  /** القطاع / النشاط */
  industry: string;
}

export const generateKey = () => {
  const { privateKey } = generateKeyPairSync('ec', { namedCurve: 'secp256k1' });
  return privateKey.export({ type: 'sec1', format: 'pem' }).toString();
};

const rdn = (type: string, value: Buffer) => set(seq(oid(type), value));

export const buildCsr = (privateKeyPem: string, egs: EgsInfo, env: ZatcaEnv): string => {
  const key = createPrivateKey(privateKeyPem);
  const spki = createPublicKey(key).export({ type: 'spki', format: 'der' });

  const subject = seq(
    rdn('2.5.4.6', printable('SA')),
    rdn('2.5.4.11', utf8(egs.branchName)),
    rdn('2.5.4.10', utf8(egs.orgName)),
    rdn('2.5.4.3', utf8(egs.commonName)),
  );

  const dirName = seq(
    rdn('2.5.4.4', utf8(`1-${egs.solutionName}|2-${egs.model}|3-${egs.serial}`)),
    rdn('0.9.2342.19200300.100.1.1', utf8(egs.vatNumber)),
    rdn('2.5.4.12', utf8(egs.invoiceTypes)),
    rdn('2.5.4.26', utf8(egs.location)),
    rdn('2.5.4.15', utf8(egs.industry)),
  );

  const extensions = seq(
    seq(oid('1.3.6.1.4.1.311.20.2'), octets(utf8(TEMPLATE[env]))),
    seq(oid('2.5.29.17'), octets(seq(ctx(4, dirName)))),
  );

  const info = seq(int(0), subject, spki, ctx(0, seq(oid('1.2.840.113549.1.9.14'), set(extensions))));
  const signature = sign('sha256', info, key);
  const csr = seq(info, seq(oid('1.2.840.10045.4.3.2')), bits(signature));

  const b64 = csr.toString('base64').match(/.{1,64}/g)!.join('\n');
  return `-----BEGIN CERTIFICATE REQUEST-----\n${b64}\n-----END CERTIFICATE REQUEST-----\n`;
};
