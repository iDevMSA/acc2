// توقيع CAdES-BES منفصل (detached) كما تشترطه ETA لنسخة المستند 1.0:
// المحتوى = التسلسل القانوني للمستند، نوع المحتوى digestedData، مع سمة signingCertificateV2.
import { createHash, createPrivateKey, KeyObject, sign } from 'crypto';
import forge from 'node-forge';
import { ctx, int, nul, octets, oid, parseCertificate, seq, set, setOf, utcTime } from '../der';

const OID = {
  data: '1.2.840.113549.1.7.5', // digestedData كما في أداة التوقيع الرسمية
  signedData: '1.2.840.113549.1.7.2',
  sha256: '2.16.840.1.101.3.4.2.1',
  rsa: '1.2.840.113549.1.1.1',
  contentType: '1.2.840.113549.1.9.3',
  messageDigest: '1.2.840.113549.1.9.4',
  signingTime: '1.2.840.113549.1.9.5',
  signingCertV2: '1.2.840.113549.1.9.16.2.47',
};

export interface Signer {
  certDer: Buffer;
  key: KeyObject;
}

/** يقرأ ملف PFX/P12 (شهادة التوقيع الإلكتروني ومفتاحها) */
export const signerFromPfx = (pfxBase64: string, password: string): Signer => {
  const asn = forge.asn1.fromDer(forge.util.decode64(pfxBase64));
  const p12 = forge.pkcs12.pkcs12FromAsn1(asn, password);
  const keyBag = (p12.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag })[forge.pki.oids.pkcs8ShroudedKeyBag] || [])[0] ||
    (p12.getBags({ bagType: forge.pki.oids.keyBag })[forge.pki.oids.keyBag] || [])[0];
  const certBags = p12.getBags({ bagType: forge.pki.oids.certBag })[forge.pki.oids.certBag] || [];
  if (!keyBag?.key || !certBags.length) throw new Error('ملف الشهادة لا يحتوي مفتاحاً وشهادة');
  const keyPem = forge.pki.privateKeyToPem(keyBag.key);
  // الشهادة الخاصة بالمفتاح (وليس شهادات الجهة المصدرة)
  const pub = forge.pki.setRsaPublicKey((keyBag.key as any).n, (keyBag.key as any).e);
  const mine = certBags.find((b) => b.cert && forge.pki.publicKeyToPem(b.cert.publicKey) === forge.pki.publicKeyToPem(pub)) || certBags[0];
  const certDer = Buffer.from(forge.asn1.toDer(forge.pki.certificateToAsn1(mine.cert!)).getBytes(), 'binary');
  return { certDer, key: createPrivateKey(keyPem) };
};

const alg = (o: string) => seq(oid(o), nul());

export const signCades = (content: string, signer: Signer, now = new Date()): string => {
  const cert = parseCertificate(signer.certDer);
  const digest = createHash('sha256').update(content, 'utf8').digest();
  const certHash = createHash('sha256').update(signer.certDer).digest();

  // ESSCertIDv2 (sha256 هي الخوارزمية الافتراضية فلا تُكتب) مع IssuerSerial
  const essCertId = seq(octets(certHash), seq(seq(ctx(4, cert.issuer)), cert.serial));
  const attrs = [
    seq(oid(OID.contentType), set(oid(OID.data))),
    seq(oid(OID.signingTime), set(utcTime(now))),
    seq(oid(OID.messageDigest), set(octets(digest))),
    seq(oid(OID.signingCertV2), set(seq(seq(essCertId)))),
  ];
  const signedAttrsSet = setOf(...attrs);
  const signature = sign('sha256', signedAttrsSet, signer.key);
  // داخل SignerInfo تُكتب السمات بوسم [0] ضمني بدل SET
  const signedAttrs = Buffer.concat([Buffer.from([0xa0]), signedAttrsSet.subarray(1)]);

  const signerInfo = seq(int(1), seq(cert.issuer, cert.serial), alg(OID.sha256), signedAttrs, alg(OID.rsa), octets(signature));
  const signedData = seq(int(3), set(alg(OID.sha256)), seq(oid(OID.data)), ctx(0, signer.certDer), set(signerInfo));
  return seq(oid(OID.signedData), ctx(0, signedData)).toString('base64');
};
