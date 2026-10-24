import { seriesGroups } from '../series/grouping';
import type { HistoryRecord } from '../core/types';
import {
  isIntervalCheck,
  recordTypeLabel,
  recordVoltage,
  voltageLabel,
  formatIntervalDateTime,
} from '../core/historyView';
import { latest, type SeriesData } from '../series/model';
export interface ResultRow {
  id: string;
  node: string;
  at: string;
  location: string;
  placement: string;
  search: string;
  record?: HistoryRecord;
  meterId?: string;
  batchId?: string;
  meterCount?: number;
}
const normalize = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[\u0300-\u036f\s]/g, '')
    .toLowerCase();
export function resultRows(records: HistoryRecord[], series: SeriesData, query = ''): ResultRow[] {
  const rows: ResultRow[] = records.map((record) => {
    const ident = record.input.identification;
    const node = (ident as typeof ident & { node?: string })?.node ?? '';
    const fallback = record.localTimestamp.replace(
      /^(\d{1,2})\.\s*(\d{1,2})\.\s*(\d{4})[, ]+/,
      (_, d, m, y) => `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}T`,
    );
    const at =
      (isIntervalCheck(record) ? record.input.interval?.to : '') ||
      (ident?.date ? `${ident.date}T${ident.time || '00:00'}` : fallback);
    return {
      id: record.id,
      node,
      at: at || '',
      location: ident?.location ?? '',
      placement: ident?.placement ?? '',
      record,
      search: [
        node,
        ident?.location,
        ident?.placement,
        record.input.serial,
        at,
        formatIntervalDateTime(at || ''),
        record.localTimestamp,
        recordTypeLabel(record),
        voltageLabel(recordVoltage(record)),
      ].join(' '),
    };
  });
  for (const { batch, meters, at } of seriesGroups(series)) {
    rows.push({
      id: `series:${batch.id}`,
      batchId: batch.id,
      meterCount: meters.length,
      node: '',
      at,
      location: batch.location,
      placement: '',
      search: [
        batch.location,
        batch.date,
        at,
        formatIntervalDateTime(at),
        'jednotlivý odečet série odečtů',
        ...meters.flatMap((meter) => [
          meter.node,
          meter.serial,
          meter.location,
          meter.placement,
          meter.location.startsWith('R') ? 'VN' : 'NN',
          meter.active ? 'aktivní sledování' : 'ukončené sledování',
          ...series.readings
            .filter((r) => r.meterId === meter.id)
            .flatMap((r) => [`${r.date}T${r.time}`, formatIntervalDateTime(`${r.date}T${r.time}`)]),
        ]),
      ].join(' '),
    });
  }
  // Unlinked legacy records remain individually accessible; never guess membership.
  for (const meter of series.meters.filter(
    (m) => !series.batches.some((b) => b.id === m.batchId),
  )) {
    const r = latest(series.readings, meter.id);
    rows.push({
      id: meter.id,
      meterId: meter.id,
      node: meter.node,
      at: r ? `${r.date}T${r.time}` : '',
      location: meter.location,
      placement: meter.placement,
      search: [meter.node, meter.serial, meter.location, meter.placement].join(' '),
    });
  }
  return rows
    .filter((r) => normalize(r.search).includes(normalize(query)))
    .sort((a, b) => b.at.localeCompare(a.at));
}
