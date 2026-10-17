import type { MeasurementRecord } from '../core/types';
export const EXPORT_COLUMNS = [
  {
    key: 'serial',
    label: 'Výrobní číslo elektroměru',
    value: (r: MeasurementRecord) => r.input.serial,
  },
  { key: 'time', label: 'Datum a čas', value: (r: MeasurementRecord) => r.localTimestamp },
  ...(['u', 'i', 'pf', 'p'] as const).flatMap((key) =>
    [0, 1, 2].map((phase) => ({
      key: `${key}${phase + 1}`,
      label: `${key.toUpperCase()}${phase + 1}${key === 'u' ? ' [V]' : key === 'i' ? ' [A]' : key === 'p' ? ' [kW]' : ''}`,
      value: (r: MeasurementRecord) => String(r.input.phases[phase][key]).replace('.', ','),
    })),
  ),
  {
    key: 'kyoritsu',
    label: 'Kyoritsu celkem [kW]',
    value: (r: MeasurementRecord) => String(r.input.kyoritsu).replace('.', ','),
  },
  {
    key: 'energis',
    label: 'Trend Energis [kW]',
    value: (r: MeasurementRecord) => String(r.input.energis).replace('.', ','),
  },
] as const;
const safeCell = (value: string) => value.replace(/[\t\r\n]/g, ' ');
// Allowlist only: no spreads or serialization of the full diagnostic record.
export function toTSV(records: MeasurementRecord[]): string {
  return records
    .map((record) => EXPORT_COLUMNS.map((column) => safeCell(column.value(record))).join('\t'))
    .join('\n');
}
export function emailBody(records: MeasurementRecord[]): string {
  return records
    .map(
      (record, index) =>
        `Měření ${index + 1}\n${EXPORT_COLUMNS.map((column) => `${column.label}: ${safeCell(column.value(record))}`).join('\n')}`,
    )
    .join('\n\n────────────\n\n');
}
export function mailtoLink(records: MeasurementRecord[]): string {
  return `mailto:?subject=${encodeURIComponent(`Naměřená data – ${records.length} měření`)}&body=${encodeURIComponent(emailBody(records))}`;
}
