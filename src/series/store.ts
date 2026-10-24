import { standaloneMeters } from './grouping';
import { withRounds, validateRounds } from './rounds';
import type { SeriesRound } from './model';
import { openDB } from 'idb';
import { DATABASE_NAME, DATABASE_VERSION } from '../data/schema';
import {
  emptySeries,
  firstReading,
  latest,
  nextReading,
  resolveMeter,
  validateSeries,
  timestamp,
  normalizeTime,
  type Entry,
  type SeriesData,
  type Reading,
  type Meter,
} from './model';
const trackingStamp = (meter: Meter) =>
  new Date(
    Math.max(Date.now(), (Date.parse(meter.trackingUpdatedAt || '') || 0) + 1),
  ).toISOString();
export function upgradeSeries(db: {
  objectStoreNames: { contains(s: string): boolean };
  createObjectStore(s: string, options: { keyPath: string }): any;
}) {
  if (!db.objectStoreNames.contains('rounds'))
    db.createObjectStore('rounds', { keyPath: 'roundId' });
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
    upgrade(db, oldVersion, _newVersion, tx) {
      if (!db.objectStoreNames.contains('measurements'))
        db.createObjectStore('measurements', { keyPath: 'id' }).createIndex('by-time', 'savedAt');
      upgradeSeries(db);
      if (oldVersion < 4) void migrateRounds(tx).catch(() => tx.abort());
    },
    blocking() {
      void promise.then((db) => db.close());
    },
  });
  return {
    async all(): Promise<SeriesData> {
      const db = await promise;
      const tx = db.transaction(['series', 'meters', 'readings', 'rounds']);
      const [batches, meters, readings, rounds] = await Promise.all(
        ['series', 'meters', 'readings', 'rounds'].map((s) => tx.objectStore(s).getAll()),
      );
      await tx.done;
      return withRounds({ batches, meters, readings, rounds });
    },
    async first(
      e: Entry,
      batchId?: string,
      visit?: { roundDate: string; roundTime: string; roundId?: string },
      kind: 'series' | 'standalone' = 'series',
    ) {
      const db = await promise;
      const tx = db.transaction(['series', 'meters', 'readings', 'rounds'], 'readwrite');
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
        let batch: SeriesData['batches'][number] | undefined = batchId
          ? await tx.objectStore('series').get(batchId)
          : undefined;
        if (kind === 'standalone') batch = undefined;
        if (batch && batch.kind === 'standalone') throw Error('Vyberte odečtovou sérii.');
        if (batch && batch.location !== e.location.trim())
          throw Error('Série patří k jinému TS/R.');
        if (!batch && kind === 'series') {
          const matches: SeriesData['batches'] = await tx
            .objectStore('series')
            .index('by-location-date')
            .getAll([e.location.trim(), e.date]);
          batch = matches.find((b) => b.kind !== 'standalone');
        }
        if (!batch)
          batch = {
            id: crypto.randomUUID(),
            location: e.location.trim(),
            date: e.date,
            ...(kind === 'standalone' ? { kind } : {}),
          };
        const { meter, reading } = firstReading(e, batch.id);
        const storedRounds: SeriesRound[] = await tx.objectStore('rounds').getAll();
        const initialRound = visit?.roundId
          ? storedRounds.find((r) => r.roundId === visit.roundId && r.batchId === batch!.id)
          : !visit
            ? storedRounds
                .filter((r) => r.batchId === batch!.id && !r.legacy)
                .sort((a, b) =>
                  (a.roundDate + a.roundTime).localeCompare(b.roundDate + b.roundTime),
                )[0]
            : undefined;
        const round: SeriesRound = initialRound ?? {
          roundId: crypto.randomUUID(),
          batchId: batch.id,
          roundDate: visit?.roundDate ?? e.date,
          roundTime: normalizeTime(visit?.roundTime ?? e.time),
          entries: [],
        };
        if (visit?.roundId && !initialRound) throw Error('Kolo série nenalezeno.');
        if (visit && initialRound) {
          round.roundDate = visit.roundDate;
          round.roundTime = normalizeTime(visit.roundTime);
        }
        timestamp(round.roundDate, round.roundTime);
        reading.roundId = round.roundId;
        round.entries.push({ meterId: meter.id, readingId: reading.id });
        await tx.objectStore('rounds').put(round);
        await tx.objectStore('series').put(batch);
        await tx.objectStore('meters').add(meter);
        await tx.objectStore('readings').add(reading);
        await tx.done;
        return { meter, reading, batch, round };
      } catch (e) {
        try {
          tx.abort();
        } catch {}
        await tx.done.catch(() => {});
        throw e;
      }
    },
    async attachToSeries(meterId: string, batchId: string) {
      const db = await promise;
      const tx = db.transaction(['series', 'meters', 'readings', 'rounds'], 'readwrite');
      try {
        const batches = await tx.objectStore('series').getAll();
        const meters = await tx.objectStore('meters').getAll();
        const meter: Meter | undefined = meters.find((m: Meter) => m.id === meterId);
        if (
          !meter ||
          !standaloneMeters({ batches, meters, readings: [] }).some((m) => m.id === meterId)
        )
          throw Error('Elektroměr už patří do série.');
        if (!batches.some((b) => b.id === batchId && b.kind !== 'standalone'))
          throw Error('Série nenalezena.');
        const snapshot = withRounds({
          batches,
          meters,
          readings: await tx.objectStore('readings').getAll(),
          rounds: await tx.objectStore('rounds').getAll(),
        });
        for (const round of snapshot.rounds) await tx.objectStore('rounds').put(round);
        await tx
          .objectStore('meters')
          .put({
            ...meter,
            batchId,
            membershipUpdatedAt: new Date(
              Math.max(Date.now(), (Date.parse(meter.membershipUpdatedAt || '') || 0) + 1),
            ).toISOString(),
          });
        await tx.done;
      } catch (e) {
        try {
          tx.abort();
        } catch {}
        await tx.done.catch(() => {});
        throw e;
      }
    },
    async reactivate(id: string) {
      const db = await promise;
      const tx = db.transaction('meters', 'readwrite');
      const meter: Meter | undefined = await tx.store.get(id);
      if (!meter) throw Error('Elektroměr nenalezen.');
      await tx.store.put({ ...meter, active: true, trackingUpdatedAt: trackingStamp(meter) });
      await tx.done;
    },
    async append(
      rows: { meter: Meter; previous: Reading; reading: Reading }[],
      visits: SeriesRound[] = [],
    ) {
      const db = await promise;
      const tx = db.transaction(['series', 'meters', 'readings', 'rounds'], 'readwrite');
      try {
        if (visits.length) {
          const data = {
            batches: await tx.objectStore('series').getAll(),
            meters: await tx.objectStore('meters').getAll(),
            readings: rows.map((r) => r.reading),
            rounds: visits,
          };
          validateRounds(data);
          if (
            visits.some((v) =>
              v.entries.some(
                (e) => !data.meters.some((m) => m.id === e.meterId && m.batchId === v.batchId),
              ),
            )
          )
            throw Error('Vývod nepatří do této série.');
          const requested = visits.flatMap((v) =>
            v.entries.flatMap((e) => (e.readingId ? [e.readingId] : [])),
          );
          if (
            requested.length !== rows.length ||
            rows.some((r) => !requested.includes(r.reading.id))
          )
            throw Error('Neúplné kolo.');
          for (const v of visits) await tx.objectStore('rounds').add(v);
        }
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
          if (!/^\d*$/.test(row.meter.node)) throw Error('UZEL smí obsahovat pouze číslice.');
          await tx.objectStore('meters').put({
            ...stored,
            node: row.meter.node,
            active: r.active,
            trackingUpdatedAt: trackingStamp(stored),
          });
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
    async updateEnergis(
      updates: {
        reading: Reading;
        energis: string;
        boundary: 'previous' | 'next';
        import?: import('./model').EnergisMeta;
      }[],
      imported = false,
    ) {
      const db = await promise;
      const tx = db.transaction(['meters', 'readings'], 'readwrite');
      let changed = 0;
      try {
        for (const update of updates) {
          const stored: Reading | undefined = await tx
            .objectStore('readings')
            .get(update.reading.id);
          if (!stored || JSON.stringify(stored) !== JSON.stringify(update.reading))
            throw Error('Interval byl mezitím změněn. Obnovte historii.');
          if (imported && stored.energis !== undefined) continue;
          const meter: Meter = await tx.objectStore('meters').get(stored.meterId);
          const previous: Reading | undefined = stored.previousId
            ? await tx.objectStore('readings').get(stored.previousId)
            : undefined;
          if (!previous || !meter)
            throw Error('SUMA ENERGIS patří až k intervalu mezi dvěma odečty.');
          const computed = nextReading(meter, previous, {
            ...stored,
            value: String(stored.value),
            energis: update.energis,
            boundary: update.boundary,
            import: update.import,
          });
          await tx.objectStore('readings').put({
            ...stored,
            energis: computed.energis,
            result: computed.result,
            boundary: update.boundary,
            import: update.import,
            energisUpdatedAt: new Date(
              Math.max(Date.now(), (Date.parse(stored.energisUpdatedAt || '') || 0) + 1),
            ).toISOString(),
          });
          changed++;
        }
        await tx.done;
        return changed;
      } catch (error) {
        try {
          tx.abort();
        } catch {}
        await tx.done.catch(() => {});
        throw error;
      }
    },
    async merge(data: SeriesData) {
      const incoming = validateSeries(data);
      const db = await promise;
      const tx = db.transaction(['series', 'meters', 'readings', 'rounds'], 'readwrite');
      try {
        const existing = emptySeries();
        for (const [key, store] of [
          ['batches', 'series'],
          ['meters', 'meters'],
          ['readings', 'readings'],
          ['rounds', 'rounds'],
        ] as const)
          (existing[key] as unknown[]) = await tx.objectStore(store).getAll();
        const additions = planSeriesMerge(existing, incoming);
        for (const [key, store] of [
          ['batches', 'series'],
          ['meters', 'meters'],
          ['readings', 'readings'],
          ['rounds', 'rounds'],
        ] as const)
          for (const r of additions[key] ?? []) await tx.objectStore(store).put(r);
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
  const merged = withRounds(structuredClone(existing));
  incoming = withRounds(structuredClone(incoming));
  const additions = emptySeries();
  additions.rounds = [];
  // An older backup has no visit identity. Keep known explicit membership, and
  // upgrade a legacy membership when a newer backup supplies the real round ID.
  for (const reading of merged.readings) {
    const next = incoming.readings.find((r) => r.id === reading.id);
    if (!next) continue;
    const oldRound = merged.rounds.find((r) => r.entries.some((e) => e.readingId === reading.id));
    const newRound = incoming.rounds?.find((r) =>
      r.entries.some((e) => e.readingId === reading.id),
    );
    if (!oldRound || !newRound || oldRound.roundId === newRound.roundId) continue;
    if (!oldRound.legacy && !newRound.legacy) throw Error('Konflikt kola odečtu.');
    if (!oldRound.legacy) {
      newRound.entries = newRound.entries.filter((e) => e.readingId !== reading.id);
      next.roundId = reading.roundId;
    } else if (!newRound.legacy) {
      oldRound.entries = oldRound.entries.filter((e) => e.readingId !== reading.id);
      reading.roundId = next.roundId;
      if (!additions.rounds.some((r) => r.roundId === oldRound.roundId))
        additions.rounds.push(oldRound);
      additions.readings.push(reading);
    }
  }
  incoming.rounds = incoming.rounds?.filter((r) => !r.legacy || r.entries.length);

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
        key === 'meters'
          ? {
              ...(v as Meter),
              active: undefined,
              trackingUpdatedAt: undefined,
              node: undefined,
              batchId: undefined,
              membershipUpdatedAt: undefined,
            }
          : key === 'readings'
            ? {
                ...(v as Reading),
                roundId: undefined,
                energis: undefined,
                import: undefined,
                result: undefined,
                boundary: undefined,
                energisUpdatedAt: undefined,
              }
            : v;
      if (
        key === 'meters' &&
        prev &&
        (prev as Meter).node !== (row as Meter).node &&
        !(prev as Meter).trackingUpdatedAt &&
        !(row as Meter).trackingUpdatedAt
      )
        throw Error('Konflikt UZLU stejného elektroměru. Nic nebylo přepsáno.');
      if (
        key === 'readings' &&
        prev &&
        (prev as Reading).roundId &&
        (row as Reading).roundId &&
        (prev as Reading).roundId !== (row as Reading).roundId
      )
        throw Error('Konflikt kola odečtu.');
      if (
        key === 'meters' &&
        prev &&
        (prev as Meter).batchId !== (row as Meter).batchId &&
        !(prev as Meter).membershipUpdatedAt &&
        !(row as Meter).membershipUpdatedAt
      )
        throw Error('Konflikt členství elektroměru.');
      if (prev && canonical(comparable(prev)) !== canonical(comparable(row)))
        throw Error('Konflikt stejného ID série. Nic nebylo přepsáno.');
      if (key === 'readings' && prev) {
        const old = prev as Reading,
          next = row as Reading;
        const fields = (r: Reading) =>
          canonical({
            energis: r.energis,
            import: r.import,
            result: r.result,
            boundary: r.boundary,
          });
        if (!old.energisUpdatedAt && !next.energisUpdatedAt && fields(old) !== fields(next))
          throw Error('Konflikt stejného ID intervalu.');
        if (
          old.energisUpdatedAt &&
          next.energisUpdatedAt &&
          Date.parse(old.energisUpdatedAt) === Date.parse(next.energisUpdatedAt) &&
          fields(old) !== fields(next)
        )
          throw Error('Konflikt stejné revize Energisu.');
        if (
          next.energisUpdatedAt &&
          (!old.energisUpdatedAt ||
            Date.parse(next.energisUpdatedAt) > Date.parse(old.energisUpdatedAt))
        ) {
          Object.assign(old, next);
          additions.readings.push(old);
        }
      }
      if (!prev) {
        (merged[key] as unknown[]).push(row);
        (additions[key] as unknown[]).push(row);
      }
    }
  for (const row of incoming.rounds ?? []) {
    const prev = merged.rounds.find((r) => r.roundId === row.roundId);
    if (prev && canonical(prev) !== canonical(row)) {
      if (
        prev.batchId !== row.batchId ||
        prev.roundDate !== row.roundDate ||
        prev.legacy !== row.legacy ||
        (!prev.legacy && prev.roundTime !== row.roundTime)
      )
        throw Error('Konflikt stejného ID kola.');
      const entries = [...prev.entries];
      for (const entry of row.entries) {
        const same = entries.find((e) =>
          prev.legacy ? e.readingId === entry.readingId : e.meterId === entry.meterId,
        );
        if (same && canonical(same) !== canonical(entry)) throw Error('Konflikt vývodu kola.');
        if (!same) entries.push(entry);
      }
      const updated = {
        ...prev,
        roundTime: prev.legacy ? [prev.roundTime, row.roundTime].sort()[0] : prev.roundTime,
        entries,
      };
      Object.assign(prev, updated);
      additions.rounds.push(updated);
    } else if (!prev) {
      merged.rounds.push(row);
      additions.rounds.push(row);
    }
  }
  for (const m of merged.meters) {
    const last = latest(merged.readings, m.id);
    const incomingMeter = incoming.meters.find((x) => x.id === m.id);
    if (
      incomingMeter?.trackingUpdatedAt &&
      (!m.trackingUpdatedAt || incomingMeter.trackingUpdatedAt > m.trackingUpdatedAt)
    ) {
      m.active = incomingMeter.active;
      m.node = incomingMeter.node;
      m.trackingUpdatedAt = incomingMeter.trackingUpdatedAt;
      additions.meters.push(m);
    }
    if (incomingMeter?.membershipUpdatedAt) {
      if (
        m.membershipUpdatedAt === incomingMeter.membershipUpdatedAt &&
        m.batchId !== incomingMeter.batchId
      )
        throw Error('Konflikt revize členství.');
      if (!m.membershipUpdatedAt || incomingMeter.membershipUpdatedAt > m.membershipUpdatedAt) {
        m.batchId = incomingMeter.batchId;
        m.membershipUpdatedAt = incomingMeter.membershipUpdatedAt;
        additions.meters.push(m);
      }
    }
    if (last && !m.trackingUpdatedAt && m.active !== last.active) {
      m.active = last.active;
      const i = additions.meters.findIndex((x) => x.id === m.id);
      if (i >= 0) additions.meters[i] = m;
      else additions.meters.push(m);
    }
  }
  validateSeries(merged);
  return additions;
}

// Runs inside the versionchange transaction: legacy readings retain their exact timestamps.
export async function migrateRounds(tx: any) {
  const [batches, meters, readings] = await Promise.all(
    ['series', 'meters', 'readings'].map((s) => tx.objectStore(s).getAll()),
  );
  const data = withRounds({ batches, meters, readings });
  for (const round of data.rounds) {
    await tx.objectStore('rounds').put(round);
    for (const entry of round.entries) {
      const reading = readings.find((r: Reading) => r.id === entry.readingId);
      if (reading) await tx.objectStore('readings').put({ ...reading, roundId: round.roundId });
    }
  }
}
