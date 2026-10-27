import { describe, it, expect } from 'vitest';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { comparisonContext } from '../src/tariffs/calculations';
import { CezPrices } from '../src/tariffs/CezPrices';
import { EonBusinessPrices, EonHouseholdComparison } from '../src/tariffs/EonPrices';
import { assessHousehold, assessEsco, escoSource } from '../src/tariffs/cezCosts';
import { assessOrlen } from '../src/tariffs/orlenCosts';
import {
  assessEonHousehold,
  eonHouseholdSources,
  eonHouseholdBreaker,
  eonHouseholdRow,
  eonBusinessSource,
  eonBusinessBreaker,
  assessBusinessRegulated,
  eonRefresh,
} from '../src/tariffs/eonCosts';
import frozen from './fixtures/frozen-147.json';
import modified from './fixtures/modified-147.json';
import { frozen147Content } from './frozen-reference148';
import type { DistributionArea } from '../src/tariffs/model';

it('preserves every pre-existing source, allowing only the exact audited tariff integration and metadata addition', () => {
  for (const [path, sha] of Object.entries({ ...frozen, ...modified }))
    expect(createHash('sha256').update(frozen147Content(path)).digest('hex'), path).toBe(sha);
});
it('retains all four E.ON source PDFs with their exact SHA', () => {
  for (const { metadata } of [eonBusinessSource, ...Object.values(eonHouseholdSources)])
    expect(
      createHash('sha256')
        .update(readFileSync(`docs/sources/eon-2026/${metadata.sourceFile}`))
        .digest('hex'),
    ).toBe(metadata.sha256);
});
it('stores both actual source VAT variants, including source-rounded 194 rather than silently deriving 193.60', () => {
  expect(eonBusinessSource.handlingPerMwh).toEqual({ priceWithoutVat: 350, priceWithVat: 424 });
  expect(eonBusinessSource.supplierFixedMonthly).toEqual({
    priceWithoutVat: 160,
    priceWithVat: 194,
  });
  expect(eonBusinessSource.minimumUnitPricePerMwh).toEqual({
    priceWithoutVat: 0.25,
    priceWithVat: 0.3,
  });
  expect(eonHouseholdRow('ČEZ Distribuce', 'D02d', 3)).toEqual({
    priceWithoutVat: 160,
    priceWithVat: 193.6,
  });
  expect(eonHouseholdRow('ČEZ Distribuce', 'D02d', 11)).toEqual({
    priceWithoutVat: 409,
    priceWithVat: 495,
  });
});
it('retains SPOT metadata with no invented reference month or commodity price and recommends checking at 20 days', () => {
  expect(eonBusinessSource.metadata).toMatchObject({
    supplier: 'E.ON',
    effectiveFrom: '2024-07-01',
    regulatedValidFrom: '2026-01-01',
    pricingType: 'spot',
    referenceMonth: null,
    requiresIntervalData: true,
    refreshAfterDays: 20,
    lastVerifiedAt: '2026-10-27',
  });
  expect(escoSource.metadata).toMatchObject({
    referenceMonth: '2026-09',
    effectiveFrom: '2026-01-01',
  });
  expect(eonBusinessSource.commodityPricePerMwh).toBeNull();
  expect(eonRefresh(new Date('2026-11-15T23:59:59Z')).recommended).toBe(false);
  expect(eonRefresh(new Date('2026-11-16T00:00:00Z'))).toEqual({
    recommended: true,
    nextRecommendedCheckAt: '2026-11-16',
  });
  expect(eonRefresh(new Date('2027-01-01')).recommended).toBe(true);
  expect(eonBusinessSource.handlingPerMwh.priceWithoutVat).toBe(350);
});
describe.each([
  'C01d',
  'C02d',
  'C03d',
  'C25d',
  'C26d',
  'C27d',
  'C35d',
  'C45d',
  'C46d',
  'C56d',
  'C62d',
])('verified C coverage %s', (code) => {
  it('exposes E.ON regulated data and an ESCO scenario while E.ON commodity remains unavailable', () => {
    expect(eonBusinessSource.tariffCodes).toContain(code);
    expect(
      assessBusinessRegulated(code, 'ČEZ Distribuce', 40, 12000, {
        annualVT: 4000,
        annualNT: 8000,
      }),
    ).not.toBeNull();
    expect(
      assessEsco(code, 'ČEZ Distribuce', 40, 12000, { annualVT: 4000, annualNT: 8000 })!.complete,
    ).toBe(true);
    const html = renderToStaticMarkup(
      createElement(EonBusinessPrices, {
        context: comparisonContext('C', 'company', 'ČEZ Distribuce', 12000, 40, code, {
          annualVT: 4000,
          annualNT: 8000,
        }),
      }),
    );
    expect(html).toContain('Přesné porovnání vyžaduje průběhová SPOT data.');
    expect(html).not.toContain('aria-label="Roční cena E.ON"');
    expect(eonBusinessSource.commodityPricePerMwh).toBeNull();
  });
});
it('does not create measured C60d or tariffs/areas/breaker interpretations absent from the PDF', () => {
  expect(eonBusinessSource.tariffCodes).not.toContain('C60d');
  expect(assessBusinessRegulated('C60d', 'ČEZ Distribuce', 40, 12000, null)).toBeNull();
  expect(assessEsco('C60d', 'ČEZ Distribuce', 40, 12000, null)).toBeNull();
  expect(assessBusinessRegulated('C02d', 'EG.D', 40, 12000, null)).toBeNull();
  expect(assessBusinessRegulated('C02d', 'PREdistribuce', 40, 12000, null)).toBeNull();
  expect(assessBusinessRegulated('C25d', 'ČEZ Distribuce', 40, 12000, null)).toBeNull();
  expect(eonBusinessBreaker('C46d', 200)).toBeNull();
  expect(eonBusinessSource.unimported).toHaveLength(1);
  // The pre-existing verified internal source remains valid for the known ORLEN/ESCO combinations.
  expect(assessEsco('C02d', 'ČEZ Distribuce', 200, 12000, null)!.complete).toBe(true);
});
it('does not substitute neighboring tariffs for special C46d and C62d source values', () => {
  const c46 = assessBusinessRegulated('C46d', 'ČEZ Distribuce', 40, 12000, {
    annualVT: 4000,
    annualNT: 8000,
  })!;
  expect(c46.lines.find((l) => l.label === 'Distribuce VT')!.priceWithoutVat).toBeCloseTo(
    12499.4,
    8,
  );
  expect(c46.lines.find((l) => l.label === 'Platba podle jističe')!.priceWithoutVat).toBe(28416);
  expect(eonBusinessBreaker('C46d', 160)).toBe(22399);
  expect(eonBusinessBreaker('C62d', 40)).toBe(800);
  const c62 = assessBusinessRegulated('C62d', 'ČEZ Distribuce', 40, 12000, null)!;
  expect(c62.lines.find((l) => l.label === 'Distribuce VT')!.priceWithoutVat).toBeCloseTo(
    3568.92,
    8,
  );
  expect(c62.lines.some((l) => l.label === 'Distribuce NT')).toBe(false);
});
it('rejects invalid inputs and keeps ORLEN results exactly unchanged', () => {
  expect(() => assessEonHousehold('D25d', 'EG.D', 40, 3, -1, 12001)).toThrow();
  expect(() => assessEonHousehold('D02d', 'EG.D', 40, 3, 4000, 8000)).toThrow();
  expect(() =>
    assessBusinessRegulated('C25d', 'ČEZ Distribuce', 40, 12000, { annualVT: 1, annualNT: 2 }),
  ).toThrow();
  expect(assessEonHousehold('D99d', 'EG.D', 40, 3, 12000, 0)).toBeNull();
  expect(assessOrlen('C02d', 'ČEZ Distribuce', 40, 12000, null).priceWithVat).toBeCloseTo(
    81959.592,
    8,
  );
});
const areas: [DistributionArea, number, number, number, number, number, number][] = [
  ['ČEZ Distribuce', 2078.58, 409, 2252.45, 116.5, 754.77, 3093],
  ['EG.D', 2295.34, 400, 2243.88, 224.3, 749.87, 2631],
  ['PREdistribuce', 1516.53, 347, 1656.49, 175.2, 421.52, 2494],
];
describe.each(areas)(
  'E.ON household %s',
  (area, dist02, breaker02, dist25, distNT, dist57, breaker57) => {
    it.each(['D02d', 'D25d', 'D57d'])(
      'computes %s from separate source values and compares identical inputs',
      (code) => {
        const single = code === 'D02d';
        const vt = single ? 12000 : 4000;
        const nt = single ? 0 : 8000;
        const amps = code === 'D57d' ? 80 : 40;
        const energyVT = single ? 2899 : code === 'D25d' ? 3029 : 3045;
        const energyNT = code === 'D25d' ? 2726 : 2884;
        const distribution = single ? dist02 : code === 'D25d' ? dist25 : dist57;
        const breaker = single
          ? breaker02
          : code === 'D57d'
            ? breaker57
            : { 'ČEZ Distribuce': 430, 'EG.D': 392, PREdistribuce: 320 }[area];
        const expected =
          (vt / 1000) * (energyVT + distribution + 28.3 + 164.24) +
          (nt / 1000) * (energyNT + distNT + 28.3 + 164.24) +
          12 * (160 + breaker + 12.87);
        const result = assessEonHousehold(code, area, amps, 3, vt, nt)!;
        expect(result.priceWithoutVat).toBeCloseTo(expected, 8);
        expect(result.priceWithVat).toBeCloseTo(expected * 1.21, 8);
        expect(result.breakerMonthly).toBe(breaker);
        expect(result.commercial).toBe((vt / 1000) * energyVT + (nt / 1000) * energyNT + 1920);
        expect(result.lines.find((l) => l.label === 'POZE')!.priceWithoutVat).toBe(0);
        expect(result.pozeByConsumption).toBeNull();
        const cez = assessHousehold(code, area, amps, 3, vt, nt)!;
        expect(cez.priceWithVat - result.priceWithVat).toBeCloseTo(
          single ? 3863.4816 : code === 'D25d' ? 3825.6812 : 5498.7724,
          6,
        );
      },
    );
    it('retains all D tariffs, fuse bands and 1f formulas without importing a missing POZE rate', () => {
      expect(eonHouseholdSources[area].tariffCodes).toEqual([
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
      ]);
      expect(eonHouseholdSources[area].common.pozePerMwh).toBeNull();
      expect(eonHouseholdBreaker(area, 'D02d', 80, 3)).toBe(
        80 * eonHouseholdRow(area, 'D02d', 18)!.priceWithoutVat,
      );
      expect(eonHouseholdBreaker(area, 'D57d', 200, 3)).toBe(
        200 * eonHouseholdRow(area, 'D57d', 18)!.priceWithoutVat,
      );
      expect(eonHouseholdBreaker(area, 'D25d', 25, 1)).toBe(
        eonHouseholdRow(area, 'D25d', 6)!.priceWithoutVat,
      );
      expect(eonHouseholdBreaker(area, 'D25d', 32, 1)).toBe(
        32 * eonHouseholdRow(area, 'D25d', 19)!.priceWithoutVat,
      );
      for (const code of eonHouseholdSources[area].tariffCodes)
        for (const amps of [10, 16, 20, 25, 32, 40, 50, 63, 80, 100, 125, 160])
          expect(eonHouseholdBreaker(area, code, amps, 3)).not.toBeNull();
    });
    it('renders both household suppliers without ORLEN and names the cheaper offer', () => {
      const html = renderToStaticMarkup(
        createElement(CezPrices, { context: comparisonContext('D', 'flat', area, 12000, 40) }),
      );
      expect(html).toContain('ČEZ');
      expect(html).toContain('E.ON – domácnosti');
      expect(html).not.toMatch(/orlen/i);
      expect(html).toContain('Levnější nabídka: E.ON.');
      expect(html).toContain('3 863,48 Kč/rok');
      expect(html).toContain('Cena není potvrzením nároku na distribuční sazbu.');
    });
  },
);
it('does not compare partial household inputs or treat a sub-cent difference as a cheaper offer', () => {
  const props = {
    code: 'D02d',
    area: 'ČEZ Distribuce' as const,
    amps: 40,
    phases: 3 as const,
    vt: 12000,
    nt: 0,
    cezResult: assessHousehold('D02d', 'ČEZ Distribuce', 40, 3, 12000, 0),
  };
  const invalid = renderToStaticMarkup(
    createElement(EonHouseholdComparison, { ...props, amps: NaN, cezResult: null }),
  );
  expect(invalid).not.toContain('Levnější nabídka:');
  expect(invalid).not.toContain('aria-label="Roční cena E.ON"');
  const eon = assessEonHousehold('D02d', 'ČEZ Distribuce', 40, 3, 12000, 0)!;
  const same = renderToStaticMarkup(
    createElement(EonHouseholdComparison, {
      ...props,
      cezResult: { ...props.cezResult!, priceWithVat: eon.priceWithVat },
    }),
  );
  expect(same).toContain('Nabídky mají shodnou roční cenu.');
});
