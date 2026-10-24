import { roundsFor } from './rounds';
import { latest, type SeriesData } from './model';
// Persisted batchId is the only membership authority; equal station names are insufficient.
export function seriesGroups(data: SeriesData) {
  return data.batches
    .map((batch) => {
      const meters = data.meters.filter((m) => m.batchId === batch.id);
      const round = roundsFor(data, batch.id).at(-1);
      const at =
        meters
          .map((m) =>
            latest(
              round
                ? data.readings.filter((r) => round.entries.some((e) => e.readingId === r.id))
                : data.readings,
              m.id,
            ),
          )
          .filter(Boolean)
          .map((r) => `${r.date}T${r.time}`)
          .sort()
          .at(-1) || (round ? `${round.roundDate}T${round.roundTime}` : '');
      return { batch, meters, at };
    })
    .filter((g) => g.meters.length)
    .sort((a, b) => b.at.localeCompare(a.at));
}
