import type { SeriesData } from './model';

// Legacy records have no round ID or round timestamp. Use the earliest actual
// reading per shared calendar date, never per-meter visit counts (outlets can skip).
// Multiple rounds on the same date cannot be distinguished by this stored model.
export function seriesDates(data: SeriesData, batchId: string): string {
  const meterIds = new Set(data.meters.filter((m) => m.batchId === batchId).map((m) => m.id));
  const dates = new Map<string, string>();
  for (const r of data.readings) {
    if (!meterIds.has(r.meterId)) continue;
    const time = r.time.padStart(5, '0');
    if (!dates.has(r.date) || time < dates.get(r.date)!) dates.set(r.date, time);
  }
  return [...dates]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, time]) => {
      const [year, month, day] = date.split('-');
      return `${day}.${month}.${year} ${time}`;
    })
    .join('; ');
}
