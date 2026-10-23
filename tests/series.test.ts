import 'fake-indexeddb/auto';
import { describe, it, expect } from 'vitest';
import { openDB } from 'idb';
import {
  blankEntry,
  firstReading,
  nextReading,
  latest,
  resetEntry,
  validateSeries,
  resolveMeter,
  emptySeries,
} from '../src/series/model';
import { createSeriesStore } from '../src/series/store';
import { createHistory } from '../src/data/history';
import { backupJSON, parseBackup } from '../src/data/backup';
import { createRecord, emptyDraft, readDraft } from '../src/core/measurement';
import { parseStylus } from '../src/series/stylus';
const entry = (serial = '12345678') => ({
  ...blankEntry(),
  location: 'TS 3831/257',
  placement: '11P',
  serial,
  node: '21208142',
  date: '2026-10-22',
  time: '08:37',
  value: '23456',
});
describe('Odečtové série', () => {
  it('první samostatný odečet a neomezený řetězec bez přepsání předchozích dat', async () => {
    const store = createSeriesStore(crypto.randomUUID());
    const { meter: m } = await store.first(entry());
    let data = await store.all();
    expect(data.readings).toHaveLength(1);
    const p = data.readings[0];
    const second = nextReading(m, p, {
      date: '2026-10-27',
      time: '09:12',
      value: '23881',
      energis: '420',
      active: true,
    });
    await store.append([{ meter: m, previous: p, reading: second }]);
    data = await store.all();
    expect(latest(data.readings, m.id)).toEqual(second);
    const third = nextReading(m, second, {
      date: '2026-11-01',
      time: '10:00',
      value: '24000',
      energis: '120',
      active: false,
    });
    await store.append([{ meter: m, previous: second, reading: third }]);
    data = await store.all();
    expect(data.readings).toHaveLength(3);
    expect(data.readings.find((r) => r.id === p.id)).toEqual(p);
    expect(data.meters[0].active).toBe(false);
    expect(third.previousId).toBe(second.id);
    expect(validateSeries(data)).toEqual(data);
    await store.close();
  });
  it('70 elektroměrů v automatickém balíku; změna TS vytvoří jiný', async () => {
    const store = createSeriesStore(crypto.randomUUID());
    for (let i = 0; i < 70; i++) await store.first({ ...entry(String(i)), node: String(i) });
    await store.first({ ...entry('different'), location: 'TS 3308/250', node: '' });
    const data = await store.all();
    expect(data.batches).toHaveLength(2);
    expect(data.meters.filter((m) => m.location === 'TS 3831/257')).toHaveLength(70);
    const chosen = data.meters.filter((m) => m.location === 'TS 3831/257').slice(0, 48);
    expect(chosen).toHaveLength(48);
    const rows = chosen.slice(0, 2).map((m) => {
      const previous = latest(data.readings, m.id);
      return {
        meter: m,
        previous,
        reading: nextReading(m, previous, {
          date: '2026-10-29',
          time: '09:12',
          value: '24110',
          energis: '654',
          active: true,
        }),
      };
    });
    await store.append(rows);
    expect((await store.all()).readings).toHaveLength(73);
    await store.close();
  });
  it('reset zachová TS, datum, MTP a vyčistí pouze pracovní pole', () => {
    const reset = resetEntry(entry());
    expect(reset).toEqual({ ...entry(), placement: '', serial: '', node: '', time: '', value: '' });
  });
  it('UZEL je nepovinný text podporující 15+ číslic; čas není automatický', () => {
    expect(firstReading({ ...entry(), node: '000123456789012345678' }, 'b').meter.node).toBe(
      '000123456789012345678',
    );
    expect(firstReading({ ...entry(), node: '' }, 'b').meter.node).toBe('');
    expect(() => firstReading({ ...entry(), node: '12X' }, 'b')).toThrow('číslice');
    expect(() => firstReading({ ...entry(), time: '' }, 'b')).toThrow();
    expect(() => firstReading({ ...entry(), date: '2026-02-30' }, 'b')).toThrow();
  });
  it('NaN, Infinity, chybná chronologie a nižší stav se neuloží', () => {
    const { meter, reading } = firstReading(entry(), 'b');
    for (const value of ['NaN', 'Infinity', '1e400', '-1', '23455'])
      expect(() =>
        nextReading(meter, reading, {
          date: '2026-10-27',
          time: '09:12',
          value,
          energis: '1',
          active: true,
        }),
      ).toThrow();
    expect(() =>
      nextReading(meter, reading, {
        date: reading.date,
        time: reading.time,
        value: '23457',
        energis: '1',
        active: true,
      }),
    ).toThrow();
  });
  it('souběžné pokračování je atomicky odmítnuto; historie zůstane', async () => {
    const store = createSeriesStore(crypto.randomUUID());
    const { meter } = await store.first(entry());
    const previous = (await store.all()).readings[0];
    const reading = nextReading(meter, previous, {
      date: '2026-10-29',
      time: '09:12',
      value: '24110',
      energis: '654',
      active: true,
    });
    await store.append([{ meter, previous, reading }]);
    await expect(
      store.append([{ meter, previous, reading: { ...reading, id: crypto.randomUUID() } }]),
    ).rejects.toThrow('mezitím');
    expect((await store.all()).readings).toHaveLength(2);
    await store.close();
  });
  it('v2 → v3 zachová starou historii; backup obnoví série idempotentně', async () => {
    const name = crypto.randomUUID();
    const draft = emptyDraft();
    draft.serial = 'legacy';
    draft.identification = { date: '2026-10-22', location: 'TS', placement: '1' };
    draft.phases = draft.phases.map(() => ({
      u: '230',
      i: '1',
      pf: '1',
      p: '0.23',
    })) as typeof draft.phases;
    draft.kyoritsu = '0.69';
    draft.energis = '0.69';
    const old = createRecord(readDraft(draft));
    const db = await openDB(name, 2, {
      upgrade(db) {
        db.createObjectStore('measurements', { keyPath: 'id' }).createIndex('by-time', 'savedAt');
      },
    });
    await db.add('measurements', old);
    db.close();
    const history = createHistory(name);
    expect(await history.all()).toEqual([old]);
    const store = createSeriesStore(name);
    await store.first(entry());
    const data = await store.all();
    const backup = parseBackup(backupJSON([old], new Date(), data));
    const restored = createHistory(crypto.randomUUID());
    await restored.merge(backup);
    expect(await restored.all()).toEqual([old]);
    await restored.merge(backup);
    expect(await restored.all()).toHaveLength(1);
    await history.close();
    await store.close();
    await restored.close();
  });
  it('obnova kompletních vazeb, odmítnutí chybné zálohy a staré zálohy', async () => {
    const first = createSeriesStore(crypto.randomUUID());
    const { meter } = await first.first(entry());
    let data = await first.all();
    const p = data.readings[0];
    await first.append([
      {
        meter,
        previous: p,
        reading: nextReading(meter, p, {
          date: '2026-10-29',
          time: '09:12',
          value: '24110',
          energis: '654',
          active: false,
        }),
      },
    ]);
    data = await first.all();
    const name = crypto.randomUUID();
    const history = createHistory(name);
    const payload = parseBackup(backupJSON([], new Date(), data));
    await history.merge(payload);
    const second = createSeriesStore(name);
    expect(await second.all()).toEqual(data);
    await history.merge(payload);
    expect(await second.all()).toEqual(data);
    const bad = structuredClone(data);
    bad.readings[1].previousId = 'missing';
    expect(() => parseBackup(backupJSON([], new Date(), bad))).toThrow();
    expect(parseBackup(backupJSON([]))).toEqual([]);
    const conflict = parseBackup(backupJSON([], new Date(), data));
    conflict.seriesData!.meters[0].serial = 'conflict';
    await expect(history.merge(conflict)).rejects.toThrow('Konflikt');
    expect(await second.all()).toEqual(data);
    await first.close();
    await history.close();
    await second.close();
  });
});
describe('STYLUS', () => {
  it('rozpozná příklad v libovolném pořadí bez uložení', () => {
    expect(
      parseStylus('TS3831/257 11P U21208142 EM12345678 22.10.2026 8:37 stav 23456'),
    ).toMatchObject({ ...entry(), location: '3831/257' });
    expect(
      parseStylus('stav 23456 EM12345678 U21208142 8:37 22.10.2026 11P TS3831/257').serial,
    ).toBe('12345678');
  });
  it('najde poslední elektroměr podle U/EM; neúplný text je opravitelný', () => {
    const { meter } = firstReading(entry(), 'b');
    const parsed = parseStylus('U21208142 EM12345678 29.10.2026 9:12 stav 24110');
    expect(resolveMeter([meter], parsed.serial, parsed.node)).toEqual(meter);
    expect(parseStylus('neúplné')).toMatchObject({ serial: '', value: '' });
    expect(() => firstReading(parseStylus('neúplné'), 'b')).toThrow();
  });
  it('nevybere naslepo při konfliktu UZLU a EM; OD/DO', () => {
    const { meter } = firstReading(entry(), 'b');
    expect(() =>
      resolveMeter([meter, { ...meter, id: '2', node: '9', serial: '2' }], meter.serial, '9'),
    ).toThrow();
    expect(parseStylus('OD 22.10.2026 8:37 DO 29.10.2026 9:12 stav 24110')).toMatchObject({
      from: '2026-10-22T08:37',
      to: '2026-10-29T09:12',
      date: '2026-10-29',
      time: '09:12',
    });
  });
});
it('novější záloha doplní další odečet i ukončení; starší záloha jej nevrátí zpět', async () => {
  const original = createSeriesStore(crypto.randomUUID());
  const { meter } = await original.first(entry());
  const old = await original.all();
  const previous = old.readings[0];
  const reading = nextReading(meter, previous, {
    date: '2026-10-29',
    time: '09:12',
    value: '24110',
    energis: '654',
    active: false,
  });
  await original.append([{ meter, previous, reading }]);
  const updated = await original.all();
  const target = createSeriesStore(crypto.randomUUID());
  await target.merge(old);
  await target.merge(updated);
  expect(await target.all()).toEqual(updated);
  await target.merge(old);
  expect(await target.all()).toEqual(updated);
  await original.close();
  await target.close();
});
it('záloha formátu 1 z verze 1.2.5 zůstává podporována', () => {
  const old = {
    backupVersion: 1,
    appVersion: '1.2.5',
    exportedAt: new Date().toISOString(),
    records: [],
  };
  expect(parseBackup(JSON.stringify(old))).toEqual([]);
});
it('spotřeba s MTP je dostupná v exportu i bez vyplněného Energisu', async () => {
  const { exportRows } = await import('../src/series/export');
  const { intervalValues } = await import('../src/series/model');
  const { meter, reading } = firstReading({ ...entry(), actualMtp: '400', meterMtp: '200' }, 'b');
  const second = nextReading(meter, reading, {
    date: '2026-10-29',
    time: '09:12',
    value: '24110',
    energis: '',
    active: true,
  });
  expect(intervalValues(meter, reading, second).meterEnergy).toBe(1308);
  const rows = exportRows([meter], {
    batches: [{ id: 'b', location: meter.location, date: reading.date }],
    meters: [meter],
    readings: [reading, second],
  });
  expect(rows[2][8]).toBe(1308);
  expect(rows[2][9]).toBe('');
  expect(rows[2][10]).toBe('');
});
