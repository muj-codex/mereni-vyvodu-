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
export type SupplierSource =
  | { kind: 'unconfigured' }
  | {
      kind: 'pdf' | 'html' | 'form' | 'interactive-web' | 'area-selection' | 'other';
      url: string | null;
    };
export type Supplier = {
  id: SupplierId;
  name: string;
  workingReference?: true;
  brand: { accentColor: string; logoPath?: string };
  source: SupplierSource;
};
export type SupplierUpdate = {
  status: 'idle' | 'updating' | 'success' | 'error';
  validFrom: string | null;
  lastChecked: string | null;
  sourceStatus: 'not-loaded' | 'not-verified' | 'verified' | 'unavailable';
  error: string | null;
  message: string;
};
export function blankSupplierUpdate(): SupplierUpdate {
  return {
    status: 'idle',
    validFrom: null,
    lastChecked: null,
    sourceStatus: 'not-loaded',
    error: null,
    message: '',
  };
}
export function suppliersFor(customer: Customer): Supplier[] {
  const common: Supplier[] = [
    { id: 'cez', name: 'ČEZ', brand: { accentColor: '#a34d0b' }, source: { kind: 'unconfigured' } },
    {
      id: 'eon',
      name: 'E.ON',
      brand: { accentColor: '#aa1733' },
      source: { kind: 'unconfigured' },
    },
    { id: 'pre', name: 'PRE', brand: { accentColor: '#205f9a' }, source: { kind: 'unconfigured' } },
    {
      id: 'innogy',
      name: 'innogy',
      brand: { accentColor: '#823783' },
      source: { kind: 'unconfigured' },
    },
  ];
  return customer === 'C'
    ? [
        {
          id: 'orlen',
          name: 'ORLEN Unipetrol',
          workingReference: true,
          brand: { accentColor: '#ab2030' },
          source: { kind: 'unconfigured' },
        },
        ...common,
      ]
    : common;
}
