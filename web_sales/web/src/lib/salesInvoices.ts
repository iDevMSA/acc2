import { useEffect, useState } from 'react';
import { ref, onValue } from 'firebase/database';
import { db } from '../config/firebase';
import { Tone } from '../components/ui/primitives';

// شكل فاتورة البيع كما يكتبها تطبيق Flutter في sales/{ownerUid}/invoices
// (Invoice.toJson في lib/sales_sys/smain.dart). قراءة فقط — لا نكتب من الويب.
export interface SalesInvoiceItem {
  productId?: string;
  productName?: string;
  quantity?: number;
  unitPrice?: number;
  vatRate?: number;
  barcode?: string | null;
}

export type InvoiceStatus = 'open' | 'suspended' | 'closed' | 'cancelled';
export type PaymentMethod = 'cash' | 'card' | 'transfer';

export interface SalesInvoice {
  id: string;
  number?: string;
  items?: SalesInvoiceItem[];
  paymentMethod?: PaymentMethod;
  status?: InvoiceStatus;
  amountPaid?: number;
  discount?: number;
  customerName?: string | null;
  customerPhone?: string | null;
  bankName?: string | null;
  createdAt?: string;
  createdByName?: string | null;
  /** حقل قديم: التطبيق لا يكتبه، لكن نحترمه إن وُجد */
  total?: number;
  date?: string;
}

const num = (v: unknown) => (Number.isFinite(Number(v)) ? Number(v) : 0);

export const itemSubtotal = (i: SalesInvoiceItem) => num(i.quantity ?? 1) * num(i.unitPrice);
export const itemVat = (i: SalesInvoiceItem) => (itemSubtotal(i) * num(i.vatRate)) / 100;

/** نفس حساب Invoice.subtotal / vatTotal / total في التطبيق */
export const invoiceAmounts = (inv: SalesInvoice) => {
  const items = inv.items || [];
  const subtotal = items.reduce((s, i) => s + itemSubtotal(i), 0);
  const vat = items.reduce((s, i) => s + itemVat(i), 0);
  const discount = num(inv.discount);
  const computed = subtotal + vat - discount;
  const total = items.length === 0 && inv.total !== undefined ? num(inv.total) : computed;
  return { subtotal, vat, discount, total };
};

export const invoiceTotal = (inv: SalesInvoice) => invoiceAmounts(inv).total;

export const STATUS_META: Record<InvoiceStatus, { label: string; tone: Tone }> = {
  closed: { label: 'مغلقة', tone: 'success' },
  open: { label: 'مفتوحة', tone: 'info' },
  suspended: { label: 'معلّقة', tone: 'warning' },
  cancelled: { label: 'ملغاة', tone: 'danger' },
};

export const PAYMENT_LABELS: Record<PaymentMethod, string> = {
  cash: 'نقدي',
  card: 'بطاقة',
  transfer: 'تحويل',
};

export const useSalesInvoices = (uid: string | null) => {
  const [invoices, setInvoices] = useState<SalesInvoice[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!uid) return;
    return onValue(ref(db, `sales/${uid}/invoices`), (snapshot) => {
      const data = snapshot.val() || {};
      setInvoices(Object.entries(data).map(([id, inv]: [string, any]) => ({ id, ...inv })));
      setLoading(false);
    });
  }, [uid]);

  return { invoices, loading };
};
