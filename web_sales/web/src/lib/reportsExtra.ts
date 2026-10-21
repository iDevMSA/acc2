// تقارير إضافية مستوحاة من مكتبة تقارير الأصيل: الفواتير، المبيعات حسب الصنف والزبون، الضريبة المضافة،
// الموازنة وطبيعة الحسابات، أعمار الديون، تقارير الأصناف المتقدمة، الرواتب، أسعار العملات.

import { REPORTS, ReportContext, ReportDef } from './reports';
import { Account, inPeriod, periodText } from './ledger';
import { PRICE_LEVELS, stockLevels } from './erp';
import {
  AGE_BUCKETS,
  INVOICE_LABELS,
  NATURE_LABELS,
  NOTE_LABELS,
  ageBalance,
  invoiceDue,
  lineShare,
  natureMismatch,
  payrollGross,
} from './trade';
import { formatDate, formatNumber } from './format';

const label = (a?: Account) => (a ? (a.code ? `${a.code} - ${a.name}` : a.name) : '—');
const bal = (c: ReportContext, id: string, upTo?: string) =>
  (c.opsByAccount[id] || []).filter((o) => !upTo || o.date.slice(0, 10) <= upTo).reduce((s, o) => s + o.amountUSD, 0);
const invs = (c: ReportContext) => (c.invoices || []).filter((i) => inPeriod(i.date, c.period));
const toMainInv = (v: number, rate: number) => v / (rate || 1);

const EXTRA: ReportDef[] = [
  /* ───── المبيعات والمشتريات ───── */
  {
    id: 'invoices-register',
    group: 'المبيعات والمشتريات',
    title: 'سجل الفواتير',
    description: 'كل فواتير البيع والشراء والمرتجعات مع الصافي والضريبة والمتبقي',
    usesPeriod: true,
    build: (c) => {
      const rows = invs(c);
      const sum = (k: string) => rows.filter((i) => i.kind === k).reduce((s, i) => s + toMainInv(i.totals.total, i.exchangeRate), 0);
      return {
        title: 'سجل الفواتير',
        subtitle: `${periodText(c.period)} · ${c.mainCurrency}`,
        summary: [
          ['المبيعات', formatNumber(sum('sale'))],
          ['مرتجع البيع', formatNumber(sum('saleReturn'))],
          ['المشتريات', formatNumber(sum('purchase'))],
          ['مرتجع الشراء', formatNumber(sum('purchaseReturn'))],
        ],
        columns: ['النوع', 'الرقم', 'التاريخ', 'الطرف', 'الصافي', 'الضريبة', 'الإجمالي', 'المتبقي', 'العملة'],
        numericColumns: [4, 5, 6, 7],
        rows: rows.map((i) => [
          INVOICE_LABELS[i.kind],
          String(i.number),
          formatDate(i.date),
          c.accountsById[i.partyId]?.name || '',
          i.totals.net,
          i.totals.vat,
          i.totals.total,
          invoiceDue(i),
          i.currency,
        ]),
      };
    },
  },
  {
    id: 'sales-by-item',
    group: 'المبيعات والمشتريات',
    title: 'المبيعات حسب الصنف',
    description: 'الكمية والقيمة والتكلفة والربح لكل صنف من فواتير البيع (بعد المرتجعات)',
    usesPeriod: true,
    build: (c) => {
      const map = new Map<string, { qty: number; value: number; cost: number }>();
      const costOf = new Map((c.moves || []).filter((m) => m.invoiceId).map((m) => [`${m.invoiceId}|${m.itemId}`, m.unitCost]));
      invs(c)
        .filter((i) => i.kind === 'sale' || i.kind === 'saleReturn')
        .forEach((i) => {
          const sg = i.kind === 'sale' ? 1 : -1;
          i.lines.forEach((l) => {
            if (!l.itemId) return;
            const r = map.get(l.itemId) || { qty: 0, value: 0, cost: 0 };
            const q = l.qty + (l.bonusQty || 0);
            r.qty += sg * l.qty;
            r.value += sg * toMainInv(lineShare(l, i.discountPct), i.exchangeRate);
            r.cost += sg * q * (costOf.get(`${i.id}|${l.itemId}`) || 0);
            map.set(l.itemId, r);
          });
        });
      const rows = Array.from(map.entries()).sort((a, b) => b[1].value - a[1].value);
      const tv = rows.reduce((s, [, r]) => s + r.value, 0);
      const tc = rows.reduce((s, [, r]) => s + r.cost, 0);
      return {
        title: 'المبيعات حسب الصنف',
        subtitle: `${periodText(c.period)} · ${c.mainCurrency}`,
        summary: [
          ['المبيعات', formatNumber(tv)],
          ['التكلفة', formatNumber(tc)],
          ['مجمل الربح', formatNumber(tv - tc)],
          ['هامش الربح', tv ? `${formatNumber(((tv - tc) / tv) * 100, 1)}%` : '—'],
        ],
        columns: ['الصنف', 'الكمية', 'المبيعات', 'التكلفة', 'الربح', 'الهامش %'],
        numericColumns: [1, 2, 3, 4, 5],
        rows: rows.map(([id, r]) => [
          c.items.find((x) => x.id === id)?.name || id,
          r.qty,
          r.value,
          r.cost,
          r.value - r.cost,
          r.value ? ((r.value - r.cost) / r.value) * 100 : 0,
        ]),
        footer: [['الإجمالي', '', tv, tc, tv - tc, tv ? ((tv - tc) / tv) * 100 : 0]],
      };
    },
  },
  {
    id: 'sales-by-customer',
    group: 'المبيعات والمشتريات',
    title: 'المبيعات حسب الزبون',
    description: 'صافي فواتير البيع والمرتجعات والمتبقي لكل زبون',
    usesPeriod: true,
    build: (c) => {
      const map = new Map<string, { count: number; sales: number; returns: number; due: number }>();
      invs(c)
        .filter((i) => i.kind === 'sale' || i.kind === 'saleReturn')
        .forEach((i) => {
          const r = map.get(i.partyId) || { count: 0, sales: 0, returns: 0, due: 0 };
          const v = toMainInv(i.totals.total, i.exchangeRate);
          if (i.kind === 'sale') {
            r.count += 1;
            r.sales += v;
            r.due += toMainInv(invoiceDue(i), i.exchangeRate);
          } else r.returns += v;
          map.set(i.partyId, r);
        });
      const rows = Array.from(map.entries()).sort((a, b) => b[1].sales - b[1].returns - (a[1].sales - a[1].returns));
      return {
        title: 'المبيعات حسب الزبون',
        subtitle: `${periodText(c.period)} · ${c.mainCurrency}`,
        columns: ['الزبون', 'عدد الفواتير', 'المبيعات', 'المرتجعات', 'الصافي', 'آجل من الفواتير', 'الرصيد الحالي'],
        numericColumns: [1, 2, 3, 4, 5, 6],
        rows: rows.map(([id, r]) => [c.accountsById[id]?.name || id, r.count, r.sales, r.returns, r.sales - r.returns, r.due, bal(c, id)]),
      };
    },
  },
  {
    id: 'purchases-by-supplier',
    group: 'المبيعات والمشتريات',
    title: 'المشتريات حسب المورد',
    description: 'صافي فواتير الشراء والمرتجعات لكل مورد',
    usesPeriod: true,
    build: (c) => {
      const map = new Map<string, { count: number; buys: number; returns: number }>();
      invs(c)
        .filter((i) => i.kind === 'purchase' || i.kind === 'purchaseReturn')
        .forEach((i) => {
          const r = map.get(i.partyId) || { count: 0, buys: 0, returns: 0 };
          const v = toMainInv(i.totals.total, i.exchangeRate);
          if (i.kind === 'purchase') {
            r.count += 1;
            r.buys += v;
          } else r.returns += v;
          map.set(i.partyId, r);
        });
      return {
        title: 'المشتريات حسب المورد',
        subtitle: `${periodText(c.period)} · ${c.mainCurrency}`,
        columns: ['المورد', 'عدد الفواتير', 'المشتريات', 'المرتجعات', 'الصافي', 'الرصيد الحالي'],
        numericColumns: [1, 2, 3, 4, 5],
        rows: Array.from(map.entries()).map(([id, r]) => [c.accountsById[id]?.name || id, r.count, r.buys, r.returns, r.buys - r.returns, bal(c, id)]),
      };
    },
  },
  {
    id: 'vat-report',
    group: 'المبيعات والمشتريات',
    title: 'كشف الضريبة المضافة',
    description: 'ضريبة المبيعات (المخرجات) مقابل ضريبة المشتريات (المدخلات) والصافي المستحق',
    usesPeriod: true,
    build: (c) => {
      const rows = invs(c).filter((i) => i.totals.vat);
      const signed = (k: string) => (k === 'sale' || k === 'purchaseReturn' ? 1 : -1);
      const out = rows.filter((i) => i.kind === 'sale' || i.kind === 'saleReturn').reduce((s, i) => s + signed(i.kind) * toMainInv(i.totals.vat, i.exchangeRate), 0);
      const inp = rows.filter((i) => i.kind === 'purchase' || i.kind === 'purchaseReturn').reduce((s, i) => s - signed(i.kind) * toMainInv(i.totals.vat, i.exchangeRate), 0);
      const notesVat = (c.notes || [])
        .filter((n) => inPeriod(n.date, c.period) && n.vatPct)
        .reduce((s, n) => s + (n.kind === 'debit' ? 1 : -1) * ((n.amount * n.vatPct) / 100 / (n.exchangeRate || 1)), 0);
      return {
        title: 'كشف الضريبة المضافة',
        subtitle: `${periodText(c.period)} · ${c.mainCurrency}`,
        summary: [
          ['ضريبة المبيعات', formatNumber(out + notesVat)],
          ['ضريبة المشتريات', formatNumber(inp)],
          ['الصافي المستحق', formatNumber(out + notesVat - inp)],
        ],
        columns: ['النوع', 'الرقم', 'التاريخ', 'الطرف', 'الصافي الخاضع', 'نسبة الضريبة', 'الضريبة'],
        numericColumns: [4, 5, 6],
        rows: [
          ...rows.map((i) => [
            INVOICE_LABELS[i.kind],
            String(i.number),
            formatDate(i.date),
            c.accountsById[i.partyId]?.name || '',
            toMainInv(i.totals.net, i.exchangeRate),
            i.vatPct,
            toMainInv(i.totals.vat, i.exchangeRate),
          ]),
          ...(c.notes || [])
            .filter((n) => inPeriod(n.date, c.period) && n.vatPct)
            .map((n) => [
              NOTE_LABELS[n.kind],
              String(n.number),
              formatDate(n.date),
              c.accountsById[n.partyId]?.name || '',
              n.amount / (n.exchangeRate || 1),
              n.vatPct,
              (n.amount * n.vatPct) / 100 / (n.exchangeRate || 1),
            ]),
        ],
      };
    },
  },
  {
    id: 'receivables-aging',
    group: 'المبيعات والمشتريات',
    title: 'أعمار الديون',
    description: 'توزيع أرصدة المدينين على فترات الاستحقاق (الأقدم يُسدَّد أولاً)',
    build: (c) => {
      const now = new Date();
      // الذمم فقط: الزبائن والتجار، والحسابات العامة التي ليست صندوقاً أو بنكاً أو مخزوناً أو إيراداً/مصروفاً
      const system = new Set([
        ...c.cashboxes.flatMap((b) => [...b.linkedAccountIds, b.cashAccountId || '']),
        ...c.warehouses.map((w) => w.inventoryAccountId || ''),
      ]);
      const isDebtor = (a: Account) => {
        const role = c.roleOf(a.id);
        if (role === 'customer' || role === 'merchant') return true;
        return role === 'general' && (a.category === 'asset' || a.category === 'other') && a.type !== 'bank' && !system.has(a.id);
      };
      const rows = c.accounts
        .filter(isDebtor)
        .map((a) => ({ a, b: bal(c, a.id) }))
        .filter((r) => r.b > 0.005)
        .map((r) => ({ ...r, ages: ageBalance(c.opsByAccount[r.a.id] || [], now) }))
        .sort((x, y) => y.b - x.b);
      const tot = AGE_BUCKETS.map((_, i) => rows.reduce((s, r) => s + r.ages[i], 0));
      return {
        title: 'أعمار الديون',
        subtitle: `حتى ${formatDate(now)} · ${c.mainCurrency}`,
        summary: [
          ['إجمالي المدينين', formatNumber(rows.reduce((s, r) => s + r.b, 0))],
          ['أكثر من 90 يوماً', formatNumber(tot[3] + tot[4])],
        ],
        columns: ['الحساب', ...AGE_BUCKETS.map((b) => `${b} يوم`), 'الرصيد'],
        numericColumns: [1, 2, 3, 4, 5, 6],
        rows: rows.map((r) => [label(r.a), ...r.ages, r.b]),
        footer: [['الإجمالي', ...tot, rows.reduce((s, r) => s + r.b, 0)]],
      };
    },
  },

  /* ───── الموازنة والرقابة ───── */
  {
    id: 'budget-vs-actual',
    group: 'الرقابة',
    title: 'مقارنة الموازنة مع أرصدة الحسابات',
    description: 'الرصيد الفعلي للفترة مقابل الموازنة المرصودة لكل حساب',
    usesPeriod: true,
    build: (c) => {
      const rows = c.accounts
        .filter((a) => c.accountMeta?.[a.id]?.budget)
        .map((a) => {
          const actual = Math.abs((c.opsByAccount[a.id] || []).filter((o) => inPeriod(o.date, c.period)).reduce((s, o) => s + o.amountUSD, 0));
          const budget = c.accountMeta![a.id].budget || 0;
          return [label(a), budget, actual, budget - actual, budget ? (actual / budget) * 100 : 0] as Array<string | number>;
        });
      return {
        title: 'مقارنة الموازنة مع أرصدة الحسابات',
        subtitle: `${periodText(c.period)} · ${c.mainCurrency}`,
        columns: ['الحساب', 'الموازنة', 'الفعلي', 'المتبقي', 'نسبة التنفيذ %'],
        numericColumns: [1, 2, 3, 4],
        rows,
      };
    },
  },
  {
    id: 'over-budget',
    group: 'الرقابة',
    title: 'الحسابات التي تعدّت الموازنة',
    description: 'حسابات تجاوز رصيدها الموازنة المرصودة',
    build: (c) => ({
      title: 'الحسابات التي تعدّت الموازنة',
      subtitle: c.mainCurrency,
      columns: ['الحساب', 'الموازنة', 'الرصيد', 'التجاوز'],
      numericColumns: [1, 2, 3],
      rows: c.accounts
        .filter((a) => c.accountMeta?.[a.id]?.budget && Math.abs(bal(c, a.id)) > (c.accountMeta[a.id].budget || 0))
        .map((a) => {
          const b = Math.abs(bal(c, a.id));
          const bu = c.accountMeta![a.id].budget || 0;
          return [label(a), bu, b, b - bu];
        }),
    }),
  },
  {
    id: 'nature-mismatch',
    group: 'الرقابة',
    title: 'حسابات اختلفت أرصدتها عن طبيعتها',
    description: 'حساب مدين فقط برصيد دائن أو العكس',
    build: (c) => ({
      title: 'حسابات اختلفت أرصدتها عن طبيعتها',
      subtitle: c.mainCurrency,
      columns: ['الحساب', 'الطبيعة', 'الرصيد', 'الحالة'],
      numericColumns: [2],
      rows: c.accounts
        .filter((a) => natureMismatch(c.accountMeta?.[a.id]?.nature, bal(c, a.id)))
        .map((a) => {
          const b = bal(c, a.id);
          return [label(a), NATURE_LABELS[c.accountMeta![a.id].nature!], Math.abs(b), b >= 0 ? 'لنا' : 'لهم'];
        }),
    }),
  },
  {
    id: 'frozen-accounts',
    group: 'الرقابة',
    title: 'الحسابات المجمّدة',
    description: 'حسابات ممنوع إدخال حركات عليها',
    build: (c) => ({
      title: 'الحسابات المجمّدة',
      columns: ['الحساب', 'الرصيد', 'ملاحظات'],
      numericColumns: [1],
      rows: c.accounts.filter((a) => c.accountMeta?.[a.id]?.frozen).map((a) => [label(a), bal(c, a.id), c.accountMeta![a.id].note || '']),
    }),
  },
  {
    id: 'over-credit-limit',
    group: 'الرقابة',
    title: 'زبائن تجاوزوا حد الائتمان',
    description: 'الرصيد المدين أكبر من حد الائتمان المحدد للحساب',
    build: (c) => ({
      title: 'زبائن تجاوزوا حد الائتمان',
      subtitle: c.mainCurrency,
      columns: ['الحساب', 'حد الائتمان', 'الرصيد', 'التجاوز'],
      numericColumns: [1, 2, 3],
      rows: c.accounts
        .filter((a) => c.accountMeta?.[a.id]?.creditLimit && bal(c, a.id) > (c.accountMeta[a.id].creditLimit || 0))
        .map((a) => {
          const lim = c.accountMeta![a.id].creditLimit || 0;
          return [label(a), lim, bal(c, a.id), bal(c, a.id) - lim];
        }),
    }),
  },

  /* ───── الأصناف ───── */
  {
    id: 'price-list',
    group: 'المخازن',
    title: 'قائمة الأسعار',
    description: 'أسعار البيع الخمسة وسعر الشراء لكل صنف',
    build: (c) => ({
      title: 'قائمة الأسعار',
      subtitle: c.mainCurrency,
      columns: ['الصنف', 'الرمز', 'الوحدة', ...PRICE_LEVELS, 'سعر الشراء'],
      numericColumns: [3, 4, 5, 6, 7, 8],
      rows: c.items.map((i) => [i.name, i.code || '', i.unit || '', i.price || 0, ...[0, 1, 2, 3].map((k) => i.prices?.[k] || ''), i.cost || '']),
    }),
  },
  {
    id: 'stock-over-max',
    group: 'المخازن',
    title: 'أصناف فوق الحد الأقصى',
    description: 'أصناف رصيدها أكبر من الحد الأقصى المحدد',
    build: (c) => {
      const lv = stockLevels(c.moves);
      return {
        title: 'أصناف فوق الحد الأقصى',
        columns: ['الصنف', 'الرصيد', 'الحد الأقصى', 'الزيادة'],
        numericColumns: [1, 2, 3],
        rows: c.items
          .map((i) => ({ i, q: c.warehouses.reduce((s, w) => s + lv.of(w.id, i.id).qty, 0) }))
          .filter((r) => r.i.maxQty && r.q > r.i.maxQty)
          .map((r) => [r.i.name, r.q, r.i.maxQty || 0, r.q - (r.i.maxQty || 0)]),
      };
    },
  },
  {
    id: 'stock-reorder',
    group: 'المخازن',
    title: 'أصناف بلغت حد إعادة الطلب',
    description: 'الكمية المقترح طلبها للوصول للحد الأقصى',
    build: (c) => {
      const lv = stockLevels(c.moves);
      return {
        title: 'أصناف بلغت حد إعادة الطلب',
        columns: ['الصنف', 'الرصيد', 'حد إعادة الطلب', 'الحد الأقصى', 'الكمية المقترحة'],
        numericColumns: [1, 2, 3, 4],
        rows: c.items
          .map((i) => ({ i, q: c.warehouses.reduce((s, w) => s + lv.of(w.id, i.id).qty, 0) }))
          .filter((r) => r.i.reorderQty && r.q <= r.i.reorderQty)
          .map((r) => [r.i.name, r.q, r.i.reorderQty || 0, r.i.maxQty || '', Math.max((r.i.maxQty || r.i.reorderQty || 0) - r.q, 0)]),
      };
    },
  },
  {
    id: 'stock-negative',
    group: 'المخازن',
    title: 'الفحص على الرصيد السالب للأصناف',
    description: 'أصناف رصيدها سالب في أي مخزن (خطأ إدخال)',
    build: (c) => {
      const lv = stockLevels(c.moves);
      const rows: Array<Array<string | number>> = [];
      c.items.forEach((i) =>
        c.warehouses.forEach((w) => {
          const q = lv.of(w.id, i.id).qty;
          if (q < -1e-9) rows.push([i.name, w.name, q]);
        }),
      );
      return { title: 'الفحص على الرصيد السالب للأصناف', columns: ['الصنف', 'المخزن', 'الرصيد'], numericColumns: [2], rows };
    },
  },
  {
    id: 'items-no-invoices',
    group: 'المخازن',
    title: 'الأصناف بدون فواتير',
    description: 'أصناف لم تُبع ولم تُشترَ بفاتورة خلال الفترة (راكدة)',
    usesPeriod: true,
    build: (c) => {
      const used = new Set(invs(c).flatMap((i) => i.lines.map((l) => l.itemId).filter(Boolean)));
      const lv = stockLevels(c.moves);
      return {
        title: 'الأصناف بدون فواتير',
        subtitle: periodText(c.period),
        columns: ['الصنف', 'الرمز', 'الرصيد', 'القيمة'],
        numericColumns: [2, 3],
        rows: c.items
          .filter((i) => !used.has(i.id))
          .map((i) => [
            i.name,
            i.code || '',
            c.warehouses.reduce((s, w) => s + lv.of(w.id, i.id).qty, 0),
            c.warehouses.reduce((s, w) => s + lv.of(w.id, i.id).value, 0),
          ]),
      };
    },
  },
  {
    id: 'item-movement-matrix',
    group: 'المخازن',
    title: 'مصفوفة حركات الأصناف',
    description: 'الوارد والصادر وصافي الحركة لكل صنف خلال الفترة',
    usesPeriod: true,
    build: (c) => {
      const rows = c.items.map((i) => {
        const ms = c.moves.filter((m) => m.itemId === i.id && inPeriod(m.date, c.period));
        const inQ = ms.filter((m) => m.type === 'in' || (m.type === 'adjust' && m.qty > 0)).reduce((s, m) => s + Math.abs(m.qty), 0);
        const outQ = ms.filter((m) => m.type === 'out' || (m.type === 'adjust' && m.qty < 0)).reduce((s, m) => s + Math.abs(m.qty), 0);
        const tr = ms.filter((m) => m.type === 'transfer').reduce((s, m) => s + m.qty, 0);
        return [i.name, ms.length, inQ, outQ, tr, inQ - outQ] as Array<string | number>;
      });
      return {
        title: 'مصفوفة حركات الأصناف',
        subtitle: periodText(c.period),
        columns: ['الصنف', 'عدد الحركات', 'وارد', 'صادر', 'محوّل', 'صافي'],
        numericColumns: [1, 2, 3, 4, 5],
        rows: rows.filter((r) => Number(r[1]) > 0),
      };
    },
  },

  /* ───── الرواتب والعملات ───── */
  {
    id: 'payroll-summary',
    group: 'الرواتب والعملات',
    title: 'ملخص الرواتب والأجور',
    description: 'إجمالي وصافي كشوف الرواتب لكل شهر',
    build: (c) => {
      const rows = (c.payrolls || []).map((p) => {
        const g = p.lines.reduce((s, l) => s + payrollGross(l), 0);
        const d = p.lines.reduce((s, l) => s + (l.deductions || 0), 0);
        const a = p.lines.reduce((s, l) => s + (l.advances || 0), 0);
        const n = p.lines.reduce((s, l) => s + l.net, 0);
        return [p.month, p.lines.length, g, d, a, n] as Array<string | number>;
      });
      return {
        title: 'ملخص الرواتب والأجور',
        subtitle: c.mainCurrency,
        columns: ['الشهر', 'الموظفون', 'الإجمالي', 'الاستقطاعات', 'السلف', 'الصافي'],
        numericColumns: [1, 2, 3, 4, 5],
        rows,
        footer: rows.length ? [['الإجمالي', '', ...[2, 3, 4, 5].map((k) => rows.reduce((s, r) => s + Number(r[k]), 0))]] : undefined,
      };
    },
  },
  {
    id: 'employee-payroll',
    group: 'الرواتب والعملات',
    title: 'رواتب موظف',
    description: 'تفاصيل رواتب موظف عبر الأشهر',
    params: ['account'],
    build: (c) => {
      const rows = (c.payrolls || [])
        .map((p) => ({ p, l: p.lines.find((l) => l.employeeId === c.accountId) }))
        .filter((x) => x.l)
        .map(({ p, l }) => [p.month, l!.basic, l!.allowances, l!.overtime, l!.deductions, l!.advances, l!.net] as Array<string | number>);
      return {
        title: `رواتب ${c.accountsById[c.accountId || '']?.name || ''}`,
        columns: ['الشهر', 'الأساسي', 'البدلات', 'إضافي', 'استقطاعات', 'سلف', 'الصافي'],
        numericColumns: [1, 2, 3, 4, 5, 6],
        rows,
      };
    },
  },
  {
    id: 'currency-rates',
    group: 'الرواتب والعملات',
    title: 'أسعار العملات',
    description: 'سجل أسعار الصرف المسجّلة حسب التاريخ',
    usesPeriod: true,
    build: (c) => ({
      title: 'أسعار العملات',
      subtitle: `${periodText(c.period)} · مقابل ${c.mainCurrency}`,
      columns: ['العملة', 'التاريخ', 'السعر'],
      numericColumns: [2],
      rows: (c.rates || []).filter((r) => inPeriod(r.date, c.period)).map((r) => [r.currency, r.date.slice(0, 16).replace('T', ' '), r.rate]),
    }),
  },
];

export const ALL_REPORTS: ReportDef[] = [...REPORTS, ...EXTRA];
export const ALL_REPORT_GROUPS = Array.from(new Set(ALL_REPORTS.map((r) => r.group)));
