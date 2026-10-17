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
  expect(all[1].input.phases[0].p).toBe(0.23);
  await expect(reopened.add(second)).rejects.toThrow();
  expect(await reopened.all()).toHaveLength(2);
  await reopened.remove(first.id);
  expect(await reopened.all()).toHaveLength(1);
  await reopened.clear();
  expect(await reopened.all()).toHaveLength(0);
  await reopened.close();
});
