import source from './data/innogy-benefit24-2026.json';
import type { Customer, DistributionArea } from './model';
import type { AnnualSplit } from './orlenCosts';
export const innogySources = source;
export const innogyLimitWarning =
  'Spotřeba nad 30 MWh/rok – innogy si podle ceníku vyhrazuje právo nabídku omezit nebo odmítnout. Výsledek je proto orientační.';
type Tariff = {
  breakerRows: Record<string, number | null>;
  distributionVT: number;
  distributionNT: number | null;
  commodityVT: number;
  commodityNT: number | null;
  fixedMonthly: number;
};
export function innogyTariff(customer: Customer, code: string): Tariff | null {
  return (source[customer].tariffs as Record<string, Tariff>)[code] ?? null;
}
export function innogyBreaker(customer: Customer, code: string, amps: number, phases: 1 | 3 = 3) {
  const t = innogyTariff(customer, code);
  if (!t || !Number.isFinite(amps) || amps <= 0 || ![1, 3].includes(phases)) return null;
  const rows = t.breakerRows;
  if (phases === 1) {
    const p = rows[amps <= 25 ? '4' : customer === 'C' ? '17' : '18'];
    return p === null || p === undefined ? null : p * (amps <= 25 ? 1 : amps);
  }
  if (customer === 'D' && code !== 'D57d' && amps > 63) return rows['17']! * amps;
  if (amps > 160) return rows['16'] === null ? null : rows['16']! * amps;
  return (
    rows[
      String(4 + [10, 16, 20, 25, 32, 40, 50, 63, 80, 100, 125, 160].findIndex((n) => amps <= n))
    ] ?? null
  );
}
export function assessInnogy(
  customer: Customer,
  code: string,
  area: DistributionArea,
  amps: number,
  annualKwh: number,
  split: AnnualSplit | null,
  phases: 1 | 3 = 3,
) {
  if (
    !Number.isFinite(amps) ||
    amps <= 0 ||
    !Number.isFinite(annualKwh) ||
    annualKwh < 0 ||
    ![1, 3].includes(phases)
  )
    throw new Error('Neplatná spotřeba nebo jistič.');
  if (
    split &&
    (!Number.isFinite(split.annualVT) ||
      !Number.isFinite(split.annualNT) ||
      split.annualVT < 0 ||
      split.annualNT < 0 ||
      Math.abs(split.annualVT + split.annualNT - annualKwh) > 1e-8 * Math.max(1, annualKwh))
  )
    throw new Error('Roční VT/NT neodpovídají celkové spotřebě.');
  const tariff = innogyTariff(customer, code);
  const breakerMonthly = innogyBreaker(customer, code, amps, phases);
  const missing: string[] = [];
  if (area !== 'ČEZ Distribuce')
    missing.push('Pro tuto distribuční oblast zatím nemáme ověřený ceník innogy Benefit 24.');
  if (!tariff) missing.push('Pro tuto sazbu nemáme ověřený ceník innogy Benefit 24.');
  if (tariff?.commodityNT !== null && tariff && !split)
    missing.push('Chybí ověřený rozpad roční spotřeby VT/NT.');
  if (breakerMonthly === null && tariff) missing.push('Pro tento jistič nemáme ověřenou cenu.');
  const warning = customer === 'C' && annualKwh > 30000 ? innogyLimitWarning : null;
  if (missing.length || !tariff || breakerMonthly === null)
    return {
      complete: false,
      missing,
      warning,
      tariff,
      breakerMonthly,
      commercial: null,
      regulated: null,
      pozeA: null,
      pozeB: null,
      lines: [],
      priceWithoutVat: null,
      priceWithVat: null,
    };
  const c = source[customer].common;
  const vt = tariff.commodityNT === null ? annualKwh : split!.annualVT;
  const nt = tariff.commodityNT === null ? 0 : split!.annualNT;
  const commercialLines = [
    { label: 'Dodávka VT', priceWithoutVat: (vt / 1000) * tariff.commodityVT },
    ...(tariff.commodityNT === null
      ? []
      : [{ label: 'Dodávka NT', priceWithoutVat: (nt / 1000) * tariff.commodityNT }]),
    { label: 'Stálý obchodní plat', priceWithoutVat: 12 * tariff.fixedMonthly },
  ];
  const pozeA = 12 * c.pozeA * amps * phases;
  const pozeB = (annualKwh / 1000) * c.pozeB;
  const regulatedLines = [
    { label: 'Distribuce VT', priceWithoutVat: (vt / 1000) * tariff.distributionVT },
    ...(tariff.distributionNT === null
      ? []
      : [{ label: 'Distribuce NT', priceWithoutVat: (nt / 1000) * tariff.distributionNT }]),
    { label: 'Plat za jistič', priceWithoutVat: 12 * breakerMonthly },
    { label: 'Systémové služby', priceWithoutVat: (annualKwh / 1000) * c.system },
    { label: 'POZE – nižší z A/B', priceWithoutVat: Math.min(pozeA, pozeB) },
    { label: 'OTE', priceWithoutVat: 12 * c.ote },
    { label: 'Datové centrum', priceWithoutVat: 12 * c.dataCentre },
    { label: 'ERÚ', priceWithoutVat: 12 * c.eru },
    { label: 'Daň z elektřiny', priceWithoutVat: (annualKwh / 1000) * c.tax },
  ];
  const sum = (ls: { priceWithoutVat: number }[]) => ls.reduce((a, l) => a + l.priceWithoutVat, 0);
  const commercial = sum(commercialLines),
    regulated = sum(regulatedLines);
  const priceWithoutVat = commercial + regulated,
    priceWithVat = priceWithoutVat * 1.21;
  if (!Number.isFinite(priceWithVat)) throw new Error('Cenový model je mimo podporovaný rozsah.');
  return {
    complete: true,
    missing,
    warning,
    tariff,
    breakerMonthly,
    commercial,
    regulated,
    pozeA,
    pozeB,
    lines: [...commercialLines, ...regulatedLines],
    priceWithoutVat,
    priceWithVat,
  };
}
