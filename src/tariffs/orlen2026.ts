import type { DistributionArea } from './model';
export const ORLEN_2026_SOURCE = {
  validFrom: '2026-01-01',
  lastChecked: '2026-10-25',
  provenance: 'Uživatelem ověřený přepis fotografií – zadání verze 1.4.3.',
  distributionArea: 'ČEZ Distribuce' as const,
  verifiedTariffs: ['C01d', 'C02d', 'C03d', 'C25d', 'C45d'] as const,
  priceBasis: 'without-vat' as const,
};
export type VerifiedOrlenTariff = (typeof ORLEN_2026_SOURCE.verifiedTariffs)[number];
export type Price = { priceWithoutVat: number; priceWithVat: null };
const net = (priceWithoutVat: number): Price => ({ priceWithoutVat, priceWithVat: null });
// No VAT is applied without separately verified tax configuration.
export const ORLEN_TAX_CONFIG = { vatRate: null, electricityTaxPerMwh: null };
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
const exact: Partial<Record<VerifiedOrlenTariff, Record<number, number>>> = {
  C01d: {
    10: 66,
    16: 105,
    20: 131,
    25: 164,
    32: 210,
    40: 263,
    50: 329,
    63: 414,
    80: 526,
    100: 657,
    125: 821,
    160: 1051,
  },
  C02d: {
    10: 144,
    16: 231,
    20: 289,
    25: 361,
    32: 462,
    40: 577,
    50: 722,
    63: 909,
    80: 1154,
    100: 1443,
    125: 1804,
    160: 2309,
  },
  C03d: { 10: 819, 16: 1311, 20: 1639, 25: 2048, 32: 2622, 40: 3277 },
};
const bands: Partial<Record<VerifiedOrlenTariff, readonly [number, number, number][]>> = {
  C03d: [
    [50, 63, 5162],
    [63, 80, 6554],
    [80, 100, 8193],
    [100, 125, 10241],
    [125, 160, 13109],
  ],
  C25d: [
    [50, 63, 1329],
    [63, 80, 1687],
    [80, 100, 2109],
    [100, 125, 2636],
    [125, 160, 3374],
  ],
  C45d: [
    [50, 63, 3691],
    [63, 80, 4687],
    [80, 100, 5859],
    [100, 125, 7324],
    [125, 160, 9374],
  ],
};
const above160: Record<VerifiedOrlenTariff, number> = {
  C01d: 6.57,
  C02d: 14.43,
  C03d: 81.93,
  C25d: 21.09,
  C45d: 58.59,
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
    return amps > 25 && (code === 'C01d' || code === 'C02d')
      ? net(amps * (code === 'C01d' ? 2.19 : 4.81))
      : null;
  const fixed = exact[code]?.[amps];
  if (fixed !== undefined) return net(fixed);
  const band = bands[code]?.find(([lower, upper]) => amps > lower && amps <= upper);
  if (band) return net(band[2]);
  return amps > 160 ? net(amps * above160[code]) : null;
}
