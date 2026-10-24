import { readingTimeOffset } from '../src/series/energisDisplay';
import 'fake-indexeddb/auto';
import { expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { Series } from '../src/series/Series';
import { MtpCoefficient } from '../src/ui/MtpCoefficient';
import {
  blankEntry,
  latest,
  localTime,
  lookupNode,
  nextReading,
  normalizeTime,
  timestamp,
  validateSeries,
} from '../src/series/model';
import { createSeriesStore } from '../src/series/store';
import { backupJSON, parseBackup } from '../src/data/backup';
import { resultRows } from '../src/ui/resultsView';
import { timeOffset } from '../src/series/energis';
const entry = {
  ...blankEntry(),
  location: 'TS 3831/257',
  placement: 'pole 48',
  serial: '777666',
  node: '21210034123456789',
  date: '2026-10-23',
  time: '8:32',
  value: '100',
  actualMtp: '300',
  meterMtp: '200',
};
it('form uses existing TS/R and MTP dropdowns, UZEL first and an explicit TEĎ action', () => {
  const html = renderToStaticMarkup(createElement(Series));
  expect(html).toContain('TS 3831/257');
  expect(html).toContain('300/5 A');
  expect(html).toContain('VLASTNÍ MTP');
  expect(html).toContain('TEĎ');
  expect(html.indexOf('UZEL (nepovinný)')).toBeLessThan(html.indexOf('TS / rozvodna'));
  expect(
    renderToStaticMarkup(createElement(MtpCoefficient, { primary: 300, meter: 200 })),
  ).toContain('1,500');
});
it('local HH:MM and one-digit hours normalize without automatic form time', () => {
  expect(localTime(new Date(2026, 9, 24, 8, 3))).toBe('08:03');
  expect(normalizeTime('8:32')).toBe('08:32');
  expect(timestamp('2026-10-24', '8:32')).toBe('2026-10-24T08:32');
  expect(lookupNode('2121', [{ node: '2121', location: 'R201', placement: '48' }])).toEqual({
    node: '2121',
    location: 'R201',
    placement: '48',
  });
  expect(lookupNode('missing')).toBeUndefined();
});
it('shared history, skipped visit, stopped tracking, reactivation and backup retain last actual reading', async () => {
  const store = createSeriesStore(crypto.randomUUID());
  const { meter, reading: a } = await store.first(entry);
  expect(a.time).toBe('08:32');
  await store.append([]); // an excluded row never enters the persistence adapter
  expect(latest((await store.all()).readings, meter.id)?.id).toBe(a.id);
  const b = nextReading(meter, a, {
    date: '2026-10-24',
    time: '8:35',
    value: '110',
    energis: '15',
    active: false,
  });
  expect(b.result).toMatchObject({ registerDelta: 10, meterEnergy: 15, difference: 0, percent: 0 });
  await store.append([{ meter: { ...meter, node: '99912345678912345' }, previous: a, reading: b }]);
  expect((await store.all()).meters[0].active).toBe(false);
  await store.reactivate(meter.id);
  const data = await store.all();
  expect(data.meters[0]).toMatchObject({ active: true, node: '99912345678912345' });
  expect(latest(data.readings, meter.id)?.id).toBe(b.id);
  expect(validateSeries(data)).toEqual(data);
  const restored = createSeriesStore(crypto.randomUUID());
  const backup = parseBackup(backupJSON([], new Date(), data));
  await restored.merge(backup.seriesData!);
  expect(await restored.all()).toEqual(data);
  await restored.merge(backup.seriesData!);
  expect((await restored.all()).readings).toHaveLength(2);
  await store.close();
  await restored.close();
});
it.each(['3831', '257', '21210034', '766', '23.10.2026', 'série', 'NN'])(
  'global live partial search %s includes readings',
  async (query) => {
    const store = createSeriesStore(crypto.randomUUID());
    await store.first(entry);
    expect(resultRows([], await store.all(), query)).toHaveLength(1);
    expect(resultRows([], await store.all(), '')).toHaveLength(1);
    await store.close();
  },
);
it('sort uses actual latest reading time and ignores batch or insertion order', async () => {
  const store = createSeriesStore(crypto.randomUUID());
  await store.first({ ...entry, time: '08:35' });
  await store.first({ ...entry, serial: '222', node: '222', time: '08:32' });
  expect(resultRows([], await store.all()).map((r) => r.at)).toEqual([
    '2026-10-23T08:35',
  ]);
  await store.close();
});
it.each([
  ['2026-10-24T08:30', '-6 min E'],
  ['2026-10-24T08:45', '+9 min E'],
])('Energis actual boundary %s produces %s', (to, expected) => {
  expect(
    timeOffset(
      {
        file: '',
        node: '1',
        from: '2026-10-24T08:00',
        to,
        unit: 'kWh',
        sum: 1,
        boundary: 'previous',
      },
      '2026-10-24',
      '8:36',
    ),
  ).toBe(expected);
});

it('manual Energis boundary also exposes signed minutes without modifying energy math', () => {
  expect(readingTimeOffset(undefined, '2026-10-24', '8:36', 'previous')).toBe('-6 min E');
  expect(readingTimeOffset(undefined, '2026-10-24', '8:36', 'next')).toBe('+9 min E');
});
