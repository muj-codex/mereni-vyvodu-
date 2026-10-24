import type { SeriesData } from './model';
import { roundLabel, roundsFor } from './rounds';

export function seriesDates(data: SeriesData, batchId: string): string {
  return roundsFor(data, batchId).map(roundLabel).join('; ');
}
