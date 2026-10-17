import { CONFIG, VOLTAGE_ANGLES } from './config';
import { currentAngle, equivalentPhaseVoltage } from './physics';
import type { AronScenario, MeasurementInput } from './types';

// Same primary-equivalent voltage calibration as the existing measurement adapter.
// Two actual line-voltage phasors; L2 is the common voltage reference, never a short.
// At nominal 500/100 V and CT r: secondary W = primary W / (5*r).
// Refer back to primary kW for comparison with Kyoritsu: factors cancel exactly.
// Neither the programmed CT ratio nor the informational correction belongs here.
export function aronBranchPower(
  input: MeasurementInput,
  target: 0 | 2,
  source: 0 | 2,
  reversed: boolean,
): number | null {
  const targetVoltage = equivalentPhaseVoltage(input.phases[target]);
  const referenceVoltage = equivalentPhaseVoltage(input.phases[1]);
  const reading = input.phases[source];
  if (!Number.isFinite(reading.i) || reading.i < 0) return null;
  if (reading.i <= CONFIG.numericEpsilon)
    return Math.abs(reading.p) <= CONFIG.numericEpsilon ? 0 : null;
  const angle = currentAngle(reading, source);
  if (targetVoltage === null || referenceVoltage === null || angle === null) return null;
  const rad = (d: number) => (d * Math.PI) / 180;
  const real =
    targetVoltage * Math.cos(rad(VOLTAGE_ANGLES[target])) -
    referenceVoltage * Math.cos(rad(VOLTAGE_ANGLES[1]));
  const imaginary =
    targetVoltage * Math.sin(rad(VOLTAGE_ANGLES[target])) -
    referenceVoltage * Math.sin(rad(VOLTAGE_ANGLES[1]));
  const power =
    (reading.i * (real * Math.cos(rad(angle)) + imaginary * Math.sin(rad(angle)))) / 1000;
  return Number.isFinite(power) ? (reversed ? -power : power) : null;
}
export function generateAronScenarios(input: MeasurementInput): AronScenario[] {
  const assignments: [0 | 2, 0 | 2][] = [
    [0, 2],
    [2, 0],
  ];
  const scale = Math.max(Math.abs(input.kyoritsu), CONFIG.powerEpsilonKw);
  return assignments
    .flatMap((currents, assignment) =>
      Array.from({ length: 4 }, (_, mask): AronScenario => {
        const reversed: [boolean, boolean] = [Boolean(mask & 1), Boolean(mask & 2)];
        const branchPowers: [number | null, number | null] = [
          aronBranchPower(input, 0, currents[0], reversed[0]),
          aronBranchPower(input, 2, currents[1], reversed[1]),
        ];
        const power =
          branchPowers[0] === null || branchPowers[1] === null
            ? null
            : branchPowers[0] + branchPowers[1];
        const error = power === null ? null : Math.abs(power - input.energis);
        return {
          kind: 'aron',
          id: `aron-${assignment}-${mask}`,
          currents: [...currents],
          reversed,
          branchPowers,
          power,
          error,
          score: error === null ? null : Math.max(0, 100 * (1 - error / scale)),
          issues:
            power === null
              ? ['ARON: nelze určit napěťový fázor L1/L2/L3 nebo proudový úhel z P/I/PF.']
              : [],
        };
      }),
    )
    .sort((a, b) => (a.error ?? Infinity) - (b.error ?? Infinity) || a.id.localeCompare(b.id));
}
