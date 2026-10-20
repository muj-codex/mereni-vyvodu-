import { emptyCurrent, evaluateCurrent } from '../src/core/current';
import { isCurrent } from '../src/data/export';
import { openDB } from 'idb';
import 'fake-indexeddb/auto';
import { it, expect } from 'vitest';
import { createHistory } from '../src/data/history';
import { createRecord, emptyDraft } from '../src/core/measurement';
import type { MeasurementInput } from '../src/core/types';
const input: MeasurementInput = {
  serial: '0001',
  config: emptyDraft().config,
  phases: [
    { u: 230, i: 1, pf: 1, p: 0.23 },
    { u: 230, i: 2, pf: 1, p: 0.46 },
    { u: 230, i: 3, pf: 1, p: 0.69 },
  ],
  kyoritsu: 1.38,
  energis: 1.38,
};
it('IndexedDB ukládá nezávisle, přežije znovuotevření a maže jednotlivě', async () => {
  const name = crypto.randomUUID();
  const store = createHistory(name);
  const first = createRecord(input, new Date('2026-10-17T06:14:37Z'));
  await store.add(first);
  const second = createRecord({ ...input, serial: '0002' }, new Date('2026-10-17T06:15:37Z'));
  await store.add(second);
  input.serial = '9999';
  first.input.phases[0].p = 99;
  await store.close();
  const reopened = createHistory(name);
  const all = await reopened.all();
  expect(all).toHaveLength(2);
  expect(all[0].input.serial).toBe('0002');
  expect(all[1].input.serial).toBe('0001');
  const old = all[1];
  if (isCurrent(old)) throw Error('Expected power record');
  expect(old.input.phases[0].p).toBe(0.23);
  await expect(reopened.add(second)).rejects.toThrow();
  expect(await reopened.all()).toHaveLength(2);
  await reopened.remove(first.id);
  expect(await reopened.all()).toHaveLength(1);
  await reopened.removeAllExplicitly();
  expect(await reopened.all()).toHaveLength(0);
  await reopened.close();
});

it('v1 → v2 migrace zachová původní záznam beze změny', async () => {
  const name = crypto.randomUUID();
  const legacy = createRecord(input);
  delete legacy.input.identification;
  const db = await openDB(name, 1, {
    upgrade(db) {
      const store = db.createObjectStore('measurements', { keyPath: 'id' });
      store.createIndex('by-time', 'savedAt');
    },
  });
  await db.add('measurements', legacy);
  db.close();
  const migrated = createHistory(name);
  expect(await migrated.all()).toEqual([legacy]);
  await migrated.close();
  const reopened = createHistory(name);
  expect(await reopened.all()).toEqual([legacy]);
  await reopened.close();
});

it('proudový záznam přežije zavření a lze reprodukovat z původních vstupů', async () => {
  const name = crypto.randomUUID(),
    store = createHistory(name),
    draft = emptyCurrent();
  draft.serial = '000NN';
  draft.phases = [0, 1, 2].map(() => ({
    primary: '20',
    raw: '33',
    unit: 'mV',
  })) as typeof draft.phases;
  const record = evaluateCurrent(draft);
  await store.add(record);
  await store.close();
  const reopened = createHistory(name);
  const [saved] = await reopened.all();
  expect(saved).toEqual(record);
  if (!isCurrent(saved)) throw Error('Expected current record');
  const reproduced = evaluateCurrent({
    ...draft,
    serial: saved.input.serial,
    identification: saved.input.identification,
    ctPrimary: saved.input.ctPrimary,
    range: saved.input.range,
    phases: saved.phases.map((p) => ({
      primary: String(p.primary),
      raw: p.raw,
      unit: p.unit,
    })) as typeof draft.phases,
  });
  expect(reproduced.phases).toEqual(saved.phases);
  await reopened.close();
});
