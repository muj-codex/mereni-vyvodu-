import { describe, it, expect } from 'vitest';
import { calculateCompany, comparisonContext } from '../src/tariffs/calculations';
import {
  ORLEN_2026_SOURCE,
  ORLEN_COMMON,
  ORLEN_ENERGY,
  ORLEN_C60D_NOTE,
  ORLEN_TAX_CONFIG,
  orlenDistribution,
  orlenBreakerMonthly,
} from '../src/tariffs/orlen2026';
import { assessOrlen } from '../src/tariffs/orlenCosts';
import { tariffsFor } from '../src/tariffs/catalog';
const input = (tariffCode = 'C25d') => ({
  tariffCode,
  breaker: { choice: '3×63 A', custom: '' },
  first: { date: '2026-01-01', time: '10:00', value: '1000', ntValue: '2000' },
  second: { date: '2026-01-11', time: '10:00', value: '1100', ntValue: '2200' },
});
describe('single and dual register readings', () => {
  it('uses explicit dualTariff metadata for all C tariffs', () => {
    for (const tariff of tariffsFor('C'))
      expect(tariff.dualTariff).toBe(!['C01d', 'C02d', 'C03d'].includes(tariff.code));
  });
  it('splits both actual and annual consumption without losing VT/NT proportions', () => {
    expect(calculateCompany(input())).toMatchObject({
      consumptionVT: 100,
      consumptionNT: 200,
      consumptionKwh: 300,
      annualVT: 3650,
      annualNT: 7300,
      annualKwh: 10950,
      dualTariff: true,
      breakerA: 63,
    });
  });
  it('switching to single tariff ignores even malformed or decreasing stale NT values', () => {
    const x = input('C02d');
    x.first.ntValue = 'not a number';
    x.second.ntValue = '-99999';
    const r = calculateCompany(x);
    expect(r).toMatchObject({
      consumptionVT: 100,
      consumptionNT: 0,
      annualVT: 3650,
      annualNT: 0,
      annualKwh: 3650,
      dualTariff: false,
    });
  });
  it('validates each active register and requires NT only for dual tariffs', () => {
    const x = input();
    expect(() => calculateCompany({ ...x, second: { ...x.second, ntValue: '1999' } })).toThrow(
      /NT/,
    );
    expect(() => calculateCompany({ ...x, second: { ...x.second, value: '999' } })).toThrow(
      /nižší/,
    );
    expect(() => calculateCompany({ ...x, first: { ...x.first, ntValue: '' } })).toThrow(/NT/);
    expect(
      calculateCompany({ ...x, second: { ...x.second, ntValue: x.first.ntValue } }).consumptionNT,
    ).toBe(0);
  });
  it('retains the split through all ORLEN comparison candidates', () => {
    const r = calculateCompany(input());
    const c = comparisonContext(
      'C',
      'company',
      'ČEZ Distribuce',
      r.annualKwh,
      r.breakerA,
      r.originalTariff,
      { annualVT: r.annualVT, annualNT: r.annualNT },
    );
    const selected = c.candidates.find((c) => c.tariffCode === 'C25d')!.orlenAssessment!;
    expect(selected.lines.find((l) => l.key === 'distributionVT')!.priceWithoutVat).toBeCloseTo(
      (3650 / 1000) * 2208.39,
      8,
    );
    expect(selected.lines.find((l) => l.key === 'distributionNT')!.priceWithoutVat).toBeCloseTo(
      (7300 / 1000) * 116.5,
      8,
    );
    expect(c.candidates.every((c) => c.supplierId === 'orlen' && c.breakerA === 63)).toBe(true);
    expect(c.verdict).toEqual({ kind: 'matches', tariffCode: 'C25d' });
  });
});
describe('verified ORLEN 2026 source', () => {
  it('records provenance, validity, manual verification and VAT-inclusive prices', () => {
    expect(ORLEN_2026_SOURCE.validFrom).toBe('2026-01-01');
    expect(ORLEN_2026_SOURCE.lastChecked).toBe('2026-10-26');
    expect(ORLEN_2026_SOURCE.verifiedTariffs).toEqual(['C01d', 'C02d', 'C03d', 'C25d', 'C45d']);
    for (const entry of Object.values(ORLEN_ENERGY)) {
      expect(entry.vtPerMwh).toEqual({ priceWithoutVat: 2599, priceWithVat: 2599 * 1.21 });
      if (entry.ntPerMwh) expect(entry.ntPerMwh).toEqual(entry.vtPerMwh);
    }
    expect(ORLEN_TAX_CONFIG.vatRate).toBe(0.21);
    expect(ORLEN_COMMON.systemServicesPerMwh.priceWithoutVat).toBe(164.24);
    expect(ORLEN_COMMON.otePerSupplyPointMonth.priceWithoutVat).toBe(12.87);
    for (const key of ['pozePerMwh', 'pozePerA', 'pozePerMw'] as const)
      expect(ORLEN_COMMON[key].priceWithoutVat).toBe(0);
  });
  it.each([
    ['C01d', 3124.85, null],
    ['C02d', 2263.19, null],
    ['C03d', 993.15, null],
    ['C25d', 2208.39, 116.5],
    ['C45d', 635.38, 116.5],
  ] as const)('%s distribution stays confined to ČEZ', (code, vt, nt) => {
    const r = orlenDistribution(code, 'ČEZ Distribuce')!;
    expect(r.vtPerMwh.priceWithoutVat).toBe(vt);
    expect(r.ntPerMwh?.priceWithoutVat ?? null).toBe(nt);
    expect(orlenDistribution(code, 'EG.D')).toBeNull();
    expect(orlenDistribution(code, 'PREdistribuce')).toBeNull();
  });
  const amps = [10, 16, 20, 25, 32, 40, 50, 63, 80, 100, 125, 160];
  it.each([
    ['C01d', [66, 105, 131, 164, 210, 263, 329, 414, 526, 657, 821, 1051]],
    ['C02d', [144, 231, 289, 361, 462, 577, 722, 909, 1154, 1443, 1804, 2309]],
  ] as const)('%s fixed breaker table matches every supplied value', (code, values) => {
    amps.forEach((a, i) =>
      expect(orlenBreakerMonthly(code, 'ČEZ Distribuce', a)!.priceWithoutVat).toBe(values[i]),
    );
    expect(orlenBreakerMonthly(code, 'ČEZ Distribuce', 64)!.priceWithoutVat).toBe(values[8]);
  });
  it('preserves C03d values and uses the newly verified 50 A band', () => {
    [819, 1311, 1639, 2048, 2622, 3277].forEach((price, i) =>
      expect(orlenBreakerMonthly('C03d', 'ČEZ Distribuce', amps[i])!.priceWithoutVat).toBe(price),
    );
    expect(orlenBreakerMonthly('C03d', 'ČEZ Distribuce', 50)!.priceWithoutVat).toBe(4097);
  });
  it.each([
    ['C03d', [5162, 6554, 8193, 10241, 13109], 81.93],
    ['C25d', [1329, 1687, 2109, 2636, 3374], 21.09],
    ['C45d', [3691, 4687, 5859, 7324, 9374], 58.59],
  ] as const)('%s uses only explicitly documented bands', (code, values, perA) => {
    [63, 80, 100, 125, 160].forEach((a, i) =>
      expect(orlenBreakerMonthly(code, 'ČEZ Distribuce', a)!.priceWithoutVat).toBe(values[i]),
    );
    [50.01, 63.01, 80.01, 100.01, 125.01].forEach((a, i) =>
      expect(orlenBreakerMonthly(code, 'ČEZ Distribuce', a)!.priceWithoutVat).toBe(values[i]),
    );
    expect(orlenBreakerMonthly(code, 'ČEZ Distribuce', 50)!.priceWithoutVat).toBe(
      { C03d: 4097, C25d: 1055, C45d: 2930 }[code],
    );
    expect(orlenBreakerMonthly(code, 'ČEZ Distribuce', 200)!.priceWithoutVat).toBe(200 * perA);
    if (code !== 'C03d')
      expect(orlenBreakerMonthly(code, 'ČEZ Distribuce', 40)!.priceWithoutVat).toBe(
        code === 'C25d' ? 844 : 2344,
      );
  });
  it('keeps the supplied per-A exceptions separate from table values and phase counts', () => {
    expect(orlenBreakerMonthly('C01d', 'ČEZ Distribuce', 200)!.priceWithoutVat).toBe(1314);
    expect(orlenBreakerMonthly('C02d', 'ČEZ Distribuce', 200)!.priceWithoutVat).toBe(2886);
    expect(orlenBreakerMonthly('C01d', 'ČEZ Distribuce', 30, 1)!.priceWithoutVat).toBe(30 * 2.19);
    expect(orlenBreakerMonthly('C02d', 'ČEZ Distribuce', 30, 1)!.priceWithoutVat).toBe(30 * 4.81);
    expect(orlenBreakerMonthly('C02d', 'ČEZ Distribuce', 25, 1)!.priceWithoutVat).toBe(144);
    expect(orlenBreakerMonthly('C25d', 'ČEZ Distribuce', 30, 1)!.priceWithoutVat).toBe(30 * 7.03);
    expect(orlenBreakerMonthly('C01d', 'EG.D', 40)).toBeNull();
  });
  it.each(['C26d', 'C27d', 'C35d', 'C46d', 'C56d', 'C60d', 'C62d'])(
    '%s has no invented ORLEN prices',
    (code) => {
      const r = assessOrlen(code, 'ČEZ Distribuce', 63, 1000, { annualVT: 500, annualNT: 500 });
      expect(r.verified).toBe(false);
      expect(r.priceWithoutVat).toBeNull();
      expect(r.lines.every((l) => l.priceWithoutVat === null)).toBe(true);
    },
  );
  it('archives the ambiguous C60d fixed fee but never uses it', () => {
    expect(ORLEN_C60D_NOTE.amount.priceWithoutVat).toBe(2599);
    expect(ORLEN_C60D_NOTE.usableInCalculation).toBe(false);
    expect(assessOrlen('C60d', 'ČEZ Distribuce', 40, 1000, null).verified).toBe(false);
  });
});
describe('partial annual costs and completeness gate', () => {
  it('scales MWh, monthly fees, tax and VAT from the verified source', () => {
    const r = assessOrlen('C02d', 'ČEZ Distribuce', 40, 12000, null);
    const values = Object.fromEntries(r.lines.map((l) => [l.key, l.priceWithoutVat]));
    expect(values.energyVT).toBe(31188);
    expect(values.distributionVT).toBeCloseTo(27158.28, 8);
    expect(values.breaker).toBe(6924);
    expect(values.system).toBeCloseTo(1970.88, 8);
    expect(values.ote).toBeCloseTo(154.44, 8);
    expect(values.poze).toBe(0);
    expect(values.supplierFixed).toBeUndefined();
    expect(values.taxes).toBeCloseTo(339.6, 8);
    expect(r.complete).toBe(true);
    expect(r.priceWithoutVat).toBeCloseTo(67735.2, 8);
    expect(r.priceWithVat).toBeCloseTo(81959.592, 8);
    expect(r.lines.every((l) => l.priceWithVat !== null)).toBe(true);
  });
  it('changing VT/NT ratio changes two-tariff distribution with unchanged annual total', () => {
    const a = assessOrlen('C25d', 'ČEZ Distribuce', 63, 1000, { annualVT: 800, annualNT: 200 });
    const b = assessOrlen('C25d', 'ČEZ Distribuce', 63, 1000, { annualVT: 200, annualNT: 800 });
    const dist = (x: typeof a) =>
      x.lines
        .filter((l) => l.key.startsWith('distribution'))
        .reduce((sum, l) => sum + l.priceWithoutVat!, 0);
    expect(dist(a)).toBeCloseTo(1790.012, 8);
    expect(dist(b)).toBeCloseTo(534.878, 8);
    expect(dist(a)).not.toBe(dist(b));
    expect(
      assessOrlen('C25d', 'ČEZ Distribuce', 63, 1000, null).lines.find(
        (l) => l.key === 'distributionVT',
      )!.priceWithoutVat,
    ).toBeNull();
  });
  it('completes verified ČEZ combinations and keeps all other areas incomplete', () => {
    for (const area of ['ČEZ Distribuce', 'EG.D', 'PREdistribuce'] as const)
      for (const code of ORLEN_2026_SOURCE.verifiedTariffs)
        for (const amp of [10, 40, 50, 63, 64, 160, 200]) {
          const r = assessOrlen(code, area, amp, 1000, { annualVT: 600, annualNT: 400 });
          expect(r.complete).toBe(area === 'ČEZ Distribuce');
          if (area === 'ČEZ Distribuce') {
            expect(r.priceWithoutVat).toBeGreaterThan(0);
            expect(r.priceWithVat).toBeCloseTo(r.priceWithoutVat! * 1.21, 8);
            expect(r.missing).toEqual([]);
          } else {
            expect(r.priceWithoutVat).toBeNull();
            expect(r.priceWithVat).toBeNull();
          }
          expect(r.missing).not.toContain('Stálý měsíční plat dodavatele');
        }
  });
});
