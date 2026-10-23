import { percentDifference, workingBand } from './current';
import type { Diagnosis, MeasurementInput, PhaseReading } from './types';

export type VoltageBasis = 'unknown' | 'phase-neutral' | 'line-line';
export interface PowerComparison {
  expected: number;
  entered: number;
  percent: number | null;
  band: ReturnType<typeof workingBand>;
}
export interface PowerConsistency {
  status: 'consistent' | 'verify' | 'mismatch' | 'unavailable';
  topology: 'aron' | VoltageBasis;
  branches: (PowerComparison & { phase: number })[];
  total?: PowerComparison;
}
function compare(expected: number, entered: number): PowerComparison {
  const percent = expected === 0 && entered === 0 ? 0 : percentDifference(entered, expected);
  // A nonzero power at zero expected power is inconsistent; no infinite percentage.
  return {
    expected,
    entered,
    percent,
    band: expected === 0 && entered !== 0 ? 'warning' : workingBand(percent),
  };
}
export function expectedBranchPower(p: PhaseReading, divisor = 1): number | null {
  if (![p.u, p.i, p.pf, p.p].every(Number.isFinite) || p.u <= 0 || p.i < 0 || Math.abs(p.pf) > 1)
    return null;
  const value = ((p.u / divisor) * p.i * Math.abs(p.pf)) / 1000;
  return Number.isFinite(value) ? value : null;
}
export function checkPowerConsistency(input: MeasurementInput): PowerConsistency {
  const aron = input.config.voltage === 500;
  const topology = aron ? 'aron' : (input.voltageBasis ?? 'unknown');
  const result: PowerConsistency = { status: 'unavailable', topology, branches: [] };
  if (
    !['aron', 'phase-neutral', 'line-line'].includes(topology) ||
    !Number.isFinite(input.kyoritsu)
  )
    return result;
  const phases = aron ? [0, 2] : [0, 1, 2];
  for (const phase of phases) {
    const p = input.phases[phase];
    const expected = expectedBranchPower(p, topology === 'line-line' ? Math.sqrt(3) : 1);
    if (expected === null) return { ...result, branches: [] };
    result.branches.push({ phase, ...compare(expected, Math.abs(p.p)) });
  }
  // PF sign describes leading/lagging. Only the independent P sign sets power flow.
  const signedTotal = result.branches.reduce(
    (sum, b) => sum + (input.phases[b.phase].p < 0 ? -b.expected : b.expected),
    0,
  );
  if (!Number.isFinite(signedTotal)) return { ...result, branches: [] };
  result.total = compare(signedTotal, input.kyoritsu);
  const bands = [...result.branches, result.total].map((b) => b.band);
  result.status = bands.includes('warning')
    ? 'mismatch'
    : bands.includes('unknown')
      ? 'unavailable'
      : bands.includes('intermediate')
        ? 'verify'
        : 'consistent';
  return result;
}
// Legacy records retain their saved verdict. Fresh records always carry the check.
export function powerNeedsVerification(d: Diagnosis) {
  return (
    d.powerConsistency !== undefined &&
    (d.powerConsistency.status !== 'consistent' || d.warnings.length > 0)
  );
}
export function measurementIsOk(d: Diagnosis) {
  return d.status === 'ok' && !powerNeedsVerification(d);
}
export function powerSummary(check: PowerConsistency) {
  return {
    consistent: 'odpovídá',
    verify: 'OVĚŘIT',
    mismatch: 'významný nesoulad',
    unavailable: 'nelze ověřit – doplňte platné U, I, PF, P a typ napětí',
  }[check.status];
}
