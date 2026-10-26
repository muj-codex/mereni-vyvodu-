import { assessOrlen } from './orlenCosts';
import {
  standardBreakerAmps,
  suppliersFor,
  unknownAnnualCosts,
  type BreakerInput,
  type FlatInputs,
  type CompanyInputs,
  type Customer,
  type DistributionArea,
  type Method,
  type ReadingInput,
} from './model';
import { tariffsFor, tariffFor } from './catalog';
export class TariffInputError extends Error {}
export function numberInput(value: string, label: string): number {
  if (!/^\d+(?:[,.]\d+)?$/.test(value.trim()))
    throw new TariffInputError(`Vyplňte platnou hodnotu: ${label}.`);
  const n = Number(value.trim().replace(',', '.'));
  if (!Number.isFinite(n)) throw new TariffInputError(`Hodnota je příliš velká: ${label}.`);
  return n;
}
export function loadAfterSimultaneity(current: string, coefficient: string) {
  const amperes = numberInput(current, 'Proudové zatížení');
  const factor = numberInput(coefficient, 'Soudobost');
  if (amperes <= 0) throw new TariffInputError('Proudové zatížení musí být větší než 0.');
  if (factor <= 0 || factor > 1)
    throw new TariffInputError('Soudobost musí být větší než 0 a nejvýše 1.');
  const concurrentA = amperes * factor;
  if (!Number.isFinite(concurrentA) || concurrentA <= 0)
    throw new TariffInputError('Proud po soudobosti je mimo podporovaný rozsah.');
  // Strictly higher standard rating, with no display rounding before selection.
  return { concurrentA, recommendedA: standardBreakerAmps.find((a) => a > concurrentA) ?? null };
}
export function usedBreaker(input: BreakerInput, recommendedA?: number | null): number {
  if (input.choice === 'auto') {
    if (!recommendedA)
      throw new TariffInputError(
        'Pro toto zatížení nelze navrhnout jistič ze standardní řady. Zadejte vlastní hodnotu.',
      );
    return recommendedA;
  }
  if (input.choice === 'custom') {
    const amps = numberInput(input.custom, 'Vlastní jistič');
    if (amps <= 0) throw new TariffInputError('Vlastní jistič musí být větší než 0 A.');
    return amps;
  }
  const standard = standardBreakerAmps.find((a) => `3×${a} A` === input.choice);
  if (!standard) throw new TariffInputError('Vyberte hlavní jistič.');
  return standard;
}
export function calculateFlat(input: FlatInputs) {
  const load = loadAfterSimultaneity(input.currentA, input.simultaneity);
  const consumptionKwh = numberInput(input.consumptionKwh, 'Spotřeba za období');
  const months = numberInput(
    input.periodMonths === 'custom' ? input.customPeriodMonths : input.periodMonths,
    'Délka období',
  );
  if (months <= 0 || !Number.isInteger(months))
    throw new TariffInputError('Délka období musí být kladný celý počet měsíců.');
  const annualKwh = consumptionKwh * (12 / months);
  if (!Number.isFinite(annualKwh))
    throw new TariffInputError('Roční spotřeba je mimo podporovaný rozsah.');
  return {
    ...load,
    consumptionKwh,
    months,
    annualKwh,
    breakerA: usedBreaker(input.breaker, load.recommendedA),
  };
}
// Meter timestamps are Czech civil time. Intl supplies the Europe/Prague offsets,
// independent of the browser/OS time zone. DST gaps and overlaps are rejected.
const zone = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Europe/Prague',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
});
function wallMilliseconds(epoch: number): number {
  const parts = Object.fromEntries(zone.formatToParts(epoch).map((p) => [p.type, p.value]));
  return Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour),
    Number(parts.minute),
    Number(parts.second),
  );
}
export function readingInstant(reading: ReadingInput): number {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(reading.date) || !/^\d{2}:\d{2}$/.test(reading.time))
    throw new TariffInputError('Vyplňte datum a čas obou odečtů.');
  const [year, month, day] = reading.date.split('-').map(Number);
  const [hour, minute] = reading.time.split(':').map(Number);
  const wall = Date.UTC(year, month - 1, day, hour, minute);
  const check = new Date(wall);
  if (
    year < 1000 ||
    check.getUTCFullYear() !== year ||
    check.getUTCMonth() !== month - 1 ||
    check.getUTCDate() !== day ||
    hour > 23 ||
    minute > 59
  )
    throw new TariffInputError('Datum nebo čas odečtu není platný.');
  const offsets = new Set(
    [-86400000, 0, 86400000].map((delta) => wallMilliseconds(wall + delta) - (wall + delta)),
  );
  const candidates = [...offsets]
    .map((offset) => wall - offset)
    .filter((epoch) => wallMilliseconds(epoch) === wall);
  if (candidates.length !== 1)
    throw new TariffInputError(
      'Čas odečtu je při změně letního času neexistující nebo nejednoznačný. Zadejte jednoznačný čas v pásmu Europe/Prague.',
    );
  return candidates[0];
}
export function calculateCompany(input: CompanyInputs) {
  const tariff = tariffFor('C', input.tariffCode);
  if (!tariff) throw new TariffInputError('Vyberte původní sazbu C.');
  const first = readingInstant(input.first),
    second = readingInstant(input.second);
  if (second <= first)
    throw new TariffInputError('Druhé datum a čas musí být pozdější než první odečet.');
  const firstKwh = numberInput(input.first.value, 'První stav elektroměru');
  const secondKwh = numberInput(input.second.value, 'Druhý stav elektroměru');
  if (secondKwh < firstKwh)
    throw new TariffInputError('Druhý stav elektroměru nesmí být nižší než první.');
  const elapsedHours = (second - first) / 3600000;
  const consumptionVT = secondKwh - firstKwh;
  let consumptionNT = 0;
  if (tariff.dualTariff) {
    const nt1 = numberInput(input.first.ntValue ?? '', 'První stav NT');
    const nt2 = numberInput(input.second.ntValue ?? '', 'Druhý stav NT');
    if (nt2 < nt1) throw new TariffInputError('Druhý stav NT nesmí být nižší než první.');
    consumptionNT = nt2 - nt1;
  }
  const consumptionKwh = consumptionVT + consumptionNT;
  const annualVT = consumptionVT * ((365 * 24) / elapsedHours);
  const annualNT = consumptionNT * ((365 * 24) / elapsedHours);
  const annualKwh = annualVT + annualNT;
  if (!Number.isFinite(annualKwh))
    throw new TariffInputError('Roční ekvivalent je mimo podporovaný rozsah.');
  return {
    consumptionKwh,
    consumptionVT,
    consumptionNT,
    annualVT,
    annualNT,
    dualTariff: tariff.dualTariff,
    elapsedHours,
    annualKwh,
    breakerA: usedBreaker(input.breaker),
    originalTariff: input.tariffCode,
  };
}
export type FlatResult = ReturnType<typeof calculateFlat>;
export type CompanyResult = ReturnType<typeof calculateCompany>;
export type TariffVerdict =
  | { kind: 'pending' }
  | { kind: 'matches'; tariffCode: string }
  | { kind: 'recommended'; tariffCode: string };
export function comparisonContext(
  customer: Customer,
  method: Method,
  area: DistributionArea,
  annualKwh: number,
  breakerA: number,
  originalTariff: string | null = null,
  annualSplit: { annualVT: number; annualNT: number } | null = null,
) {
  if (method === 'company' && customer !== 'C')
    throw new TariffInputError('Odhad / firmy je dostupný pouze v režimu C.');
  if (!['ČEZ Distribuce', 'EG.D', 'PREdistribuce'].includes(area))
    throw new TariffInputError('Vyberte distribuční oblast.');
  if (!Number.isFinite(annualKwh) || annualKwh < 0 || !Number.isFinite(breakerA) || breakerA <= 0)
    throw new TariffInputError('Spotřeba a jistič musí být platné číselné hodnoty.');
  if (method === 'company' && (!originalTariff || !tariffFor('C', originalTariff)))
    throw new TariffInputError('Vyberte původní sazbu C.');
  const context = {
    customer,
    method,
    distributionArea: area,
    originalTariff,
    annualSplit,
    annualKwh,
    breakerA,
    verdict: { kind: 'pending' } as TariffVerdict,
    candidates: suppliersFor(customer, method).flatMap((supplier) =>
      tariffsFor(customer).map((tariff) => ({
        supplierId: supplier.id,
        tariffCode: tariff.code,
        distributionArea: area,
        breakerA,
        annualKwh,
        eligibility: 'not-evaluated' as const,
        annualCosts: unknownAnnualCosts(),
        orlenAssessment:
          supplier.id === 'orlen'
            ? assessOrlen(tariff.code, area, breakerA, annualKwh, annualSplit)
            : null,
      })),
    ),
  };
  if (method === 'company') {
    const current = context.candidates.find(
      (c) => c.supplierId === 'orlen' && c.tariffCode === originalTariff,
    )?.orlenAssessment;
    // Single-register data does not establish a low-tariff split or technical eligibility.
    // Compare the three universal single tariffs and the user's existing dual tariff only.
    const comparable = context.candidates.filter(
      (c) =>
        c.supplierId === 'orlen' &&
        c.orlenAssessment?.complete &&
        (!c.orlenAssessment.dualTariff || c.tariffCode === originalTariff),
    );
    if (current?.complete && comparable.length > 1) {
      const best = comparable.reduce((a, b) =>
        a.orlenAssessment!.priceWithVat! <= b.orlenAssessment!.priceWithVat! ? a : b,
      );
      const matches = current.priceWithVat! <= best.orlenAssessment!.priceWithVat! + 1e-8;
      context.verdict = {
        kind: matches ? 'matches' : 'recommended',
        tariffCode: matches ? originalTariff! : best.tariffCode,
      };
    }
  }
  return context;
}
export type ComparisonContext = ReturnType<typeof comparisonContext>;
