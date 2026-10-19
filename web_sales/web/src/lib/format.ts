// تنسيق موحّد للأرقام والمبالغ والتواريخ في كل الصفحات.
// أرقام لاتينية + تقويم ميلادي بأسماء أشهر عربية (ar-SA وحدها تعرض التاريخ هجرياً).
const LOCALE = 'ar-u-nu-latn-ca-gregory';

const numberFormatters = new Map<number, Intl.NumberFormat>();

export const formatNumber = (value: number | null | undefined, fractionDigits = 2): string => {
  let fmt = numberFormatters.get(fractionDigits);
  if (!fmt) {
    fmt = new Intl.NumberFormat('en-US', {
      minimumFractionDigits: fractionDigits,
      maximumFractionDigits: fractionDigits,
    });
    numberFormatters.set(fractionDigits, fmt);
  }
  const n = Number(value);
  return fmt.format(Number.isFinite(n) ? n : 0);
};

export const formatMoney = (value: number | null | undefined, currency?: string, fractionDigits = 2): string =>
  currency ? `${formatNumber(value, fractionDigits)} ${currency}` : formatNumber(value, fractionDigits);

export const formatPercent = (value: number | string | null | undefined, fractionDigits = 1): string =>
  `${formatNumber(Number(value), fractionDigits)}%`;

export const toDate = (value: unknown): Date | null => {
  if (value === null || value === undefined || value === '') return null;
  const d = new Date(value as any);
  return Number.isNaN(d.getTime()) ? null : d;
};

export const formatDate = (value: unknown, opts: Intl.DateTimeFormatOptions = { dateStyle: 'medium' }): string => {
  const d = toDate(value);
  return d ? new Intl.DateTimeFormat(LOCALE, opts).format(d) : '—';
};

export const formatTime = (value: unknown): string => formatDate(value, { hour: '2-digit', minute: '2-digit' });
