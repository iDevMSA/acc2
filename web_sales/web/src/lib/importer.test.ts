import { autoMap, IMPORT_KINDS, parseDate, parseNumber, prepareImport } from './importer';
import { parseCsv } from './excel';

test('numbers in Arabic, Persian and western formats', () => {
  expect(parseNumber('١٬٢٣٤٫٥')).toBe(1234.5);
  expect(parseNumber('1,234.50')).toBe(1234.5);
  expect(parseNumber('12,5')).toBe(12.5);
  expect(parseNumber('15%')).toBe(15);
  expect(parseNumber('(200)')).toBe(-200);
  expect(parseNumber('۲۵')).toBe(25);
  expect(parseNumber('1,500 ر.س')).toBe(1500);
  expect(parseNumber('abc')).toBeNaN();
});

test('dates', () => {
  expect(parseDate('30/06/2027')).toBe('2027-06-30');
  expect(parseDate('2027-6-3')).toBe('2027-06-03');
  expect(parseDate('46568')).toBe('2027-06-30');
  expect(parseDate('غداً')).toBeNull();
});

test('auto mapping prefers exact headers', () => {
  const m = autoMap(['اسم الصنف', 'سعر الشراء', 'السعر', 'الباركود', 'ملاحظات'], IMPORT_KINDS.items.fields);
  expect(m).toMatchObject({ name: 0, cost: 1, price: 2, barcode: 3, unit: -1 });
  const p = autoMap(['Customer', 'Mobile', 'Opening Balance'], IMPORT_KINDS.customers.fields);
  expect(p).toMatchObject({ name: 0, phone: 1, opening: 2, code: -1 });
});

test('prepareImport: errors, duplicates in file, existing records', () => {
  const mapping = { name: 0, code: 1, phone: 2, address: -1, opening: 3 };
  const rows = [
    ['مؤسسة النخبة', 'C1', '0500000001', '1500'],
    ['', 'C2', '', ''],
    ['شركة الأمل', 'C3', '', 'كثير'],
    ['مؤسسة النخبه', 'C9', '', ''],
    ['محمد', '', '+966 50 000 0007', ''],
    ['جديد', 'C5', '', '-20'],
  ];
  const existing = [{ id: '0007', name: 'محمد العتيبي', phone: '0500000007' }];
  const out = prepareImport('customers', rows, mapping, existing, 'skip');
  expect(out.map((r) => r.status)).toEqual(['new', 'error', 'error', 'skip', 'skip', 'new']);
  expect(out[1].message).toContain('الاسم مطلوب');
  expect(out[2].message).toContain('ليس رقماً');
  expect(out[3].message).toBe('مكرر في الملف');
  expect(out[4]).toMatchObject({ existingId: '0007', message: 'موجود مسبقاً' });
  expect(out[0].values).toMatchObject({ name: 'مؤسسة النخبة', opening: 1500 });
  expect(prepareImport('customers', rows, mapping, existing, 'update')[4].status).toBe('update');
});

test('CSV with quotes, semicolons and BOM', () => {
  expect(parseCsv('﻿الاسم;السعر\n"صنف ""خاص""";1,5\n\nب;2\n')).toEqual([
    ['الاسم', 'السعر'],
    ['صنف "خاص"', '1,5'],
    ['ب', '2'],
  ]);
});
