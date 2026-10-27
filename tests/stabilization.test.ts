import 'fake-indexeddb/auto';
import { openDB } from 'idb';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import {
  createRecord,
  emptyDraft,
  readDraft,
  saveAndReset,
  startKyoritsu,
} from '../src/core/measurement';
import { createIntervalCheck } from '../src/core/intervalCheck';
import { emptyCurrent, evaluateCurrent } from '../src/core/current';
import { measurementComparisons } from '../src/core/comparisons';
import { Comparisons, StateCheckSummary } from '../src/ui/Comparisons';
import { createHistory } from '../src/data/history';
import { backupJSON, parseBackup, planImport } from '../src/data/backup';
import { emailBody } from '../src/data/export';
import type { HistoryRecord, MeasurementRecord } from '../src/core/types';
import { Detail } from '../src/ui/components';
function draft() {
  const d = emptyDraft();
  d.serial = '000125';
  d.identification = { date: '2026-10-22', location: 'TS 3308/250', placement: '25' };
  d.config.actualMtp = 300;
  d.config.meterMtp = 600;
  d.intervalEnabled = true;
  d.interval = {
    from: '2026-10-22T14:45',
    to: '2026-10-22T16:45',
    start: '100',
    end: '300',
    energis: '98.5',
  };
  return d;
}
function complete(d = draft()) {
  d.phases = [0, 1, 2].map(() => ({ u: '230', i: '10', pf: '1', p: '2.3' })) as typeof d.phases;
  d.kyoritsu = '6.9';
  d.energis = '6.8';
  return d;
}
function records(): HistoryRecord[] {
  const legacy = createRecord(readDraft(complete()));
  delete legacy.input.identification;
  delete legacy.input.interval;
  const current = emptyCurrent();
  current.serial = '000CURRENT';
  current.phases = current.phases.map(() => ({
    primary: '20',
    raw: '33',
    unit: 'mV',
  })) as typeof current.phases;
  return [
    legacy,
    evaluateCurrent(current),
    createIntervalCheck(draft()),
    createRecord(readDraft(complete(startKyoritsu(draft(), true)))),
  ];
}
describe('1.2.5 measurement continuity', () => {
  it('direct Kyoritsu starts without check, including previously linked draft', () => {
    expect(startKyoritsu(startKyoritsu(draft(), true)).stateCheck).toBeUndefined();
    expect(startKyoritsu(draft()).stateCheck).toBeUndefined();
  });
  it('explicit continuation snapshots interval, corrected energy, sign and assessment', () => {
    const d = draft(),
      next = startKyoritsu(d, true),
      check = next.stateCheck!;
    expect(check.input.interval.from).toBe(d.interval.from);
    expect(check.input.interval.to).toBe(d.interval.to);
    expect(check.result).toMatchObject({
      meterEnergy: 100,
      energisEnergy: 98.5,
      difference: -1.5,
      percent: -1.5,
    });
    expect(check.assessment.summary).toBeTruthy();
    d.interval.end = '999';
    expect(check.input.interval.end).toBe(300);
  });
  it('explicit check retains correct meter when header carry is OFF', () => {
    const d = draft();
    d.carryIdentification = false;
    const n = startKyoritsu(d, true);
    expect(n.serial).toBe(d.serial);
    expect(n.config).toEqual(d.config);
  });
  it('renders compact noneditable Kyoritsu summary', () => {
    const html = renderToStaticMarkup(
      createElement(StateCheckSummary, { record: createIntervalCheck(draft()) }),
    );
    expect(html).toContain('22.10.2026 14:45');
    expect(html).toContain('16:45');
    expect(html).toContain('98,5');
    expect(html).not.toContain('<input');
  });
  it('saved final record contains both sources and resets check after successful save only', async () => {
    const d = complete(startKyoritsu(draft(), true));
    const { record, nextDraft } = await saveAndReset(d, async () => {});
    expect(record.input.stateCheck).toEqual(d.stateCheck);
    expect(record.input.kyoritsu).toBe(6.9);
    expect(nextDraft.stateCheck).toBeUndefined();
    await expect(
      saveAndReset(d, async () => {
        throw Error('quota');
      }),
    ).rejects.toThrow('quota');
    expect(d.stateCheck).toBeDefined();
  });
  it('UI shows only meaningful comparisons while internal data and export stay compatible', () => {
    const r = createRecord(readDraft(complete(startKyoritsu(draft(), true)))),
      c = measurementComparisons(r);
    expect(c.map((x) => x.percent)).toEqual([-1.5, ((6.8 - 6.9) / 6.9) * 100, null]);
    expect(c[2].note).toContain('kWh');
    const html = renderToStaticMarkup(createElement(Comparisons, { record: r }));
    for (const x of c.slice(0, 2)) expect(html).toContain(x.label);
    expect(html).not.toContain('Elektroměr ↔ Kyoritsu');
    expect(html).not.toContain('Porovnání není dostupné');
    expect(html).toContain('Kyoritsu: 6,9 kW');
    expect(emailBody([r])).toContain('-1,50 %');
    expect(emailBody([r])).toContain('-1,45 %');
  });
  it('zero Kyoritsu yields neutral unavailable comparison', () => {
    const r = createRecord(readDraft(complete()));
    r.input.kyoritsu = 0;
    expect(measurementComparisons(r)[1].percent).toBeNull();
  });
  it('linked history round trip retains snapshot; legacy detail remains readable', async () => {
    const name = crypto.randomUUID(),
      repo = createHistory(name),
      all = records();
    await repo.merge(all);
    await repo.close();
    const reopened = createHistory(name),
      saved = await reopened.all();
    expect(saved).toHaveLength(4);
    const linked = saved.find(
      (r) => 'stateCheck' in r.input && r.input.stateCheck,
    ) as MeasurementRecord;
    expect(linked.input.stateCheck).toEqual((all[3] as MeasurementRecord).input.stateCheck);
    expect(
      renderToStaticMarkup(createElement(Detail, { record: all[0] as MeasurementRecord })),
    ).toBeTruthy();
    const legacyHtml = renderToStaticMarkup(
      createElement(Comparisons, {
        record: saved.find((r) => r.id === all[0].id) as MeasurementRecord,
      }),
    );
    expect(legacyHtml).toContain('Elektroměr ↔ Energis');
    expect(legacyHtml).toContain('Kyoritsu ↔ Energis');
    expect(legacyHtml).not.toContain('Elektroměr ↔ Kyoritsu');
    await reopened.close();
  });
});
describe('1.2.5 persistent DB and complete backup', () => {
  it.each([1, 2])('initialization preserves v%s data and new records coexist', async (version) => {
    const name = crypto.randomUUID(),
      before = records();
    const old = await openDB(name, version, {
      upgrade(db) {
        const s = db.createObjectStore('measurements', { keyPath: 'id' });
        s.createIndex('by-time', 'savedAt');
      },
    });
    for (const r of before) await old.add('measurements', r);
    old.close();
    const repo = createHistory(name);
    expect(await repo.all()).toEqual(expect.arrayContaining(before));
    await repo.add(createIntervalCheck(draft()));
    expect(await repo.all()).toHaveLength(5);
    await repo.close();
    const reopened = createHistory(name);
    expect(await reopened.all()).toHaveLength(5);
    await reopened.close();
  });
  it('JSON includes all types, metadata and complete unrounded inputs/results', () => {
    const all = records(),
      json = backupJSON(all),
      data = JSON.parse(json);
    expect(data).toMatchObject({
      backupVersion: 3,
      appVersion: '1.4.7',
      database: { name: 'mereni-vyvodu-v1', version: 4 },
    });
    expect(data.exportedAt).toBeTruthy();
    expect(parseBackup(json)).toEqual(all);
  });
  it('round trip into empty DB and repeated import do not create duplicates', async () => {
    const repo = createHistory(crypto.randomUUID()),
      all = records(),
      incoming = parseBackup(backupJSON(all));
    expect(await repo.merge(incoming)).toMatchObject({ added: 4, existing: 0 });
    expect(await repo.all()).toEqual(expect.arrayContaining(all));
    expect(await repo.merge(incoming)).toMatchObject({ added: 0, existing: 4 });
    expect(await repo.all()).toHaveLength(4);
    await repo.close();
  });
  it('partial merge adds missing only and retains conflicting stable-ID local record', async () => {
    const repo = createHistory(crypto.randomUUID()),
      all = records();
    await repo.add(all[0]);
    const incoming = structuredClone(all);
    incoming[0].input.serial = 'DO NOT OVERWRITE';
    expect(planImport(await repo.all(), incoming)).toMatchObject({
      total: 4,
      added: 3,
      existing: 1,
    });
    await repo.merge(incoming);
    expect((await repo.all()).find((r) => r.id === all[0].id)).toEqual(all[0]);
    await repo.close();
  });
  it('concurrent imports recheck duplicates inside serialized transactions', async () => {
    const repo = createHistory(crypto.randomUUID()),
      all = records();
    const result = await Promise.all([repo.merge(all), repo.merge(all)]);
    expect(result.map((x) => x.added).sort()).toEqual([0, 4]);
    expect(await repo.all()).toHaveLength(4);
    await repo.close();
  });
  it('fallback IDs deduplicate content, preserving repeated measurements of same meter', async () => {
    const repo = createHistory(crypto.randomUUID()),
      a = createRecord(readDraft(complete()), new Date('2026-10-22T14:45Z')),
      b = createRecord(a.input, new Date('2026-10-22T16:45Z'));
    const old: any[] = [a, b];
    old.forEach((r) => delete r.id);
    await repo.merge(old);
    expect(await repo.all()).toHaveLength(2);
    await repo.merge(old);
    expect(await repo.all()).toHaveLength(2);
    await repo.close();
  });
  it('ID-less backup matches existing stable-ID record by full measurement content', () => {
    const all = records(),
      old = structuredClone(all) as any[];
    old.forEach((r) => delete r.id);
    expect(planImport(all, old).added).toBe(0);
  });
  it.each([
    '{broken',
    JSON.stringify({ backupVersion: 99 }),
    JSON.stringify({ backupVersion: 1, appVersion: '1', exportedAt: 'bad', records: [] }),
  ])('invalid/incompatible backup cannot mutate DB: %s', async (text) => {
    const repo = createHistory(crypto.randomUUID()),
      before = records();
    await repo.merge(before);
    expect(() => parseBackup(text)).toThrow();
    expect(await repo.all()).toEqual(expect.arrayContaining(before));
    await repo.close();
  });
  it('invalid record anywhere prevents writing even valid rows', async () => {
    const repo = createHistory(crypto.randomUUID()),
      all = records();
    await repo.add(all[0]);
    await expect(repo.merge([...all, { input: {} } as HistoryRecord])).rejects.toThrow(/neplatný/);
    expect(await repo.all()).toEqual([all[0]]);
    await repo.close();
  });
});

it.each([400, 500])('backup accepts complete diagnostic scenarios for %s V', (voltage) => {
  const d = complete();
  d.config.voltage = voltage;
  d.energis = '3';
  const r = createRecord(readDraft(d));
  expect(r.diagnosis.scenarios.length).toBeGreaterThan(0);
  expect(parseBackup(backupJSON([r]))).toEqual([r]);
});
it('a write failure midway through merge rolls back all additions', async () => {
  const repo = createHistory(crypto.randomUUID()),
    all = records();
  await repo.add(all[0]);
  const original = IDBObjectStore.prototype.add;
  let count = 0;
  IDBObjectStore.prototype.add = function (...args: Parameters<IDBObjectStore['add']>) {
    if (++count === 2) throw new DOMException('Test quota failure', 'QuotaExceededError');
    return original.apply(this, args);
  };
  try {
    await expect(repo.merge(all)).rejects.toThrow('Test quota failure');
  } finally {
    IDBObjectStore.prototype.add = original;
  }
  expect(await repo.all()).toEqual([all[0]]);
  await repo.close();
});
