// استيراد الزبائن والموردين والأصناف ومنتجات نقطة البيع من Excel: مطابقة الأعمدة تلقائياً،
// تحويل الأرقام (العربية والهندية)، كشف المكرر والأخطاء قبل الحفظ.

export type ImportKind = 'customers' | 'suppliers' | 'items' | 'products';

export interface FieldDef {
  key: string;
  label: string;
  required?: boolean;
  type?: 'text' | 'number' | 'date';
  aliases: string[];
}

const PARTY_FIELDS: FieldDef[] = [
  { key: 'name', label: 'الاسم', required: true, aliases: ['الاسم', 'اسم العميل', 'اسم الزبون', 'اسم المورد', 'العميل', 'الزبون', 'المورد', 'اسم الحساب', 'name', 'customer', 'supplier', 'vendor'] },
  { key: 'code', label: 'الكود', aliases: ['الكود', 'الرمز', 'رمز العميل', 'كود', 'code'] },
  { key: 'phone', label: 'الهاتف', aliases: ['الهاتف', 'الجوال', 'رقم الهاتف', 'رقم الجوال', 'الموبايل', 'phone', 'mobile', 'tel'] },
  { key: 'address', label: 'العنوان', aliases: ['العنوان', 'المدينة', 'address', 'city'] },
  {
    key: 'opening',
    label: 'الرصيد الافتتاحي',
    type: 'number',
    aliases: ['الرصيد الافتتاحي', 'رصيد افتتاحي', 'الرصيد', 'رصيد أول المدة', 'opening balance', 'opening', 'balance'],
  },
];

export const IMPORT_KINDS: Record<ImportKind, { label: string; fields: FieldDef[]; example: Array<string | number>; hint: string }> = {
  customers: {
    label: 'الزبائن',
    fields: PARTY_FIELDS,
    example: ['مؤسسة النخبة', 'C-001', '0500000000', 'الرياض', 1500],
    hint: 'الرصيد الافتتاحي الموجب = مبلغ على الزبون لنا',
  },
  suppliers: {
    label: 'الموردون',
    fields: PARTY_FIELDS,
    example: ['مصنع اليمامة', 'S-001', '0110000000', 'جدة', 3200],
    hint: 'الرصيد الافتتاحي الموجب = مبلغ للمورد علينا',
  },
  items: {
    label: 'أصناف المخازن',
    fields: [
      { key: 'name', label: 'اسم الصنف', required: true, aliases: ['اسم الصنف', 'الصنف', 'الاسم', 'اسم المادة', 'المادة', 'name', 'item', 'product'] },
      { key: 'code', label: 'الكود', aliases: ['الكود', 'رمز الصنف', 'رقم الصنف', 'كود', 'code', 'sku'] },
      { key: 'barcode', label: 'الباركود', aliases: ['الباركود', 'باركود', 'barcode', 'ean'] },
      { key: 'unit', label: 'الوحدة', aliases: ['الوحدة', 'وحدة', 'unit', 'uom'] },
      { key: 'category', label: 'التصنيف', aliases: ['التصنيف', 'الفئة', 'المجموعة', 'القسم', 'category', 'group'] },
      { key: 'price', label: 'سعر البيع', type: 'number', aliases: ['سعر البيع', 'السعر', 'سعر', 'price', 'sell price', 'sale price'] },
      { key: 'cost', label: 'سعر الشراء', type: 'number', aliases: ['سعر الشراء', 'التكلفة', 'سعر التكلفة', 'cost', 'purchase price'] },
      { key: 'minQty', label: 'الحد الأدنى', type: 'number', aliases: ['الحد الأدنى', 'حد أدنى', 'min', 'min qty'] },
      { key: 'reorderQty', label: 'حد إعادة الطلب', type: 'number', aliases: ['حد إعادة الطلب', 'إعادة الطلب', 'reorder', 'reorder level'] },
      { key: 'vatPct', label: 'نسبة الضريبة %', type: 'number', aliases: ['نسبة الضريبة', 'الضريبة', 'ضريبة القيمة المضافة', 'vat', 'tax'] },
    ],
    example: ['أسمنت مقاوم 50 كغ', 'CEM-50', '6281000000017', 'كيس', 'مواد بناء', 18, 12, 50, 100, 15],
    hint: 'الأصناف بلا كميات؛ أدخل الكميات بحركة إدخال أو جرد',
  },
  products: {
    label: 'منتجات نقطة البيع',
    fields: [
      { key: 'name', label: 'اسم المنتج', required: true, aliases: ['اسم المنتج', 'المنتج', 'الاسم', 'اسم الصنف', 'الصنف', 'name', 'product', 'item'] },
      { key: 'barcode', label: 'الباركود', aliases: ['الباركود', 'باركود', 'barcode', 'ean'] },
      { key: 'category', label: 'التصنيف', aliases: ['التصنيف', 'الفئة', 'المجموعة', 'القسم', 'category'] },
      { key: 'sellPrice', label: 'سعر البيع', type: 'number', aliases: ['سعر البيع', 'السعر', 'سعر', 'price', 'sell price'] },
      { key: 'costPrice', label: 'سعر الشراء', type: 'number', aliases: ['سعر الشراء', 'التكلفة', 'cost', 'purchase price'] },
      { key: 'quantity', label: 'الكمية', type: 'number', aliases: ['الكمية', 'الرصيد', 'المخزون', 'quantity', 'qty', 'stock'] },
      { key: 'vatRate', label: 'نسبة الضريبة %', type: 'number', aliases: ['نسبة الضريبة', 'الضريبة', 'vat', 'tax'] },
      { key: 'expiryDate', label: 'تاريخ الانتهاء', type: 'date', aliases: ['تاريخ الانتهاء', 'الانتهاء', 'الصلاحية', 'expiry', 'expiry date'] },
    ],
    example: ['مياه نوفا 330 مل', '6281234567890', 'مشروبات', 1, 0.6, 120, 15, '2027-06-30'],
    hint: 'تُضاف للمخزن الذي تختاره، والكمية تصبح رصيد المنتج',
  },
};

const norm = (s: string) =>
  s
    .toLowerCase()
    .replace(/[ً-ْـ]/g, '')
    .replace(/[أإآ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/[^a-z0-9؀-ۿ]+/g, '');

/** المطابقة التلقائية: field.key ← رقم العمود (أو -1) */
export const autoMap = (headers: string[], fields: FieldDef[]): Record<string, number> => {
  const H = headers.map(norm);
  const used = new Set<number>();
  const out: Record<string, number> = {};
  // مطابقة تامة أولاً ثم جزئية، حتى لا يأخذ "السعر" عمود "سعر الشراء"
  for (const exact of [true, false])
    fields.forEach((f) => {
      if (out[f.key] !== undefined && out[f.key] >= 0) return;
      const aliases = f.aliases.map(norm);
      const i = H.findIndex((h, idx) => !used.has(idx) && h && aliases.some((a) => (exact ? h === a : h.includes(a) || a.includes(h))));
      if (i >= 0) {
        out[f.key] = i;
        used.add(i);
      } else if (!exact) out[f.key] = -1;
    });
  return out;
};

const ARABIC_DIGITS = '٠١٢٣٤٥٦٧٨٩';
const PERSIAN_DIGITS = '۰۱۲۳۴۵۶۷۸۹';

/** "١٬٢٣٤٫٥" و "1,234.50" و "15%" و "(200)" ← رقم، أو NaN */
export const parseNumber = (raw: string): number => {
  let s = (raw || '').trim();
  if (!s) return NaN;
  s = s.replace(/[٠-٩]/g, (d) => String(ARABIC_DIGITS.indexOf(d))).replace(/[۰-۹]/g, (d) => String(PERSIAN_DIGITS.indexOf(d)));
  s = s.replace(/٬/g, ',').replace(/٫/g, '.').replace(/[%\s ]|[A-Za-z؀-ۿ]+\.?/g, '');
  if (!/\d/.test(s)) return NaN;
  const neg = /^\(.*\)$/.test(s) || s.startsWith('-');
  s = s.replace(/[()\-+]/g, '');
  if (/^\d{1,3}(,\d{3})+(\.\d+)?$/.test(s)) s = s.replace(/,/g, '');
  else if (/^\d+,\d+$/.test(s)) s = s.replace(',', '.');
  const n = Number(s);
  return Number.isFinite(n) ? (neg ? -n : n) : NaN;
};

/** yyyy-mm-dd من "2027-06-30" أو "30/06/2027" أو رقم تاريخ Excel */
export const parseDate = (raw: string): string | null => {
  const s = (raw || '').trim();
  if (!s) return null;
  let m = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (m) return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
  m = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/);
  if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  if (/^\d{5}$/.test(s)) return new Date(Date.UTC(1899, 11, 30) + Number(s) * 86400000).toISOString().slice(0, 10);
  return null;
};

export type RowStatus = 'new' | 'update' | 'skip' | 'error';

export interface ImportRow {
  line: number;
  status: RowStatus;
  message?: string;
  values: Record<string, string | number | null>;
  /** للتحديث: معرّف السجل الموجود */
  existingId?: string;
}

export interface Existing {
  id: string;
  name: string;
  code?: string;
  barcode?: string | null;
  phone?: string;
}

/**
 * يحوّل الصفوف إلى سجلات جاهزة مع حالة كل صف:
 * new = يُضاف، update = موجود ويُحدَّث (mode=update)، skip = موجود أو مكرر في الملف، error = خطأ يُعرض للمستخدم.
 */
export const prepareImport = (
  kind: ImportKind,
  rows: string[][],
  mapping: Record<string, number>,
  existing: Existing[],
  mode: 'skip' | 'update',
): ImportRow[] => {
  const fields = IMPORT_KINDS[kind].fields;
  const keyOf = (v: Record<string, any>) => {
    const keys: string[] = [];
    if (v.code) keys.push(`c:${norm(String(v.code))}`);
    if (v.barcode) keys.push(`b:${norm(String(v.barcode))}`);
    if (v.phone && (kind === 'customers' || kind === 'suppliers')) keys.push(`p:${String(v.phone).replace(/\D/g, '').slice(-9)}`);
    keys.push(`n:${norm(String(v.name || ''))}`);
    return keys;
  };
  const index = new Map<string, string>();
  existing.forEach((e) => keyOf(e).forEach((k) => !index.has(k) && index.set(k, e.id)));
  const seen = new Set<string>();

  return rows.map((r, i) => {
    const values: Record<string, string | number | null> = {};
    const errors: string[] = [];
    fields.forEach((f) => {
      const col = mapping[f.key];
      const raw = col >= 0 ? r[col] ?? '' : '';
      if (f.type === 'number') {
        if (!raw) values[f.key] = null;
        else {
          const n = parseNumber(raw);
          if (Number.isNaN(n)) errors.push(`${f.label}: "${raw}" ليس رقماً`);
          values[f.key] = Number.isNaN(n) ? null : n;
        }
      } else if (f.type === 'date') {
        const d = parseDate(raw);
        if (raw && !d) errors.push(`${f.label}: "${raw}" تاريخ غير مفهوم`);
        values[f.key] = d;
      } else values[f.key] = raw.trim();
      if (f.required && !values[f.key]) errors.push(`${f.label} مطلوب`);
    });
    const line = i + 2;
    if (errors.length) return { line, status: 'error', message: errors.join('، '), values };
    const keys = keyOf(values);
    if (keys.some((k) => seen.has(k))) return { line, status: 'skip', message: 'مكرر في الملف', values };
    keys.forEach((k) => seen.add(k));
    const match = keys.map((k) => index.get(k)).find(Boolean);
    if (match)
      return mode === 'update'
        ? { line, status: 'update', message: 'موجود — سيُحدَّث', values, existingId: match }
        : { line, status: 'skip', message: 'موجود مسبقاً', values, existingId: match };
    return { line, status: 'new', values };
  });
};
