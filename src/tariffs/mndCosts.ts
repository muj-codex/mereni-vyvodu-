import source from './data/mnd-prosinec28-2026.json';
import type { Customer, DistributionArea } from './model';
import type { AnnualSplit } from './orlenCosts';
export const mndSources = source;
export const mndLimitWarning =
  'Spotřeba nad 30 MWh/rok – tento ceník MND je určen pouze pro odběrná místa do 30 MWh/rok. MND může při vyšší spotřebě smlouvu neuzavřít nebo od ní odstoupit. Výsledek je pouze orientační.';
type Price = { priceWithoutVat: number; priceWithVat: number };
type Tariff = {
  breakerRows: Record<string, Price | null>;
  distributionVT: Price | null;
  distributionNT: Price | null;
  commodityVT: Price;
  commodityNT: Price | null;
  fixedMonthly: Price;
};
export function mndTariff(customer: Customer, code: string, area: DistributionArea): Tariff | null {
  return (source[customer][area].tariffs as Record<string, Tariff>)[code] ?? null;
}
export function mndBreaker(
  customer: Customer,
  code: string,
  area: DistributionArea,
  amps: number,
  phases: 1 | 3 = 3,
) {
  const t = mndTariff(customer, code, area);
  if (!t || !Number.isFinite(amps) || amps <= 0 || ![1, 3].includes(phases)) return null;
  const rows = t.breakerRows;
  if (phases === 1) {
    const p = rows[amps <= 25 ? '9' : customer === 'C' ? '22' : '23']?.priceWithoutVat;
    return p === undefined ? null : p * (amps <= 25 ? 1 : amps);
  }
  if (customer === 'D' && code !== 'D57d' && amps > 63) {
    const p = rows['22']?.priceWithoutVat;
    return p === undefined ? null : p * amps;
  }
  if (amps > 160) {
    const p = rows['21']?.priceWithoutVat;
    return p === undefined ? null : p * amps;
  }
  return (
    rows[
      String(9 + [10, 16, 20, 25, 32, 40, 50, 63, 80, 100, 125, 160].findIndex((n) => amps <= n))
    ]?.priceWithoutVat ?? null
  );
}

export function assessMnd(
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
  const tariff = mndTariff(customer, code, area);
  const breakerMonthly = mndBreaker(customer, code, area, amps, phases);
  const missing: string[] = [];
  if (!tariff) missing.push('Pro tuto sazbu nemáme ověřený ceník MND.');
  if (tariff?.commodityNT !== null && tariff && !split)
    missing.push('Chybí ověřený rozpad roční spotřeby VT/NT.');
  if (breakerMonthly === null && tariff) missing.push('Pro tento jistič nemáme ověřenou cenu.');
  const warning = annualKwh > 30000 ? mndLimitWarning : null;
  if (missing.length || !tariff || breakerMonthly === null)
    return {
      complete: false,
      missing,
      warning,
      tariff,
      breakerMonthly,
      commercial: null,
      regulated: null,
      poze: null,
      lines: [],
      priceWithoutVat: null,
      priceWithVat: null,
    };
  const c = source[customer][area].common;
  const vt = tariff.commodityNT === null ? annualKwh : split!.annualVT;
  const nt = tariff.commodityNT === null ? 0 : split!.annualNT;
  const commercialLines = [
    { label: 'Dodávka VT', priceWithoutVat: (vt / 1000) * tariff.commodityVT.priceWithoutVat },
    ...(tariff.commodityNT === null
      ? []
      : [
          {
            label: 'Dodávka NT',
            priceWithoutVat: (nt / 1000) * tariff.commodityNT.priceWithoutVat,
          },
        ]),
    { label: 'Stálý obchodní plat', priceWithoutVat: 12 * tariff.fixedMonthly.priceWithoutVat },
  ];
  const poze = (annualKwh / 1000) * c.pozePerMwh.priceWithoutVat;
  const regulatedLines = [
    {
      label: 'Distribuce VT',
      priceWithoutVat: (vt / 1000) * tariff.distributionVT!.priceWithoutVat,
    },
    ...(tariff.distributionNT === null
      ? []
      : [
          {
            label: 'Distribuce NT',
            priceWithoutVat: (nt / 1000) * tariff.distributionNT.priceWithoutVat,
          },
        ]),
    { label: 'Plat za jistič', priceWithoutVat: 12 * breakerMonthly },
    { label: 'Systémové služby', priceWithoutVat: (annualKwh / 1000) * c.system.priceWithoutVat },
    { label: 'POZE', priceWithoutVat: poze },
    { label: 'Nesíťová infrastruktura', priceWithoutVat: 12 * c.infrastructure.priceWithoutVat },
    { label: 'Daň z elektřiny', priceWithoutVat: (annualKwh / 1000) * c.tax.priceWithoutVat },
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
    poze,
    lines: [...commercialLines, ...regulatedLines],
    priceWithoutVat,
    priceWithVat,
  };
}
