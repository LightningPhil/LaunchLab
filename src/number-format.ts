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

/** Keep day-long flights readable without an enormous count of minutes. */
export function formatTime(seconds: number): string {
  const whole = Math.floor(Math.max(0, seconds));
  const pad = (value: number) => String(value).padStart(2, '0');
  const minutes = `${pad(Math.floor(whole / 60) % 60)}:${pad(whole % 60)}`;
  if (whole < 3600) return minutes;
  const hours = `${pad(Math.floor(whole / 3600) % 24)}:${minutes}`;
  return whole < 86400 ? hours : `${formatNumber(Math.floor(whole / 86400))}d ${hours}`;
}
