// ملفات Excel الحقيقية (.xlsx): تصدير التقارير بتنسيق عربي من اليمين لليسار، وقراءة ملفات الاستيراد.
// مكتبة exceljs كبيرة فتُحمَّل عند الحاجة فقط (import ديناميكي) ولا تدخل في الحزمة الأولى.
import type { Workbook, Worksheet } from 'exceljs';
import { CompanyInfo } from './ledger';
import { ReportTable } from './export';

const loadExcel = async () => {
  const mod: any = await import('exceljs');
  return (mod.default || mod) as typeof import('exceljs');
};

const safeName = (s: string) => s.replace(/[\\/:*?"<>|]+/g, '-').trim() || 'report';

const save = async (wb: Workbook, name: string) => {
  const buf = await wb.xlsx.writeBuffer();
  const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${safeName(name)}.xlsx`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};

const BRAND = 'FF1E2F80';
const FONT = 'Arial';

const styleHeader = (ws: Worksheet, rowNo: number, count: number) => {
  const row = ws.getRow(rowNo);
  for (let c = 1; c <= count; c++) {
    const cell = row.getCell(c);
    cell.font = { name: FONT, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BRAND } };
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
  }
  row.height = 22;
};

const NUM_FMT = '#,##0.00;[Red]-#,##0.00';

/** يبني ورقة التقرير: العنوان والشركة والملخص ثم الجدول بأرقام حقيقية (قابلة للجمع في Excel) */
export const reportSheet = (wb: Workbook, t: ReportTable, company?: CompanyInfo, sheetName = 'التقرير') => {
  const ws = wb.addWorksheet(sheetName.slice(0, 31), { views: [{ rightToLeft: true, state: 'frozen', ySplit: 0 }] });
  const n = Math.max(t.columns.length, 2);
  const numeric = new Set(t.numericColumns || []);
  let r = 1;
  const title = ws.getRow(r);
  title.getCell(1).value = t.title;
  title.getCell(1).font = { name: FONT, bold: true, size: 15, color: { argb: BRAND } };
  ws.mergeCells(r, 1, r, n);
  r++;
  const sub = [company?.name, t.subtitle].filter(Boolean).join(' · ');
  if (sub) {
    ws.getRow(r).getCell(1).value = sub;
    ws.getRow(r).getCell(1).font = { name: FONT, color: { argb: 'FF475569' } };
    ws.mergeCells(r, 1, r, n);
    r++;
  }
  if (t.summary?.length) {
    r++;
    t.summary.forEach(([k, v]) => {
      const row = ws.getRow(r++);
      row.getCell(1).value = k;
      row.getCell(1).font = { name: FONT, color: { argb: 'FF64748B' } };
      row.getCell(2).value = v;
      row.getCell(2).font = { name: FONT, bold: true };
    });
  }
  r++;
  const headerRow = r;
  ws.getRow(r).values = t.columns;
  styleHeader(ws, r, t.columns.length);
  r++;
  ws.views = [{ rightToLeft: true, state: 'frozen', ySplit: headerRow }];

  const put = (rows: Array<Array<string | number>> | undefined, bold = false) =>
    rows?.forEach((vals) => {
      const row = ws.getRow(r++);
      vals.forEach((v, i) => {
        const cell = row.getCell(i + 1);
        cell.value = typeof v === 'number' ? (Number.isFinite(v) ? v : 0) : v ?? '';
        cell.font = { name: FONT, bold };
        if (typeof v === 'number' || numeric.has(i)) cell.numFmt = NUM_FMT;
        if (bold) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEEF4FF' } };
      });
    });

  if (t.sections?.length)
    t.sections.forEach((s) => {
      const h = ws.getRow(r);
      h.getCell(1).value = s.heading;
      h.getCell(1).font = { name: FONT, bold: true, color: { argb: BRAND } };
      ws.mergeCells(r, 1, r, n);
      r++;
      put(s.rows);
      put(s.footer, true);
      r++;
    });
  else {
    put(t.rows);
    put(t.footer, true);
  }

  // عرض الأعمدة حسب أطول قيمة
  t.columns.forEach((c, i) => {
    let w = c.length;
    const all = t.sections?.length ? t.sections.flatMap((s) => [...s.rows, ...(s.footer || [])]) : [...t.rows, ...(t.footer || [])];
    all.slice(0, 500).forEach((row) => {
      const v = row[i];
      w = Math.max(w, typeof v === 'number' ? 12 : String(v ?? '').length);
    });
    ws.getColumn(i + 1).width = Math.min(Math.max(w + 2, 10), 60);
  });
  if (!t.sections?.length && t.rows.length) ws.autoFilter = { from: { row: headerRow, column: 1 }, to: { row: headerRow, column: t.columns.length } };
  return ws;
};

export const exportXlsx = async (t: ReportTable, company?: CompanyInfo) => {
  const ExcelJS = await loadExcel();
  const wb = new ExcelJS.Workbook();
  wb.creator = company?.name || 'المنصة المحاسبية';
  wb.created = new Date();
  reportSheet(wb, t, company);
  await save(wb, t.title);
};

/* ───────── الاستيراد ───────── */

export interface SheetData {
  headers: string[];
  rows: string[][];
}

const cellText = (v: any): string => {
  if (v == null) return '';
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === 'object') {
    if ('result' in v) return cellText(v.result);
    if ('text' in v) return String(v.text);
    if ('richText' in v) return v.richText.map((p: any) => p.text).join('');
    if ('hyperlink' in v) return String(v.text || v.hyperlink);
    return '';
  }
  return String(v).trim();
};

/** CSV بسيط يدعم علامات التنصيص والفاصلة أو الفاصلة المنقوطة */
export const parseCsv = (text: string): string[][] => {
  const src = text.replace(/^﻿/, '');
  const firstLine = src.split(/\r?\n/, 1)[0] || '';
  const sep = (firstLine.match(/;/g) || []).length > (firstLine.match(/,/g) || []).length ? ';' : ',';
  const rows: string[][] = [];
  let row: string[] = [];
  let cur = '';
  let q = false;
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (q) {
      if (c === '"' && src[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (c === '"') q = false;
      else cur += c;
    } else if (c === '"') q = true;
    else if (c === sep) {
      row.push(cur.trim());
      cur = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && src[i + 1] === '\n') i++;
      row.push(cur.trim());
      rows.push(row);
      row = [];
      cur = '';
    } else cur += c;
  }
  if (cur || row.length) {
    row.push(cur.trim());
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => c));
};

/** أول ورقة في الملف: أول صف غير فارغ هو العناوين */
export const readSheet = async (file: File): Promise<SheetData> => {
  let grid: string[][];
  if (/\.csv$/i.test(file.name) || file.type === 'text/csv') grid = parseCsv(await file.text());
  else {
    const ExcelJS = await loadExcel();
    const wb = new ExcelJS.Workbook();
    try {
      await wb.xlsx.load(await file.arrayBuffer());
    } catch {
      throw new Error('تعذّرت قراءة الملف. احفظه بصيغة Excel (.xlsx) أو CSV ثم أعد المحاولة');
    }
    const ws = wb.worksheets[0];
    if (!ws) throw new Error('الملف لا يحتوي على أوراق');
    grid = [];
    ws.eachRow({ includeEmpty: false }, (row) => {
      const vals: string[] = [];
      for (let c = 1; c <= row.cellCount; c++) vals.push(cellText(row.getCell(c).value));
      if (vals.some((v) => v)) grid.push(vals);
    });
  }
  if (!grid.length) throw new Error('الملف فارغ');
  const [headers, ...rows] = grid;
  return { headers: headers.map((h) => h.trim()), rows: rows.map((r) => headers.map((_, i) => (r[i] ?? '').trim())) };
};

/** قالب فارغ بالأعمدة المطلوبة وسطر مثال */
export const downloadTemplate = async (name: string, columns: string[], example: Array<string | number>) => {
  const ExcelJS = await loadExcel();
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('البيانات', { views: [{ rightToLeft: true, state: 'frozen', ySplit: 1 }] });
  ws.getRow(1).values = columns;
  styleHeader(ws, 1, columns.length);
  ws.getRow(2).values = example;
  ws.getRow(2).font = { name: FONT, color: { argb: 'FF94A3B8' }, italic: true };
  columns.forEach((c, i) => (ws.getColumn(i + 1).width = Math.max(c.length + 6, 14)));
  await save(wb, name);
};
