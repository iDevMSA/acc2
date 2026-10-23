// ترميز وقراءة ASN.1 DER بالحد الأدنى الذي نحتاجه: طلب الشهادة (CSR) لـ ZATCA وتوقيع CAdES لـ ETA.
// Node يوفّر المفاتيح والتوقيع (بما فيها secp256k1)، لكنه لا يبني CSR بامتدادات مخصّصة ولا رسائل CMS.

export const len = (n: number): Buffer => {
  if (n < 0x80) return Buffer.from([n]);
  const bytes: number[] = [];
  for (let v = n; v > 0; v = Math.floor(v / 256)) bytes.unshift(v & 0xff);
  return Buffer.from([0x80 | bytes.length, ...bytes]);
};

export const tlv = (tag: number, value: Buffer): Buffer => Buffer.concat([Buffer.from([tag]), len(value.length), value]);

export const seq = (...items: Buffer[]) => tlv(0x30, Buffer.concat(items));
export const set = (...items: Buffer[]) => tlv(0x31, Buffer.concat(items));
/** SET OF مرتّب كما يشترط DER (للسمات الموقّعة في CMS) */
export const setOf = (...items: Buffer[]) => tlv(0x31, Buffer.concat([...items].sort(Buffer.compare)));
export const octets = (v: Buffer) => tlv(0x04, v);
export const bits = (v: Buffer) => tlv(0x03, Buffer.concat([Buffer.from([0]), v]));
export const utf8 = (s: string) => tlv(0x0c, Buffer.from(s, 'utf8'));
export const printable = (s: string) => tlv(0x13, Buffer.from(s, 'ascii'));
export const nul = () => Buffer.from([0x05, 0x00]);
/** [n] صريح (EXPLICIT) أو بنية ضمنية مركّبة — كلاهما 0xA0|n */
export const ctx = (n: number, value: Buffer) => tlv(0xa0 | n, value);

export const int = (v: number | bigint | Buffer): Buffer => {
  let bytes: Buffer;
  if (Buffer.isBuffer(v)) bytes = v;
  else {
    let hex = BigInt(v).toString(16);
    if (hex.length % 2) hex = `0${hex}`;
    bytes = Buffer.from(hex, 'hex');
  }
  let i = 0;
  while (i < bytes.length - 1 && bytes[i] === 0 && (bytes[i + 1] & 0x80) === 0) i++;
  bytes = bytes.subarray(i);
  if (bytes[0] & 0x80) bytes = Buffer.concat([Buffer.from([0]), bytes]);
  return tlv(0x02, bytes);
};

export const oid = (dotted: string): Buffer => {
  const parts = dotted.split('.').map((p) => BigInt(p));
  const out: number[] = [Number(parts[0] * 40n + parts[1])];
  for (const p of parts.slice(2)) {
    const chunk: number[] = [];
    let v = p;
    do {
      chunk.unshift(Number(v & 0x7fn));
      v >>= 7n;
    } while (v > 0n);
    for (let i = 0; i < chunk.length - 1; i++) chunk[i] |= 0x80;
    out.push(...chunk);
  }
  return tlv(0x06, Buffer.from(out));
};

export const utcTime = (d: Date): Buffer => {
  const p = (n: number) => String(n).padStart(2, '0');
  const s = `${p(d.getUTCFullYear() % 100)}${p(d.getUTCMonth() + 1)}${p(d.getUTCDate())}${p(d.getUTCHours())}${p(d.getUTCMinutes())}${p(d.getUTCSeconds())}Z`;
  return tlv(0x17, Buffer.from(s, 'ascii'));
};

/* ───────── القراءة ───────── */

export interface Node {
  tag: number;
  /** البايتات الكاملة (وسم + طول + قيمة) */
  raw: Buffer;
  value: Buffer;
}

export const read = (buf: Buffer, offset = 0): Node => {
  const tag = buf[offset];
  let p = offset + 1;
  let length = buf[p++];
  if (length & 0x80) {
    const n = length & 0x7f;
    length = 0;
    for (let i = 0; i < n; i++) length = length * 256 + buf[p++];
  }
  return { tag, raw: buf.subarray(offset, p + length), value: buf.subarray(p, p + length) };
};

export const children = (node: Node): Node[] => {
  const out: Node[] = [];
  for (let p = 0; p < node.value.length; ) {
    const c = read(node.value, p);
    out.push(c);
    p += c.raw.length;
  }
  return out;
};

/** أجزاء الشهادة التي نحتاجها: TBS، رقمها التسلسلي، الجهة المصدرة (DER)، والتوقيع الخام */
export const parseCertificate = (der: Buffer) => {
  const [tbs, , sig] = children(read(der));
  const tbsParts = children(tbs);
  const off = tbsParts[0].tag === 0xa0 ? 1 : 0; // [0] version اختياري
  return {
    tbs: tbs.raw,
    serial: tbsParts[off].raw,
    issuer: tbsParts[off + 2].raw,
    signature: sig.value.subarray(1), // نتجاوز بايت "unused bits" في BIT STRING
  };
};
