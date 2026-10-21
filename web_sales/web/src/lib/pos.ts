// نموذج بيانات نقطة البيع المشترك مع تطبيق الهاتف (lib/sales_sys/smain.dart).
//
// الهاتف يكتب تحت sales/{ownerUid}:
//   branches/{id}       ← Branch.toJson        (name, ownerUid, address, phone, type, createdAt)
//   warehouses/{id}     ← Warehouse.toJson     (name, branchId, ownerUid)
//   products/{id}       ← Product.toJson       (name, warehouseId, barcode, costPrice, sellPrice, quantity, vatRate ...)
//   cashRegisters/{id}  ← CashRegister.toJson  (name, branchId, ownerUid, sessionOpen)
//   employees/{uid}     ← SalesUser.toJson     (uid, name, email, role, branchId, cashRegisterId, ownerUid, phone)
//   invoices/{id}       ← Invoice.toJson
//   invoiceSequence     ← رقم تسلسلي
// و employeeOwnerMap/{employeeUid} = ownerUid يسمح للكاشير بقراءة/كتابة sales/{ownerUid} (قواعد Firebase).
//
// ما يخص الويب وحده (جلسات الكاشير، ربط المخازن، صور المنتجات، دليل الباركود، الماسح عن بُعد)
// يُحفظ في عقد جديدة تحت sales/{ownerUid}/... لا يكتبها الهاتف أبداً.

export type BusinessType = 'store' | 'restaurant' | 'cafe';
export type PosRole = 'owner' | 'manager' | 'cashier';
export type PayMethod = 'cash' | 'card' | 'transfer';

export interface PosBranch {
  id: string;
  name: string;
  ownerUid: string;
  address?: string | null;
  phone?: string | null;
  type: BusinessType;
  createdAt: string;
}

export interface PosWarehouse {
  id: string;
  name: string;
  branchId: string;
  ownerUid: string;
}

export interface PosProduct {
  id: string;
  name: string;
  warehouseId: string;
  ownerUid: string;
  barcode?: string | null;
  category?: string | null;
  description?: string | null;
  costPrice: number;
  sellPrice: number;
  quantity: number;
  vatRate: number;
  branchPrices: Record<string, number>;
  expiryDate?: string | null;
  productionDate?: string | null;
  trackExpiry: boolean;
}

export interface CashRegister {
  id: string;
  name: string;
  branchId: string;
  ownerUid: string;
  sessionOpen: boolean;
}

export interface PosEmployee {
  uid: string;
  name: string;
  email: string;
  role: PosRole;
  branchId?: string | null;
  cashRegisterId?: string | null;
  ownerUid?: string | null;
  phone?: string | null;
}

export interface PosInvoiceItem {
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  vatRate: number;
  barcode?: string | null;
}

/** نفس Invoice.toJson في الهاتف */
export interface PosInvoiceJson {
  number: string;
  cashRegisterId: string;
  branchId: string;
  ownerUid: string;
  createdByUid: string;
  items: PosInvoiceItem[];
  paymentMethod: PayMethod;
  status: 'open' | 'suspended' | 'closed' | 'cancelled';
  amountPaid: number;
  discount: number;
  customerPhone: string | null;
  customerName: string | null;
  bankName: string | null;
  transferAccountName: string | null;
  createdAt: string;
  createdByName: string | null;
}

/* ───────── عقد الويب الجديدة ───────── */

/** جلسة كاشير: فتح الصندوق بنقدية افتتاحية وإغلاقه بجرد فعلي (sales/{owner}/posSessions) */
export interface PosSession {
  id: string;
  registerId: string;
  branchId: string;
  cashierUid: string;
  cashierName: string;
  openedAt: string;
  openingCash: number;
  closedAt?: string | null;
  /** النقدية المعدودة عند الإغلاق */
  countedCash?: number | null;
  /** مجاميع محسوبة عند الإغلاق */
  totals?: { count: number; cash: number; card: number; transfer: number; total: number } | null;
  note?: string;
}

/** بيانات إضافية للمنتج يكتبها الويب فقط (sales/{owner}/productMeta/{productId}) */
export interface ProductMeta {
  imageUrl?: string;
  brand?: string;
  source?: string;
}

/** دليل الباركود المحفوظ (sales/{owner}/barcodeCatalog/{barcode}) — من قواعد المنتجات العالمية */
export interface CatalogEntry {
  barcode: string;
  name: string;
  nameAr?: string;
  brand?: string;
  quantity?: string;
  imageUrl?: string;
  category?: string;
  source: string;
  fetchedAt: string;
}

/** ربط المخازن ببعضها (sales/{owner}/warehouseLinks/{warehouseId} = [ids]) للتحويل بينها */
export type WarehouseLinks = Record<string, string[]>;

export const BUSINESS_LABELS: Record<BusinessType, string> = { store: 'متجر', restaurant: 'مطعم', cafe: 'كافيه' };
export const ROLE_LABELS: Record<PosRole, string> = { owner: 'مالك', manager: 'مدير فرع', cashier: 'كاشير' };
export const PAY_LABELS: Record<PayMethod, string> = { cash: 'نقدي', card: 'بطاقة', transfer: 'تحويل' };

const n = (v: unknown, d = 0) => (Number.isFinite(Number(v)) ? Number(v) : d);
const s = (v: unknown) => (typeof v === 'string' ? v : v == null ? '' : String(v));

export const parseBranch = (id: string, j: any): PosBranch => ({
  id,
  name: s(j?.name),
  ownerUid: s(j?.ownerUid),
  address: j?.address ?? null,
  phone: j?.phone ?? null,
  type: (['store', 'restaurant', 'cafe'].includes(j?.type) ? j.type : 'store') as BusinessType,
  createdAt: s(j?.createdAt),
});

export const parseWarehouse = (id: string, j: any): PosWarehouse => ({
  id,
  name: s(j?.name),
  branchId: s(j?.branchId),
  ownerUid: s(j?.ownerUid),
});

export const parseProduct = (id: string, j: any): PosProduct => ({
  id,
  name: s(j?.name),
  warehouseId: s(j?.warehouseId),
  ownerUid: s(j?.ownerUid),
  barcode: j?.barcode ?? null,
  category: j?.category ?? null,
  description: j?.description ?? null,
  costPrice: n(j?.costPrice),
  sellPrice: n(j?.sellPrice),
  quantity: n(j?.quantity),
  vatRate: n(j?.vatRate),
  branchPrices:
    j?.branchPrices && typeof j.branchPrices === 'object'
      ? Object.fromEntries(Object.entries(j.branchPrices).map(([k, v]) => [k, n(v)]))
      : {},
  expiryDate: j?.expiryDate ?? null,
  productionDate: j?.productionDate ?? null,
  trackExpiry: j?.trackExpiry === true,
});

export const parseRegister = (id: string, j: any): CashRegister => ({
  id,
  name: s(j?.name),
  branchId: s(j?.branchId),
  ownerUid: s(j?.ownerUid),
  sessionOpen: j?.sessionOpen === true,
});

export const parseEmployee = (uid: string, j: any): PosEmployee => ({
  uid,
  name: s(j?.name),
  email: s(j?.email),
  role: (['owner', 'manager', 'cashier'].includes(j?.role) ? j.role : 'cashier') as PosRole,
  branchId: j?.branchId ?? null,
  cashRegisterId: j?.cashRegisterId ?? null,
  ownerUid: j?.ownerUid ?? null,
  phone: j?.phone ?? null,
});

/** نفس Product.toJson — كل الحقول حتى لا يقرأ الهاتف قيمة ناقصة */
export const productToJson = (p: PosProduct) => ({
  name: p.name,
  warehouseId: p.warehouseId,
  ownerUid: p.ownerUid,
  barcode: p.barcode || null,
  category: p.category || null,
  description: p.description || null,
  costPrice: p.costPrice,
  sellPrice: p.sellPrice,
  quantity: p.quantity,
  vatRate: p.vatRate,
  branchPrices: p.branchPrices,
  expiryDate: p.expiryDate || null,
  productionDate: p.productionDate || null,
  trackExpiry: p.trackExpiry,
});

export const priceForBranch = (p: PosProduct, branchId?: string | null) =>
  (branchId && p.branchPrices[branchId] !== undefined ? p.branchPrices[branchId] : p.sellPrice) || 0;

/** نفس SalesDataService.makeNumber في الهاتف: dd/mm-seq-REG-BR */
export const makeInvoiceNumber = (seq: number, regId: string, brId: string, now = new Date()) => {
  const p2 = (x: number) => String(x).padStart(2, '0');
  const cr = (regId.length > 4 ? regId.slice(0, 4) : regId).toUpperCase();
  const br = (brId.length > 4 ? brId.slice(0, 4) : brId).toUpperCase();
  return `${p2(now.getDate())}/${p2(now.getMonth() + 1)}-${String(seq).padStart(4, '0')}-${cr}-${br}`;
};

/** نفس حساب الهاتف: الإجمالي = مجموع البنود + الضريبة − الخصم، ثم تقريب لأقرب عدد صحيح */
export const cartTotals = (items: PosInvoiceItem[], discount = 0) => {
  const subtotal = items.reduce((t, i) => t + i.quantity * i.unitPrice, 0);
  const vat = items.reduce((t, i) => t + (i.quantity * i.unitPrice * i.vatRate) / 100, 0);
  const total = subtotal + vat - discount;
  const frac = total - Math.floor(total);
  const rounded = frac >= 0.5 ? Math.ceil(total) : Math.floor(total);
  return { subtotal, vat, total, rounded };
};

/** هل الرمز باركود منتج صالح (EAN-8/12/13/14 مع رقم التحقق)؟ */
export const isValidGtin = (code: string) => {
  if (!/^\d{8}$|^\d{12,14}$/.test(code)) return false;
  const digits = code.split('').map(Number);
  const check = digits.pop()!;
  const sum = digits.reverse().reduce((t, d, i) => t + d * (i % 2 === 0 ? 3 : 1), 0);
  return (10 - (sum % 10)) % 10 === check;
};
