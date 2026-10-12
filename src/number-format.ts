const formats = new Map<number, Intl.NumberFormat>();

/** Consistent grouping for measurements and settings, including negative values. */
export function formatNumber(value: number, digits = 0): string {
  let format = formats.get(digits);
  if (!format) {
    format = new Intl.NumberFormat('en-GB', { minimumFractionDigits: digits, maximumFractionDigits: digits });
    formats.set(digits, format);
  }
  return format.format(value);
}
