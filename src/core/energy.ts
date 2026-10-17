import { PULSE_OPTIONS } from './config';
import type { IntervalInput, MeterConfig } from './types';
// Assumption: register is primary-scaled to the MTP programmed into the meter.
// Isolated adapter: meters with a secondary/unscaled register need another policy.
export function mtpCorrection(actualPrimary: number, programmedPrimary: number): number {
  if (![actualPrimary, programmedPrimary].every((n) => Number.isFinite(n) && n > 0))
    throw new Error('Neplatný převod MTP.');
  return actualPrimary / programmedPrimary;
}
export function compareEnergy(interval: IntervalInput, config: MeterConfig) {
  const from = Date.parse(interval.from),
    to = Date.parse(interval.to);
  if (!Number.isFinite(from) || !Number.isFinite(to) || to <= from)
    throw new Error('Čas DO musí být později než OD.');
  if (![interval.start, interval.end, interval.energis].every((n) => Number.isFinite(n) && n >= 0))
    throw new Error('Stavy a spotřeba musí být nezáporná čísla.');
  if (interval.end < interval.start)
    throw new Error('Stav DO je nižší než OD. Přetočení registru není podporováno.');
  const correction = mtpCorrection(config.actualMtp, config.meterMtp);
  const registerDelta = interval.end - interval.start;
  const meterEnergy = registerDelta * correction;
  const difference = interval.energis - meterEnergy;
  return {
    registerDelta,
    correction,
    meterEnergy,
    energisEnergy: interval.energis,
    difference,
    percent: meterEnergy > 1e-8 ? (difference / meterEnergy) * 100 : null,
  };
}
// Pulse is assumed to use the same primary-scaled basis as the register.
export function estimateEnergisPulse(
  meterEnergy: number,
  energisEnergy: number,
  meterPulse: number,
) {
  if (![meterEnergy, energisEnergy, meterPulse].every((n) => Number.isFinite(n) && n > 0))
    return null;
  const pulseCount = meterEnergy / meterPulse;
  const effective = energisEnergy / pulseCount;
  const nearest = [...PULSE_OPTIONS].sort(
    (a, b) => Math.abs(a.value - effective) - Math.abs(b.value - effective),
  )[0];
  const distancePercent = (Math.abs(nearest.value - effective) / nearest.value) * 100;
  return { effective, pulseCount, nearest, distancePercent, meaningful: distancePercent <= 15 };
}
