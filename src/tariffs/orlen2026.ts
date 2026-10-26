import type { DistributionArea } from './model';
export const ORLEN_2026_SOURCE = {
  validFrom: '2026-01-01',
  lastChecked: '2026-10-26',
  provenance: 'Uživatelem ověřené hodnoty pro verzi 1.4.4, doplněné 26. 10. 2026.',
  distributionArea: 'ČEZ Distribuce' as const,
  verifiedTariffs: ['C01d', 'C02d', 'C03d', 'C25d', 'C45d'] as const,
  priceBasis: 'without-vat' as const,
};
export type VerifiedOrlenTariff = (typeof ORLEN_2026_SOURCE.verifiedTariffs)[number];
export type Price = { priceWithoutVat: number; priceWithVat: number };
const net = (priceWithoutVat: number): Price => ({
  priceWithoutVat,
  priceWithVat: priceWithoutVat * 1.21,
});
// User-verified tax configuration supplied for release 1.4.4.
export const ORLEN_TAX_CONFIG = { vatRate: 0.21, electricityTaxPerMwh: 28.3 };
export const ORLEN_COMMON = {
  systemServicesPerMwh: net(164.24),
  pozePerMwh: net(0),
  pozePerA: net(0),
  pozePerMw: net(0),
  otePerSupplyPointMonth: net(12.87),
  otherOteCharges: null,
  supplierFixedMonthly: null,
};
export const ORLEN_C60D_NOTE = {
  amount: net(2599),
  unit: 'Kč / měsíc',
  usableInCalculation: false,
  note: 'Doložený údaj pro stálý měsíční plat / bezměrný odběr C60d. Význam v aktuálním modelu není ověřen; automaticky se nepoužívá.',
};
export const ORLEN_ENERGY: Record<
  VerifiedOrlenTariff,
  { vtPerMwh: Price; ntPerMwh: Price | null }
> = {
  C01d: { vtPerMwh: net(2599), ntPerMwh: null },
  C02d: { vtPerMwh: net(2599), ntPerMwh: null },
  C03d: { vtPerMwh: net(2599), ntPerMwh: null },
  C25d: { vtPerMwh: net(2599), ntPerMwh: net(2599) },
  C45d: { vtPerMwh: net(2599), ntPerMwh: net(2599) },
};
export const ORLEN_CEZ_DISTRIBUTION: Record<
  VerifiedOrlenTariff,
  { vtPerMwh: Price; ntPerMwh: Price | null }
> = {
  C01d: { vtPerMwh: net(3124.85), ntPerMwh: null },
  C02d: { vtPerMwh: net(2263.19), ntPerMwh: null },
  C03d: { vtPerMwh: net(993.15), ntPerMwh: null },
  C25d: { vtPerMwh: net(2208.39), ntPerMwh: net(116.5) },
  C45d: { vtPerMwh: net(635.38), ntPerMwh: net(116.5) },
};
export const ORLEN_BREAKER_AMPS = [10, 16, 20, 25, 32, 40, 50, 63, 80, 100, 125, 160] as const;
export const ORLEN_BREAKER_MONTHLY: Record<VerifiedOrlenTariff, readonly number[]> = {
  C01d: [66, 105, 131, 164, 210, 263, 329, 414, 526, 657, 821, 1051],
  C02d: [144, 231, 289, 361, 462, 577, 722, 909, 1154, 1443, 1804, 2309],
  C03d: [819, 1311, 1639, 2048, 2622, 3277, 4097, 5162, 6554, 8193, 10241, 13109],
  C25d: [211, 337, 422, 527, 675, 844, 1055, 1329, 1687, 2109, 2636, 3374],
  C45d: [586, 937, 1172, 1465, 1875, 2344, 2930, 3691, 4687, 5859, 7324, 9374],
};
const above160: Record<VerifiedOrlenTariff, number> = {
  C01d: 6.57,
  C02d: 14.43,
  C03d: 81.93,
  C25d: 21.09,
  C45d: 58.59,
};
const singlePhasePerA: Record<VerifiedOrlenTariff, number> = {
  C01d: 2.19,
  C02d: 4.81,
  C03d: 27.31,
  C25d: 7.03,
  C45d: 19.53,
};
export function isVerifiedOrlenTariff(code: string): code is VerifiedOrlenTariff {
  return (ORLEN_2026_SOURCE.verifiedTariffs as readonly string[]).includes(code);
}
export function orlenDistribution(code: string, area: DistributionArea) {
  return area === 'ČEZ Distribuce' && isVerifiedOrlenTariff(code)
    ? ORLEN_CEZ_DISTRIBUTION[code]
    : null;
}
export function orlenBreakerMonthly(
  code: string,
  area: DistributionArea,
  amps: number,
  phases: 1 | 3 = 3,
): Price | null {
  if (
    area !== 'ČEZ Distribuce' ||
    !isVerifiedOrlenTariff(code) ||
    !Number.isFinite(amps) ||
    amps <= 0
  )
    return null;
  if (phases === 1)
    return net(amps <= 25 ? ORLEN_BREAKER_MONTHLY[code][0] : amps * singlePhasePerA[code]);
  if (phases !== 3) return null;
  if (amps > 160) return net(amps * above160[code]);
  const index = ORLEN_BREAKER_AMPS.findIndex((upper) => amps <= upper);
  return index < 0 ? null : net(ORLEN_BREAKER_MONTHLY[code][index]);
}
