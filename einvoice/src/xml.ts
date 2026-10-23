// شجرة XML صغيرة تُكتب مباشرة بصيغة Canonical XML (C14N 1.1) دون مسافات بين العناصر.
// لأن المستند نفسه مكتوب بالصيغة القانونية، فالـ hash الذي نحسبه يطابق ما تحسبه ZATCA
// بعد حذف عناصر التوقيع ورمز QR وتطبيق C14N، دون الاعتماد على مكتبة تحويل.

export interface El {
  name: string;
  attrs: Record<string, string>;
  children: (El | string)[];
}

export const el = (name: string, attrs: Record<string, string | undefined> | null, ...children: (El | string | number | null | undefined | false)[]): El => ({
  name,
  attrs: Object.fromEntries(Object.entries(attrs || {}).filter(([, v]) => v !== undefined)) as Record<string, string>,
  children: children.filter((c): c is El | string | number => c !== null && c !== undefined && c !== false).map((c) => (typeof c === 'number' ? String(c) : c)),
});

const escText = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\r/g, '&#xD;');
const escAttr = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;').replace(/\t/g, '&#x9;').replace(/\n/g, '&#xA;').replace(/\r/g, '&#xD;');

// C14N: تصريحات النطاقات أولاً (الافتراضي ثم حسب البادئة)، ثم بقية السمات مرتّبة (لا نستخدم سمات بنطاقات)
const sortAttrs = (attrs: Record<string, string>) => {
  const keys = Object.keys(attrs);
  const ns = keys.filter((k) => k === 'xmlns' || k.startsWith('xmlns:')).sort((a, b) => (a === 'xmlns' ? -1 : b === 'xmlns' ? 1 : a < b ? -1 : 1));
  const rest = keys.filter((k) => !ns.includes(k)).sort();
  return [...ns, ...rest];
};

/** skip: عناصر تُستبعد (لحساب hash الفاتورة) */
export const serialize = (node: El, skip?: (e: El) => boolean): string => {
  const out: string[] = [];
  const walk = (e: El) => {
    if (skip?.(e)) return;
    out.push(`<${e.name}`);
    for (const k of sortAttrs(e.attrs)) out.push(` ${k}="${escAttr(e.attrs[k])}"`);
    out.push('>');
    for (const c of e.children) typeof c === 'string' ? out.push(escText(c)) : walk(c);
    out.push(`</${e.name}>`);
  };
  walk(node);
  return out.join('');
};

export const find = (node: El, pred: (e: El) => boolean): El | undefined => {
  if (pred(node)) return node;
  for (const c of node.children) {
    if (typeof c === 'string') continue;
    const f = find(c, pred);
    if (f) return f;
  }
  return undefined;
};

export const textOf = (e: El | undefined) => (e ? e.children.filter((c) => typeof c === 'string').join('') : '');
