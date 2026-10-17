import { CONFIG, VOLTAGE_ANGLES } from './config';
import type { PhaseReading } from './types';
import type { Phase } from './config';
const rad = (degrees: number) => (degrees * Math.PI) / 180;
export function equivalentPhaseVoltage(reading: PhaseReading): number | null {
  const { i, pf, p } = reading;
  if (
    ![i, pf, p].every(Number.isFinite) ||
    i <= CONFIG.numericEpsilon ||
    Math.abs(pf) <= CONFIG.numericEpsilon ||
    Math.abs(pf) > 1
  )
    return null;
  const voltage = (Math.abs(p) * 1000) / (i * Math.abs(pf));
  return Number.isFinite(voltage) && voltage > CONFIG.numericEpsilon ? voltage : null;
}
// Phasors rotate counterclockwise. Positive PF lags; negative PF leads.
// P sign independently selects the forward/reverse active-power half-plane.
export function currentAngle(reading: PhaseReading, source: Phase): number | null {
  if (reading.currentAngleDegrees !== undefined)
    return Number.isFinite(reading.currentAngleDegrees) ? reading.currentAngleDegrees : null;
  if (!Number.isFinite(reading.pf) || Math.abs(reading.pf) > 1 || !Number.isFinite(reading.p))
    return null;
  const magnitude = (Math.acos(Math.abs(reading.pf)) * 180) / Math.PI;
  const direction = reading.pf < 0 ? 1 : -1;
  return VOLTAGE_ANGLES[source] + direction * magnitude + (reading.p < 0 ? 180 : 0);
}
export function branchPower(
  targetVoltage: number | null,
  target: Phase,
  source: Phase,
  reading: PhaseReading,
): number | null {
  if (!Number.isFinite(reading.i) || reading.i < 0) return null;
  if (reading.i <= CONFIG.numericEpsilon)
    return Math.abs(reading.p) <= CONFIG.numericEpsilon ? 0 : null;
  const angle = currentAngle(reading, source);
  if (
    targetVoltage === null ||
    !Number.isFinite(targetVoltage) ||
    targetVoltage <= 0 ||
    angle === null
  )
    return null;
  const result = (targetVoltage * reading.i * Math.cos(rad(VOLTAGE_ANGLES[target] - angle))) / 1000;
  return Number.isFinite(result) ? result : null;
}
