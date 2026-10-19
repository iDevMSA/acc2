// تصدير التقارير: Excel (CSV بترميز UTF-8 يفتحه Excel بالعربية) و PDF (طباعة منسّقة → حفظ كـ PDF).

import { CompanyInfo } from './ledger';

export interface ReportTable {
  title: string;
  subtitle?: string;
  columns: string[];
  /** الأعمدة الرقمية (بالترتيب) تُحاذى لليسار في الطباعة */
  numericColumns?: number[];
  rows: Array<Array<string | number>>;
  /** صفوف إجمالي تظهر بخط عريض في الأسفل */
  footer?: Array<Array<string | number>>;
  /** ملخص أعلى الجدول: [العنوان، القيمة] */
  summary?: Array<[string, string]>;
  /** أقسام إضافية (لتقارير متعددة الجداول مثل دفتر الأستاذ) */
  sections?: Array<{ heading: string; rows: Array<Array<string | number>>; footer?: Array<Array<string | number>> }>;
}

const fmtCell = (v: string | number) => (typeof v === 'number' ? v.toFixed(2) : v ?? '');

const safeName = (s: string) => s.replace(/[\\/:*?"<>|]+/g, '-').trim() || 'report';

const download = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};

export const exportCsv = (t: ReportTable) => {
  const esc = (v: string | number) => {
    const s = String(fmtCell(v));
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines: string[] = [esc(t.title)];
  if (t.subtitle) lines.push(esc(t.subtitle));
  t.summary?.forEach(([k, v]) => lines.push(`${esc(k)},${esc(v)}`));
  lines.push('');
  lines.push(t.columns.map(esc).join(','));
  const pushRows = (rows?: Array<Array<string | number>>) => rows?.forEach((r) => lines.push(r.map(esc).join(',')));
  if (t.sections?.length) {
    t.sections.forEach((s) => {
      lines.push(esc(s.heading));
      pushRows(s.rows);
      pushRows(s.footer);
      lines.push('');
    });
  } else {
    pushRows(t.rows);
    pushRows(t.footer);
  }
  download(new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' }), `${safeName(t.title)}.csv`);
};

const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

const tableHtml = (t: ReportTable, rows: Array<Array<string | number>>, footer?: Array<Array<string | number>>) => {
  const numeric = new Set(t.numericColumns || []);
  const cell = (v: string | number, i: number, tag = 'td') =>
    `<${tag} class="${numeric.has(i) ? 'n' : ''}">${escapeHtml(String(fmtCell(v)))}</${tag}>`;
  return `<table><thead><tr>${t.columns.map((c, i) => cell(c, i, 'th')).join('')}</tr></thead>
<tbody>${rows.map((r) => `<tr>${r.map((v, i) => cell(v, i)).join('')}</tr>`).join('')}</tbody>
${footer?.length ? `<tfoot>${footer.map((r) => `<tr>${r.map((v, i) => cell(v, i)).join('')}</tr>`).join('')}</tfoot>` : ''}
</table>`;
};

/** يفتح نافذة الطباعة بتقرير منسّق (رأس الشركة، الملخص، الجدول) — اختر "حفظ كـ PDF" */
export const printReport = (t: ReportTable, company?: CompanyInfo) => {
  const printed = new Intl.DateTimeFormat('ar-u-nu-latn-ca-gregory', { dateStyle: 'medium', timeStyle: 'short' }).format(
    new Date(),
  );
  const body = t.sections?.length
    ? t.sections.map((s) => `<h3>${escapeHtml(s.heading)}</h3>${tableHtml(t, s.rows, s.footer)}`).join('')
    : tableHtml(t, t.rows, t.footer);
  const html = `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>${escapeHtml(t.title)}</title>
<style>
@page{size:A4;margin:14mm}
*{box-sizing:border-box}
body{font-family:"IBM Plex Sans Arabic","Segoe UI",Tahoma,sans-serif;color:#0f172a;font-size:11px;margin:0}
header{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #1d38c9;padding-bottom:10px;margin-bottom:12px}
.co b{font-size:15px;display:block}.co span{color:#64748b;display:block}
.tt{text-align:left}.tt .badge{background:#1d38c9;color:#fff;border-radius:6px;padding:5px 12px;font-weight:700;font-size:13px;display:inline-block}
.tt small{display:block;color:#64748b;margin-top:4px}
.sum{display:flex;gap:8px;flex-wrap:wrap;margin:0 0 12px}
.sum div{border:1px solid #e5e9f0;border-radius:8px;padding:6px 10px;min-width:120px}
.sum div span{display:block;color:#64748b;font-size:10px}.sum div b{font-size:13px;direction:ltr;unicode-bidi:isolate}
h3{font-size:12px;margin:14px 0 6px;color:#1d38c9}
table{width:100%;border-collapse:collapse;margin-bottom:8px}
th{background:#eef4ff;color:#1e2f80;font-weight:700;text-align:right;padding:6px 8px;border:1px solid #d3d9e3}
td{padding:5px 8px;border:1px solid #e5e9f0;text-align:right}
tbody tr:nth-child(even) td{background:#f8fafc}
.n{text-align:left;direction:ltr;unicode-bidi:isolate;font-variant-numeric:tabular-nums}
tfoot td{font-weight:700;background:#f1f5f9}
footer{margin-top:16px;color:#94a3b8;font-size:9px;display:flex;justify-content:space-between}
</style></head><body>
<header><div class="co"><b>${escapeHtml(company?.name || 'منصتي المحاسبية')}</b>
${company?.phone ? `<span>${escapeHtml(company.phone)}</span>` : ''}${company?.address ? `<span>${escapeHtml(company.address)}</span>` : ''}</div>
<div class="tt"><span class="badge">${escapeHtml(t.title)}</span>${t.subtitle ? `<small>${escapeHtml(t.subtitle)}</small>` : ''}<small>تاريخ الطباعة: ${printed}</small></div></header>
${t.summary?.length ? `<div class="sum">${t.summary.map(([k, v]) => `<div><span>${escapeHtml(k)}</span><b>${escapeHtml(v)}</b></div>`).join('')}</div>` : ''}
${body}
<footer><span>منصتي المحاسبية</span><span>${escapeHtml(t.title)}</span></footer>
</body></html>`;

  const frame = document.createElement('iframe');
  frame.style.cssText = 'position:fixed;width:0;height:0;border:0;left:0;bottom:0';
  document.body.appendChild(frame);
  const doc = frame.contentDocument!;
  doc.open();
  doc.write(html);
  doc.close();
  const go = () => {
    frame.contentWindow?.focus();
    frame.contentWindow?.print();
    setTimeout(() => frame.remove(), 60_000);
  };
  // ننتظر تحميل الخط قبل الطباعة إن أمكن
  const fonts = (doc as any).fonts;
  if (fonts?.ready) fonts.ready.then(() => setTimeout(go, 50));
  else setTimeout(go, 300);
};

export const shareWhatsApp = (text: string, phone?: string) => {
  const digits = (phone || '').replace(/[^0-9]/g, '');
  const url = `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
  window.open(url, '_blank', 'noopener');
};
