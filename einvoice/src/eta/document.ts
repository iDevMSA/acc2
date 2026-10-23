// مستند منظومة الفاتورة الإلكترونية المصرية (ETA) بصيغة JSON v1.0 والتسلسل القانوني الذي يُوقَّع.
import { EDoc, lineGross, lineNet, Party, round5 } from '../model';

export interface EtaIssuer extends Party {
  /** رقم التسجيل الضريبي (9 أرقام) */
  vatNumber: string;
  /** رمز النشاط الضريبي (مثل 4620) */
  activityCode: string;
  /** رقم الفرع في المنظومة ("0" للمركز الرئيسي) */
  branchId?: string;
}

export interface EtaOptions {
  version: '1.0' | '0.9';
  /** النوع الفرعي لضريبة القيمة المضافة عند نسبة 0% (مثل V003 سلعة أو خدمة معفاة) */
  zeroSubtype?: string;
  defaultItem?: { itemType?: 'EGS' | 'GS1'; itemCode?: string; unitType?: string };
}

const TYPE: Record<EDoc['kind'], string> = { invoice: 'I', credit: 'C', debit: 'D' };

const address = (p: Party, branchId?: string) => ({
  ...(branchId !== undefined ? { branchID: branchId } : {}),
  country: p.country || 'EG',
  governate: p.governate || p.city || '-',
  regionCity: p.city || '-',
  street: p.street || '-',
  buildingNumber: p.building || '-',
  ...(p.postalCode ? { postalCode: p.postalCode } : {}),
});

/** يُرجع المستند بدون التوقيعات، بترتيب الحقول المعتمد */
export const buildEtaDocument = (doc: EDoc, issuer: EtaIssuer, opts: EtaOptions) => {
  const rate = doc.rateToTaxCurrency || 1;
  const foreign = doc.currency !== 'EGP';
  // خصم المستند (قبل الضريبة) يوزّع على البنود كخصم بند لأن ETA تحسب الضريبة لكل بند
  const allowanceFor = new Map(doc.allowances.map((a) => [a.rate, a.amount]));
  const netByRate = new Map<number, number>();
  for (const l of doc.lines) netByRate.set(l.vatRate, (netByRate.get(l.vatRate) || 0) + lineNet(l));

  const lines = doc.lines.map((l) => {
    const share = (allowanceFor.get(l.vatRate) || 0) * (netByRate.get(l.vatRate) ? lineNet(l) / netByRate.get(l.vatRate)! : 0);
    const amountEGP = round5(l.unitPrice * rate);
    const salesTotal = round5(l.qty * amountEGP);
    const discountAmount = round5((lineGross(l) - lineNet(l) + share) * rate);
    const netTotal = round5(salesTotal - discountAmount);
    const tax = round5((netTotal * l.vatRate) / 100);
    const code = { ...opts.defaultItem, ...(l.itemCode ? { itemType: l.itemType, itemCode: l.itemCode, unitType: l.unitType } : {}) };
    return {
      description: l.name,
      itemType: code.itemType || 'EGS',
      itemCode: code.itemCode || '',
      unitType: code.unitType || 'EA',
      quantity: l.qty,
      internalCode: code.itemCode || '',
      salesTotal,
      total: round5(netTotal + tax),
      valueDifference: 0,
      totalTaxableFees: 0,
      netTotal,
      itemsDiscount: 0,
      unitValue: foreign
        ? { currencySold: doc.currency, amountEGP, amountSold: round5(l.unitPrice), currencyExchangeRate: round5(rate) }
        : { currencySold: 'EGP', amountEGP },
      discount: { rate: salesTotal ? round5((discountAmount / salesTotal) * 100) : 0, amount: discountAmount },
      taxableItems: [{ taxType: 'T1', amount: tax, subType: l.vatRate > 0 ? 'V009' : opts.zeroSubtype || 'V003', rate: l.vatRate }],
    };
  });

  const sum = (f: (l: (typeof lines)[number]) => number) => round5(lines.reduce((s, l) => s + f(l), 0));
  const taxTotal = sum((l) => l.taxableItems[0].amount);
  const buyer = doc.buyer;
  const receiverType = buyer?.type || (buyer?.vatNumber ? 'B' : 'P');

  return {
    issuer: { address: address(issuer, issuer.branchId ?? '0'), type: 'B', id: issuer.vatNumber, name: issuer.name },
    receiver: {
      ...(buyer?.street || buyer?.city ? { address: address(buyer) } : {}),
      type: receiverType,
      id: receiverType === 'B' ? buyer?.vatNumber || '' : buyer?.nationalId || '',
      name: buyer?.name || '',
    },
    documentType: TYPE[doc.kind],
    documentTypeVersion: opts.version,
    dateTimeIssued: new Date(doc.issuedAt).toISOString().replace(/\.\d{3}Z$/, 'Z'),
    taxpayerActivityCode: issuer.activityCode,
    internalID: doc.number,
    ...(doc.kind !== 'invoice' && doc.billingRefUuid ? { references: [doc.billingRefUuid] } : {}),
    invoiceLines: lines,
    totalDiscountAmount: sum((l) => l.discount.amount),
    totalSalesAmount: sum((l) => l.salesTotal),
    netAmount: sum((l) => l.netTotal),
    taxTotals: [{ taxType: 'T1', amount: taxTotal }],
    totalAmount: round5(sum((l) => l.netTotal) + taxTotal),
    extraDiscountAmount: 0,
    totalItemsDiscountAmount: 0,
  };
};

/**
 * التسلسل القانوني لـ ETA: اسم كل حقل بأحرف كبيرة بين علامتي تنصيص ثم قيمته؛
 * عناصر المصفوفة يسبق كلاً منها اسم المصفوفة. حقل signatures لا يدخل.
 */
export const serialize = (value: unknown): string => {
  if (value === null || typeof value !== 'object') return `"${value === null || value === undefined ? '' : String(value)}"`;
  let out = '';
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (k === 'signatures') continue;
    const name = `"${k.toUpperCase()}"`;
    if (Array.isArray(v)) {
      out += name;
      for (const item of v) out += name + serialize(item);
    } else out += name + serialize(v);
  }
  return out;
};

export const validateEta = (doc: EDoc, issuer: EtaIssuer | null, opts: EtaOptions): string[] => {
  const errs: string[] = [];
  if (!issuer?.vatNumber || !/^\d{9}$/.test(issuer.vatNumber)) errs.push('رقم التسجيل الضريبي للمنشأة (9 أرقام)');
  if (!issuer?.activityCode) errs.push('رمز النشاط الضريبي');
  if (!issuer?.governate || !issuer?.city || !issuer?.street || !issuer?.building) errs.push('عنوان المنشأة (المحافظة، المدينة، الشارع، رقم المبنى)');
  const b = doc.buyer;
  if (b?.vatNumber && !/^\d{9}$/.test(b.vatNumber) && (b.type || 'B') === 'B') errs.push('رقم التسجيل الضريبي للعميل يجب أن يكون 9 أرقام');
  if ((b?.type || (b?.vatNumber ? 'B' : 'P')) === 'B' && !(b?.street && b?.city)) errs.push('عنوان العميل (المدينة والشارع) مطلوب للشركات');
  if (doc.lines.some((l) => !l.itemCode) && !opts.defaultItem?.itemCode) errs.push('رمز الصنف (EGS/GS1): حدّد رمزاً لكل صنف أو رمزاً افتراضياً في الإعدادات');
  if (doc.kind !== 'invoice' && !doc.billingRefUuid) errs.push('أدخل الرقم الإلكتروني (UUID) للفاتورة الأصلية لهذا الإشعار');
  if (doc.currency !== 'EGP' && doc.rateToTaxCurrency === 1) errs.push('عملة الفاتورة ليست الجنيه المصري ولا يوجد سعر صرف إليه');
  return errs;
};
