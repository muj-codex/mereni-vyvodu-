import { timestamp, type Reading, type SeriesData, type SeriesRound } from './model';

// Old storage cannot identify visits within a day. Preserve every actual reading,
// and explicitly mark the compatible daily overview as legacy rather than inventing times.
export function withRounds(data: SeriesData): SeriesData & { rounds: SeriesRound[] } {
  const rounds = structuredClone(data.rounds ?? []);
  const linked = new Set(
    rounds.flatMap((r) => r.entries.flatMap((e) => (e.readingId ? [e.readingId] : []))),
  );
  for (const b of data.batches) {
    const ids = new Set(data.meters.filter((m) => m.batchId === b.id).map((m) => m.id));
    const days = new Map<string, Reading[]>();
    for (const r of data.readings) {
      if (!ids.has(r.meterId) || linked.has(r.id) || r.roundId) continue;
      days.set(r.date, [...(days.get(r.date) ?? []), r]);
    }
    for (const [date, rows] of days) {
      const roundId = `legacy:${b.id}:${date}`;
      const old = rounds.find((r) => r.roundId === roundId);
      const entries = rows.map((r) => ({ meterId: r.meterId, readingId: r.id }));
      if (old) old.entries.push(...entries);
      else
        rounds.push({
          roundId,
          batchId: b.id,
          roundDate: date,
          roundTime: rows.map((r) => r.time.padStart(5, '0')).sort()[0],
          legacy: true,
          entries,
        });
    }
  }
  return { ...data, rounds };
}
export function validateRounds(data: SeriesData & { rounds: SeriesRound[] }) {
  const ids = new Set<string>(),
    linked = new Set<string>();
  for (const r of data.rounds) {
    if (
      !r ||
      typeof r.roundId !== 'string' ||
      !r.roundId ||
      ids.has(r.roundId) ||
      !data.batches.some((b) => b.id === r.batchId) ||
      !Array.isArray(r.entries) ||
      (r.legacy !== undefined && typeof r.legacy !== 'boolean')
    )
      throw Error('Neplatné kolo série.');
    timestamp(r.roundDate, r.roundTime);
    ids.add(r.roundId);
    const meters = new Set<string>();
    for (const e of r.entries) {
      if (
        !data.meters.some((m) => m.id === e.meterId && m.batchId === r.batchId) ||
        (!r.legacy && meters.has(e.meterId))
      )
        throw Error('Neplatný vývod kola.');
      meters.add(e.meterId);
      if (e.readingId !== undefined) {
        const reading = data.readings.find((x) => x.id === e.readingId);
        if (
          !reading ||
          reading.meterId !== e.meterId ||
          linked.has(e.readingId) ||
          ((!r.legacy || reading.roundId !== undefined) && reading.roundId !== r.roundId)
        )
          throw Error('Neplatná vazba kola.');
        linked.add(e.readingId);
      }
    }
  }
  for (const reading of data.readings)
    if (reading.roundId !== undefined && (!ids.has(reading.roundId) || !linked.has(reading.id)))
      throw Error('Chybí kolo odečtu.');
}
export function roundsFor(data: SeriesData, batchId: string) {
  return withRounds(data)
    .rounds.filter((r) => r.batchId === batchId && (!r.legacy || r.entries.length > 0))
    .sort(
      (a, b) =>
        (a.roundDate + a.roundTime).localeCompare(b.roundDate + b.roundTime) ||
        a.roundId.localeCompare(b.roundId),
    );
}
export function roundLabel(r: SeriesRound) {
  const [y, m, d] = r.roundDate.split('-');
  return `${d}.${m}.${y} ${r.roundTime}`;
}
