import source from './data/esco-electricity24-2026.json';
import { assessVariantRegulated } from './eonVariantCosts';
import type { DistributionArea } from './model';
import type { AnnualSplit } from './orlenCosts';
import type { SourcePrice } from './eonCosts';
import type { CezLine } from './cezCosts';
export const escoElectricity24Source = source;
type Tariff = {
  sourceTariffLabel: string;
  vtPerMwh: SourcePrice;
  ntPerMwh: SourcePrice | null;
  supplierFixedMonthly: SourcePrice;
};
export function electricity24Tariff(code: string): Tariff | null {
  return (source.tariffs as Record<string, Tariff>)[code] ?? null;
}
export function assessElectricity24(
  code: string,
  area: DistributionArea,
  amps: number,
  annualKwh: number,
  split: AnnualSplit | null,
) {
  // Reuse the existing verified regulated calculation; no new distribution assumptions.
  const regulated = assessVariantRegulated(code, area, amps, annualKwh, split);
  const tariff = electricity24Tariff(code);
  if (!tariff) return null;
  const missing: string[] = [];
  if (area !== 'ČEZ Distribuce')
    missing.push('Pro tuto distribuční oblast nemáme ověřenou regulovanou část.');
  if (code === 'C55d')
    missing.push('Pro C55d máme ověřenou pouze obchodní cenu; regulovaná část není ověřena.');
  if (tariff.ntPerMwh && !split) missing.push('Chybí ověřený rozpad roční spotřeby VT/NT.');
  if (!regulated && !missing.length)
    missing.push('Regulovaná část pro tuto kombinaci není ověřena.');
  const commercialLines: CezLine[] = [];
  if (tariff.ntPerMwh && split) {
    commercialLines.push(
      {
        label: 'Dodávka VT',
        priceWithoutVat: (split.annualVT / 1000) * tariff.vtPerMwh.priceWithoutVat,
      },
      {
        label: 'Dodávka NT',
        priceWithoutVat: (split.annualNT / 1000) * tariff.ntPerMwh.priceWithoutVat,
      },
    );
  } else {
    // The published VT and NT commodity prices are identical. Total commodity
    // cost is known without guessing a split, but distribution still requires it.
    commercialLines.push({
      label: tariff.ntPerMwh ? 'Dodávka elektřiny (VT = NT)' : 'Dodávka VT',
      priceWithoutVat: (annualKwh / 1000) * tariff.vtPerMwh.priceWithoutVat,
    });
  }
  commercialLines.push({
    label: 'Stálá obchodní platba',
    priceWithoutVat: 12 * tariff.supplierFixedMonthly.priceWithoutVat,
  });
  const commercial = commercialLines.reduce((sum, l) => sum + l.priceWithoutVat, 0);
  const complete = !!regulated && missing.length === 0;
  const lines = complete ? [...commercialLines, ...regulated.lines] : commercialLines;
  const priceWithoutVat = complete ? commercial + regulated.priceWithoutVat : null;
  const priceWithVat = priceWithoutVat === null ? null : priceWithoutVat * 1.21;
  if (!Number.isFinite(commercial) || (priceWithVat !== null && !Number.isFinite(priceWithVat)))
    throw new Error('Cenový model je mimo podporovaný rozsah.');
  return { code, complete, missing, commercial, regulated, lines, priceWithoutVat, priceWithVat };
}
