// Input-only scaffold. No calculation, storage, price data or network adapters.
export type Customer = 'C' | 'D';
export type Method = 'estimate' | 'actual';
export const distributionAreas = ['ČEZ Distribuce', 'EG.D', 'PREdistribuce'] as const;
export type DistributionArea = (typeof distributionAreas)[number];
export const breakers = [
  '3×16 A',
  '3×20 A',
  '3×25 A',
  '3×32 A',
  '3×40 A',
  '3×50 A',
  '3×63 A',
  '3×80 A',
  '3×100 A',
];
export const periods = ['1', '2', '3', '6', '12'];
export type BreakerInput = { choice: string; custom: string };
export type EstimateInputs = {
  powerKw: string;
  currentA: string;
  simultaneity: string;
  breaker: BreakerInput;
  annualConsumptionKwh: string;
};
export type ActualInputs = {
  tariffCode: string;
  breaker: BreakerInput;
  consumptionKwh: string;
  periodMonths: string;
  customPeriodMonths: string;
  // Reserved input fields; no conversion, annualisation or aggregation.
  vtKwh?: string;
  ntKwh?: string;
};
export type TariffDraft = {
  customer: Customer | null;
  method: Method | null;
  // Exactly one area for the entire comparison and its supplier catalog.
  distributionArea: DistributionArea | '';
  estimate: EstimateInputs;
  actual: ActualInputs;
};
export function blankTariffDraft(): TariffDraft {
  return {
    customer: null,
    method: null,
    distributionArea: '',
    estimate: {
      powerKw: '',
      currentA: '',
      simultaneity: '',
      breaker: { choice: '', custom: '' },
      annualConsumptionKwh: '',
    },
    actual: {
      tariffCode: '',
      breaker: { choice: '', custom: '' },
      consumptionKwh: '',
      periodMonths: '',
      customPeriodMonths: '',
    },
  };
}
export type SupplierId = 'orlen' | 'cez' | 'eon' | 'pre' | 'innogy';
export type Supplier = { id: SupplierId; name: string; workingReference?: true };
export type SupplierUpdate = {
  status: 'not-loaded' | 'loading' | 'success' | 'error';
  validFrom: string | null;
  lastVerifiedAt: string | null;
  error: string | null;
  message: string;
};
export function blankSupplierUpdate(): SupplierUpdate {
  return { status: 'not-loaded', validFrom: null, lastVerifiedAt: null, error: null, message: '' };
}
export function suppliersFor(customer: Customer): Supplier[] {
  const common: Supplier[] = [
    { id: 'cez', name: 'ČEZ' },
    { id: 'eon', name: 'E.ON' },
    { id: 'pre', name: 'PRE' },
    { id: 'innogy', name: 'innogy' },
  ];
  return customer === 'C'
    ? [{ id: 'orlen', name: 'ORLEN Unipetrol', workingReference: true }, ...common]
    : common;
}
