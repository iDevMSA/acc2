// تصدير التقارير: PDF (طباعة منسّقة ← حفظ كـ PDF). ملفات Excel الحقيقية (.xlsx) في lib/excel.ts.

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

/** تنزيل نص كملف (ملفات الفوترة الإلكترونية XML/JSON) */
export const downloadFile = (name: string, content: string, type: string) => download(new Blob([content], { type: `${type};charset=utf-8` }), name);

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

const money = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** خلية مطبوعة: الأرقام بفواصل الآلاف، والسالب بالأحمر */
const printCell = (v: string | number, numeric: boolean, tag = 'td') => {
  if (typeof v === 'number') {
    const n = Number.isFinite(v) ? v : 0;
    return `<${tag} class="n${n < 0 ? ' neg' : ''}">${money.format(n)}</${tag}>`;
  }
  const text = v ?? '';
  return `<${tag} class="${numeric ? 'n' : ''}">${text === '' ? '<span class="dash">—</span>' : escapeHtml(String(text))}</${tag}>`;
};

const tableHtml = (t: ReportTable, rows: Array<Array<string | number>>, footer?: Array<Array<string | number>>) => {
  const numeric = new Set(t.numericColumns || []);
  const head = `<thead><tr>${t.columns.map((c, i) => `<th class="${numeric.has(i) ? 'n' : ''}">${escapeHtml(c)}</th>`).join('')}</tr></thead>`;
  const body = rows.length
    ? rows.map((r) => `<tr>${r.map((v, i) => printCell(v, numeric.has(i))).join('')}</tr>`).join('')
    : `<tr><td colspan="${t.columns.length}" class="empty">لا توجد بيانات</td></tr>`;
  const foot = footer?.length
    ? `<tfoot>${footer.map((r) => `<tr>${r.map((v, i) => printCell(v, numeric.has(i))).join('')}</tr>`).join('')}</tfoot>`
    : '';
  return `<table>${head}<tbody>${body}</tbody>${foot}</table>`;
};

/**
 * يفتح نافذة الطباعة بتقرير منسّق بهوية المنصة (ترويسة الشركة، بطاقات الملخص، جدول بترقيم صفحات)
 * — يختار المستخدم "حفظ كـ PDF". المحتوى نفس ما يظهر في الصفحة حرفياً.
 */
export const printReport = (t: ReportTable, company?: CompanyInfo) => {
  const now = new Date();
  const printed = new Intl.DateTimeFormat('ar-u-nu-latn-ca-gregory', { dateStyle: 'long', timeStyle: 'short' }).format(now);
  const coName = company?.name || 'المنصة المحاسبية';
  const initial = coName.trim().charAt(0);
  const rowCount = t.sections?.length ? t.sections.reduce((s, x) => s + x.rows.length, 0) : t.rows.length;
  const body = t.sections?.length
    ? t.sections
        .map((s) => `<section><h3><span></span>${escapeHtml(s.heading)}</h3>${tableHtml(t, s.rows, s.footer)}</section>`)
        .join('')
    : tableHtml(t, t.rows, t.footer);
  const contact = [company?.phone, company?.email, company?.address].filter(Boolean).map((x) => escapeHtml(x!));

  const html = `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>${escapeHtml(t.title)} — ${escapeHtml(coName)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Arabic:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>
@page{size:A4;margin:14mm 12mm 16mm}
@page{@bottom-center{content:"صفحة " counter(page) " من " counter(pages);font:9px "IBM Plex Sans Arabic",Tahoma,sans-serif;color:#94a3b8}}
*{box-sizing:border-box;-webkit-print-color-adjust:exact;print-color-adjust:exact}
html,body{margin:0;padding:0}
body{font-family:"IBM Plex Sans Arabic","Segoe UI",Tahoma,sans-serif;color:#0f172a;font-size:10.5px;line-height:1.5}
.band{height:6px;border-radius:3px;background:linear-gradient(90deg,#1e2f80,#2349ea 55%,#5c8dfd)}
header{display:flex;justify-content:space-between;align-items:center;gap:16px;padding:14px 2px 12px}
.co{display:flex;align-items:center;gap:10px}
.logo{width:42px;height:42px;border-radius:10px;background:linear-gradient(135deg,#2349ea,#1e2f80);color:#fff;display:grid;place-items:center;font-size:20px;font-weight:700}
.co b{display:block;font-size:15px;font-weight:700}
.co small{display:block;color:#64748b;font-size:9.5px}
.doc{text-align:left}
.doc .title{font-size:19px;font-weight:700;color:#1e2f80;margin:0}
.doc .sub{color:#475569;font-size:10px;margin-top:2px;max-width:330px}
.meta{display:flex;justify-content:space-between;color:#64748b;font-size:9px;border-top:1px solid #e5e9f0;border-bottom:1px solid #e5e9f0;padding:6px 2px;margin-bottom:12px}
.sum{display:grid;grid-template-columns:repeat(${Math.min(t.summary?.length || 1, 4)},1fr);gap:8px;margin:0 0 14px}
.card{border:1px solid #e5e9f0;border-radius:10px;padding:8px 12px;background:#f8fafc;position:relative;overflow:hidden}
.card:before{content:"";position:absolute;inset-inline-start:0;top:0;bottom:0;width:3px;background:#2349ea}
.card span{display:block;color:#64748b;font-size:9px}
.card b{display:block;font-size:14px;font-weight:700;direction:ltr;unicode-bidi:isolate;text-align:right;margin-top:2px}
section{margin-bottom:14px;break-inside:auto}
h3{display:flex;align-items:center;gap:6px;font-size:11.5px;color:#1e2f80;margin:12px 0 6px}
h3 span{width:4px;height:13px;border-radius:2px;background:#2349ea;display:inline-block}
table{width:100%;border-collapse:separate;border-spacing:0;border:1px solid #d3d9e3;border-radius:8px;overflow:hidden}
thead{display:table-header-group}
tfoot{display:table-footer-group}
tr{break-inside:avoid}
th{background:#1e2f80;color:#fff;font-weight:600;font-size:9.5px;text-align:right;padding:7px 8px;white-space:nowrap}
td{padding:6px 8px;border-top:1px solid #edf0f5;text-align:right;vertical-align:top}
tbody tr:nth-child(even) td{background:#f7f9fc}
.n{text-align:left;direction:ltr;unicode-bidi:isolate;font-variant-numeric:tabular-nums;white-space:nowrap}
.neg{color:#b42318}
.dash{color:#cbd5e1}
tfoot td{background:#eef4ff;font-weight:700;border-top:2px solid #2349ea;color:#1e2f80}
.empty{text-align:center;color:#94a3b8;padding:18px}
footer{margin-top:18px;display:flex;justify-content:space-between;align-items:center;color:#94a3b8;font-size:8.5px;border-top:1px solid #e5e9f0;padding-top:6px}
.sign{display:flex;gap:40px;margin-top:28px;color:#475569;font-size:9.5px}
.sign div{flex:1;border-top:1px dashed #cbd5e1;padding-top:4px;text-align:center}
</style></head><body>
<div class="band"></div>
<header>
  <div class="co"><div class="logo">${escapeHtml(initial)}</div><div><b>${escapeHtml(coName)}</b>${contact.length ? `<small>${contact.join(' · ')}</small>` : ''}</div></div>
  <div class="doc"><p class="title">${escapeHtml(t.title)}</p>${t.subtitle ? `<div class="sub">${escapeHtml(t.subtitle)}</div>` : ''}</div>
</header>
<div class="meta"><span>تاريخ الإصدار: ${printed}</span><span>عدد الأسطر: ${rowCount}</span></div>
${t.summary?.length ? `<div class="sum">${t.summary.map(([k, v]) => `<div class="card"><span>${escapeHtml(k)}</span><b>${escapeHtml(v)}</b></div>`).join('')}</div>` : ''}
${body}
<div class="sign"><div>إعداد</div><div>مراجعة</div><div>اعتماد</div></div>
<footer><span>${escapeHtml(coName)} — ${escapeHtml(t.title)}</span><span>صادر من المنصة المحاسبية</span></footer>
</body></html>`;

  const frame = document.createElement('iframe');
  frame.style.cssText = 'position:fixed;width:0;height:0;border:0;left:0;bottom:0';
  document.body.appendChild(frame);
  const doc = frame.contentDocument!;
  doc.open();
  doc.write(html);
  doc.close();
  let done = false;
  const go = () => {
    if (done) return;
    done = true;
    frame.contentWindow?.focus();
    frame.contentWindow?.print();
    setTimeout(() => frame.remove(), 60_000);
  };
  // ننتظر تحميل الخط العربي (حتى ثانيتين) ثم نطبع
  const fonts = (doc as any).fonts;
  setTimeout(go, 2000);
  if (fonts?.ready) {
    frame.addEventListener('load', () => fonts.ready.then(() => setTimeout(go, 100)));
  }
};


export const shareWhatsApp = (text: string, phone?: string) => {
  const digits = (phone || '').replace(/[^0-9]/g, '');
  const url = `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
  window.open(url, '_blank', 'noopener');
};
