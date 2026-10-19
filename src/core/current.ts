import { MTP_OPTIONS } from './config';
import { parseNumber, formatNumber, localTimestamp } from './numbers';
import type { Identification, Triple } from './types';
export const TS_LOCATIONS = [
  'TS 3308/250',
  'TS 4601/251',
  'TS 4424/252',
  'TS 3401/253',
  'TS 2535/254',
  'TS 1515/256',
  'TS 3831/257',
  'TS 0524/258',
  'TS 0425/259',
  'TS 2312/264',
  'TS 1318/265',
  'TS 4315/269',
  'TS ČOV-2225',
  'TS k123-4616',
  'TS HR6-2803-6654/VEDAG',
  'TS 1613/CHEZACARB',
  'TS 6910',
] as const;
export const R_LOCATIONS = [
  'R201',
  'R202',
  'R701',
  'R702',
  'R105-106',
  'RPCH',
  'RASU-AIP',
] as const;
export const VN_MTP = [
  70, 75, 100, 200, 250, 300, 400, 500, 600, 750, 800, 1000, 1250, 2000, 2500, 3500, 4000,
] as const;
export const currentOptions = (vn: boolean) =>
  (vn ? VN_MTP : MTP_OPTIONS).map((primary) => ({ primary, secondary: vn ? 1 : 5 }));
export const locations = (vn: boolean): readonly string[] => (vn ? R_LOCATIONS : TS_LOCATIONS);
export const RANGES = { '200 mA': 1, '2 A': 10, '20 A': 100 } as const;
export type ClampRange = keyof typeof RANGES;
export type InputUnit = 'mV' | 'V';
export function signedPercent(value: number | null | undefined) {
  return value == null || !Number.isFinite(value)
    ? '—'
    : `${value > 0 ? '+' : value < 0 ? '−' : ''}${formatNumber(Math.abs(value), 1)} %`;
}
export function percentDifference(actual: number, reference: number): number | null {
  if (![actual, reference].every(Number.isFinite) || reference === 0) return null;
  const value = ((actual - reference) / reference) * 100;
  return Number.isFinite(value) ? value : null;
}
export function workingBand(percent: number | null) {
  return percent === null
    ? 'unknown'
    : Math.abs(percent) <= 15
      ? 'success'
      : Math.abs(percent) <= 25
        ? 'intermediate'
        : 'warning';
}
export function today(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
export const emptyIdentification = (): Identification => ({
  date: today(),
  location: TS_LOCATIONS[0],
  placement: '',
});
export function validateIdentification(value: Identification) {
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(value.date) ||
    !Number.isFinite(Date.parse(value.date)) ||
    new Date(value.date).toISOString().slice(0, 10) !== value.date
  )
    throw Error('Vyplňte platné datum.');
  if (!value.location.trim()) throw Error('Vyplňte lokalitu.');
}
export interface CurrentPhaseInput {
  primary: string;
  raw: string;
  unit: InputUnit;
}
export interface CurrentPhase {
  primary: number;
  source: 'SCADA' | 'měřený proud';
  range: ClampRange;
  unit: InputUnit;
  raw: string;
  millivolts: number;
  secondaryMA: number;
  secondaryA: number;
  expectedA: number;
  primaryFromSecondary: number;
  differencePercent: number | null;
}
export interface VoltageInput {
  primary: Triple<string>;
  secondary: Triple<string>;
  secondaryEdited: Triple<boolean>;
  preset: string;
}
export interface VoltageResult {
  input: VoltageInput;
  primary: Triple<number>;
  secondary: Triple<number>;
  source: 'SCADA' | 'měřené napětí';
  diagnosis: string;
}
export interface CurrentDraft {
  serial: string;
  identification: Identification;
  vn: boolean;
  ctPrimary: number;
  range: ClampRange;
  phases: Triple<CurrentPhaseInput>;
  voltageEnabled: boolean;
  voltage: VoltageInput;
}
export interface CurrentRecord {
  kind: 'current';
  id: string;
  savedAt: string;
  localTimestamp: string;
  input: {
    serial: string;
    identification: Identification;
    vn: boolean;
    ctPrimary: number;
    ctSecondary: number;
    range: ClampRange;
  };
  phases: Triple<CurrentPhase>;
  voltage?: VoltageResult;
}
export function emptyCurrent(vn = false): CurrentDraft {
  return {
    serial: '',
    identification: { ...emptyIdentification(), location: locations(vn)[0] },
    vn,
    ctPrimary: 300,
    range: '2 A',
    phases: [0, 1, 2].map(() => ({
      primary: '',
      raw: '',
      unit: 'mV',
    })) as Triple<CurrentPhaseInput>,
    voltageEnabled: false,
    voltage: {
      primary: vn ? ['10', '10', '10'] : ['', '', ''],
      secondary: ['100', '100', '100'],
      secondaryEdited: [false, false, false],
      preset: '10',
    },
  };
}
function positive(raw: string, label: string, zero = true) {
  const value = parseNumber(raw);
  if (!Number.isFinite(value) || value < 0 || (!zero && value === 0))
    throw Error(`${label}: zadejte ${zero ? 'nezáporné' : 'kladné'} konečné číslo.`);
  return value;
}
export function convertClamp(raw: string, unit: InputUnit, range: ClampRange) {
  if (!Object.hasOwn(RANGES, range) || !['mV', 'V'].includes(unit))
    throw Error('Neplatný rozsah nebo jednotka.');
  const millivolts = positive(raw, 'Multimetr') * (unit === 'V' ? 1000 : 1);
  const secondaryMA = millivolts * RANGES[range];
  if (!Number.isFinite(secondaryMA)) throw Error('Hodnota multimetru je příliš velká.');
  if (secondaryMA > { '200 mA': 200, '2 A': 2000, '20 A': 20000 }[range])
    throw Error('Překročen rozsah Kyoritsu 8112. Ověřte přepínač a měření.');
  return { millivolts, secondaryMA, secondaryA: secondaryMA / 1000 };
}
// Only distinguish branches with separated signatures and a unique, close ratio match.
export function diagnoseVoltage(primary: Triple<number>, secondary: Triple<number>): string {
  const unknown = 'Napěťové zapojení nelze z naměřených hodnot jednoznačně určit.';
  if (![...primary, ...secondary].every((v) => Number.isFinite(v) && v > 0)) return unknown;
  const norm = (values: number[]) => values.map((v) => v / (values.reduce((a, b) => a + b, 0) / 3));
  const p = norm(primary),
    s = norm(secondary);
  if (
    p.some((v, i) => p.some((w, j) => i !== j && Math.abs(v - w) < 0.03)) ||
    s.some((v, i) => s.some((w, j) => i !== j && Math.abs(v - w) < 0.03))
  )
    return unknown;
  const permutations = [
    [0, 1, 2],
    [0, 2, 1],
    [1, 0, 2],
    [1, 2, 0],
    [2, 0, 1],
    [2, 1, 0],
  ];
  const scores = permutations
    .map((order) => ({
      order,
      score: Math.sqrt(order.reduce((sum, j, i) => sum + (p[i] - s[j]) ** 2, 0) / 3),
    }))
    .sort((a, b) => a.score - b.score);
  if (scores[0].score > 0.02 || scores[1].score - scores[0].score < 0.02) return unknown;
  const pairs = ['L1–L2', 'L1–L3', 'L2–L3'];
  return (
    'Pravděpodobné přiřazení (primár ← sekundár): ' +
    scores[0].order.map((j, i) => `${pairs[i]} ← ${pairs[j]}`).join('; ') +
    '. Ověřte zapojení na místě.'
  );
}
export function evaluateCurrent(d: CurrentDraft, date = new Date()): CurrentRecord {
  if (!d.serial.trim()) throw Error('Vyplňte číslo elektroměru.');
  validateIdentification(d.identification);
  if (!locations(d.vn).includes(d.identification.location))
    throw Error('Lokalita neodpovídá režimu NN/VN.');
  if (!currentOptions(d.vn).some((ct) => ct.primary === d.ctPrimary))
    throw Error('Neplatný MTP pro tento režim.');
  const ctSecondary = d.vn ? 1 : 5;
  const phases = d.phases.map((p) => {
    const primary = positive(p.primary, 'Primární proud');
    const converted = convertClamp(p.raw, p.unit, d.range);
    const expectedA = (primary * ctSecondary) / d.ctPrimary,
      primaryFromSecondary = (converted.secondaryA * d.ctPrimary) / ctSecondary;
    if (![expectedA, primaryFromSecondary].every(Number.isFinite))
      throw Error('Proud je příliš velký.');
    return {
      ...converted,
      primary,
      source: d.vn ? 'SCADA' : 'měřený proud',
      range: d.range,
      unit: p.unit,
      raw: p.raw,
      expectedA,
      primaryFromSecondary,
      differencePercent: percentDifference(primaryFromSecondary, primary),
    };
  }) as Triple<CurrentPhase>;
  let voltage: VoltageResult | undefined;
  if (d.voltageEnabled) {
    if (d.vn && !['6', '10', '10.3', 'custom'].includes(d.voltage.preset))
      throw Error('Neplatná volba napětí.');
    const primary = d.voltage.primary.map(
      (v) => positive(v, 'Primární napětí', false) * (d.vn ? 1000 : 1),
    ) as Triple<number>;
    const secondary = d.voltage.secondary.map((v) =>
      positive(v, 'Sekundární napětí', false),
    ) as Triple<number>;
    if (!primary.every(Number.isFinite)) throw Error('Napětí je příliš velké.');
    voltage = {
      input: structuredClone(d.voltage),
      primary,
      secondary,
      source: d.vn ? 'SCADA' : 'měřené napětí',
      diagnosis: diagnoseVoltage(primary, secondary),
    };
  }
  return {
    kind: 'current',
    id: crypto.randomUUID(),
    savedAt: date.toISOString(),
    localTimestamp: localTimestamp(date),
    input: {
      serial: d.serial,
      identification: { ...d.identification, time: localTimestamp(date).split(' ')[1] },
      vn: d.vn,
      ctPrimary: d.ctPrimary,
      ctSecondary,
      range: d.range,
    },
    phases,
    voltage,
  };
}
