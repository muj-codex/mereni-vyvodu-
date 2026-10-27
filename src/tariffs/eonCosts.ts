import cez from './data/eon-cez-household-2026.json';
import egd from './data/eon-egd-household-2026.json';
import pre from './data/eon-pre-household-2026.json';
import business from './data/eon-business-spot.json';
import type { DistributionArea } from './model';
import type { AnnualSplit } from './orlenCosts';
import type { CezLine } from './cezCosts';
export const eonHouseholdSources = { 'ČEZ Distribuce': cez, 'EG.D': egd, PREdistribuce: pre };
export const eonBusinessSource = business;
export type SourcePrice = { priceWithoutVat: number; priceWithVat: number };
type Rows = Record<string, (SourcePrice | null)[]>;
const sum = (lines: CezLine[]) => {
  const priceWithoutVat = lines.reduce((a, b) => a + b.priceWithoutVat, 0);
  const priceWithVat = priceWithoutVat * 1.21;
  if (!Number.isFinite(priceWithVat)) throw new Error('Cenový model je mimo podporovaný rozsah.');
  return { lines, priceWithoutVat, priceWithVat };
};
function validate(amps: number, phases: number, vt: number, nt: number) {
  if (
    ![amps, vt, nt].every(Number.isFinite) ||
    amps <= 0 ||
    vt < 0 ||
    nt < 0 ||
    ![1, 3].includes(phases)
  )
    throw new Error('Zadejte platný jistič a nezápornou spotřebu VT/NT.');
}
function rowPrice(source: { tariffCodes: string[]; rows: Rows }, code: string, row: number) {
  const i = source.tariffCodes.indexOf(code);
  return i < 0 ? null : (source.rows[String(row)]?.[i] ?? null);
}
export function eonHouseholdRow(area: DistributionArea, code: string, row: number) {
  return rowPrice(eonHouseholdSources[area], code, row);
}
export function eonHouseholdBreaker(
  area: DistributionArea,
  code: string,
  amps: number,
  phases: 1 | 3,
) {
  if (!Number.isFinite(amps) || amps <= 0) return null;
  const row = (n: number) => eonHouseholdRow(area, code, n)?.priceWithoutVat ?? null;
  if (phases === 1) {
    const p = row(amps <= 25 ? 6 : 19);
    return p === null ? null : p * (amps <= 25 ? 1 : amps);
  }
  if (phases !== 3) return null;
  if (amps <= 63)
    return row(6 + [10, 16, 20, 25, 32, 40, 50, 63].findIndex((upper) => amps <= upper));
  if (code === 'D57d' && amps <= 160)
    return row(14 + [80, 100, 125, 160].findIndex((upper) => amps <= upper));
  const p = row(18);
  return p === null ? null : amps * p;
}
export function assessEonHousehold(
  code: string,
  area: DistributionArea,
  amps: number,
  phases: 1 | 3,
  vt: number,
  nt: number,
) {
  validate(amps, phases, vt, nt);
  const source = eonHouseholdSources[area];
  if (!source.tariffCodes.includes(code)) return null;
  const row = (n: number) => eonHouseholdRow(area, code, n)?.priceWithoutVat ?? null;
  const dual = row(2) !== null;
  if (!dual && nt !== 0) throw new Error('Jednotarifní sazba nepoužívá NT.');
  const breaker = eonHouseholdBreaker(area, code, amps, phases);
  if ([row(1), row(3), row(4), breaker].some((v) => v === null) || (dual && row(5) === null))
    return null;
  const common = source.common;
  const mwh = (vt + nt) / 1000;
  const pozeByBreaker = 12 * amps * phases * common.pozePerA.priceWithoutVat;
  // The per-MWh cell is a dash. The source explicitly gives total POZE = 0,
  // so use that published total, never invent a missing per-MWh rate.
  const pozeByConsumption: number | null = null;
  const poze = common.pozeAnnual.priceWithoutVat;
  const commercial = (vt / 1000) * row(1)! + (nt / 1000) * (row(2) ?? 0) + 12 * row(3)!;
  const result = sum([
    { label: 'Dodávka VT', priceWithoutVat: (vt / 1000) * row(1)! },
    ...(dual ? [{ label: 'Dodávka NT', priceWithoutVat: (nt / 1000) * row(2)! }] : []),
    { label: 'Stálá obchodní platba', priceWithoutVat: 12 * row(3)! },
    { label: 'Distribuce VT', priceWithoutVat: (vt / 1000) * row(4)! },
    ...(dual ? [{ label: 'Distribuce NT', priceWithoutVat: (nt / 1000) * row(5)! }] : []),
    { label: 'Platba podle jističe', priceWithoutVat: 12 * breaker! },
    { label: 'Daň z elektřiny', priceWithoutVat: mwh * common.tax.priceWithoutVat },
    { label: 'Systémové služby', priceWithoutVat: mwh * common.system.priceWithoutVat },
    {
      label: 'Provoz nesíťové infrastruktury',
      priceWithoutVat: 12 * common.infrastructure.priceWithoutVat,
    },
    { label: 'POZE', priceWithoutVat: poze },
  ]);
  return {
    ...result,
    commercial,
    regulated: result.priceWithoutVat - commercial,
    breakerMonthly: breaker!,
    pozeByBreaker,
    pozeByConsumption,
  };
}
export function eonRefresh(now = new Date()) {
  const due = new Date(`${business.metadata.lastVerifiedAt}T00:00:00Z`);
  due.setUTCDate(due.getUTCDate() + business.metadata.refreshAfterDays);
  return {
    recommended: now.getTime() >= due.getTime(),
    nextRecommendedCheckAt: due.toISOString().slice(0, 10),
  };
}
export function eonBusinessBreaker(code: string, amps: number, phases: 1 | 3 = 3): number | null {
  if (!Number.isFinite(amps) || amps <= 0) return null;
  const row = (n: number) => rowPrice(business, code, n)?.priceWithoutVat ?? null;
  if (phases === 1) {
    const p = row(amps <= 25 ? 5 : 18);
    return p === null ? null : p * (amps <= 25 ? 1 : amps);
  }
  if (phases !== 3 || amps > 160) return null; // Conflicting applicability text in row 17.
  return row(
    5 + [10, 16, 20, 25, 32, 40, 50, 63, 80, 100, 125, 160].findIndex((upper) => amps <= upper),
  );
}
export function assessBusinessRegulated(
  code: string,
  area: DistributionArea,
  amps: number,
  annualKwh: number,
  split: AnnualSplit | null,
) {
  validate(amps, 3, annualKwh, 0);
  if (
    split &&
    (!Number.isFinite(split.annualVT) ||
      !Number.isFinite(split.annualNT) ||
      split.annualVT < 0 ||
      split.annualNT < 0 ||
      Math.abs(split.annualVT + split.annualNT - annualKwh) > 1e-8 * Math.max(1, annualKwh))
  )
    throw new Error('Roční VT/NT neodpovídají celkové spotřebě.');
  if (area !== 'ČEZ Distribuce' || !business.tariffCodes.includes(code)) return null;
  const vtPrice = rowPrice(business, code, 3);
  const ntPrice = rowPrice(business, code, 4);
  const breaker = eonBusinessBreaker(code, amps);
  if (!vtPrice || breaker === null || (ntPrice && !split)) return null;
  const vt = ntPrice ? split!.annualVT : annualKwh;
  const nt = ntPrice ? split!.annualNT : 0;
  const common = business.common;
  return sum([
    { label: 'Distribuce VT', priceWithoutVat: (vt / 1000) * vtPrice.priceWithoutVat },
    ...(ntPrice
      ? [{ label: 'Distribuce NT', priceWithoutVat: (nt / 1000) * ntPrice.priceWithoutVat }]
      : []),
    { label: 'Platba podle jističe', priceWithoutVat: 12 * breaker },
    { label: 'Daň z elektřiny', priceWithoutVat: (annualKwh / 1000) * common.tax.priceWithoutVat },
    {
      label: 'Systémové služby',
      priceWithoutVat: (annualKwh / 1000) * common.system.priceWithoutVat,
    },
    {
      label: 'Provoz nesíťové infrastruktury',
      priceWithoutVat: 12 * common.infrastructure.priceWithoutVat,
    },
    { label: 'POZE', priceWithoutVat: common.pozeAnnual.priceWithoutVat },
  ]);
}
