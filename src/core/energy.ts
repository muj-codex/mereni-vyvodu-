import type { IntervalInput, MeterConfig } from './types';
// Assumption: register is primary-scaled to the MTP programmed into the meter.
// Isolated adapter: meters with a secondary/unscaled register need another policy.
export function mtpCorrection(actualPrimary: number, programmedPrimary: number): number {
  if (![actualPrimary, programmedPrimary].every((n) => Number.isFinite(n) && n > 0))
    throw new Error('Neplatný převod MTP.');
  return actualPrimary / programmedPrimary;
}
export function compareEnergy(
  interval: IntervalInput,
  config: Pick<MeterConfig, 'actualMtp' | 'meterMtp'>,
) {
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
  if (![correction, registerDelta, meterEnergy, difference].every(Number.isFinite))
    throw Error('Hodnoty jsou příliš velké pro bezpečné vyhodnocení.');
  const percent = meterEnergy > 0 ? (difference / meterEnergy) * 100 : null;
  if (percent !== null && !Number.isFinite(percent))
    throw Error('Procentní rozdíl je příliš velký.');
  return {
    registerDelta,
    correction,
    meterEnergy,
    energisEnergy: interval.energis,
    difference,
    percent,
  };
}
