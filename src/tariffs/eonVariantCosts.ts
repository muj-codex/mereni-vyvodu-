import source from './data/eon-variant-business-2026.json';
import type { DistributionArea } from './model';
import type { AnnualSplit } from './orlenCosts';
import type { CezLine } from './cezCosts';
import type { SourcePrice } from './eonCosts';
export const eonVariantSource = source;
export function variantRow(code: string, row: number): SourcePrice | null {
  const index = source.tariffCodes.indexOf(code);
  const rows: Record<string, (SourcePrice | null)[]> = source.rows;
  return index < 0 ? null : (rows[String(row)]?.[index] ?? null);
}
function validate(amps: number, annualKwh: number, split: AnnualSplit | null, phases: number) {
  if (
    !Number.isFinite(amps) ||
    amps <= 0 ||
    !Number.isFinite(annualKwh) ||
    annualKwh < 0 ||
    ![1, 3].includes(phases)
  )
    throw new Error('Neplatná spotřeba nebo jistič pro cenový model.');
  if (
    split &&
    (!Number.isFinite(split.annualVT) ||
      !Number.isFinite(split.annualNT) ||
      split.annualVT < 0 ||
      split.annualNT < 0 ||
      Math.abs(split.annualVT + split.annualNT - annualKwh) > 1e-8 * Math.max(1, annualKwh))
  )
    throw new Error('Roční VT/NT neodpovídají celkové spotřebě.');
}
function total(lines: CezLine[]) {
  const priceWithoutVat = lines.reduce((s, l) => s + l.priceWithoutVat, 0);
  const priceWithVat = priceWithoutVat * 1.21;
  if (!Number.isFinite(priceWithVat)) throw new Error('Cenový model je mimo podporovaný rozsah.');
  return { lines, priceWithoutVat, priceWithVat };
}
export function variantBreaker(code: string, amps: number, phases: 1 | 3 = 3): number | null {
  if (!Number.isFinite(amps) || amps <= 0) return null;
  if (phases === 1) {
    const p = variantRow(code, amps <= 25 ? 6 : 19)?.priceWithoutVat;
    return p === undefined ? null : p * (amps <= 25 ? 1 : amps);
  }
  if (phases !== 3) return null;
  if (amps > 160) {
    const p = variantRow(code, 18)?.priceWithoutVat;
    return p === undefined ? null : amps * p;
  }
  return (
    variantRow(
      code,
      6 + [10, 16, 20, 25, 32, 40, 50, 63, 80, 100, 125, 160].findIndex((upper) => amps <= upper),
    )?.priceWithoutVat ?? null
  );
}
export function assessVariantRegulated(
  code: string,
  area: DistributionArea,
  amps: number,
  annualKwh: number,
  split: AnnualSplit | null,
  phases: 1 | 3 = 3,
) {
  validate(amps, annualKwh, split, phases);
  if (area !== 'ČEZ Distribuce' || !source.tariffCodes.includes(code)) return null;
  const distribution = variantRow(code, 4);
  const distributionNT = variantRow(code, 5);
  const breaker = variantBreaker(code, amps, phases);
  if (!distribution || breaker === null || (distributionNT && !split)) return null;
  const vt = distributionNT ? split!.annualVT : annualKwh;
  const nt = distributionNT ? split!.annualNT : 0;
  const c = source.common;
  return {
    ...total([
      { label: 'Distribuce VT', priceWithoutVat: (vt / 1000) * distribution.priceWithoutVat },
      ...(distributionNT
        ? [
            {
              label: 'Distribuce NT',
              priceWithoutVat: (nt / 1000) * distributionNT.priceWithoutVat,
            },
          ]
        : []),
      { label: 'Platba podle jističe', priceWithoutVat: 12 * breaker },
      { label: 'Daň z elektřiny', priceWithoutVat: (annualKwh / 1000) * c.tax.priceWithoutVat },
      { label: 'Systémové služby', priceWithoutVat: (annualKwh / 1000) * c.system.priceWithoutVat },
      {
        label: 'Provoz nesíťové infrastruktury',
        priceWithoutVat: 12 * c.infrastructure.priceWithoutVat,
      },
      // The source gives total POZE = 0; its per-MWh dash remains null.
      { label: 'POZE', priceWithoutVat: c.pozeAnnual.priceWithoutVat },
    ]),
    breakerMonthly: breaker,
  };
}
export function assessEonVariant(
  code: string,
  area: DistributionArea,
  amps: number,
  annualKwh: number,
  split: AnnualSplit | null,
  phases: 1 | 3 = 3,
) {
  validate(amps, annualKwh, split, phases);
  const vtPrice = variantRow(code, 1);
  const ntPrice = variantRow(code, 2);
  const fixed = variantRow(code, 3);
  const supported = !!vtPrice && !!fixed;
  const missing: string[] = [];
  if (!supported) missing.push('Pro tuto sazbu nemáme ověřený cenový podklad.');
  if (area !== 'ČEZ Distribuce')
    missing.push('Pro tuto distribuční oblast nemáme kompletní ověřený podklad.');
  if (ntPrice && !split) missing.push('Chybí ověřený rozpad roční spotřeby VT/NT.');
  const vt = ntPrice ? (split?.annualVT ?? null) : annualKwh;
  const nt = ntPrice ? (split?.annualNT ?? null) : 0;
  const commercialLines: CezLine[] = [];
  if (supported && vt !== null && nt !== null) {
    commercialLines.push({
      label: 'Dodávka VT',
      priceWithoutVat: (vt / 1000) * vtPrice.priceWithoutVat,
    });
    if (ntPrice)
      commercialLines.push({
        label: 'Dodávka NT',
        priceWithoutVat: (nt / 1000) * ntPrice.priceWithoutVat,
      });
    commercialLines.push({
      label: 'Stálá obchodní platba',
      priceWithoutVat: 12 * fixed.priceWithoutVat,
    });
  }
  const commercial = commercialLines.length ? total(commercialLines) : null;
  const regulated = assessVariantRegulated(code, area, amps, annualKwh, split, phases);
  if (!regulated && !missing.length)
    missing.push('Regulovaná část pro zadané parametry není ověřena.');
  const complete = missing.length === 0 && !!commercial && !!regulated;
  const result = complete ? total([...commercial!.lines, ...regulated!.lines]) : null;
  return {
    code,
    supported,
    complete,
    missing,
    commercial,
    regulated,
    lines: result?.lines ?? commercialLines,
    priceWithoutVat: result?.priceWithoutVat ?? null,
    priceWithVat: result?.priceWithVat ?? null,
  };
}
