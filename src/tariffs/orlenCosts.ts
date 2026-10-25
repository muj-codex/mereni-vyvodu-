import {
  ORLEN_COMMON,
  ORLEN_ENERGY,
  ORLEN_TAX_CONFIG,
  isVerifiedOrlenTariff,
  orlenDistribution,
  orlenBreakerMonthly,
} from './orlen2026';
import { tariffFor } from './catalog';
import type { DistributionArea } from './model';
export type AnnualSplit = { annualVT: number; annualNT: number };
export type CostLine = {
  key: string;
  label: string;
  priceWithoutVat: number | null;
  priceWithVat: number | null;
};
export function assessOrlen(
  code: string,
  area: DistributionArea,
  breakerA: number,
  annualKwh: number,
  split: AnnualSplit | null,
) {
  const verified = isVerifiedOrlenTariff(code);
  const dual = tariffFor('C', code)?.dualTariff ?? false;
  if (!Number.isFinite(annualKwh) || annualKwh < 0 || !Number.isFinite(breakerA) || breakerA <= 0)
    throw new Error('Neplatná spotřeba nebo jistič pro cenový model.');
  if (
    split &&
    (!Number.isFinite(split.annualVT) ||
      split.annualVT < 0 ||
      !Number.isFinite(split.annualNT) ||
      split.annualNT < 0 ||
      Math.abs(split.annualVT + split.annualNT - annualKwh) > 1e-8 * Math.max(1, annualKwh))
  )
    throw new Error('Roční VT/NT neodpovídají celkové spotřebě.');
  const distribution = orlenDistribution(code, area);
  const breaker = orlenBreakerMonthly(code, area, breakerA);
  const energy = verified ? ORLEN_ENERGY[code] : null;
  const lines: CostLine[] = [];
  const add = (key: string, label: string, priceWithoutVat: number | null) => {
    if (priceWithoutVat !== null && !Number.isFinite(priceWithoutVat))
      throw new Error('Cenový model je mimo podporovaný rozsah.');
    lines.push({ key, label, priceWithoutVat, priceWithVat: null });
  };
  const vt = dual ? (split?.annualVT ?? null) : annualKwh;
  const nt = dual ? (split?.annualNT ?? null) : null;
  add(
    'energyVT',
    dual ? 'Silová elektřina VT' : 'Silová elektřina',
    energy && vt !== null ? (vt / 1000) * energy.vtPerMwh.priceWithoutVat : null,
  );
  if (dual)
    add(
      'energyNT',
      'Silová elektřina NT',
      energy?.ntPerMwh && nt !== null ? (nt / 1000) * energy.ntPerMwh.priceWithoutVat : null,
    );
  add(
    'distributionVT',
    dual ? 'Distribuce VT' : 'Distribuce',
    distribution && vt !== null ? (vt / 1000) * distribution.vtPerMwh.priceWithoutVat : null,
  );
  if (dual)
    add(
      'distributionNT',
      'Distribuce NT',
      distribution?.ntPerMwh && nt !== null
        ? (nt / 1000) * distribution.ntPerMwh.priceWithoutVat
        : null,
    );
  add('breaker', 'Plat za jistič', breaker ? breaker.priceWithoutVat * 12 : null);
  add(
    'system',
    'Systémové služby',
    verified ? (annualKwh / 1000) * ORLEN_COMMON.systemServicesPerMwh.priceWithoutVat : null,
  );
  add('poze', 'POZE', verified ? ORLEN_COMMON.pozePerMwh.priceWithoutVat : null);
  add(
    'ote',
    'OTE / provoz nesíťové infrastruktury',
    verified ? ORLEN_COMMON.otePerSupplyPointMonth.priceWithoutVat * 12 : null,
  );
  add('supplierFixed', 'Stálý měsíční plat dodavatele', ORLEN_COMMON.supplierFixedMonthly);
  add('otherMandatory', 'Další povinné / OTE položky', ORLEN_COMMON.otherOteCharges);
  add('taxes', 'Daňové položky', ORLEN_TAX_CONFIG.electricityTaxPerMwh);
  const missing = lines.filter((line) => line.priceWithoutVat === null).map((line) => line.label);
  if (dual && !split) missing.unshift('Ověřený rozpad roční spotřeby VT/NT');
  if (!verified) missing.unshift('Cenová data ORLEN zatím nejsou ověřena.');
  // Current source is incomplete for every combination. Never compare partial subtotals.
  const complete = missing.length === 0;
  const priceWithoutVat = complete
    ? lines.reduce((sum, line) => sum + line.priceWithoutVat!, 0)
    : null;
  return {
    code,
    distributionArea: area,
    breakerA,
    verified,
    dualTariff: dual,
    lines,
    missing,
    complete,
    priceWithoutVat,
    priceWithVat: null,
    vatRate: ORLEN_TAX_CONFIG.vatRate,
  };
}
