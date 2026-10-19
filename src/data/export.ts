import type { HistoryRecord, MeasurementRecord } from '../core/types';
import type { CurrentRecord } from '../core/current';
import { percentDifference } from '../core/current';
type Column<T> = { key: string; label: string; value: (record: T) => unknown };
const number = (v: unknown) => (typeof v === 'number' ? String(v).replace('.', ',') : (v ?? ''));
const identityColumns: Column<HistoryRecord>[] = [
  {
    key: 'date',
    label: 'Datum',
    value: (r) => r.input.identification?.date ?? r.localTimestamp.split(' ')[0],
  },
  {
    key: 'time',
    label: 'Čas',
    value: (r) => r.input.identification?.time ?? r.localTimestamp.split(' ')[1],
  },
  {
    key: 'location',
    label: 'Trafostanice / Rozvodna',
    value: (r) => r.input.identification?.location ?? '',
  },
  {
    key: 'placement',
    label: 'Pole / umístění',
    value: (r) => r.input.identification?.placement ?? '',
  },
  { key: 'serial', label: 'Výrobní číslo elektroměru', value: (r) => r.input.serial },
];
// Column order lives here. No diagnosis scenarios or informational correction coefficient.
export const EXPORT_COLUMNS: Column<MeasurementRecord>[] = [
  ...identityColumns,
  { key: 'network', label: 'Síť', value: (r) => `${r.input.config.voltage} V` },
  ...(['u', 'i', 'pf', 'p'] as const).flatMap((key) =>
    [0, 1, 2].map((phase) => ({
      key: `${key}${phase + 1}`,
      label: `${key === 'pf' ? 'cosφ' : key.toUpperCase()}${phase + 1}${key === 'i' ? ' [A]' : key === 'u' ? ' [V]' : key === 'p' ? ' [kW]' : ''}`,
      value: (r: MeasurementRecord) => r.input.phases[phase][key],
    })),
  ),
  { key: 'kyoritsu', label: 'Kyoritsu celkem [kW]', value: (r) => r.input.kyoritsu },
  { key: 'energis', label: 'Trend Energis [kW]', value: (r) => r.input.energis },
  {
    key: 'percent',
    label: 'Rozdíl %',
    value: (r) => percentDifference(r.input.energis, r.input.kyoritsu),
  },
  { key: 'mtp', label: 'MTP', value: (r) => `${r.input.config.actualMtp}/5 A` },
];
export const CURRENT_COLUMNS: Column<CurrentRecord>[] = [
  ...identityColumns,
  { key: 'mtp', label: 'MTP', value: (r) => `${r.input.ctPrimary}/${r.input.ctSecondary} A` },
  { key: 'mode', label: 'Režim', value: (r) => (r.input.vn ? 'VN' : 'NN') },
  ...([0, 1, 2] as const).flatMap((i) =>
    (
      [
        ['primary', 'Primár [A]'],
        ['source', 'Zdroj primáru'],
        ['range', 'Rozsah Kyoritsu 8112'],
        ['unit', 'Jednotka multimetru'],
        ['raw', 'Původní vstup'],
        ['millivolts', 'Multimetr [mV]'],
        ['secondaryMA', 'Skutečný sekundár [mA]'],
        ['secondaryA', 'Skutečný sekundár [A]'],
        ['expectedA', 'Očekávaný sekundár [A]'],
        ['primaryFromSecondary', 'Přepočtený primár [A]'],
        ['differencePercent', 'Rozdíl %'],
      ] as const
    ).map(([key, label]) => ({
      key: `L${i + 1}-${key}`,
      label: `L${i + 1} ${label}`,
      value: (r: CurrentRecord) => r.phases[i][key],
    })),
  ),
  ...([0, 1, 2] as const).flatMap((i) => [
    {
      key: `primaryVoltage${i}`,
      label: `${['L1–L2', 'L1–L3', 'L2–L3'][i]} primár [V]`,
      value: (r: CurrentRecord) => r.voltage?.primary[i],
    },
    {
      key: `secondaryVoltage${i}`,
      label: `${['L1–L2', 'L1–L3', 'L2–L3'][i]} sekundár [V]`,
      value: (r: CurrentRecord) => r.voltage?.secondary[i],
    },
    {
      key: `voltageEdited${i}`,
      label: `${['L1–L2', 'L1–L3', 'L2–L3'][i]} sekundární hodnota`,
      value: (r: CurrentRecord) =>
        r.voltage ? (r.voltage.input.secondaryEdited[i] ? 'ručně upraveno' : 'výchozí') : '',
    },
  ]),
  { key: 'voltageSource', label: 'Zdroj primárního napětí', value: (r) => r.voltage?.source },
  {
    key: 'voltagePreset',
    label: 'Volba primárního napětí [kV] (VN)',
    value: (r) => (r.input.vn ? r.voltage?.input.preset : ''),
  },
];
export const isCurrent = (r: HistoryRecord): r is CurrentRecord =>
  'kind' in r && r.kind === 'current';
const exportPercent = (value: unknown) =>
  typeof value === 'number' && Number.isFinite(value)
    ? `${value > 0 ? '+' : ''}${String(value).replace('.', ',')}`
    : (value ?? '');
const columnValue = (key: string, value: unknown) =>
  key === 'percent' || key.endsWith('-differencePercent') ? exportPercent(value) : value;
const safeCell = (value: unknown) => String(number(value)).replace(/[\t\r\n]/g, ' ');
function columns(r: HistoryRecord): Column<HistoryRecord>[] {
  return (isCurrent(r) ? CURRENT_COLUMNS : EXPORT_COLUMNS) as Column<HistoryRecord>[];
}
export function toTSV(records: HistoryRecord[]) {
  return records
    .map((r) =>
      columns(r)
        .map((c) => safeCell(columnValue(c.key, c.value(r))))
        .join('\t'),
    )
    .join('\n');
}
export function emailBody(records: HistoryRecord[]) {
  return records
    .map(
      (r, index) =>
        `Měření ${index + 1}\n${columns(r)
          .map(
            (c) =>
              `${c.key === 'location' ? (isCurrent(r) && r.input.vn ? 'Rozvodna' : 'Trafostanice') : c.label}: ${safeCell(columnValue(c.key, c.value(r)))}`,
          )
          .join('\n')}`,
    )
    .join('\n\n────────────\n\n');
}
export function mailtoLink(records: HistoryRecord[]) {
  return `mailto:?subject=${encodeURIComponent(`Naměřená data – ${records.length} měření`)}&body=${encodeURIComponent(emailBody(records))}`;
}
// A unified backup keeps one row per record and one stable header, even for mixed modes.
export function backupTSV(records: HistoryRecord[]) {
  const keys = [...new Set([...EXPORT_COLUMNS, ...CURRENT_COLUMNS].map((c) => c.key))];
  const labels = new Map([...EXPORT_COLUMNS, ...CURRENT_COLUMNS].map((c) => [c.key, c.label]));
  const hasVN = records.some((r) => isCurrent(r) && r.input.vn);
  const hasNN = records.some((r) => !isCurrent(r) || !r.input.vn);
  labels.set('location', hasVN ? (hasNN ? 'Trafostanice / Rozvodna' : 'Rozvodna') : 'Trafostanice');
  const header = keys.map((k) => safeCell(labels.get(k))).join('\t');
  return (
    '\uFEFF' +
    header +
    '\n' +
    records
      .map((r) => {
        const map = new Map(columns(r).map((c) => [c.key, c.value(r)]));
        return keys.map((k) => safeCell(columnValue(k, map.get(k)))).join('\t');
      })
      .join('\n')
  );
}
export function downloadBackup(records: HistoryRecord[]) {
  const url = URL.createObjectURL(
    new Blob([backupTSV(records)], { type: 'text/tab-separated-values;charset=utf-8' }),
  );
  const link = document.createElement('a');
  link.href = url;
  link.download = 'mereni-zaloha.tsv';
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
