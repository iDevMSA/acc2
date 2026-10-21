// البحث عن منتج بالباركود في قواعد المنتجات العالمية المفتوحة (Open Food Facts وأخواتها):
// ملايين المنتجات من كل الدول، مع الاسم (بالعربية إن وُجد) والعلامة التجارية والصورة.
// نحفظ النتيجة في دليل الشركة (barcodeCatalog) فلا نطلبها مرة ثانية، وتعمل بدون اتصال بعد أول مرة.

import { CatalogEntry } from './pos';

const SOURCES: Array<{ host: string; label: string }> = [
  { host: 'world.openfoodfacts.org', label: 'Open Food Facts' },
  { host: 'world.openproductsfacts.org', label: 'Open Products Facts' },
  { host: 'world.openbeautyfacts.org', label: 'Open Beauty Facts' },
  { host: 'world.openpetfoodfacts.org', label: 'Open Pet Food Facts' },
];

const FIELDS = [
  'product_name',
  'product_name_ar',
  'product_name_en',
  'generic_name',
  'brands',
  'quantity',
  'image_front_url',
  'image_url',
  'categories',
].join(',');

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

/** يرجع بيانات المنتج من أول قاعدة تعرفه، أو null */
export const lookupBarcode = async (barcode: string): Promise<CatalogEntry | null> => {
  const code = barcode.trim();
  if (!/^\d{6,14}$/.test(code)) return null;
  for (const src of SOURCES) {
    const j = await fetchJson(`https://${src.host}/api/v2/product/${code}.json?fields=${FIELDS}`);
    const p = j?.status === 1 || j?.product ? j.product : null;
    if (!p) continue;
    const nameAr = (p.product_name_ar || '').trim();
    const name = (nameAr || p.product_name || p.product_name_en || p.generic_name || '').trim();
    if (!name) continue;
    const brand = (p.brands || '').split(',')[0]?.trim() || '';
    return {
      barcode: code,
      name: brand && !name.includes(brand) ? `${name} - ${brand}` : name,
      nameAr: nameAr || undefined,
      brand: brand || undefined,
      quantity: p.quantity || undefined,
      imageUrl: p.image_front_url || p.image_url || undefined,
      // آخر تصنيف مقروء (التصنيفات المسبوقة برمز لغة مثل "fr:" وسوم داخلية)
      category: (p.categories || '').split(',').map((c: string) => c.trim()).filter((c: string) => c && !/^[a-z]{2}:/.test(c)).pop() || undefined,
      source: src.label,
      fetchedAt: new Date().toISOString(),
    };
  }
  return null;
};

/** يحذف الحقول الفارغة قبل الحفظ في Firebase (لا يقبل undefined) */
export const catalogToJson = (e: CatalogEntry) =>
  Object.fromEntries(Object.entries(e).filter(([, v]) => v !== undefined && v !== ''));
