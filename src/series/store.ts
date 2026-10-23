import { openDB } from 'idb';
import { DATABASE_NAME, DATABASE_VERSION } from '../data/schema';
import {
  emptySeries,
  firstReading,
  latest,
  nextReading,
  resolveMeter,
  validateSeries,
  type Entry,
  type SeriesData,
  type Reading,
  type Meter,
} from './model';
export function upgradeSeries(db: {
  objectStoreNames: { contains(s: string): boolean };
  createObjectStore(s: string, options: { keyPath: string }): any;
}) {
  for (const name of ['series', 'meters', 'readings'])
    if (!db.objectStoreNames.contains(name)) {
      const s = db.createObjectStore(name, { keyPath: 'id' });
      if (name === 'series') s.createIndex('by-location-date', ['location', 'date']);
      if (name === 'meters') {
        s.createIndex('by-batch', 'batchId');
        s.createIndex('by-serial', 'serial');
        s.createIndex('by-node', 'node');
      }
      if (name === 'readings') s.createIndex('by-meter', 'meterId');
    }
}
export function createSeriesStore(name = DATABASE_NAME) {
  const promise = openDB(name, DATABASE_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains('measurements'))
        db.createObjectStore('measurements', { keyPath: 'id' }).createIndex('by-time', 'savedAt');
      upgradeSeries(db);
    },
    blocking() {
      void promise.then((db) => db.close());
    },
  });
  return {
    async all(): Promise<SeriesData> {
      const db = await promise;
      const tx = db.transaction(['series', 'meters', 'readings']);
      const [batches, meters, readings] = await Promise.all(
        ['series', 'meters', 'readings'].map((s) => tx.objectStore(s).getAll()),
      );
      await tx.done;
      return { batches, meters, readings };
    },
    async first(e: Entry) {
      const db = await promise;
      const tx = db.transaction(['series', 'meters', 'readings'], 'readwrite');
      try {
        const bySerial: Meter[] = await tx
          .objectStore('meters')
          .index('by-serial')
          .getAll(e.serial.trim());
        const byNode: Meter[] = e.node
          ? await tx.objectStore('meters').index('by-node').getAll(e.node)
          : [];
        const meters = [...new Map([...bySerial, ...byNode].map((m) => [m.id, m])).values()];
        if (resolveMeter(meters, e.serial, e.node))
          throw Error('Elektroměr již existuje. Pokračujte dalším odečtem z historie.');
        let batch: SeriesData['batches'][number] | undefined = await tx
          .objectStore('series')
          .index('by-location-date')
          .get([e.location.trim(), e.date]);
        if (!batch) batch = { id: crypto.randomUUID(), location: e.location.trim(), date: e.date };
        const { meter, reading } = firstReading(e, batch.id);
        await tx.objectStore('series').put(batch);
        await tx.objectStore('meters').add(meter);
        await tx.objectStore('readings').add(reading);
        await tx.done;
        return { meter, reading, batch };
      } catch (e) {
        try {
          tx.abort();
        } catch {}
        await tx.done.catch(() => {});
        throw e;
      }
    },
    async append(rows: { meter: Meter; previous: Reading; reading: Reading }[]) {
      const db = await promise;
      const tx = db.transaction(['meters', 'readings'], 'readwrite');
      try {
        for (const row of rows) {
          const stored: Meter = await tx.objectStore('meters').get(row.meter.id);
          const history: Reading[] = await tx
            .objectStore('readings')
            .index('by-meter')
            .getAll(row.meter.id);
          const last = latest(history, row.meter.id);
          if (!stored || !last || last.id !== row.previous.id)
            throw Error(
              'Historie byla mezitím změněna. Obnovte stránku a zkontrolujte poslední odečet.',
            );
          const r = row.reading;
          const verified = nextReading(stored, last, {
            ...r,
            value: String(r.value),
            energis: r.energis === undefined ? '' : String(r.energis),
          });
          if (
            r.previousId !== last.id ||
            r.meterId !== stored.id ||
            JSON.stringify(r.result) !== JSON.stringify(verified.result)
          )
            throw Error('Neplatný interval.');
          await tx.objectStore('readings').add(r);
          await tx.objectStore('meters').put({ ...stored, active: r.active });
        }
        await tx.done;
      } catch (e) {
        try {
          tx.abort();
        } catch {}
        await tx.done.catch(() => {});
        throw e;
      }
    },
    async merge(data: SeriesData) {
      const incoming = validateSeries(data);
      const db = await promise;
      const tx = db.transaction(['series', 'meters', 'readings'], 'readwrite');
      try {
        const existing = emptySeries();
        for (const [key, store] of [
          ['batches', 'series'],
          ['meters', 'meters'],
          ['readings', 'readings'],
        ] as const)
          (existing[key] as unknown[]) = await tx.objectStore(store).getAll();
        const additions = planSeriesMerge(existing, incoming);
        for (const [key, store] of [
          ['batches', 'series'],
          ['meters', 'meters'],
          ['readings', 'readings'],
        ] as const)
          for (const r of additions[key]) await tx.objectStore(store).put(r);
        await tx.done;
        return additions.batches.length + additions.meters.length + additions.readings.length;
      } catch (e) {
        try {
          tx.abort();
        } catch {}
        await tx.done.catch(() => {});
        throw e;
      }
    },
    async close() {
      (await promise).close();
    },
  };
}

export function planSeriesMerge(existing: SeriesData, incoming: SeriesData): SeriesData {
  const merged = structuredClone(existing),
    additions = emptySeries();
  const canonical = (v: unknown): string => {
    if (Array.isArray(v)) return '[' + v.map(canonical).join(',') + ']';
    if (v && typeof v === 'object')
      return (
        '{' +
        Object.entries(v)
          .filter(([, v]) => v !== undefined)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([k, v]) => JSON.stringify(k) + ':' + canonical(v))
          .join(',') +
        '}'
      );
    return JSON.stringify(v);
  };
  for (const key of ['batches', 'meters', 'readings'] as const)
    for (const row of incoming[key]) {
      const prev = merged[key].find((r) => r.id === row.id);
      const comparable = (v: unknown) =>
        key === 'meters' ? { ...(v as Meter), active: undefined } : v;
      if (prev && canonical(comparable(prev)) !== canonical(comparable(row)))
        throw Error('Konflikt stejného ID série. Nic nebylo přepsáno.');
      if (!prev) {
        (merged[key] as unknown[]).push(row);
        (additions[key] as unknown[]).push(row);
      }
    }
  for (const m of merged.meters) {
    const last = latest(merged.readings, m.id);
    if (last && m.active !== last.active) {
      m.active = last.active;
      const i = additions.meters.findIndex((x) => x.id === m.id);
      if (i >= 0) additions.meters[i] = m;
      else additions.meters.push(m);
    }
  }
  validateSeries(merged);
  return additions;
}
