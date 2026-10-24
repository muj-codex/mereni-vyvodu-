import 'fake-indexeddb/auto';
import { expect, it } from 'vitest';
import { createSeriesStore } from '../src/series/store';
import { createHistory } from '../src/data/history';
import { DATABASE_VERSION, backupJSON, parseBackup } from '../src/data/backup';
import {
  blankEntry,
  latest,
  nextReading,
  validateSeries,
  type SeriesData,
  type SeriesRound,
} from '../src/series/model';
import { seriesGroups, standaloneMeters } from '../src/series/grouping';
import { resultRows } from '../src/ui/resultsView';
const entry = (serial: string, location = 'TS 4601/251') => ({
  ...blankEntry(),
  serial,
  location,
  placement: `pole ${serial}`,
  node: serial,
  date: '2026-10-24',
  time: '11:19',
  value: '100',
});
const visit = { roundDate: '2026-10-24', roundTime: '11:00' };
it('two series and one genuine standalone share one model and produce exactly three primary rows', async () => {
  const store = createSeriesStore(crypto.randomUUID());
  const a = await store.first(entry('21'), undefined, visit);
  await store.first(entry('54'), a.batch.id, { ...visit, roundId: a.round.roundId });
  const b = await store.first(entry('31', 'TS 3831/257'), undefined, visit);
  for (const serial of ['32', '35', '48'])
    await store.first(entry(serial, 'TS 3831/257'), b.batch.id, {
      ...visit,
      roundId: b.round.roundId,
    });
  const single = await store.first(entry('777'), undefined, visit, 'standalone');
  const data = await store.all();
  expect(
    seriesGroups(data)
      .map((g) => g.meters.length)
      .sort(),
  ).toEqual([2, 4]);
  expect(standaloneMeters(data).map((m) => m.id)).toEqual([single.meter.id]);
  expect(resultRows([], data)).toHaveLength(3);
  for (const term of ['21', 'pole 54', '3831', '777', '2026-10-24', '24.10.2026'])
    expect(resultRows([], data, term).length).toBeGreaterThan(0);
  expect(resultRows([], data, 'pole 54')).toMatchObject([{ batchId: a.batch.id }]);
  expect(resultRows([], data, '777')).toMatchObject([{ meterId: single.meter.id }]);
  expect(DATABASE_VERSION).toBe(4);
  expect(validateSeries(data)).toEqual(data);
  await store.close();
});
it('single creation never joins an existing series or another standalone by matching location/date', async () => {
  const store = createSeriesStore(crypto.randomUUID());
  const a = await store.first(entry('1'));
  const b = await store.first(entry('2'), a.batch.id, visit, 'standalone');
  const c = await store.first(entry('3'), undefined, visit, 'standalone');
  expect(new Set([a.batch.id, b.batch.id, c.batch.id]).size).toBe(3);
  const data = await store.all();
  expect(seriesGroups(data)).toHaveLength(1);
  expect(standaloneMeters(data)).toHaveLength(2);
  await store.close();
});
it('legacy valid batchId is authoritative; unlinked records alone are standalone, inputs stay untouched', () => {
  const data = {
    batches: [{ id: 'series', location: 'TS', date: '2026-10-24' }],
    meters: [
      { id: 'member', batchId: 'series' },
      { id: 'orphan', batchId: 'missing' },
    ],
    readings: [],
  } as unknown as SeriesData;
  data.meters = data.meters.map((m) => ({
    ...m,
    location: 'TS',
    serial: m.id,
    node: '',
    placement: m.id,
    active: true,
    actualMtp: 1,
    meterMtp: 1,
  }));
  const before = structuredClone(data);
  expect(standaloneMeters(data).map((m) => m.id)).toEqual(['orphan']);
  expect(seriesGroups(data)[0].meters.map((m) => m.id)).toEqual(['member']);
  expect(
    resultRows([], data)
      .map((r) => r.id)
      .sort(),
  ).toEqual(['orphan', 'series:series']);
  expect(data).toEqual(before);
});
it('attaching a standalone preserves the exact A/B chain, old rounds, Energis and tracking; backups cannot move it back', async () => {
  const store = createSeriesStore(crypto.randomUUID());
  const a = await store.first(entry('21'), undefined, visit);
  const single = await store.first(entry('777'), undefined, visit, 'standalone');
  const b = nextReading(single.meter, single.reading, {
    date: '2026-10-25',
    time: '11:19',
    value: '110',
    energis: '10',
    active: false,
    boundary: 'next',
  });
  await store.append([{ meter: single.meter, previous: single.reading, reading: b }]);
  const before = await store.all();
  const old = parseBackup(backupJSON([], new Date(), before));
  await store.attachToSeries(single.meter.id, a.batch.id);
  const after = await store.all();
  expect(after.readings).toEqual(before.readings);
  expect(after.rounds).toEqual(before.rounds);
  expect(after.meters.find((m) => m.id === single.meter.id)).toMatchObject({
    batchId: a.batch.id,
    active: false,
  });
  expect(standaloneMeters(after)).toHaveLength(0);
  expect(seriesGroups(after)).toHaveLength(1);
  expect(seriesGroups(after)[0].meters).toHaveLength(2);
  expect(validateSeries(after)).toEqual(after);
  await expect(store.attachToSeries(single.meter.id, a.batch.id)).rejects.toThrow('už patří');
  const current = parseBackup(backupJSON([], new Date(), after));
  const name = crypto.randomUUID(),
    history = createHistory(name),
    restored = createSeriesStore(name);
  await history.merge(old);
  await history.merge(current);
  await history.merge(old);
  await history.merge(current);
  expect(await restored.all()).toEqual(after);
  const direct = createSeriesStore(crypto.randomUUID());
  await direct.merge(current.seriesData!);
  await direct.merge(old.seriesData!);
  expect(await direct.all()).toEqual(after);
  await direct.close();
  await restored.close();
  await history.close();
  await store.close();
});
it('only one of three is read; skipped members retain their latest readings and long-term activity', async () => {
  const store = createSeriesStore(crypto.randomUUID());
  const a = await store.first(entry('1'), undefined, visit);
  const b = await store.first(entry('2'), a.batch.id, { ...visit, roundId: a.round.roundId });
  const c = await store.first(entry('3'), a.batch.id, { ...visit, roundId: a.round.roundId });
  const round: SeriesRound = {
    roundId: crypto.randomUUID(),
    batchId: a.batch.id,
    roundDate: '2026-10-25',
    roundTime: '11:00',
    entries: [],
  };
  const reading = {
    ...nextReading(a.meter, a.reading, {
      date: '2026-10-25',
      time: '11:19',
      value: '110',
      energis: '10',
      active: true,
      boundary: 'previous',
    }),
    roundId: round.roundId,
  };
  round.entries = [
    { meterId: a.meter.id, readingId: reading.id },
    { meterId: b.meter.id },
    { meterId: c.meter.id },
  ];
  await store.append([{ meter: a.meter, previous: a.reading, reading }], [round]);
  const data = await store.all();
  expect(data.readings).toHaveLength(4);
  expect(data.meters.every((m) => m.active)).toBe(true);
  expect(latest(data.readings, b.meter.id)).toEqual(b.reading);
  expect(latest(data.readings, c.meter.id)).toEqual(c.reading);
  expect(seriesGroups(data)[0].meters).toHaveLength(3);
  expect(resultRows([], data)).toHaveLength(1);
  expect(parseBackup(backupJSON([], new Date(), data)).seriesData).toEqual(data);
  await store.close();
});
