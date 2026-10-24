import { expect, it } from 'vitest';
import { seriesDates } from '../src/series/seriesDates';
import type { SeriesData } from '../src/series/model';

it('uses earliest saved daily time, isolates series, survives skips and does not mutate data', () => {
  const data = {
    batches: [],
    meters: [
      { id: 'a', batchId: 'one' },
      { id: 'b', batchId: 'one' },
      { id: 'c', batchId: 'other' },
    ],
    readings: [
      { meterId: 'a', date: '2026-11-02', time: '09:12' },
      { meterId: 'b', date: '2026-10-24', time: '10:20' },
      { meterId: 'a', date: '2026-10-24', time: '10:15' },
      { meterId: 'b', date: '2026-10-26', time: '8:36' },
      { meterId: 'c', date: '2026-10-23', time: '01:00' },
    ],
  };
  const complete: SeriesData = {
    batches: [],
    meters: data.meters.map((m) => ({
      ...m,
      location: 'TS',
      placement: 'pole',
      serial: m.id,
      node: '',
      active: true,
      actualMtp: 1,
      meterMtp: 1,
    })),
    readings: data.readings.map((r, i) => ({ ...r, id: String(i), value: 100, active: true })),
  };
  const before = JSON.stringify(complete);
  expect(seriesDates(complete, 'one')).toBe('24.10.2026 10:15; 26.10.2026 08:36; 02.11.2026 09:12');
  expect(seriesDates({ ...complete, readings: [...complete.readings].reverse() }, 'one')).toBe(
    seriesDates(complete, 'one'),
  );
  expect(seriesDates(complete, 'missing')).toBe('');
  expect(JSON.stringify(complete)).toBe(before);
});
