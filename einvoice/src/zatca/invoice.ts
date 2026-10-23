// فاتورة UBL 2.1 بمواصفات ZATCA (المرحلة الثانية) وتوقيعها: hash الفاتورة، التوقيع ECDSA،
// خصائص XAdES، ورمز QR بالحقول 1-9.
import { createHash, createPrivateKey, createPublicKey, sign, X509Certificate } from 'crypto';
import { parseCertificate } from '../der';
import { computeTotals, EDoc, lineNet, Party, round2 } from '../model';
import { el, El, serialize } from '../xml';

const NS = {
  inv: 'urn:oasis:names:specification:ubl:schema:xsd:Invoice-2',
  cac: 'urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2',
  cbc: 'urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2',
  ext: 'urn:oasis:names:specification:ubl:schema:xsd:CommonExtensionComponents-2',
  sig: 'urn:oasis:names:specification:ubl:schema:xsd:CommonSignatureComponents-2',
  sac: 'urn:oasis:names:specification:ubl:schema:xsd:SignatureAggregateComponents-2',
  sbc: 'urn:oasis:names:specification:ubl:schema:xsd:SignatureBasicComponents-2',
  ds: 'http://www.w3.org/2000/09/xmldsig#',
  xades: 'http://uri.etsi.org/01903/v1.3.2#',
};
const SHA256 = 'http://www.w3.org/2001/04/xmlenc#sha256';

/** PIH لأول فاتورة: base64(sha256("0")) */
export const INITIAL_PIH = 'NWZlY2ViNjZmZmM4NmYzOGQ5NTI3ODZjNmQ2OTZjNzljMmRiYzIzOWRkNGU5MWI0NjcyOWQ3M2EyN2ZiNTdlOQ==';

export interface Exemption {
  /** Z نسبة صفرية، E معفى */
  category: 'Z' | 'E';
  /** رمز السبب، مثل VATEX-SA-32 */
  code: string;
  reason: string;
}

export interface BuildInput {
  doc: EDoc;
  /** standard = فاتورة ضريبية (B2B، اعتماد مسبق)، simplified = مبسطة (B2C، إبلاغ خلال 24 ساعة) */
  profile: 'standard' | 'simplified';
  seller: Party;
  uuid: string;
  icv: number;
  pih: string;
  exemption?: Exemption;
  /** للعينات فقط: تاريخ ووقت ثابتان */
  timeZone?: string;
}

const money = (n: number) => round2(n).toFixed(2);
const qtyStr = (n: number) => String(Math.round(n * 1e6) / 1e6);
const price = (n: number) => {
  const s = String(Math.round(n * 1e6) / 1e6);
  return s.includes('.') && s.split('.')[1].length >= 2 ? s : Number(s).toFixed(2);
};
const pct = (n: number) => n.toFixed(2);

const TYPE_CODE: Record<EDoc['kind'], string> = { invoice: '388', credit: '381', debit: '383' };
const PAYMENT_CODE: Record<EDoc['payment'], string> = { cash: '10', credit: '30', transfer: '42', card: '48' };

/** تاريخ ووقت الإصدار بتوقيت المنشأة */
export const issueDateTime = (iso: string, timeZone = 'Asia/Riyadh') => {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' })
      .formatToParts(new Date(iso))
      .map((p) => [p.type, p.value]),
  );
  return { date: `${parts.year}-${parts.month}-${parts.day}`, time: `${parts.hour}:${parts.minute}:${parts.second}` };
};

const taxCategory = (tag: 'cac:TaxCategory' | 'cac:ClassifiedTaxCategory', rate: number, ex: Exemption | undefined, withReason: boolean) => {
  const cat = rate > 0 ? 'S' : ex?.category || 'Z';
  const scheme = tag === 'cac:TaxCategory';
  return el(
    tag,
    null,
    el('cbc:ID', scheme ? { schemeAgencyID: '6', schemeID: 'UN/ECE 5305' } : null, cat),
    el('cbc:Percent', null, pct(rate)),
    withReason && rate === 0 && ex ? el('cbc:TaxExemptionReasonCode', null, ex.code) : null,
    withReason && rate === 0 && ex ? el('cbc:TaxExemptionReason', null, ex.reason) : null,
    el('cac:TaxScheme', null, el('cbc:ID', scheme ? { schemeAgencyID: '6', schemeID: 'UN/ECE 5153' } : null, 'VAT')),
  );
};

const address = (p: Party) =>
  el(
    'cac:PostalAddress',
    null,
    p.street ? el('cbc:StreetName', null, p.street) : null,
    p.building ? el('cbc:BuildingNumber', null, p.building) : null,
    p.district ? el('cbc:CitySubdivisionName', null, p.district) : null,
    p.city ? el('cbc:CityName', null, p.city) : null,
    p.postalCode ? el('cbc:PostalZone', null, p.postalCode) : null,
    el('cac:Country', null, el('cbc:IdentificationCode', null, p.country || 'SA')),
  );

const party = (p: Party, isSeller: boolean) => {
  const otherId = p.crn ? { scheme: 'CRN', value: p.crn } : !isSeller && p.nationalId ? { scheme: 'NAT', value: p.nationalId } : null;
  return el(
    'cac:Party',
    null,
    otherId ? el('cac:PartyIdentification', null, el('cbc:ID', { schemeID: otherId.scheme }, otherId.value)) : null,
    address(p),
    el('cac:PartyTaxScheme', null, p.vatNumber ? el('cbc:CompanyID', null, p.vatNumber) : null, el('cac:TaxScheme', null, el('cbc:ID', null, 'VAT'))),
    el('cac:PartyLegalEntity', null, el('cbc:RegistrationName', null, p.name)),
  );
};

const docRef = (id: string, content: El) => el('cac:AdditionalDocumentReference', null, el('cbc:ID', null, id), content);
const attachment = (value: string) => el('cac:Attachment', null, el('cbc:EmbeddedDocumentBinaryObject', { mimeCode: 'text/plain' }, value));

export const buildInvoice = (input: BuildInput) => {
  const { doc, profile, seller, exemption } = input;
  const cur = doc.currency;
  const totals = computeTotals(doc);
  const { date, time } = issueDateTime(doc.issuedAt, input.timeZone);
  const m = (name: string, n: number, currency = cur) => el(name, { currencyID: currency }, money(n));

  const lines = doc.lines.map((l, i) => {
    const net = lineNet(l);
    const tax = round2((net * l.vatRate) / 100);
    const discountUnit = l.discountPct ? (l.unitPrice * l.discountPct) / 100 : 0;
    return el(
      'cac:InvoiceLine',
      null,
      el('cbc:ID', null, i + 1),
      el('cbc:InvoicedQuantity', { unitCode: 'PCE' }, qtyStr(l.qty)),
      m('cbc:LineExtensionAmount', net),
      el('cac:TaxTotal', null, m('cbc:TaxAmount', tax), m('cbc:RoundingAmount', net + tax)),
      el('cac:Item', null, el('cbc:Name', null, l.name || '-'), taxCategory('cac:ClassifiedTaxCategory', l.vatRate, exemption, false)),
      el(
        'cac:Price',
        null,
        el('cbc:PriceAmount', { currencyID: cur }, price(l.unitPrice - discountUnit)),
        discountUnit
          ? el(
              'cac:AllowanceCharge',
              null,
              el('cbc:ChargeIndicator', null, 'false'),
              el('cbc:AllowanceChargeReason', null, 'discount'),
              el('cbc:Amount', { currencyID: cur }, price(discountUnit)),
              el('cbc:BaseAmount', { currencyID: cur }, price(l.unitPrice)),
            )
          : null,
      ),
    );
  });

  const typeName = profile === 'standard' ? '0100000' : '0200000';
  const root = el(
    'Invoice',
    { xmlns: NS.inv, 'xmlns:cac': NS.cac, 'xmlns:cbc': NS.cbc, 'xmlns:ext': NS.ext },
    el('ext:UBLExtensions', null),
    el('cbc:ProfileID', null, 'reporting:1.0'),
    el('cbc:ID', null, doc.number),
    el('cbc:UUID', null, input.uuid),
    el('cbc:IssueDate', null, date),
    el('cbc:IssueTime', null, time),
    el('cbc:InvoiceTypeCode', { name: typeName }, TYPE_CODE[doc.kind]),
    el('cbc:DocumentCurrencyCode', null, cur),
    el('cbc:TaxCurrencyCode', null, 'SAR'),
    doc.kind !== 'invoice'
      ? el('cac:BillingReference', null, el('cac:InvoiceDocumentReference', null, el('cbc:ID', null, doc.billingRef || '-')))
      : null,
    docRef('ICV', el('cbc:UUID', null, input.icv)),
    docRef('PIH', attachment(input.pih)),
    profile === 'simplified' ? docRef('QR', attachment('')) : null,
    el(
      'cac:Signature',
      null,
      el('cbc:ID', null, 'urn:oasis:names:specification:ubl:signature:Invoice'),
      el('cbc:SignatureMethod', null, 'urn:oasis:names:specification:ubl:dsig:enveloped:xades'),
    ),
    el('cac:AccountingSupplierParty', null, party(seller, true)),
    el('cac:AccountingCustomerParty', null, doc.buyer && (profile === 'standard' || doc.buyer.name) ? party(doc.buyer, false) : null),
    el('cac:Delivery', null, el('cbc:ActualDeliveryDate', null, date)),
    el(
      'cac:PaymentMeans',
      null,
      el('cbc:PaymentMeansCode', null, PAYMENT_CODE[doc.payment]),
      doc.kind !== 'invoice' ? el('cbc:InstructionNote', null, doc.reason || 'تعديل الفاتورة') : null,
    ),
    ...doc.allowances.map((a) =>
      el(
        'cac:AllowanceCharge',
        null,
        el('cbc:ChargeIndicator', null, 'false'),
        el('cbc:AllowanceChargeReason', null, 'discount'),
        m('cbc:Amount', a.amount),
        taxCategory('cac:TaxCategory', a.rate, exemption, false),
      ),
    ),
    el('cac:TaxTotal', null, m('cbc:TaxAmount', totals.tax * doc.rateToTaxCurrency, 'SAR')),
    el(
      'cac:TaxTotal',
      null,
      m('cbc:TaxAmount', totals.tax),
      ...totals.byRate.map((r) =>
        el('cac:TaxSubtotal', null, m('cbc:TaxableAmount', r.taxable), m('cbc:TaxAmount', r.tax), taxCategory('cac:TaxCategory', r.rate, exemption, true)),
      ),
    ),
    el(
      'cac:LegalMonetaryTotal',
      null,
      m('cbc:LineExtensionAmount', totals.lineExtension),
      m('cbc:TaxExclusiveAmount', totals.taxExclusive),
      m('cbc:TaxInclusiveAmount', totals.taxInclusive),
      m('cbc:AllowanceTotalAmount', totals.allowance),
      m('cbc:PrepaidAmount', 0),
      m('cbc:PayableAmount', totals.taxInclusive),
    ),
    ...lines,
  );
  return { root, totals, date, time };
};

/* ───────── التوقيع ───────── */

const isHashExcluded = (e: El) =>
  e.name === 'ext:UBLExtensions' ||
  e.name === 'cac:Signature' ||
  (e.name === 'cac:AdditionalDocumentReference' && e.children.some((c) => typeof c !== 'string' && c.name === 'cbc:ID' && c.children[0] === 'QR'));

/** hash الفاتورة: SHA-256 لنسخة C14N بعد حذف التوقيع ورمز QR، بصيغة base64 */
export const invoiceHash = (root: El) => createHash('sha256').update(serialize(root, isHashExcluded), 'utf8').digest('base64');

const hexB64 = (s: string) => Buffer.from(createHash('sha256').update(s, 'utf8').digest('hex'), 'utf8').toString('base64');

export interface CertInfo {
  /** نص الشهادة base64 (DER) كما يأتي من ZATCA بعد فك binarySecurityToken */
  base64: string;
  digest: string;
  issuer: string;
  serial: string;
  /** المفتاح العام SPKI DER (حقل QR 8) */
  publicKey: Buffer;
  /** توقيع الشهادة الخام (حقل QR 9) */
  signature: Buffer;
}

export const certInfo = (certBase64: string): CertInfo => {
  const der = Buffer.from(certBase64, 'base64');
  const x509 = new X509Certificate(der);
  return {
    base64: certBase64,
    digest: hexB64(certBase64),
    issuer: x509.issuer.split('\n').reverse().join(', '),
    serial: BigInt(`0x${x509.serialNumber}`).toString(10),
    publicKey: x509.publicKey.export({ type: 'spki', format: 'der' }),
    signature: parseCertificate(der).signature,
  };
};

/** الشكل الذي تحسب منه ZATCA بصمة SignedProperties (تصريح ds على كل عنصر) */
const signedPropsDigestForm = (c: CertInfo, signingTime: string) =>
  `<xades:SignedProperties xmlns:xades="${NS.xades}" Id="xadesSignedProperties"><xades:SignedSignatureProperties><xades:SigningTime>${signingTime}</xades:SigningTime><xades:SigningCertificate><xades:Cert><xades:CertDigest><ds:DigestMethod xmlns:ds="${NS.ds}" Algorithm="${SHA256}"/><ds:DigestValue xmlns:ds="${NS.ds}">${c.digest}</ds:DigestValue></xades:CertDigest><xades:IssuerSerial><ds:X509IssuerName xmlns:ds="${NS.ds}">${c.issuer}</ds:X509IssuerName><ds:X509SerialNumber xmlns:ds="${NS.ds}">${c.serial}</ds:X509SerialNumber></xades:IssuerSerial></xades:Cert></xades:SigningCertificate></xades:SignedSignatureProperties></xades:SignedProperties>`;

const tlv = (tag: number, value: Buffer) => {
  const len = value.length < 128 ? Buffer.from([value.length]) : value.length < 256 ? Buffer.from([0x81, value.length]) : Buffer.from([0x82, value.length >> 8, value.length & 0xff]);
  return Buffer.concat([Buffer.from([tag]), len, value]);
};

export const qrPhase2 = (f: {
  seller: string;
  vat: string;
  timestamp: string;
  total: string;
  tax: string;
  hash: string;
  signature: string;
  publicKey: Buffer;
  certSignature?: Buffer;
}) =>
  Buffer.concat([
    tlv(1, Buffer.from(f.seller, 'utf8')),
    tlv(2, Buffer.from(f.vat, 'utf8')),
    tlv(3, Buffer.from(f.timestamp, 'utf8')),
    tlv(4, Buffer.from(f.total, 'utf8')),
    tlv(5, Buffer.from(f.tax, 'utf8')),
    tlv(6, Buffer.from(f.hash, 'utf8')),
    tlv(7, Buffer.from(f.signature, 'utf8')),
    tlv(8, f.publicKey),
    ...(f.certSignature ? [tlv(9, f.certSignature)] : []),
  ]).toString('base64');

/** يقرأ حقول QR (للاختبارات ولعرضها في الويب) */
export const decodeQr = (b64: string) => {
  const buf = Buffer.from(b64, 'base64');
  const out: Record<number, Buffer> = {};
  for (let p = 0; p < buf.length; ) {
    const tag = buf[p++];
    let len = buf[p++];
    if (len === 0x81) len = buf[p++];
    else if (len === 0x82) {
      len = buf[p] * 256 + buf[p + 1];
      p += 2;
    }
    out[tag] = buf.subarray(p, p + len);
    p += len;
  }
  return out;
};

export interface SignedInvoice {
  xml: string;
  hash: string;
  qr?: string;
  totals: ReturnType<typeof computeTotals>;
}

export const signInvoice = (input: BuildInput, privateKeyPem: string, certBase64: string, now = new Date()): SignedInvoice => {
  const { root, totals, date, time } = buildInvoice(input);
  const hash = invoiceHash(root);
  const key = createPrivateKey(privateKeyPem);
  const signature = sign('sha256', Buffer.from(hash, 'base64'), key).toString('base64');
  const cert = certInfo(certBase64);

  if (createPublicKey(key).export({ type: 'spki', format: 'der' }).compare(cert.publicKey) !== 0) {
    throw new Error('المفتاح الخاص لا يطابق شهادة ZATCA');
  }

  const signingTime = now.toISOString().replace(/\.\d{3}Z$/, '');
  const ublExt = el(
    'ext:UBLExtension',
    null,
    el('ext:ExtensionURI', null, 'urn:oasis:names:specification:ubl:dsig:enveloped:xades'),
    el(
      'ext:ExtensionContent',
      null,
      el(
        'sig:UBLDocumentSignatures',
        { 'xmlns:sig': NS.sig, 'xmlns:sac': NS.sac, 'xmlns:sbc': NS.sbc },
        el(
          'sac:SignatureInformation',
          null,
          el('cbc:ID', null, 'urn:oasis:names:specification:ubl:signature:1'),
          el('sbc:ReferencedSignatureID', null, 'urn:oasis:names:specification:ubl:signature:Invoice'),
          el(
            'ds:Signature',
            { 'xmlns:ds': NS.ds, Id: 'signature' },
            el(
              'ds:SignedInfo',
              null,
              el('ds:CanonicalizationMethod', { Algorithm: 'http://www.w3.org/2006/12/xml-c14n11' }),
              el('ds:SignatureMethod', { Algorithm: 'http://www.w3.org/2001/04/xmldsig-more#ecdsa-sha256' }),
              el(
                'ds:Reference',
                { Id: 'invoiceSignedData', URI: '' },
                el(
                  'ds:Transforms',
                  null,
                  ...[
                    'not(//ancestor-or-self::ext:UBLExtensions)',
                    'not(//ancestor-or-self::cac:Signature)',
                    "not(//ancestor-or-self::cac:AdditionalDocumentReference[cbc:ID='QR'])",
                  ].map((xp) => el('ds:Transform', { Algorithm: 'http://www.w3.org/TR/1999/REC-xpath-19991116' }, el('ds:XPath', null, xp))),
                  el('ds:Transform', { Algorithm: 'http://www.w3.org/2006/12/xml-c14n11' }),
                ),
                el('ds:DigestMethod', { Algorithm: SHA256 }),
                el('ds:DigestValue', null, hash),
              ),
              el(
                'ds:Reference',
                { Type: 'http://www.w3.org/2000/09/xmldsig#SignatureProperties', URI: '#xadesSignedProperties' },
                el('ds:DigestMethod', { Algorithm: SHA256 }),
                el('ds:DigestValue', null, hexB64(signedPropsDigestForm(cert, signingTime))),
              ),
            ),
            el('ds:SignatureValue', null, signature),
            el('ds:KeyInfo', null, el('ds:X509Data', null, el('ds:X509Certificate', null, cert.base64))),
            el(
              'ds:Object',
              null,
              el(
                'xades:QualifyingProperties',
                { 'xmlns:xades': NS.xades, Target: 'signature' },
                el(
                  'xades:SignedProperties',
                  { Id: 'xadesSignedProperties' },
                  el(
                    'xades:SignedSignatureProperties',
                    null,
                    el('xades:SigningTime', null, signingTime),
                    el(
                      'xades:SigningCertificate',
                      null,
                      el(
                        'xades:Cert',
                        null,
                        el('xades:CertDigest', null, el('ds:DigestMethod', { Algorithm: SHA256 }), el('ds:DigestValue', null, cert.digest)),
                        el('xades:IssuerSerial', null, el('ds:X509IssuerName', null, cert.issuer), el('ds:X509SerialNumber', null, cert.serial)),
                      ),
                    ),
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    ),
  );
  (root.children[0] as El).children.push(ublExt);

  let qr: string | undefined;
  if (input.profile === 'simplified') {
    qr = qrPhase2({
      seller: input.seller.name,
      vat: input.seller.vatNumber || '',
      timestamp: `${date}T${time}`,
      total: money(totals.taxInclusive),
      tax: money(totals.tax),
      hash,
      signature,
      publicKey: cert.publicKey,
      certSignature: cert.signature,
    });
    const qrRef = root.children.find(
      (c): c is El => typeof c !== 'string' && c.name === 'cac:AdditionalDocumentReference' && (c.children[0] as El).children[0] === 'QR',
    )!;
    ((qrRef.children[1] as El).children[0] as El).children = [qr];
  }

  return { xml: `<?xml version="1.0" encoding="UTF-8"?>\n${serialize(root)}`, hash, qr, totals };
};
