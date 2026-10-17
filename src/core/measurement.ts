import { parseNumber, localTimestamp } from './numbers';
import { diagnose } from './diagnosis';
import { compareEnergy } from './energy';
import type {
  FormDraft,
  MeasurementInput,
  MeasurementRecord,
  MeterConfig,
  Triple,
  PhaseReading,
} from './types';
export const DEFAULT_CONFIG: MeterConfig = {
  actualMtp: 100,
  meterMtp: 100,
  voltage: 400,
  meterPulse: 0.1,
  energisPulse: 0.1,
};
export function emptyDraft(config: MeterConfig = DEFAULT_CONFIG): FormDraft {
  return {
    serial: '',
    config: structuredClone(config),
    intervalEnabled: false,
    interval: { from: '', to: '', start: '', end: '', energis: '' },
    phases: [0, 1, 2].map(() => ({ u: '', i: '', pf: '', p: '' })) as FormDraft['phases'],
    kyoritsu: '',
    energis: '',
  };
}
export function readDraft(
  draft: FormDraft,
  includeInterval = draft.intervalEnabled,
): MeasurementInput {
  if (!/^\d+$/.test(draft.serial))
    throw new Error('Vyplňte výrobní číslo elektroměru pouze číslicemi.');
  const phases = draft.phases.map((phase, index) => {
    const p = Object.fromEntries(
      Object.entries(phase).map(([k, v]) => [k, parseNumber(v)]),
    ) as unknown as PhaseReading;
    if (![p.u, p.i, p.pf, p.p].every(Number.isFinite))
      throw new Error(`Vyplňte U, I, PF a P pro fázi ${index + 1}.`);
    if (p.u <= 0 || p.i < 0 || Math.abs(p.pf) > 1)
      throw new Error(`Fáze ${index + 1}: U musí být kladné, I nezáporné a PF od −1 do +1.`);
    if (p.i === 0 && Math.abs(p.p) > 1e-8)
      throw new Error(`Fáze ${index + 1}: při nulovém proudu nemůže být nenulový činný výkon.`);
    if (p.pf === 0 && Math.abs(p.p) > 1e-8)
      throw new Error(`Fáze ${index + 1}: při PF = 0 musí být činný výkon nulový.`);
    return p;
  }) as Triple<PhaseReading>;
  const kyoritsu = parseNumber(draft.kyoritsu),
    energis = parseNumber(draft.energis);
  if (![kyoritsu, energis].every(Number.isFinite))
    throw new Error('Vyplňte celkový výkon Kyoritsu a trend Energis.');
  const interval = includeInterval
    ? {
        from: draft.interval.from,
        to: draft.interval.to,
        start: parseNumber(draft.interval.start),
        end: parseNumber(draft.interval.end),
        energis: parseNumber(draft.interval.energis),
      }
    : undefined;
  if (interval) compareEnergy(interval, draft.config);
  return {
    serial: draft.serial,
    config: structuredClone(draft.config),
    phases,
    kyoritsu,
    energis,
    interval,
  };
}
export function createRecord(input: MeasurementInput, date = new Date()): MeasurementRecord {
  return structuredClone({
    id: crypto.randomUUID(),
    savedAt: date.toISOString(),
    localTimestamp: localTimestamp(date),
    input,
    diagnosis: diagnose(input),
  });
}
// Reset only after repository transaction has completed successfully.
export async function saveAndReset(
  draft: FormDraft,
  persist: (record: MeasurementRecord) => Promise<void>,
  date = new Date(),
) {
  const input = readDraft(draft);
  const record = createRecord(input, date);
  await persist(record);
  return { record, nextDraft: emptyDraft(draft.config) };
}
