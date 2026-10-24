import { amountInWords, fiscalYearOf, formatHijri, formatOfficialDate, integerWords, parseProfile, suggestedProfile } from './localization';
import { buildChartTemplate, planChart } from './coaTemplates';
import { parseAccount } from './ledger';

test('integer words', () => {
  expect(integerWords(0)).toBe('صفر');
  expect(integerWords(15)).toBe('خمسة عشر');
  expect(integerWords(21)).toBe('واحد وعشرون');
  expect(integerWords(305)).toBe('ثلاثمائة وخمسة');
  expect(integerWords(1250)).toBe('ألف ومئتان وخمسون');
  expect(integerWords(3_000)).toBe('ثلاثة آلاف');
  expect(integerWords(11_000)).toBe('أحد عشر ألفاً');
  expect(integerWords(2_500_000)).toBe('مليونان وخمسمائة ألف');
  expect(integerWords(13, true)).toBe('ثلاث عشرة');
});

test('amount in words with currency agreement', () => {
  expect(amountInWords(1250.5, 'SAR')).toBe('فقط ألف ومئتان وخمسون ريالاً سعودياً وخمسون هللة لا غير');
  expect(amountInWords(1, 'KWD')).toBe('فقط دينار كويتي واحد لا غير');
  expect(amountInWords(2, 'EGP')).toBe('فقط جنيهان مصريان لا غير');
  expect(amountInWords(7, 'JOD')).toBe('فقط سبعة دنانير أردنية لا غير');
  expect(amountInWords(100, 'AED')).toBe('فقط مائة درهم إماراتي لا غير');
  expect(amountInWords(2000, 'QAR')).toBe('فقط ألفا ريال قطري لا غير');
  expect(amountInWords(12.345, 'BHD')).toBe('فقط اثنا عشر ديناراً بحرينياً وثلاثمائة وخمسة وأربعون فلساً لا غير');
  expect(amountInWords(3, 'LBP')).toBe('فقط ثلاث ليرات لبنانية لا غير');
  expect(amountInWords(0.25, 'SYP')).toBe('فقط صفر ليرة سورية وخمسة وعشرون قرشاً لا غير');
});

test('fiscal year by start month', () => {
  expect(fiscalYearOf('2026-10-24', 1)).toEqual({ from: '2026-01-01', to: '2026-12-31', label: '2026' });
  expect(fiscalYearOf('2026-10-24', 7)).toEqual({ from: '2026-07-01', to: '2027-06-30', label: '2026/2027' });
  expect(fiscalYearOf('2026-03-15', 4)).toEqual({ from: '2025-04-01', to: '2026-03-31', label: '2025/2026' });
  expect(fiscalYearOf('2028-02-10', 3).to).toBe('2028-02-29');
});

test('hijri and official dates', () => {
  expect(formatHijri('2026-10-24')).toBe('13 جمادى الأولى 1448 هـ');
  expect(formatOfficialDate('2026-10-24', 'both')).toBe('24 أكتوبر 2026 م — 13 جمادى الأولى 1448 هـ');
  expect(formatOfficialDate('2026-10-24')).toBe('24 أكتوبر 2026 م');
});

test('profile defaults and parsing', () => {
  expect(suggestedProfile('EG', 'government')).toMatchObject({ fiscalYearStartMonth: 7, calendar: 'gregorian' });
  expect(suggestedProfile('KW', 'government').fiscalYearStartMonth).toBe(4);
  expect(suggestedProfile('KW', 'private').fiscalYearStartMonth).toBe(1);
  expect(suggestedProfile('SA', 'private').calendar).toBe('both');
  expect(parseProfile({ country: 'JO', fiscalYearStartMonth: 13, sector: 'x' })).toMatchObject({ sector: 'private', fiscalYearStartMonth: 1, activity: 'trading' });
  expect(parseProfile(null)).toBeNull();
});

test('chart templates follow country and activity', () => {
  const sa = buildChartTemplate(suggestedProfile('SA', 'private', 'trading'));
  const names = sa.map((x) => x.name);
  expect(names).toEqual(expect.arrayContaining(['ضريبة القيمة المضافة', 'الزكاة المستحقة', 'مخصص مكافأة نهاية الخدمة', 'تكلفة البضاعة المباعة']));
  const kw = buildChartTemplate(suggestedProfile('KW', 'private', 'services')).map((x) => x.name);
  expect(kw).not.toContain('ضريبة القيمة المضافة');
  expect(kw).not.toContain('تكلفة البضاعة المباعة');
  expect(kw).toContain('إيرادات الخدمات');
  const jo = buildChartTemplate(suggestedProfile('JO', 'private')).map((x) => x.name);
  expect(jo).toContain('الضريبة العامة على المبيعات');
  // كل كود فريد، وكل إعداد يُربط بحساب واحد فقط
  for (const p of ['SA', 'AE', 'KW', 'BH', 'QA', 'EG', 'JO', 'LB', 'SY'])
    for (const act of ['trading', 'services', 'manufacturing', 'restaurant', 'contracting'] as const)
      for (const sector of ['private', 'government'] as const) {
        const t = buildChartTemplate(suggestedProfile(p, sector, act));
        expect(new Set(t.map((x) => x.code)).size).toBe(t.length);
        const settings = t.filter((x) => x.setting).map((x) => x.setting);
        expect(new Set(settings).size).toBe(settings.length);
      }
  const gov = buildChartTemplate(suggestedProfile('EG', 'government'));
  expect(gov.filter((x) => x.chapter).length).toBeGreaterThan(10);
});

test('planChart matches by name, or by code with the same category', () => {
  const tpl = buildChartTemplate(suggestedProfile('SA', 'private'));
  const accounts = [
    parseAccount('0001', { name: 'الصندوق الرئيسى', category: 'asset' }),
    parseAccount('0002', { name: 'أحمد', code: '1102', category: 'asset' }),
    parseAccount('0003', { name: 'مؤسسة النور', code: '3101', category: 'liability' }),
  ];
  const plan = planChart(tpl, accounts);
  const row = (code: string) => plan.find((r) => r.tpl.code === code)!;
  expect(row('1101').existing?.id).toBe('0001');
  expect(row('1102').existing?.id).toBe('0002');
  expect(row('3101')).toMatchObject({ existing: undefined, codeTaken: true });
});
