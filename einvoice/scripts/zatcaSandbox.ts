// اختبار كامل مع بيئة ZATCA التجريبية (developer-portal) دون Firebase:
//   npm run build && npm run sandbox
// يولّد مفتاحاً وCSR، يطلب شهادة امتثال برمز OTP التجريبي، يجري فحص المطابقة لستة مستندات،
// يطلب شهادة إنتاج، ثم يبلّغ عن فاتورة مبسطة ويعتمد فاتورة قياسية. لا يكتب شيئاً في قاعدة البيانات.
import { MemoryStore } from '../src/store';
import { onboard, submitZatca } from '../src/zatca/service';

const seller = {
  name: 'Monsati Sandbox Co.',
  vatNumber: '399999999900003',
  crn: '1010010000',
  street: 'Prince Sultan',
  building: '2322',
  district: 'Al-Murabba',
  city: 'Riyadh',
  postalCode: '23333',
  country: 'SA',
};

const main = async () => {
  const store = new MemoryStore();
  const now = new Date().toISOString();
  await store.update({
    'users/t/einvoice/seller': seller,
    'users/t/erp/settings/mainCurrency': 'SAR',
    'sales/t/invoices/p1': { number: 'POS-1001', status: 'closed', createdAt: now, paymentMethod: 'cash', discount: 1.15, items: [{ productName: 'ماء', quantity: 3, unitPrice: 2.5, vatRate: 15 }] },
    'users/t/accounts/a1': { name: 'شركة العميل' },
    'users/t/einvoice/parties/a1': { vatNumber: '399999999800003', street: 'King Fahd', building: '1234', district: 'Al Olaya', city: 'Riyadh', postalCode: '12211' },
    'users/t/erp/invoices/i1': { kind: 'sale', number: 77, partyId: 'a1', date: now.slice(0, 10), createdAt: now, currency: 'SAR', exchangeRate: 1, vatPct: 15, discountPct: 5, paid: 0, lines: [{ description: 'جهاز', qty: 2, unitPrice: 199.99, discountPct: 10 }], totals: { total: 0 } },
  });

  const st = await onboard(store, 't', {
    env: 'sandbox',
    otp: process.env.ZATCA_OTP || '123345',
    egs: { model: 'Web', vatNumber: '', orgName: '', branchName: 'Riyadh Branch', commonName: 'TST-886431145-399999999900003', invoiceTypes: '1100', location: 'Riyadh', industry: 'Retail' },
  });
  console.log('ONBOARD', JSON.stringify(st, null, 2));
  if (st.status !== 'ready') process.exit(1);

  for (const key of ['pos_p1', 'trade_i1']) {
    const r = await submitZatca(store, 't', key);
    console.log(key, JSON.stringify({ ...r, qr: r.qr ? `${r.qr.slice(0, 20)}…` : undefined }, null, 2));
  }
};

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
