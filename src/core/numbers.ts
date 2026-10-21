export function parseNumber(raw: string): number {
  const s = raw.trim().replace(',', '.');
  if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(s)) return NaN;
  return Number(s);
}
export function formatNumber(value: number | null | undefined, digits = 3, fixed = false): string {
  return value == null || !Number.isFinite(value)
    ? '—'
    : value.toLocaleString('cs-CZ', {
        maximumFractionDigits: Math.min(3, Math.max(0, digits)),
        minimumFractionDigits: fixed ? Math.min(3, Math.max(0, digits)) : 0,
        useGrouping: false,
      });
}
export function localTimestamp(date: Date): string {
  const pad = (v: number) => String(v).padStart(2, '0');
  return `${pad(date.getDate())}.${pad(date.getMonth() + 1)}.${date.getFullYear()} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}
