import { compareEnergy } from '../core/energy';
export interface Batch {
  id: string;
  location: string;
  date: string;
}
export interface Meter {
  id: string;
  batchId: string;
  location: string;
  placement: string;
  serial: string;
  node: string;
  active: boolean;
  actualMtp: number;
  meterMtp: number;
  /** Last explicit tracking or outlet identity edit, preserved when merging backups. */
  trackingUpdatedAt?: string;
}
export interface EnergisMeta {
  file: string;
  node: string;
  from: string;
  to: string;
  unit: string;
  sum: number;
  boundary: 'previous' | 'next';
  offsetMinutes?: number;
}
export interface Reading {
  id: string;
  meterId: string;
  previousId?: string;
  date: string;
  time: string;
  value: number;
  active: boolean;
  energis?: number;
  import?: EnergisMeta;
  boundary?: 'previous' | 'next';
  result?: ReturnType<typeof compareEnergy>;
}
export interface SeriesData {
  batches: Batch[];
  meters: Meter[];
  readings: Reading[];
}
export interface Entry {
  location: string;
  placement: string;
  serial: string;
  node: string;
  date: string;
  time: string;
  value: string;
  actualMtp: string;
  meterMtp: string;
}
export const emptySeries = (): SeriesData => ({ batches: [], meters: [], readings: [] });
export const blankEntry = (): Entry => ({
  location: '',
  placement: '',
  serial: '',
  node: '',
  date: '',
  time: '',
  value: '',
  actualMtp: '1',
  meterMtp: '1',
});
export const resetEntry = (e: Entry): Entry => ({
  ...e,
  placement: '',
  serial: '',
  node: '',
  time: '',
  value: '',
});
export const numberValue = (s: string) => {
  if (!/^\d+(?:[.,]\d+)?$/.test(s.trim().replace(/\s/g, '')))
    throw Error('Zadejte nezáporné číslo.');
  const n = Number(s.replace(/\s/g, '').replace(',', '.'));
  if (!Number.isFinite(n)) throw Error('Číslo je příliš velké.');
  return n;
};
export function normalizeTime(time: string) {
  return /^\d:[0-5]\d$/.test(time) ? `0${time}` : time;
}
export function localTime(now = new Date()) {
  return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
}
export interface NodeLocation {
  node: string;
  location: string;
  placement: string;
}
export function lookupNode(node: string, directory: readonly NodeLocation[] = []) {
  return directory.find((item) => item.node === node);
}
export function timestamp(date: string, time: string) {
  time = normalizeTime(time);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time))
    throw Error('Vyplňte platné datum a ručně čas HH:MM.');
  const d = new Date(`${date}T${time}:00Z`);
  if (!Number.isFinite(+d) || d.toISOString().slice(0, 10) !== date)
    throw Error('Neplatné datum odečtu.');
  return `${date}T${time}`;
}
export function validateEntry(e: Entry) {
  if (!e.location.trim() || !e.placement.trim() || !e.serial.trim())
    throw Error('Vyplňte TS/R, pole a číslo elektroměru.');
  if (e.node && !/^\d+$/.test(e.node)) throw Error('UZEL smí obsahovat pouze číslice.');
  timestamp(e.date, e.time);
  numberValue(e.value);
  if (numberValue(e.actualMtp) <= 0 || numberValue(e.meterMtp) <= 0)
    throw Error('MTP musí být kladné.');
}
export function latest(readings: Reading[], meterId: string) {
  return readings
    .filter((r) => r.meterId === meterId)
    .sort((a, b) => timestamp(b.date, b.time).localeCompare(timestamp(a.date, a.time)))[0];
}
export function resolveMeter(meters: Meter[], serial: string, node: string) {
  const matches = meters.filter(
    (m) => (serial && m.serial === serial.trim()) || (node && m.node === node),
  );
  if (matches.length > 1)
    throw Error('EM/UZEL odpovídá více elektroměrům. Vyberte konkrétní elektroměr v historii.');
  return matches[0];
}
export function firstReading(e: Entry, batchId: string) {
  validateEntry(e);
  const meter: Meter = {
    id: crypto.randomUUID(),
    batchId,
    location: e.location.trim(),
    placement: e.placement.trim(),
    serial: e.serial.trim(),
    node: e.node,
    active: true,
    actualMtp: numberValue(e.actualMtp),
    meterMtp: numberValue(e.meterMtp),
  };
  const reading: Reading = {
    id: crypto.randomUUID(),
    meterId: meter.id,
    date: e.date,
    time: normalizeTime(e.time),
    value: numberValue(e.value),
    active: true,
  };
  return { meter, reading };
}
export function nextReading(
  m: Meter,
  previous: Reading,
  e: {
    date: string;
    time: string;
    value: string;
    energis: string;
    active: boolean;
    import?: EnergisMeta;
    boundary?: 'previous' | 'next';
  },
): Reading {
  const value = numberValue(e.value);
  const to = timestamp(e.date, e.time);
  const from = timestamp(previous.date, previous.time);
  const energy = e.energis.trim() ? numberValue(e.energis) : undefined;
  // Single adapter to the frozen production mathematics, including MTP and chronology validation.
  const result = compareEnergy(
    { from, to, start: previous.value, end: value, energis: energy ?? 0 },
    m,
  );
  return {
    id: crypto.randomUUID(),
    meterId: m.id,
    previousId: previous.id,
    date: e.date,
    time: normalizeTime(e.time),
    value,
    active: e.active,
    energis: energy,
    import: e.import,
    ...(e.boundary ? { boundary: e.boundary } : {}),
    result: energy === undefined ? undefined : result,
  };
}
export function validateSeries(value: unknown): SeriesData {
  const d = value as SeriesData;
  if (!d || !Array.isArray(d.batches) || !Array.isArray(d.meters) || !Array.isArray(d.readings))
    throw Error('Neplatná záloha sérií.');
  const ids = (rows: { id: string }[]) =>
    rows.every((r) => r && typeof r.id === 'string' && r.id.length > 0) &&
    new Set(rows.map((r) => r.id)).size === rows.length;
  if (![d.batches, d.meters, d.readings].every(ids))
    throw Error('Chybné nebo duplicitní ID série.');
  for (const b of d.batches) {
    if (typeof b.location !== 'string' || !b.location.trim())
      throw Error('Neplatná lokalita série.');
    timestamp(b.date, '00:00');
  }
  for (const m of d.meters) {
    if (!d.batches.some((b) => b.id === m.batchId) || typeof m.active !== 'boolean')
      throw Error('Chybí vazba elektroměru.');
    if (
      m.trackingUpdatedAt !== undefined &&
      (typeof m.trackingUpdatedAt !== 'string' || !Number.isFinite(Date.parse(m.trackingUpdatedAt)))
    )
      throw Error('Neplatná metadata sledování.');
    validateEntry({
      ...m,
      date: '2026-01-01',
      time: '00:00',
      value: '0',
      actualMtp: String(m.actualMtp),
      meterMtp: String(m.meterMtp),
    });
  }
  for (const r of d.readings) {
    if (
      !d.meters.some((m) => m.id === r.meterId) ||
      typeof r.active !== 'boolean' ||
      typeof r.value !== 'number' ||
      !Number.isFinite(r.value) ||
      r.value < 0
    )
      throw Error('Neplatný odečet.');
    timestamp(r.date, r.time);
    if (
      r.energis !== undefined &&
      (typeof r.energis !== 'number' || !Number.isFinite(r.energis) || r.energis < 0)
    )
      throw Error('Neplatná hodnota Energis.');
    if (r.boundary !== undefined && !['previous', 'next'].includes(r.boundary))
      throw Error('Neplatná hranice Energisu.');
    if (r.import) {
      const i = r.import;
      if (
        typeof i.file !== 'string' ||
        typeof i.node !== 'string' ||
        typeof i.unit !== 'string' ||
        !['previous', 'next'].includes(i.boundary) ||
        !Number.isFinite(i.sum) ||
        i.sum < 0 ||
        !Number.isFinite(Date.parse(i.from)) ||
        !Number.isFinite(Date.parse(i.to)) ||
        i.to <= i.from ||
        (i.offsetMinutes !== undefined && !Number.isFinite(i.offsetMinutes))
      )
        throw Error('Neplatná metadata Energis.');
    }
    if (r.previousId) {
      const p = d.readings.find((p) => p.id === r.previousId);
      if (!p || p.meterId !== r.meterId || timestamp(p.date, p.time) >= timestamp(r.date, r.time))
        throw Error('Neplatná vazba předchozího odečtu.');
      const computed = nextReading(
        d.meters.find((m) => m.id === r.meterId)!,
        p,
        { ...r, value: String(r.value), energis: r.energis === undefined ? '' : String(r.energis) },
      );
      if (JSON.stringify(computed.result) !== JSON.stringify(r.result))
        throw Error('Výsledek intervalu neodpovídá uloženým vstupům.');
    }
  }
  for (const m of d.meters) {
    const rows = d.readings.filter((r) => r.meterId === m.id);
    if (
      !rows.length ||
      rows.filter((r) => !r.previousId).length !== 1 ||
      new Set(rows.map((r) => r.previousId).filter(Boolean)).size !== rows.length - 1
    )
      throw Error('Historie elektroměru není souvislá.');
  }
  return structuredClone(d);
}

// Display/export adapter also exposes corrected meter consumption before Energis is entered.
export function intervalValues(meter: Meter, previous: Reading, reading: Reading) {
  return compareEnergy(
    {
      from: timestamp(previous.date, previous.time),
      to: timestamp(reading.date, reading.time),
      start: previous.value,
      end: reading.value,
      energis: reading.energis ?? 0,
    },
    meter,
  );
}
