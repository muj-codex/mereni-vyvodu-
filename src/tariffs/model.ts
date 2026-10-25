// Separate tariff workflow. No measurement imports or persistence.
export type Customer = 'C' | 'D';
export type Method = 'flat' | 'company';
export const distributionAreas = ['ČEZ Distribuce', 'EG.D', 'PREdistribuce'] as const;
export type DistributionArea = (typeof distributionAreas)[number];
export const standardBreakerAmps = [10, 16, 20, 25, 32, 40, 50, 63, 80, 100, 125, 160] as const;
export const breakers = standardBreakerAmps.map((amps) => `3×${amps} A`);
export const periods = ['1', '2', '3', '6', '12'];
export type BreakerInput = { choice: string; custom: string };
export type FlatInputs = {
  currentA: string;
  simultaneity: string;
  consumptionKwh: string;
  periodMonths: string;
  customPeriodMonths: string;
  breaker: BreakerInput;
};
export type ReadingInput = { date: string; time: string; value: string };
export type CompanyInputs = {
  tariffCode: string;
  breaker: BreakerInput;
  first: ReadingInput;
  second: ReadingInput;
  vtKwh?: string;
  ntKwh?: string;
};
export type TariffDraft = {
  customer: Customer | null;
  method: Method | null;
  distributionArea: DistributionArea | '';
  flat: FlatInputs;
  company: CompanyInputs;
};
export function blankTariffDraft(): TariffDraft {
  return {
    customer: null,
    method: null,
    distributionArea: '',
    flat: {
      currentA: '',
      simultaneity: '',
      consumptionKwh: '',
      periodMonths: '1',
      customPeriodMonths: '',
      breaker: { choice: 'auto', custom: '' },
    },
    company: {
      tariffCode: '',
      breaker: { choice: '', custom: '' },
      first: { date: '', time: '', value: '' },
      second: { date: '', time: '', value: '' },
    },
  };
}
// Unknown costs stay null. No price arithmetic or simulated values.
export type AnnualCosts = {
  commodity: { vt: number | null; nt: number | null; total: number | null };
  supplierMonthlyFixed: number | null;
  distribution: number | null;
  breakerPayment: number | null;
  regulatedItems: number | null;
  systemServices: number | null;
  poze: number | null;
  oteAndMandatoryItems: number | null;
  taxes: number | null;
  vat: number | null;
  annualTotal: number | null;
};
export function unknownAnnualCosts(): AnnualCosts {
  return {
    commodity: { vt: null, nt: null, total: null },
    supplierMonthlyFixed: null,
    distribution: null,
    breakerPayment: null,
    regulatedItems: null,
    systemServices: null,
    poze: null,
    oteAndMandatoryItems: null,
    taxes: null,
    vat: null,
    annualTotal: null,
  };
}
export type PriceList = {
  distributionArea: DistributionArea;
  validFrom: string;
  tariffs: { code: string; annualCosts: AnnualCosts }[];
};
export type SupplierId = 'orlen' | 'cez' | 'eon' | 'pre' | 'innogy' | 'mnd' | 'centropol' | 'epet';
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
  lastValidPriceList: PriceList | null;
};
export function blankSupplierUpdate(): SupplierUpdate {
  return {
    status: 'idle',
    validFrom: null,
    lastChecked: null,
    sourceStatus: 'not-loaded',
    error: null,
    message: '',
    lastValidPriceList: null,
  };
}
export function suppliersFor(customer: Customer, method: Method = 'flat'): Supplier[] {
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
    { id: 'mnd', name: 'MND', brand: { accentColor: '#275d99' }, source: { kind: 'unconfigured' } },
    {
      id: 'centropol',
      name: 'Centropol',
      brand: { accentColor: '#9c4a0b' },
      source: { kind: 'unconfigured' },
    },
    {
      id: 'epet',
      name: 'EPET',
      brand: { accentColor: '#813e70' },
      source: { kind: 'unconfigured' },
    },
  ];
  const available: Supplier[] =
    customer === 'C'
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
  return method === 'company'
    ? available.filter((s) => customer === 'C' && s.id === 'orlen')
    : available;
}
