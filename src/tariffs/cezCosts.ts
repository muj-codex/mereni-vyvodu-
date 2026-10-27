import cez from './data/cez-household-2026.json';
import egd from './data/egd-household-2026.json';
import pre from './data/pre-household-2026.json';
import spot from './data/esco-spot-2026.json';
import type { DistributionArea } from './model';
import {
  ORLEN_COMMON,
  ORLEN_TAX_CONFIG,
  orlenDistribution,
  orlenBreakerMonthly,
} from './orlen2026';
import type { AnnualSplit } from './orlenCosts';

export const householdSources = { 'ČEZ Distribuce': cez, 'EG.D': egd, PREdistribuce: pre };
export const escoSource = spot;
export const latestSpotMonth = () => Object.keys(spot.monthlyPricesWithoutVatPerMwh).sort().at(-1)!;
export function spotPrice(code: string): number | null {
  const months: Record<string, Record<string, number>> = spot.monthlyPricesWithoutVatPerMwh;
  return months[latestSpotMonth()]?.[code] ?? null;
}
export function spotRefresh(now = new Date()) {
  const due = new Date(`${spot.metadata.lastVerifiedAt}T00:00:00Z`);
  due.setUTCDate(due.getUTCDate() + spot.metadata.refreshAfterDays);
  return {
    nextRecommendedCheckAt: due.toISOString().slice(0, 10),
    recommended: now.getTime() >= due.getTime(),
  };
}
export type CezLine = { label: string; priceWithoutVat: number };
const total = (lines: CezLine[]) => {
  const priceWithoutVat = lines.reduce((sum, line) => sum + line.priceWithoutVat, 0);
  const priceWithVat = priceWithoutVat * 1.21;
  if (!Number.isFinite(priceWithVat)) throw new Error('Cenový model je mimo podporovaný rozsah.');
  return { lines, priceWithoutVat, priceWithVat };
};
function validate(amps: number, vt: number, nt: number, phases: number) {
  if (
    ![amps, vt, nt].every(Number.isFinite) ||
    amps <= 0 ||
    vt < 0 ||
    nt < 0 ||
    ![1, 3].includes(phases)
  )
    throw new Error('Zadejte platný jistič a nezápornou spotřebu VT/NT.');
}
export function householdRow(area: DistributionArea, code: string, row: number): number | null {
  const source = householdSources[area];
  const i = source.tariffCodes.indexOf(code);
  const rows: Record<string, (number | null)[]> = source.rowsWithoutVat;
  return i < 0 ? null : (rows[String(row)]?.[i] ?? null);
}
export function householdBreaker(
  area: DistributionArea,
  code: string,
  amps: number,
  phases: 1 | 3,
): number | null {
  if (!Number.isFinite(amps) || amps <= 0) return null;
  if (phases === 1) {
    const value = householdRow(area, code, amps <= 25 ? 6 : 20);
    return value === null ? null : value * (amps <= 25 ? 1 : amps);
  }
  if (phases !== 3) return null;
  const bands = [10, 16, 20, 25, 32, 40, 50, 63];
  if (amps <= 63) return householdRow(area, code, 6 + bands.findIndex((upper) => amps <= upper));
  if (code === 'D57d') {
    if (amps > 160) {
      const rate = householdRow(area, code, 18);
      return rate === null ? null : amps * rate;
    }
    return householdRow(area, code, 14 + [80, 100, 125, 160].findIndex((upper) => amps <= upper));
  }
  const rate = householdRow(area, code, 19);
  return rate === null ? null : amps * rate;
}
export function assessHousehold(
  code: string,
  area: DistributionArea,
  amps: number,
  phases: 1 | 3,
  vt: number,
  nt: number,
) {
  validate(amps, vt, nt, phases);
  const row = (n: number) => householdRow(area, code, n);
  const dual = row(2) !== null;
  if (!dual && nt !== 0) throw new Error('Jednotarifní sazba nepoužívá NT.');
  const breaker = householdBreaker(area, code, amps, phases);
  const required = [row(1), row(3), row(4), breaker, row(21), row(22), row(23), row(24), row(25)];
  if (required.some((v) => v === null) || (dual && row(5) === null)) return null;
  const mwh = (vt + nt) / 1000;
  const pozeByBreaker = 12 * row(24)! * amps * phases;
  const pozeByConsumption = mwh * row(25)!;
  const commercial = (vt / 1000) * row(1)! + (nt / 1000) * (row(2) ?? 0) + 12 * row(3)!;
  const lines: CezLine[] = [
    { label: 'Dodávka VT', priceWithoutVat: (vt / 1000) * row(1)! },
    ...(dual ? [{ label: 'Dodávka NT', priceWithoutVat: (nt / 1000) * row(2)! }] : []),
    { label: 'Stálá obchodní platba', priceWithoutVat: 12 * row(3)! },
    { label: 'Distribuce VT', priceWithoutVat: (vt / 1000) * row(4)! },
    ...(dual ? [{ label: 'Distribuce NT', priceWithoutVat: (nt / 1000) * row(5)! }] : []),
    { label: 'Platba podle jističe', priceWithoutVat: 12 * breaker! },
    { label: 'Daň z elektřiny', priceWithoutVat: mwh * row(21)! },
    { label: 'Systémové služby', priceWithoutVat: mwh * row(22)! },
    { label: 'Provoz nesíťové infrastruktury', priceWithoutVat: 12 * row(23)! },
    { label: 'POZE', priceWithoutVat: Math.min(pozeByBreaker, pozeByConsumption) },
  ];
  const result = total(lines);
  return {
    ...result,
    commercial,
    regulated: result.priceWithoutVat - commercial,
    breakerMonthly: breaker!,
    pozeByBreaker,
    pozeByConsumption,
  };
}
export function assessEsco(
  code: string,
  area: DistributionArea,
  amps: number,
  annualKwh: number,
  split: AnnualSplit | null,
) {
  validate(amps, annualKwh, 0, 3);
  if (
    split &&
    (!Number.isFinite(split.annualVT) ||
      !Number.isFinite(split.annualNT) ||
      split.annualVT < 0 ||
      split.annualNT < 0 ||
      Math.abs(split.annualVT + split.annualNT - annualKwh) > 1e-8 * Math.max(1, annualKwh))
  )
    throw new Error('Roční VT/NT neodpovídají celkové spotřebě.');
  const price = spotPrice(code);
  if (price === null) return null;
  const commercial = (annualKwh / 1000) * price + 12 * spot.supplierFixedMonthlyWithoutVat;
  const distribution = orlenDistribution(code, area);
  const breaker = orlenBreakerMonthly(code, area, amps);
  const dual = !['C01d', 'C02d', 'C03d', 'C62d'].includes(code);
  const complete = !!distribution && !!breaker && (!dual || !!split);
  const lines: CezLine[] = [
    { label: 'Dodávka elektřiny (VT = NT)', priceWithoutVat: (annualKwh / 1000) * price },
    { label: 'Stálá obchodní platba', priceWithoutVat: 12 * spot.supplierFixedMonthlyWithoutVat },
  ];
  if (complete) {
    const vt = dual ? split!.annualVT : annualKwh;
    const nt = dual ? split!.annualNT : 0;
    lines.push(
      {
        label: 'Distribuce VT',
        priceWithoutVat: (vt / 1000) * distribution.vtPerMwh.priceWithoutVat,
      },
      ...(dual
        ? [
            {
              label: 'Distribuce NT',
              priceWithoutVat: (nt / 1000) * distribution.ntPerMwh!.priceWithoutVat,
            },
          ]
        : []),
      { label: 'Platba podle jističe', priceWithoutVat: 12 * breaker.priceWithoutVat },
      {
        label: 'Systémové služby',
        priceWithoutVat: (annualKwh / 1000) * ORLEN_COMMON.systemServicesPerMwh.priceWithoutVat,
      },
      { label: 'POZE', priceWithoutVat: ORLEN_COMMON.pozePerMwh.priceWithoutVat },
      {
        label: 'Provoz nesíťové infrastruktury',
        priceWithoutVat: 12 * ORLEN_COMMON.otePerSupplyPointMonth.priceWithoutVat,
      },
      {
        label: 'Daň z elektřiny',
        priceWithoutVat: (annualKwh / 1000) * ORLEN_TAX_CONFIG.electricityTaxPerMwh,
      },
    );
  }
  const result = total(lines);
  return {
    lines,
    commercial,
    complete,
    priceWithoutVat: complete ? result.priceWithoutVat : null,
    priceWithVat: complete ? result.priceWithVat : null,
  };
}
