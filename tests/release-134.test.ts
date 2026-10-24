import 'fake-indexeddb/auto';
import { openDB } from 'idb';
import { expect, it } from 'vitest';
import { createSeriesStore } from '../src/series/store';
import { createHistory } from '../src/data/history';
import { backupJSON, parseBackup } from '../src/data/backup';
import {
  blankEntry,
  firstReading,
  latest,
  nextReading,
  validateSeries,
  type SeriesData,
  type SeriesRound,
} from '../src/series/model';
import { roundsFor } from '../src/series/rounds';
import { seriesGroups } from '../src/series/grouping';
import { resultRows } from '../src/ui/resultsView';
import { readingTimeOffset } from '../src/series/energisDisplay';
import { usedEnergisBoundary } from '../src/series/SavedEnergis';
const entry = (serial: string, time: string) => ({
  ...blankEntry(),
  location: 'TS',
  placement: serial,
  serial,
  date: '2026-10-24',
  time,
  value: '100',
});
async function fixture() {
  const store = createSeriesStore(crypto.randomUUID());
  const a = await store.first(entry('21', '11:07'), undefined, {
    roundDate: '2026-10-24',
    roundTime: '11:00',
  });
  const b = await store.first(entry('54', '11:19'), a.batch.id, {
    roundDate: '2026-10-24',
    roundTime: '11:00',
    roundId: a.round.roundId,
  });
  return { store, a, b };
}
async function append(
  store: ReturnType<typeof createSeriesStore>,
  time: string,
  skip = false,
  date = '2026-10-24',
) {
  const data = await store.all();
  const round: SeriesRound = {
    roundId: crypto.randomUUID(),
    batchId: data.batches[0].id,
    roundDate: date,
    roundTime: time,
    entries: [],
  };
  const rows = data.meters.flatMap((meter) => {
    if (skip && meter.serial === '54') {
      round.entries.push({ meterId: meter.id });
      return [];
    }
    const previous = latest(data.readings, meter.id);
    const reading = {
      ...nextReading(meter, previous, {
        date,
        time: meter.serial === '21' ? '15:36' : '15:44',
        value: String(previous.value + 10),
        energis: '10',
        active: true,
        boundary: 'next',
      }),
      roundId: round.roundId,
    };
    round.entries.push({ meterId: meter.id, readingId: reading.id });
    return [{ meter, previous, reading }];
  });
  await store.append(rows, [round]);
  return round;
}
it('separates two same-day visits, physical times, skipped B and C links to last actual A', async () => {
  const { store, a, b } = await fixture();
  const rb = await append(store, '15:30', true);
  let data = await store.all();
  expect(roundsFor(data, a.batch.id).map((r) => r.roundTime)).toEqual(['11:00', '15:30']);
  expect(data.readings.filter((r) => r.meterId === b.meter.id)).toHaveLength(1);
  expect(rb.entries.find((e) => e.meterId === b.meter.id)?.readingId).toBeUndefined();
  const rc = await append(store, '08:00', false, '2026-10-31');
  data = await store.all();
  expect(
    data.readings.find((r) => r.roundId === rc.roundId && r.meterId === b.meter.id)?.previousId,
  ).toBe(b.reading.id);
  expect(data.readings.find((r) => r.id === b.reading.id)?.time).toBe('11:19');
  expect(resultRows([], data)).toHaveLength(1);
  expect(validateSeries(data)).toEqual(data);
  await store.close();
});
it.each(['previous', 'next'] as const)(
  'Energis %s uses 11:19 rather than the common 11:00 visit',
  async (boundary) => {
    const { store, b } = await fixture();
    const r = {
      ...nextReading(b.meter, b.reading, {
        date: '2026-10-25',
        time: '11:19',
        value: '110',
        energis: '10',
        active: true,
        boundary,
      }),
      roundId: crypto.randomUUID(),
    };
    await store.append(
      [{ meter: b.meter, previous: b.reading, reading: r }],
      [
        {
          roundId: r.roundId,
          batchId: b.batch.id,
          roundDate: '2026-10-25',
          roundTime: '11:00',
          entries: [{ meterId: b.meter.id, readingId: r.id }],
        },
      ],
    );
    expect((await store.all()).readings.find((x) => x.id === r.id)?.time).toBe('11:19');
    expect(readingTimeOffset(undefined, r.date, r.time, boundary)).toBe(
      boundary === 'previous' ? '-4 min E' : '+11 min E',
    );
    expect(usedEnergisBoundary(r)).toBe(
      boundary === 'previous' ? '2026-10-25 11:15' : '2026-10-25 11:30',
    );
    await store.close();
  },
);
it('all skipped round persists, creates no readings and sorts the series by round timestamp', async () => {
  const { store, a, b } = await fixture();
  const round: SeriesRound = {
    roundId: crypto.randomUUID(),
    batchId: a.batch.id,
    roundDate: '2026-10-31',
    roundTime: '09:12',
    entries: [{ meterId: a.meter.id }, { meterId: b.meter.id }],
  };
  await store.append([], [round]);
  const data = await store.all();
  expect(data.readings).toHaveLength(2);
  expect(seriesGroups(data)[0].at).toBe('2026-10-31T09:12');
  await store.close();
});
it('round JSON backup restores all links and skips, both adapters are idempotent, old backups still load', async () => {
  const { store } = await fixture();
  await append(store, '15:30', true);
  const data = await store.all();
  const records = parseBackup(backupJSON([], new Date(), data));
  const name = crypto.randomUUID();
  const history = createHistory(name);
  await history.merge(records);
  await history.merge(records);
  const restored = createSeriesStore(name);
  expect(await restored.all()).toEqual(data);
  const direct = createSeriesStore(crypto.randomUUID());
  await direct.merge(data);
  await direct.merge(data);
  expect(await direct.all()).toEqual(data);
  const old = JSON.parse(backupJSON([], new Date(), data));
  old.backupVersion = 2;
  delete old.seriesData.rounds;
  old.seriesData.readings.forEach((r: { roundId?: string }) => delete r.roundId);
  const legacy = parseBackup(JSON.stringify(old));
  await restored.merge(legacy.seriesData!);
  expect(await restored.all()).toEqual(data);
  const empty = createSeriesStore(crypto.randomUUID());
  await empty.merge(legacy.seriesData!);
  expect((await empty.all()).readings.map((r) => r.time)).toEqual(data.readings.map((r) => r.time));
  await empty.merge(data);
  expect((await empty.all()).readings).toEqual(data.readings);
  expect(roundsFor(await empty.all(), data.batches[0].id)).toHaveLength(2);
  await store.close();
  await restored.close();
  await direct.close();
  await history.close();
  await empty.close();
});
it.each(['series', 'history'])(
  'version 3 migration via %s preserves every same-day legacy reading and measurement',
  async (opener) => {
    const name = crypto.randomUUID();
    const pair = firstReading(entry('21', '11:07'), 'batch');
    const second = nextReading(pair.meter, pair.reading, {
      date: '2026-10-24',
      time: '15:36',
      value: '110',
      energis: '',
      active: true,
    });
    const legacy: SeriesData = {
      batches: [{ id: 'batch', location: 'TS', date: '2026-10-24' }],
      meters: [pair.meter],
      readings: [pair.reading, second],
    };
    const db = await openDB(name, 3, {
      upgrade(db) {
        db.createObjectStore('series', { keyPath: 'id' }).createIndex('by-location-date', [
          'location',
          'date',
        ]);
        const m = db.createObjectStore('meters', { keyPath: 'id' });
        m.createIndex('by-batch', 'batchId');
        m.createIndex('by-serial', 'serial');
        m.createIndex('by-node', 'node');
        db.createObjectStore('readings', { keyPath: 'id' }).createIndex('by-meter', 'meterId');
        db.createObjectStore('measurements', { keyPath: 'id' }).createIndex('by-time', 'savedAt');
      },
    });
    await db.put('series', legacy.batches[0]);
    await db.put('meters', pair.meter);
    for (const r of legacy.readings) await db.put('readings', r);
    await db.put('measurements', { id: 'untouched', savedAt: '2026-10-24T00:00:00Z', input: {} });
    db.close();
    if (opener === 'history') {
      const h = createHistory(name);
      await h.all();
      await h.close();
    }
    const store = createSeriesStore(name);
    const data = await store.all();
    expect(
      data.readings
        .map(({ roundId: _roundId, ...r }) => r)
        .sort((a, b) => a.time.localeCompare(b.time)),
    ).toEqual(legacy.readings);
    expect(data.rounds).toHaveLength(1);
    expect(data.rounds![0].legacy).toBe(true);
    expect(data.readings.every((r) => r.roundId === data.rounds![0].roundId)).toBe(true);
    expect(validateSeries(data)).toEqual(data);
    const inspect = await openDB(name);
    expect(inspect.version).toBe(4);
    expect(await inspect.get('measurements', 'untouched')).toEqual({
      id: 'untouched',
      savedAt: '2026-10-24T00:00:00Z',
      input: {},
    });
    inspect.close();
    await store.close();
  },
);
it('rejects orphan, cross-series and duplicate reading links before writing', async () => {
  const { store, a } = await fixture();
  const data = await store.all();
  const bad = structuredClone(data);
  bad.readings[0].roundId = 'missing';
  expect(() => validateSeries(bad)).toThrow();
  const duplicate = structuredClone(data);
  duplicate.rounds![0].entries.push(duplicate.rounds![0].entries[0]);
  expect(() => validateSeries(duplicate)).toThrow();
  await expect(
    store.append(
      [],
      [
        {
          roundId: crypto.randomUUID(),
          batchId: a.batch.id,
          roundDate: '2026-10-24',
          roundTime: '25:00',
          entries: [],
        },
      ],
    ),
  ).rejects.toThrow();
  expect(await store.all()).toEqual(data);
  await store.close();
});

it('two visits with identical date and time keep distinct IDs; failed append rolls back round and readings', async () => {
  const { store, a } = await fixture();
  const first = await append(store, '15:30');
  const duplicateTime: SeriesRound = {
    roundId: crypto.randomUUID(),
    batchId: a.batch.id,
    roundDate: '2026-10-24',
    roundTime: '15:30',
    entries: [{ meterId: a.meter.id }],
  };
  await store.append([], [duplicateTime]);
  const before = await store.all();
  expect(roundsFor(before, a.batch.id).filter((r) => r.roundTime === '15:30')).toHaveLength(2);
  expect(first.roundId).not.toBe(duplicateTime.roundId);
  const meter = before.meters.find((m) => m.id === a.meter.id)!;
  const stale = {
    ...nextReading(meter, a.reading, {
      date: '2026-10-25',
      time: '11:07',
      value: '120',
      energis: '',
      active: true,
    }),
    roundId: crypto.randomUUID(),
  };
  await expect(
    store.append(
      [{ meter, previous: a.reading, reading: stale }],
      [
        {
          roundId: stale.roundId,
          batchId: a.batch.id,
          roundDate: '2026-10-25',
          roundTime: '11:00',
          entries: [{ meterId: meter.id, readingId: stale.id }],
        },
      ],
    ),
  ).rejects.toThrow('mezitím');
  expect(await store.all()).toEqual(before);
  await store.close();
});
