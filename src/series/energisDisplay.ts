import { timeOffset } from './energis';
import { normalizeTime, type EnergisMeta } from './model';
// Presentation only: a manual export boundary is the previous/next quarter-hour.
export function readingTimeOffset(
  meta: EnergisMeta | undefined,
  date: string,
  time: string,
  boundary?: 'previous' | 'next',
) {
  if (meta) return timeOffset(meta, date, time);
  const normalized = normalizeTime(time);
  if (!date || !/^([01]\d|2[0-3]):[0-5]\d$/.test(normalized) || !boundary) return '';
  const [hour, minute] = normalized.split(':').map(Number);
  const total = hour * 60 + minute;
  const end = (boundary === 'previous' ? Math.floor(total / 15) : Math.ceil(total / 15)) * 15;
  const offset = end - total;
  return `${offset >= 0 ? '+' : ''}${offset} min E`;
}
