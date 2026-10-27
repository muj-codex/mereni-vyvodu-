import { distributionAreas, type Customer, type DistributionArea } from './model';

export const companyTariffCodes = [
  'C01d',
  'C02d',
  'C03d',
  'C25d',
  'C26d',
  'C27d',
  'C35d',
  'C45d',
  'C46d',
  'C55d',
  'C56d',
  'C60d',
  'C62d',
] as const;
export const householdTariffCodes = [
  'D01d',
  'D02d',
  'D25d',
  'D26d',
  'D27d',
  'D35d',
  'D45d',
  'D56d',
  'D57d',
  'D61d',
] as const;
export type TariffCode =
  (typeof companyTariffCodes)[number] | (typeof householdTariffCodes)[number];
export type TechnicalConditions = {
  lowTariffHoursPerDay: number | null;
  waterHeating: boolean | null;
  storageHeating: boolean | null;
  directHeating: boolean | null;
  heatPump: boolean | null;
  electricVehicle: boolean | null;
  otherConditions: string[];
};
// Reserved data shape, never populated or used for calculations in this release.
export type RegulatedPriceData = {
  validFrom: string;
  vtPerKwh: string | null;
  ntPerKwh: string | null;
  breakerPayments: Record<string, string>;
};
export type Tariff = {
  code: TariffCode;
  category: Customer;
  tariffType: 'single' | 'dual';
  dualTariff: boolean;
  usesVT: true;
  usesNT: boolean;
  usageNote: string;
  technicalConditions: TechnicalConditions;
  regulatedPricesByArea: Record<DistributionArea, RegulatedPriceData | null>;
};
const singleTariffs: readonly string[] = ['C01d', 'C02d', 'C03d', 'D01d', 'D02d'];
function entry(code: TariffCode, category: Customer): Tariff {
  const single = singleTariffs.includes(code);
  return {
    code,
    category,
    tariffType: single ? 'single' : 'dual',
    dualTariff: !single,
    usesVT: true,
    usesNT: !single,
    usageNote: `${single ? 'Jednotarifní' : 'Dvoutarifní'} sazba pro ${category === 'C' ? 'podnikatele a firmy' : 'domácnosti'}. Podmínky použití budou doplněny.`,
    technicalConditions: {
      lowTariffHoursPerDay: null,
      waterHeating: null,
      storageHeating: null,
      directHeating: null,
      heatPump: null,
      electricVehicle: null,
      otherConditions: [],
    },
    regulatedPricesByArea: Object.fromEntries(
      distributionAreas.map((area) => [area, null]),
    ) as Tariff['regulatedPricesByArea'],
  };
}
const catalog: readonly Tariff[] = [
  ...companyTariffCodes.map((code) => entry(code, 'C')),
  ...householdTariffCodes.map((code) => entry(code, 'D')),
];
export function tariffsFor(customer: Customer): readonly Tariff[] {
  return catalog.filter((tariff) => tariff.category === customer);
}
export function tariffFor(customer: Customer, code: string): Tariff | undefined {
  return catalog.find((tariff) => tariff.category === customer && tariff.code === code);
}
