import { latest, type SeriesData } from './model';
// Persisted batchId is the only membership authority; equal station names are insufficient.
export function seriesGroups(data: SeriesData) {
  return data.batches
    .map((batch) => {
      const meters = data.meters.filter((m) => m.batchId === batch.id);
      const at =
        meters
          .map((m) => latest(data.readings, m.id))
          .filter(Boolean)
          .map((r) => `${r.date}T${r.time}`)
          .sort()
          .at(-1) || '';
      return { batch, meters, at };
    })
    .filter((g) => g.meters.length)
    .sort((a, b) => b.at.localeCompare(a.at));
}
