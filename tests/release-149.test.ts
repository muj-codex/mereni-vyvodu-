import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import frozen from './fixtures/frozen-148.json';
import { frozen148Content } from './frozen-reference149';
import {
  variantRow,
  variantBreaker,
  eonVariantSource,
  assessEonVariant,
  assessVariantRegulated,
} from '../src/tariffs/eonVariantCosts';
import { compareBusinessOffers } from '../src/tariffs/businessOffers';
import { comparisonContext } from '../src/tariffs/calculations';
import { EonVariantPrices } from '../src/tariffs/EonVariantPrices';
import { assessEsco } from '../src/tariffs/cezCosts';
it('protects every original source file, allowing only the three exact audited tariff integrations', () => {
  for (const [path, sha] of Object.entries(frozen))
    expect(createHash('sha256').update(frozen148Content(path)).digest('hex'), path).toBe(sha);
});
it('preserves the actual fixed PDF and exact product/VAT metadata', () => {
  const m = eonVariantSource.metadata;
  expect(
    createHash('sha256')
      .update(readFileSync(`docs/sources/eon-2026/${m.sourceFile}`))
      .digest('hex'),
  ).toBe(m.sha256);
  expect(m).toMatchObject({
    supplier: 'E.ON',
    productName: 'Variant na 2 roky 10/26 Profi',
    validFrom: '2026-10-01',
    regulatedValidFrom: '2026-01-01',
    pricingType: 'fixed',
    lastVerifiedAt: '2026-10-27',
    distributionArea: 'ČEZ Distribuce',
  });
  expect(m).not.toHaveProperty('refreshAfterDays');
  expect(variantRow('C02d', 3)).toEqual({ priceWithoutVat: 139, priceWithVat: 168.19 });
  expect(eonVariantSource.unimported).toEqual([]);
});
it.each([
  ['C01d', 2999, null],
  ['C02d', 2999, null],
  ['C03d', 2999, null],
  ['C25d', 3124, 2826],
  ['C26d', 3124, 2826],
  ['C27d', 3124, 2826],
  ['C35d', 3135, 2930],
  ['C45d', 3133, 2984],
  ['C46d', 3133, 2984],
  ['C56d', 3133, 2984],
  ['C62d', 3009, null],
] as const)('uses source-specific fixed energy prices for %s', (code, vt, nt) => {
  expect(variantRow(code, 1)!.priceWithoutVat).toBe(vt);
  expect(variantRow(code, 2)?.priceWithoutVat ?? null).toBe(nt);
  expect(variantRow(code, 3)!.priceWithoutVat).toBe(139);
  expect(
    assessEonVariant(
      code,
      'ČEZ Distribuce',
      40,
      12000,
      nt === null ? null : { annualVT: 4000, annualNT: 8000 },
    ).complete,
  ).toBe(true);
});
describe.each([
  ['C02d', 12000, 0, 2999, 0, 2263.19, 577, 74203.2],
  ['C25d', 4000, 8000, 3124, 2826, 2208.39, 844, 59130.48],
  ['C45d', 4000, 8000, 3133, 2984, 635.38, 2344, 72138.44],
  ['C62d', 12000, 0, 3009, 0, 297.41, 800, 53409.84],
] as const)(
  'full fixed annual cost %s',
  (code, vt, nt, energyVT, energyNT, distributionVT, breaker, expected) => {
    it('uses the exact source energy, fuse, regulated fees and one VAT addition', () => {
      const r = assessEonVariant(
        code,
        'ČEZ Distribuce',
        40,
        12000,
        nt ? { annualVT: vt, annualNT: nt } : null,
      );
      const commodity = (vt / 1000) * energyVT + (nt / 1000) * energyNT + 1668;
      const regulated =
        (vt / 1000) * distributionVT +
        (nt / 1000) * 116.5 +
        12 * breaker +
        12 * (28.3 + 164.24) +
        154.44;
      expect(r.complete).toBe(true);
      expect(r.commercial!.priceWithoutVat).toBeCloseTo(commodity, 8);
      expect(r.regulated!.priceWithoutVat).toBeCloseTo(regulated, 8);
      expect(r.regulated!.breakerMonthly).toBe(breaker);
      expect(r.priceWithoutVat).toBeCloseTo(expected, 8);
      expect(r.priceWithVat).toBeCloseTo(expected * 1.21, 8);
      expect(r.lines.find((l) => l.label === 'POZE')!.priceWithoutVat).toBe(0);
    });
    it('ranks only comparable complete offers and computes differences against fixed E.ON', () => {
      const context = comparisonContext(
        'C',
        'company',
        'ČEZ Distribuce',
        12000,
        40,
        code,
        nt ? { annualVT: vt, annualNT: nt } : null,
      );
      const result = compareBusinessOffers(code, context);
      expect(result.offers.map((o) => o.name)).toEqual(
        code === 'C62d' ? ['ČEZ ESCO', 'E.ON Variant'] : ['ORLEN', 'ČEZ ESCO', 'E.ON Variant'],
      );
      expect(result.offers.find((o) => o.name === 'E.ON Variant')!.value).toBeCloseTo(
        expected * 1.21,
        8,
      );
      expect(result.offers.every((o, i) => i === 0 || o.value >= result.offers[i - 1].value)).toBe(
        true,
      );
      const html = renderToStaticMarkup(createElement(EonVariantPrices, { context }));
      expect(html).toContain('Fixace 2 roky');
      expect(html).toContain('Pořadí dostupných úplných nabídek');
      expect(html).toContain('Elektřina 24 · Fixace 24 měsíců');
      expect(html).not.toContain('OTE + 350');
      expect(html).not.toContain('Přesné porovnání vyžaduje průběhová SPOT data.');
    });
  },
);
it('uses the explicit above-160A and single-phase formulas, including special C46d', () => {
  expect(variantBreaker('C02d', 160)).toBe(2309);
  expect(variantBreaker('C02d', 200)).toBe(2886);
  expect(variantBreaker('C46d', 200)).toBe(27998);
  expect(variantBreaker('C25d', 25, 1)).toBe(211);
  expect(variantBreaker('C25d', 32, 1)).toBe(224.96);
  expect(variantBreaker('C02d', 25.1)).toBe(462);
  expect(
    assessVariantRegulated('C46d', 'ČEZ Distribuce', 200, 12000, {
      annualVT: 4000,
      annualNT: 8000,
    }),
  ).not.toBeNull();
  expect(
    assessEsco('C46d', 'ČEZ Distribuce', 200, 12000, { annualVT: 4000, annualNT: 8000 })!.complete,
  ).toBe(true);
});
it('never invents missing tariffs, areas or a VT/NT split, and excludes incomplete offers from ranking', () => {
  expect(variantRow('C60d', 1)).toBeNull();
  expect(assessEonVariant('C60d', 'ČEZ Distribuce', 40, 12000, null).supported).toBe(false);
  for (const area of ['EG.D', 'PREdistribuce'] as const) {
    const r = assessEonVariant('C02d', area, 40, 12000, null);
    expect(r.complete).toBe(false);
    expect(r.priceWithVat).toBeNull();
    expect(r.commercial).not.toBeNull();
    expect(
      compareBusinessOffers('C02d', comparisonContext('C', 'flat', area, 12000, 40)).offers,
    ).toEqual([]);
  }
  expect(assessEonVariant('C25d', 'ČEZ Distribuce', 40, 12000, null).priceWithVat).toBeNull();
  expect(
    compareBusinessOffers('C25d', comparisonContext('C', 'flat', 'ČEZ Distribuce', 12000, 40))
      .offers,
  ).toEqual([]);
  expect(eonVariantSource.common.pozePerMwh).toBeNull();
  expect(() =>
    assessEonVariant('C25d', 'ČEZ Distribuce', 40, 12000, { annualVT: 1, annualNT: 2 }),
  ).toThrow();
  expect(() => assessEonVariant('C02d', 'ČEZ Distribuce', NaN, 12000, null)).toThrow();
});
it('does not expose a fixed business card or business ranking for households', () => {
  const context = comparisonContext('D', 'flat', 'ČEZ Distribuce', 12000, 40);
  expect(renderToStaticMarkup(createElement(EonVariantPrices, { context }))).toBe('');
  expect(compareBusinessOffers('C02d', context)).toEqual({ offers: [], missing: [] });
});
