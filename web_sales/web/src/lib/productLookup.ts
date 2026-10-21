// البحث عن منتج بالباركود في قواعد المنتجات العالمية المفتوحة (Open Food Facts وأخواتها):
// ملايين المنتجات من كل الدول، مع الاسم والعلامة التجارية والحجم والصورة.
// الاسم يُعرض بالعربية دائماً مع الحجم (مثل: كوكا كولا زيرو 330 مل): من القاعدة إن وُجد،
// وإلا بترجمة آلية. ونحفظ النتيجة في دليل الشركة (barcodeCatalog) فلا نطلبها مرة ثانية.

import { CatalogEntry } from './pos';

const SOURCES: Array<{ host: string; label: string }> = [
  { host: 'world.openfoodfacts.org', label: 'Open Food Facts' },
  { host: 'world.openproductsfacts.org', label: 'Open Products Facts' },
  { host: 'world.openbeautyfacts.org', label: 'Open Beauty Facts' },
  { host: 'world.openpetfoodfacts.org', label: 'Open Pet Food Facts' },
];

const FIELDS = ['product_name', 'product_name_ar', 'product_name_en', 'generic_name', 'brands', 'quantity', 'image_front_url', 'image_url', 'categories'].join(',');

const fetchJson = async (url: string, ms = 8000) => {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    const r = await fetch(url, { signal: ctrl.signal });
    return r.ok ? await r.json() : null;
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
};

const hasArabic = (s: string) => /[؀-ۿ]/.test(s);

/* ───────── الحجم بالعربية ───────── */

const UNITS: Array<[RegExp, string]> = [
  [/\b(?:ml|mL|ML|millilit(?:er|re)s?)\b/g, 'مل'],
  [/\b(?:cl|cL|CL)\b/g, 'سل'],
  [/\b(?:l|L|lt|ltr|lit(?:er|re)s?)\b/g, 'لتر'],
  [/\b(?:kg|KG|Kg|kilo(?:gram)?s?)\b/g, 'كغ'],
  [/\b(?:mg|MG)\b/g, 'ملغ'],
  [/\b(?:g|gr|grs|gram(?:me)?s?|G)\b/g, 'غ'],
  [/\b(?:oz|OZ)\b/g, 'أونصة'],
  [/\b(?:pcs?|pieces?|units?)\b/gi, 'حبة'],
];

/** "330 ml" ← "330 مل"، "1,5 L" ← "1.5 لتر"، "6 x 250 ml" ← "6 × 250 مل" */
export const quantityAr = (q?: string) => {
  let s = (q || '').trim();
  if (!s) return '';
  s = s.replace(/(\d),(\d)/g, '$1.$2').replace(/\s*[xX×]\s*/g, ' × ');
  s = s.replace(/(\d)(?=[a-zA-Z])/g, '$1 ');
  UNITS.forEach(([re, ar]) => (s = s.replace(re, ar)));
  return s.replace(/\s+/g, ' ').trim();
};

/* ───────── الترجمة الآلية للاسم ───────── */

const TR_KEY = 'pos.tr.';

/** ترجمة اسم المنتج للعربية (MyMemory المجاني) مع تخزين محلي حتى لا تتكرر */
export const translateToArabic = async (text: string): Promise<string> => {
  const t = text.trim();
  if (!t || hasArabic(t)) return t;
  try {
    const cached = localStorage.getItem(TR_KEY + t);
    if (cached) return cached;
  } catch {
    // لا تخزين محلي
  }
  const j = await fetchJson(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(t)}&langpair=en|ar`, 6000);
  const out = (j?.responseData?.translatedText || '').trim();
  if (!out || !hasArabic(out) || /MYMEMORY|QUOTA/i.test(out)) return t;
  try {
    localStorage.setItem(TR_KEY + t, out);
  } catch {
    // لا تخزين محلي
  }
  return out;
};

/** الاسم الذي يُحفظ للمنتج: بالعربية + الحجم (بدون تكرار الحجم إن كان في الاسم) */
export const arabicProductName = async (e: { name: string; nameAr?: string; nameEn?: string; brand?: string; quantity?: string }) => {
  let base = (e.nameAr || '').trim();
  if (!base) base = await translateToArabic(e.nameEn || e.name);
  const size = quantityAr(e.quantity);
  const digits = size.match(/[\d.]+/)?.[0];
  return digits && base.includes(digits) ? base : `${base} ${size}`.trim();
};

/* ───────── البحث بالباركود ───────── */

/** يرجع بيانات المنتج من أول قاعدة تعرفه، أو null */
export const lookupBarcode = async (barcode: string): Promise<CatalogEntry | null> => {
  const code = barcode.trim();
  if (!/^\d{6,14}$/.test(code)) return null;
  for (const src of SOURCES) {
    const j = await fetchJson(`https://${src.host}/api/v2/product/${code}.json?fields=${FIELDS}`);
    const p = j?.status === 1 || j?.product ? j.product : null;
    if (!p) continue;
    const nameAr = (p.product_name_ar || '').trim();
    const nameEn = (p.product_name || p.product_name_en || p.generic_name || '').trim();
    if (!nameAr && !nameEn) continue;
    const brand = (p.brands || '').split(',')[0]?.trim() || '';
    const entry: CatalogEntry = {
      barcode: code,
      name: '',
      nameAr: nameAr || undefined,
      brand: brand || undefined,
      quantity: p.quantity || undefined,
      imageUrl: p.image_front_url || p.image_url || undefined,
      // آخر تصنيف مقروء (التصنيفات المسبوقة برمز لغة مثل "fr:" وسوم داخلية)
      category: (p.categories || '').split(',').map((c: string) => c.trim()).filter((c: string) => c && !/^[a-z]{2}:/.test(c)).pop() || undefined,
      source: src.label,
      fetchedAt: new Date().toISOString(),
    };
    entry.name = await arabicProductName({ name: nameEn || nameAr, nameAr, nameEn, brand, quantity: p.quantity });
    return entry;
  }
  return null;
};

/* ───────── البحث بالاسم / الدولة (للاستيراد بالجملة) ───────── */

export interface SearchItem {
  barcode: string;
  name: string;
  nameAr?: string;
  nameEn?: string;
  brand?: string;
  quantity?: string;
  imageUrl: string;
  category?: string;
}

/** عبر خادم موقع خوارزم لأن خدمة البحث لا تسمح بالطلب المباشر من المتصفح */
const SEARCH_API = typeof window !== 'undefined' && /inexusdev\.com$/.test(window.location.hostname) ? '/api/products/search' : 'https://inexusdev.com/api/products/search';

export const searchProducts = async (q: string, country: string, page = 1) => {
  const p = new URLSearchParams({ q, country, page: String(page), pageSize: '40' });
  const j = await fetchJson(`${SEARCH_API}?${p}`, 20000);
  if (!j || !Array.isArray(j.items)) throw new Error('تعذّر الاتصال بقاعدة المنتجات — حاول بعد قليل');
  return { items: j.items as SearchItem[], page: Number(j.page) || page, pageCount: Number(j.pageCount) || 1 };
};

/** يحذف الحقول الفارغة قبل الحفظ في Firebase (لا يقبل undefined) */
export const catalogToJson = (e: CatalogEntry) => Object.fromEntries(Object.entries(e).filter(([, v]) => v !== undefined && v !== ''));
