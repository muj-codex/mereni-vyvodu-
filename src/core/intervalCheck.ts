import { compareEnergy } from './energy';
import { emptyIdentification, validateIdentification, workingBand } from './current';
import { localTimestamp, parseNumber } from './numbers';
import type { FormDraft, Identification, IntervalInput } from './types';
export interface IntervalCheckRecord {
  kind: 'interval-check';
  id: string;
  savedAt: string;
  localTimestamp: string;
  input: {
    serial: string;
    identification: Identification;
    config: { actualMtp: number; meterMtp: number; voltage: number };
    interval: IntervalInput;
  };
  result: ReturnType<typeof compareEnergy>;
  assessment: ReturnType<typeof assessEnergy>;
}
export function assessEnergy(percent: number | null, bothZero = false) {
  const band = bothZero ? 'success' : workingBand(percent);
  return {
    band,
    summary:
      band === 'success'
        ? 'Spotřeba elektroměru a Energis odpovídá.'
        : band === 'intermediate'
          ? 'Rozdíl spotřeby elektroměru a Energis je třeba ověřit.'
          : band === 'unknown'
            ? 'Při nulové spotřebě elektroměru nelze určit procentní rozdíl.'
            : 'Rozdíl spotřeby elektroměru a Energis je významný.',
    recommendations:
      band === 'success'
        ? []
        : [
            'Prověřte správné nastavení váhy pulzu v elektroměru a Energis.',
            'Pokud nastavení pulzů odpovídá, pokračujte kontrolou měření vývodu a zapojení měřicím přístrojem.',
          ],
  };
}
export function createIntervalCheck(draft: FormDraft, date = new Date()): IntervalCheckRecord {
  if (!draft.serial.trim()) throw Error('Vyplňte číslo elektroměru.');
  const identification = draft.identification ?? emptyIdentification();
  validateIdentification(identification);
  if (![400, 500, 6000, 6300, 10000, 10300].includes(draft.config.voltage))
    throw Error('Neplatný režim sítě.');
  const interval = {
    from: draft.interval.from,
    to: draft.interval.to,
    start: parseNumber(draft.interval.start),
    end: parseNumber(draft.interval.end),
    energis: parseNumber(draft.interval.energis),
  };
  const { actualMtp, meterMtp, voltage } = draft.config;
  const config = { actualMtp, meterMtp, voltage };
  const result = compareEnergy(interval, config);
  return structuredClone({
    kind: 'interval-check',
    id: crypto.randomUUID(),
    savedAt: date.toISOString(),
    localTimestamp: localTimestamp(date),
    input: {
      serial: draft.serial,
      identification: {
        ...identification,
        networkVoltage: voltage,
        time: localTimestamp(date).split(' ')[1],
      },
      config,
      interval,
    },
    result,
    assessment: assessEnergy(
      result.percent,
      result.meterEnergy === 0 && result.energisEnergy === 0,
    ),
  });
}
