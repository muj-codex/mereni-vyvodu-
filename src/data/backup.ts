import { emptySeries, validateSeries, type SeriesData } from '../series/model';
import type { HistoryRecord } from '../core/types';
export const BACKUP_VERSION = 3;
import { DATABASE_NAME, DATABASE_VERSION } from './schema';
export { DATABASE_NAME, DATABASE_VERSION } from './schema';
import { createSeriesStore } from '../series/store';
export type BackupRecords = HistoryRecord[] & { seriesData?: SeriesData };
export function backupJSON(records: HistoryRecord[], date = new Date(), seriesData?: SeriesData) {
  return JSON.stringify(
    {
      backupVersion: BACKUP_VERSION,
      appVersion: __APP_VERSION__,
      exportedAt: date.toISOString(),
      database: { name: DATABASE_NAME, version: DATABASE_VERSION, store: 'measurements' },
      records,
      ...(seriesData ? { seriesData: validateSeries(seriesData) } : {}),
    },
    null,
    2,
  );
}
type Obj = Record<string, any>;
const object = (v: unknown): v is Obj => !!v && typeof v === 'object' && !Array.isArray(v);
const finite = (v: unknown) => typeof v === 'number' && Number.isFinite(v);
const strings = (v: unknown) => Array.isArray(v) && v.every((x) => typeof x === 'string');
const triple = (v: unknown) => Array.isArray(v) && v.length === 3 && v.every(object);
const numeric = (v: Obj, keys: string[]) => keys.every((k) => finite(v[k]));
const nullableNumber = (v: unknown) => v === null || finite(v);
function validScenario(s: unknown) {
  if (
    !object(s) ||
    typeof s.id !== 'string' ||
    !strings(s.issues) ||
    !['power', 'error', 'score'].every((k) => nullableNumber(s[k]))
  )
    return false;
  if (s.kind === 'aron')
    return (
      Array.isArray(s.currents) &&
      s.currents.length === 2 &&
      s.currents.every((p: unknown) => p === 0 || p === 2) &&
      Array.isArray(s.reversed) &&
      s.reversed.length === 2 &&
      s.reversed.every((p: unknown) => typeof p === 'boolean') &&
      Array.isArray(s.branchPowers) &&
      s.branchPowers.length === 2 &&
      s.branchPowers.every(nullableNumber)
    );
  return (
    (s.kind === undefined || s.kind === 'three-current') &&
    Array.isArray(s.permutation) &&
    s.permutation.length === 3 &&
    new Set(s.permutation).size === 3 &&
    s.permutation.every((p: unknown) => p === 0 || p === 1 || p === 2) &&
    Array.isArray(s.shorted) &&
    s.shorted.length === 3 &&
    s.shorted.every((p: unknown) => typeof p === 'boolean')
  );
}
function validPowerConsistency(v: unknown) {
  if (
    !object(v) ||
    !['consistent', 'verify', 'mismatch', 'unavailable'].includes(v.status) ||
    !['aron', 'unknown', 'phase-neutral', 'line-line'].includes(v.topology) ||
    !Array.isArray(v.branches)
  )
    return false;
  const comparison = (b: unknown) =>
    object(b) &&
    numeric(b, ['expected', 'entered']) &&
    nullableNumber(b.percent) &&
    ['success', 'intermediate', 'warning', 'unknown'].includes(b.band);
  return (
    v.branches.every((b: unknown) => comparison(b) && object(b) && [0, 1, 2].includes(b.phase)) &&
    (v.total === undefined || comparison(v.total))
  );
}
function validRecord(r: unknown): r is HistoryRecord {
  if (
    !object(r) ||
    !object(r.input) ||
    typeof r.input.serial !== 'string' ||
    !r.input.serial.trim() ||
    (r.id !== undefined && (typeof r.id !== 'string' || !r.id)) ||
    typeof r.localTimestamp !== 'string' ||
    (r.savedAt !== undefined &&
      (typeof r.savedAt !== 'string' || !Number.isFinite(Date.parse(r.savedAt))))
  )
    return false;
  const i = r.input;
  if (
    i.identification !== undefined &&
    (!object(i.identification) ||
      !['date', 'location', 'placement'].every((k) => typeof i.identification[k] === 'string'))
  )
    return false;
  if (r.kind === 'current') {
    return (
      numeric(i, ['ctPrimary', 'ctSecondary']) &&
      typeof i.vn === 'boolean' &&
      ['200 mA', '2 A', '20 A'].includes(i.range) &&
      triple(r.phases) &&
      r.phases.every(
        (p: Obj) =>
          p.unused === true ||
          (numeric(p, [
            'primary',
            'millivolts',
            'secondaryMA',
            'secondaryA',
            'expectedA',
            'primaryFromSecondary',
          ]) &&
            typeof p.raw === 'string' &&
            (p.differencePercent === null || finite(p.differencePercent))),
      ) &&
      (r.diagnostics === undefined || strings(r.diagnostics)) &&
      (r.voltage === undefined ||
        (object(r.voltage) &&
          object(r.voltage.input) &&
          ['primary', 'secondary'].every(
            (k) =>
              Array.isArray(r.voltage[k]) &&
              r.voltage[k].length === 3 &&
              r.voltage[k].every(finite),
          ) &&
          Array.isArray(r.voltage.input.secondaryEdited) &&
          r.voltage.input.secondaryEdited.length === 3 &&
          typeof r.voltage.diagnosis === 'string'))
    );
  }
  if (!object(i.config) || !numeric(i.config, ['actualMtp', 'meterMtp', 'voltage'])) return false;
  if (
    i.interval !== undefined &&
    (!object(i.interval) ||
      !['from', 'to'].every((k) => typeof i.interval[k] === 'string') ||
      !numeric(i.interval, ['start', 'end', 'energis']))
  )
    return false;
  if (r.kind === 'interval-check')
    return (
      object(r.result) &&
      numeric(r.result, [
        'registerDelta',
        'correction',
        'meterEnergy',
        'energisEnergy',
        'difference',
      ]) &&
      (r.result.percent === null || finite(r.result.percent)) &&
      object(r.assessment) &&
      ['success', 'intermediate', 'unknown', 'warning'].includes(r.assessment.band) &&
      typeof r.assessment.summary === 'string' &&
      strings(r.assessment.recommendations)
    );
  return (
    r.kind === undefined &&
    triple(i.phases) &&
    i.phases.every((p: Obj) => numeric(p, ['u', 'i', 'pf', 'p'])) &&
    numeric(i, ['kyoritsu', 'energis']) &&
    object(r.diagnosis) &&
    ['ok', 'outside', 'near-zero'].includes(r.diagnosis.status) &&
    (r.diagnosis.powerConsistency === undefined ||
      validPowerConsistency(r.diagnosis.powerConsistency)) &&
    Array.isArray(r.diagnosis.scenarios) &&
    r.diagnosis.scenarios.every(validScenario) &&
    strings(r.diagnosis.warnings) &&
    nullableNumber(r.diagnosis.differencePercent) &&
    typeof r.diagnosis.modelVersion === 'string' &&
    (r.diagnosis.best === undefined || validScenario(r.diagnosis.best)) &&
    (r.diagnosis.alternative === undefined || validScenario(r.diagnosis.alternative)) &&
    (i.stateCheck === undefined ||
      (object(i.stateCheck) &&
        i.stateCheck.kind === 'interval-check' &&
        validRecord(i.stateCheck) &&
        i.stateCheck.input.serial === i.serial))
  );
}
export function validateRecords(records: unknown): HistoryRecord[] {
  if (!Array.isArray(records) || !records.every(validRecord))
    throw Error('Záloha obsahuje neplatný nebo nepodporovaný záznam. Nic nebylo zapsáno.');
  return structuredClone(records);
}
export function parseBackup(text: string): BackupRecords {
  let backup: unknown;
  try {
    backup = JSON.parse(text.replace(/^\uFEFF/, ''));
  } catch {
    throw Error('Soubor není platný JSON. Nic nebylo zapsáno.');
  }
  if (!object(backup) || ![1, 2, BACKUP_VERSION].includes(backup.backupVersion))
    throw Error('Nekompatibilní backupVersion. Vyberte podporovanou JSON zálohu historie.');
  if (
    typeof backup.appVersion !== 'string' ||
    typeof backup.exportedAt !== 'string' ||
    !Number.isFinite(Date.parse(backup.exportedAt))
  )
    throw Error('Neplatná metadata zálohy.');
  const records: BackupRecords = validateRecords(backup.records);
  if (backup.seriesData !== undefined) records.seriesData = validateSeries(backup.seriesData);
  return records;
}
function canonical(v: any): string {
  if (Array.isArray(v)) return '[' + v.map(canonical).join(',') + ']';
  if (object(v))
    return (
      '{' +
      Object.keys(v)
        .filter((k) => v[k] !== undefined)
        .sort()
        .map((k) => JSON.stringify(k) + ':' + canonical(v[k]))
        .join(',') +
      '}'
    );
  return JSON.stringify(v);
}
// Full measurement identity includes timestamps, input and results, never just the meter serial.
function fingerprint(r: HistoryRecord) {
  const {
    id: _id,
    originalDraft: _draft,
    ...rest
  } = r as HistoryRecord & { originalDraft?: unknown };
  return canonical(rest);
}
const hasStableID = (r: HistoryRecord) => !!r.id && !r.id.startsWith('legacy:');
export function planImport(existing: HistoryRecord[], incoming: HistoryRecord[]) {
  const ids = new Set(existing.map((r) => r.id));
  const allPrints = new Set(existing.map(fingerprint));
  const legacyPrints = new Set(existing.filter((r) => !hasStableID(r)).map(fingerprint));
  const additions: HistoryRecord[] = [];
  for (const record of incoming) {
    const print = fingerprint(record);
    const stable = hasStableID(record);
    if (
      (record.id && ids.has(record.id)) ||
      (stable ? legacyPrints.has(print) : allPrints.has(print))
    )
      continue;
    const next = structuredClone(record);
    // Exact content key avoids hash collisions and is repeatable for older backups without IDs.
    if (!next.id) next.id = 'legacy:' + print;
    additions.push(next);
    ids.add(next.id);
    allPrints.add(print);
    if (!stable) legacyPrints.add(print);
  }
  return {
    total: incoming.length,
    added: additions.length,
    existing: incoming.length - additions.length,
    additions,
  };
}
export async function downloadJSONBackup(records: HistoryRecord[]) {
  const series = createSeriesStore();
  let seriesData = emptySeries();
  try {
    seriesData = await series.all();
  } finally {
    await series.close();
  }
  const file = new File([backupJSON(records, new Date(), seriesData)], 'mereni-zaloha.json', {
    type: 'application/json',
  });
  if (navigator.share && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: 'Záloha historie měření' });
      return;
    } catch (e) {
      if ((e as Error).name === 'AbortError') return;
    }
  }
  const url = URL.createObjectURL(file);
  const link = document.createElement('a');
  link.href = url;
  link.download = file.name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
