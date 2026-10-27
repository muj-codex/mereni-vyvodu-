import { describe, it, expect } from 'vitest';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { createElement } from 'react';
import { CezPrices } from '../src/tariffs/CezPrices';
import { comparisonContext } from '../src/tariffs/calculations';
import { assessOrlen } from '../src/tariffs/orlenCosts';
import {
  assessEsco,
  assessHousehold,
  escoSource,
  householdSources,
  householdRow,
  householdBreaker,
  latestSpotMonth,
  spotPrice,
  spotRefresh,
} from '../src/tariffs/cezCosts';
import baseline from './fixtures/frozen-146.json';
import type { DistributionArea } from '../src/tariffs/model';

describe('1.4.7 exact source data and isolation', () => {
  it('preserves every existing source file except the explicitly audited tariff integration', () => {
    for (const [path, sha] of Object.entries(baseline))
      expect(createHash('sha256').update(readFileSync(path)).digest('hex'), path).toBe(sha);
  });
  it('retains the four actual source PDFs with exact hashes', () => {
    for (const { metadata: m } of [escoSource, ...Object.values(householdSources)])
      expect(
        createHash('sha256')
          .update(readFileSync(`docs/sources/cez-2026/${m.sourceFile}`))
          .digest('hex'),
      ).toBe(m.sha256);
  });
  it.each(['C01d', 'C02d', 'C03d', 'C25d', 'C26d', 'C27d', 'C35d', 'C45d', 'C46d', 'C56d', 'C62d'])(
    'covers only verified SPOT tariff %s',
    (code) => {
      expect(spotPrice(code)).not.toBeNull();
    },
  );
  it('does not invent C60d and uses September with surcharge already included', () => {
    expect(spotPrice('C60d')).toBeNull();
    expect(assessEsco('C60d', 'ČEZ Distribuce', 40, 12000, null)).toBeNull();
    expect(latestSpotMonth()).toBe('2026-09');
    expect([spotPrice('C02d'), spotPrice('C25d'), spotPrice('C45d'), spotPrice('C62d')]).toEqual([
      3850, 3845, 3863, 4459,
    ]);
    expect(escoSource.supplierFixedMonthlyWithoutVat).toBe(95);
    expect(escoSource.includedSurchargeWithoutVatPerMwh).toBe(285);
    expect(escoSource.metadata).toMatchObject({
      pricingType: 'spot',
      referenceMonth: '2026-09',
      coverage: 'nationwide',
      validFrom: '2026-01-01',
      distributionArea: 'Republiková / všechna distribuční území',
      refreshAfterDays: 20,
    });
  });
  it('keeps last valid prices after exactly 20 days and recommends review', () => {
    expect(spotRefresh(new Date('2026-11-15T23:59:59Z')).recommended).toBe(false);
    expect(spotRefresh(new Date('2026-11-16T00:00:00Z'))).toEqual({
      recommended: true,
      nextRecommendedCheckAt: '2026-11-16',
    });
    expect(spotRefresh(new Date('2027-01-01')).recommended).toBe(true);
    expect(spotPrice('C02d')).toBe(3850);
  });
  it('computes complete SPOT control from verified C distribution without changing ORLEN', () => {
    const r = assessEsco('C02d', 'ČEZ Distribuce', 40, 12000, null)!;
    expect(r.complete).toBe(true);
    expect(r.commercial).toBe(47340);
    expect(r.priceWithoutVat).toBeCloseTo(83887.2, 8);
    expect(r.priceWithVat).toBeCloseTo(101503.512, 8);
    expect(assessOrlen('C02d', 'ČEZ Distribuce', 40, 12000, null).priceWithVat).toBeCloseTo(
      81959.592,
      8,
    );
  });
  it('uses the same SPOT price in VT and NT and never fills missing distribution', () => {
    const r = assessEsco('C25d', 'ČEZ Distribuce', 40, 12000, { annualVT: 4000, annualNT: 8000 })!;
    expect(r.complete).toBe(true);
    expect(r.commercial).toBe(47280);
    for (const [code, area, split] of [
      ['C02d', 'EG.D', null],
      ['C02d', 'PREdistribuce', null],
      ['C26d', 'ČEZ Distribuce', { annualVT: 4000, annualNT: 8000 }],
      ['C62d', 'ČEZ Distribuce', null],
      ['C25d', 'ČEZ Distribuce', null],
    ] as const) {
      const partial = assessEsco(code, area, 40, 12000, split)!;
      expect(partial.complete).toBe(false);
      expect(partial.priceWithVat).toBeNull();
      expect(partial.lines).toHaveLength(2);
    }
  });
  it('refuses malformed inputs rather than showing a guessed total', () => {
    expect(() =>
      assessEsco('C25d', 'ČEZ Distribuce', 40, 12000, { annualVT: 1, annualNT: 2 }),
    ).toThrow();
    expect(() => assessHousehold('D25d', 'EG.D', 40, 3, -1, 12001)).toThrow();
    expect(() => assessHousehold('D02d', 'EG.D', 40, 3, 4000, 8000)).toThrow();
    expect(() => assessHousehold('D25d', 'EG.D', NaN, 3, 4000, 8000)).toThrow();
    expect(assessHousehold('D99d', 'EG.D', 40, 3, 12000, 0)).toBeNull();
  });
});
const cases: [DistributionArea, number, number, number, number, number, number, number][] = [
  ['ČEZ Distribuce', 2078.58, 409, 2252.45, 116.5, 677, 3093, 122.49],
  ['EG.D', 2295.34, 400, 2243.88, 224.3, 618, 2631, 111.81],
  ['PREdistribuce', 1516.53, 347, 1656.49, 175.2, 505, 2494, 129.87],
];
describe.each(cases)(
  'household %s independent PDF checks',
  (area, distribution02, breaker02, distribution25, nt25, breaker25, high57, above160) => {
    it('computes D02d with exact net prices and a single VAT addition', () => {
      const r = assessHousehold('D02d', area, 40, 3, 12000, 0)!;
      const expected =
        12 * (3190.08 + distribution02 + 28.3 + 164.24) + 12 * (135 + breaker02 + 12.87);
      expect(r.breakerMonthly).toBe(breaker02);
      expect(r.priceWithoutVat).toBeCloseTo(expected, 8);
      expect(r.priceWithVat).toBeCloseTo(expected * 1.21, 8);
      expect(r.pozeByBreaker).toBe(0);
      expect(r.pozeByConsumption).toBe(5940);
      expect(r.lines.find((l) => l.label === 'POZE')!.priceWithoutVat).toBe(0);
    });
    it('computes D25d at 63A from separate VT and NT without averaging', () => {
      const r = assessHousehold('D25d', area, 63, 3, 4000, 8000)!;
      const expected =
        4 * (3272.73 + distribution25 + 28.3 + 164.24) +
        8 * (3057.85 + nt25 + 28.3 + 164.24) +
        12 * (121 + breaker25 + 12.87);
      expect(r.breakerMonthly).toBe(breaker25);
      expect(r.priceWithoutVat).toBeCloseTo(expected, 8);
      expect(r.priceWithVat).toBeCloseTo(expected * 1.21, 8);
      expect(householdRow(area, 'D25d', 4)).toBe(distribution25);
      expect(householdRow(area, 'D25d', 5)).toBe(nt25);
    });
    it('preserves D57d high bands, per-A formulas and single-phase band', () => {
      expect(householdBreaker(area, 'D57d', 80, 3)).toBe(high57);
      expect(householdBreaker(area, 'D57d', 200, 3)).toBe(200 * above160);
      expect(householdBreaker(area, 'D02d', 80, 3)).toBe(80 * householdRow(area, 'D02d', 19)!);
      expect(householdBreaker(area, 'D25d', 25, 1)).toBe(householdRow(area, 'D25d', 6));
      expect(householdBreaker(area, 'D25d', 32, 1)).toBe(32 * householdRow(area, 'D25d', 20)!);
      expect(householdBreaker(area, 'D02d', 25.1, 3)).toBe(householdRow(area, 'D02d', 10));
    });
    it('covers all 10 tariffs and reconciles source total rows with imported components', () => {
      expect(householdSources[area].tariffCodes).toHaveLength(10);
      for (const code of householdSources[area].tariffCodes) {
        expect(
          assessHousehold(code, area, 25, 3, 1000, householdRow(area, code, 2) === null ? 0 : 2000),
        ).not.toBeNull();
        expect(householdRow(area, code, 26)!).toBeCloseTo(
          householdRow(area, code, 1)! + householdRow(area, code, 4)! + 28.3 + 164.24,
          1,
        );
        if (householdRow(area, code, 2) !== null)
          expect(householdRow(area, code, 27)!).toBeCloseTo(
            householdRow(area, code, 2)! + householdRow(area, code, 5)! + 28.3 + 164.24,
            1,
          );
        for (const amps of [10, 16, 20, 25, 32, 40, 50, 63, 80, 100, 125, 160, 200])
          expect(householdBreaker(area, code, amps, 3)).not.toBeNull();
      }
    });
    it('renders only household ČEZ with its exact area and no ORLEN or SPOT', () => {
      const html = renderToStaticMarkup(
        createElement(CezPrices, { context: comparisonContext('D', 'flat', area, 12000, 40) }),
      );
      expect(html).toContain('Domácnosti / sazby D – ČEZ');
      expect(html).toContain(area);
      expect(html).not.toMatch(/(?<!\p{L})(?:ORLEN|ESCO|SPOT)(?!\p{L})/iu);
    });
  },
);
