import 'fake-indexeddb/auto';
import { expect, it } from 'vitest';
import ExcelJS from 'exceljs';
import { createSeriesStore } from '../src/series/store';
import { createHistory } from '../src/data/history';
import { blankEntry, latest, nextReading, validateSeries, type Reading } from '../src/series/model';
import { seriesGroups } from '../src/series/grouping';
import { resultRows } from '../src/ui/resultsView';
import { readingTimeOffset } from '../src/series/energisDisplay';
import { usedEnergisBoundary } from '../src/series/SavedEnergis';
import { planSavedEnergis } from '../src/series/energisImport';
import { backupJSON, parseBackup } from '../src/data/backup';
const entry = (serial: string, node = serial) => ({
  ...blankEntry(),
  location: 'TS 4601/251',
  placement: serial === '123' ? 'pole 21' : 'pole 54',
  serial,
  node,
  date: '2026-10-23',
  time: '17:33',
  value: '1000',
});
async function interval(
  store: ReturnType<typeof createSeriesStore>,
  serial: string,
  node = serial,
  boundary: 'previous' | 'next' = 'previous',
) {
  const { meter, reading: a, batch } = await store.first(entry(serial, node));
  const b = nextReading(meter, a, {
    date: '2026-10-24',
    time: '08:37',
    value: '1020',
    energis: '',
    active: true,
    boundary,
  });
  await store.append([{ meter, previous: a, reading: b }]);
  return { meter, a, b, batch };
}
it('1.3.1 batchId groups a series once, uses latest real reading and searches all members', async () => {
  const store = createSeriesStore(crypto.randomUUID());
  const first = await interval(store, '123', '21210001');
  await store.first({ ...entry('234', '21210002'), time: '17:35' }, first.batch.id);
  const data = await store.all();
  expect(seriesGroups(data)).toHaveLength(1);
  expect(resultRows([], data)).toMatchObject([
    { batchId: first.batch.id, meterCount: 2, at: '2026-10-24T08:37' },
  ]);
  for (const query of ['21210002', '234', '4601', 'pole 54'])
    expect(resultRows([], data, query)).toHaveLength(1);
  const other = await store.first({ ...entry('345'), date: '2026-10-25', time: '01:00' });
  expect(other.batch.id).not.toBe(first.batch.id);
  expect(seriesGroups(await store.all())).toHaveLength(2); // same TS is insufficient to merge distinct IDs
  await store.close();
});
it('explicit series membership survives a changed initial-entry date', async () => {
  const store = createSeriesStore(crypto.randomUUID());
  const { batch } = await store.first(entry('123'));
  await store.first({ ...entry('234'), date: '2026-10-24' }, batch.id);
  expect(seriesGroups(await store.all())[0].meters).toHaveLength(2);
  await expect(store.first({ ...entry('345'), location: 'R201' }, batch.id)).rejects.toThrow(
    'jinému',
  );
  await store.close();
});
it('late manual SUMA and per-interval boundary preserve saved states, chain, tracking and following readings', async () => {
  const store = createSeriesStore(crypto.randomUUID());
  const { meter, a, b } = await interval(store, '123');
  const c = nextReading(meter, b, {
    date: '2026-10-25',
    time: '08:37',
    value: '1050',
    energis: '',
    active: false,
    boundary: 'next',
  });
  await store.append([{ meter, previous: b, reading: c }]);
  expect(b.energis).toBeUndefined();
  await store.updateEnergis([{ reading: b, energis: '20', boundary: 'previous' }]);
  let data = await store.all();
  const edited = data.readings.find((r) => r.id === b.id)!;
  expect(edited).toMatchObject({
    id: b.id,
    previousId: a.id,
    value: 1020,
    result: { meterEnergy: 20, difference: 0, percent: 0 },
    boundary: 'previous',
  });
  expect(data.readings).toHaveLength(3);
  expect(latest(data.readings, meter.id)).toEqual(c);
  expect(data.meters[0].active).toBe(false);
  expect(data.readings.find((r) => r.id === a.id)).toEqual(a);
  expect(validateSeries(data)).toEqual(data);
  await expect(
    store.updateEnergis([{ reading: b, energis: '40', boundary: 'next' }]),
  ).rejects.toThrow('mezitím');
  await expect(
    store.updateEnergis([{ reading: a, energis: '20', boundary: 'previous' }]),
  ).rejects.toThrow('intervalu');
  data = await store.all();
  expect(data.readings.find((r) => r.id === b.id)).toEqual(edited);
  await store.close();
});
it('edited interval JSON restores into empty and existing DB, is idempotent and older backup cannot undo the edit', async () => {
  const store = createSeriesStore(crypto.randomUUID());
  const { b } = await interval(store, '123');
  const old = parseBackup(backupJSON([], new Date(), await store.all()));
  await store.updateEnergis([{ reading: b, energis: '20', boundary: 'next' }]);
  const current = parseBackup(backupJSON([], new Date(), await store.all()));
  const targetName = crypto.randomUUID();
  const target = createHistory(targetName);
  await target.merge(old);
  await target.merge(current);
  await target.merge(current);
  await target.merge(old);
  const inspected = createSeriesStore(targetName);
  expect(await inspected.all()).toEqual(current.seriesData);
  await inspected.close();
  // Exercise the same merge planner through both persistence adapters.
  const direct = createSeriesStore(crypto.randomUUID());
  await direct.merge(old.seriesData!);
  await direct.merge(current.seriesData!);
  await direct.merge(old.seriesData!);
  expect(await direct.all()).toEqual(current.seriesData);
  await target.close();
  await direct.close();
  await store.close();
});
it.each(['previous', 'next'] as const)(
  '08:37 %s gives the selected real time boundary and saved minute offset',
  async (boundary) => {
    const store = createSeriesStore(crypto.randomUUID());
    const { b } = await interval(store, '123', '123', boundary);
    expect(readingTimeOffset(undefined, b.date, b.time, b.boundary)).toBe(
      boundary === 'previous' ? '-7 min E' : '+8 min E',
    );
    expect(usedEnergisBoundary(b)).toBe(
      boundary === 'previous' ? '2026-10-24 08:30' : '2026-10-24 08:45',
    );
    expect(
      parseBackup(backupJSON([], new Date(), await store.all())).seriesData!.readings.find(
        (r) => r.id === b.id,
      )?.boundary,
    ).toBe(boundary);
    await store.close();
  },
);
it.each(['txt', 'xlsx'])(
  '%s import joins UZEL, ignores foreign nodes and preserves manual values',
  async (extension) => {
    const store = createSeriesStore(crypto.randomUUID());
    await interval(store, '123', '21210001');
    const manual = await interval(store, '234', '21210002');
    await interval(store, '345', '');
    await store.updateEnergis([{ reading: manual.b, energis: '99', boundary: 'next' }]);
    const grid = [
      ['Agregace 1/4 24.10.2026'],
      ['UZEL', 'Popis', 'Jednotka', '24.10.2026 08:00-15', '24.10.2026 08:15-30', 'SUMA'],
      ['99999999', 'foreign', 'kWh', 100, 100, 200],
      ['21210002', 'manual', 'kWh', 10, 10, 20],
      ['21210001', 'target', 'kWh', 10, 10, 20],
    ];
    let file: File;
    if (extension === 'xlsx') {
      const workbook = new ExcelJS.Workbook();
      workbook.addWorksheet('Energis').addRows(grid);
      file = new File([(await workbook.xlsx.writeBuffer()) as BlobPart], 'energis.xlsx');
    } else file = new File([grid.map((r) => r.join('\t')).join('\n')], 'energis.txt');
    const data = await store.all();
    const plan = await planSavedEnergis(file, data.meters, data.readings);
    expect(plan.updates).toHaveLength(1);
    expect(plan.updates[0].import.node).toBe('21210001');
    expect(plan.issues.join(' ')).toContain('nepřepsal');
    expect(plan.issues.join(' ')).toContain('bez UZLU');
    await store.updateEnergis(plan.updates, true);
    const after = await store.all();
    expect(after.readings.find((r) => r.id === manual.b.id)?.energis).toBe(99);
    expect(after.readings).toHaveLength(data.readings.length);
    expect(after.meters).toEqual(data.meters);
    expect(validateSeries(after)).toEqual(after);
    await store.close();
  },
);
it('ambiguous UZEL membership is reported instead of assigning one SUMA to multiple outlets', async () => {
  const store = createSeriesStore(crypto.randomUUID());
  const { meter, b } = await interval(store, '123', '21210001');
  const file = new File(
    ['Agregace 1/4 24.10.2026\nUZEL\tJednotka\t24.10.2026 08:15-30\tSUMA\n21210001\tkWh\t20\t20'],
    'energis.txt',
  );
  const plan = await planSavedEnergis(
    file,
    [meter, { ...meter, id: 'other', serial: 'other' }],
    [b as Reading],
  );
  expect(plan.updates).toHaveLength(0);
  expect(plan.issues.join(' ')).toContain('nejednoznačný');
  await store.close();
});
