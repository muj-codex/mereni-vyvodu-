export function parseNumber(raw: string): number {
  const s = raw.trim().replace(',', '.');
  if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(s)) return NaN;
  return Number(s);
}
export function formatNumber(value: number | null | undefined, digits = 2): string {
  return value == null || !Number.isFinite(value)
    ? '—'
    : value.toLocaleString('cs-CZ', {
        maximumFractionDigits: digits,
        minimumFractionDigits: digits,
      });
}
export function localTimestamp(date: Date): string {
  const pad = (v: number) => String(v).padStart(2, '0');
  return `${pad(date.getDate())}.${pad(date.getMonth() + 1)}.${date.getFullYear()} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}
