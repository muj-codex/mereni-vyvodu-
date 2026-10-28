import { it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { renderToStaticMarkup } from 'react-dom/server';
import { createElement } from 'react';
import {
  assessInnogy,
  innogyTariff,
  innogyBreaker,
  innogySources,
} from '../src/tariffs/innogyCosts';
import { compareBusinessOffers } from '../src/tariffs/businessOffers';
import { comparisonContext } from '../src/tariffs/calculations';
import { InnogyHouseholdComparison } from '../src/tariffs/InnogyHouseholdComparison';
import { assessHousehold } from '../src/tariffs/cezCosts';
import frozen from './fixtures/frozen-1410.json';
import { frozen1410Content } from './frozen-reference1411';
it('preserves all prior source files with only the exact supplier integration patches', () => {
  for (const [p, sha] of Object.entries(frozen))
    expect(createHash('sha256').update(frozen1410Content(p)).digest('hex'), p).toBe(sha);
});
it('retains both original PDFs and exact source metadata', () => {
  for (const c of ['C', 'D'] as const) {
    const m = innogySources[c].metadata;
    expect(
      createHash('sha256')
        .update(readFileSync(`docs/sources/innogy-2026/${m.sourceFile}`))
        .digest('hex'),
    ).toBe(m.sha256);
    expect(m).toMatchObject({
      supplier: 'innogy',
      productName: 'elektřina Benefit 24',
      pricingType: 'fixed',
      fixationMonths: 24,
      validFrom: '2026-04-01',
      distributionArea: 'CEZ_DISTRIBUCE',
    });
  }
});
const examples = [
  ['C', 'C01d', 3240, null, 3124.85, 263],
  ['C', 'C02d', 3240, null, 2263.19, 577],
  ['C', 'C03d', 3240, null, 993.15, 3277],
  ['C', 'C25d', 3240, 3240, 2208.39, 844],
  ['C', 'C26d', 3240, 3240, 1302.61, 2028],
  ['C', 'C27d', 3140, 3140, 2208.39, 802],
  ['C', 'C35d', 3240, 3240, 635.38, 2344],
  ['C', 'C45d', 3240, 3240, 635.38, 2344],
  ['C', 'C46d', 3240, 3240, 3124.85, 2368],
  ['C', 'C56d', 3140, 3140, 635.38, 2344],
  ['C', 'C62d', 3240, null, 297.41, 800],
  ['D', 'D01d', 3240, null, 2666.66, 198],
  ['D', 'D02d', 3240, null, 2078.58, 409],
  ['D', 'D25d', 3240, 3240, 2252.45, 430],
  ['D', 'D26d', 3240, 3240, 1202.06, 578],
  ['D', 'D27d', 3140, 3140, 2252.45, 408],
  ['D', 'D35d', 3240, 3240, 754.77, 888],
  ['D', 'D45d', 3240, 3240, 754.77, 888],
  ['D', 'D56d', 3140, 3140, 754.77, 888],
  ['D', 'D57d', 3140, 3140, 754.77, 896],
  ['D', 'D61d', 3240, 3240, 3306.67, 358],
] as const;
it.each(examples)(
  '%s %s has exact commodity, regulation and once-only VAT',
  (c, code, vt, nt, dist, breaker) => {
    const t = innogyTariff(c, code)!;
    expect(t.commodityVT).toBe(vt);
    expect(t.commodityNT).toBe(nt);
    expect(t.fixedMonthly).toBe(127);
    const r = assessInnogy(
      c,
      code,
      'ČEZ Distribuce',
      40,
      12000,
      nt === null ? null : { annualVT: 4000, annualNT: 8000 },
    );
    const commercial = 12 * vt + 12 * 127;
    const regulated =
      (nt === null ? 12 : 4) * dist +
      (nt === null ? 0 : 8 * 116.5) +
      12 * breaker +
      12 * (164.24 + 28.3) +
      12 * (2.99 + 5.88 + 4);
    expect(r.complete).toBe(true);
    expect(r.breakerMonthly).toBe(breaker);
    expect(r.commercial).toBe(commercial);
    expect(r.regulated).toBeCloseTo(regulated, 8);
    expect(r.priceWithoutVat).toBeCloseTo(commercial + regulated, 8);
    expect(r.priceWithVat).toBeCloseTo((commercial + regulated) * 1.21, 8);
    expect(r.pozeA).toBe(0);
    expect(r.pozeB).toBe(5940);
    expect(r.lines.find((l) => l.label.startsWith('POZE'))!.priceWithoutVat).toBe(0);
  },
);
it('keeps the category-specific 1f and over-limit breaker tables', () => {
  expect(innogyBreaker('C', 'C02d', 25, 1)).toBe(144);
  expect(innogyBreaker('C', 'C02d', 32, 1)).toBe(4.81 * 32);
  expect(innogyBreaker('C', 'C02d', 200)).toBe(14.43 * 200);
  expect(innogyBreaker('D', 'D02d', 25, 1)).toBe(102);
  expect(innogyBreaker('D', 'D02d', 32, 1)).toBe(3.41 * 32);
  expect(innogyBreaker('D', 'D02d', 80)).toBe(10.23 * 80);
  expect(innogyBreaker('D', 'D57d', 80)).toBe(3093);
  expect(innogyBreaker('D', 'D57d', 160)).toBe(19598);
  expect(innogyBreaker('D', 'D57d', 200)).toBe(122.49 * 200);
  expect(innogyBreaker('D', 'D57d', 32, 1)).toBe(40.83 * 32);
});
it('warns only businesses above 30 MWh without removing the priced offer', () => {
  expect(assessInnogy('C', 'C02d', 'ČEZ Distribuce', 40, 30000, null).warning).toBeNull();
  expect(assessInnogy('C', 'C02d', 'ČEZ Distribuce', 40, 30000.01, null).warning).toContain(
    'Spotřeba nad 30 MWh',
  );
  const ranked = compareBusinessOffers(
    'C02d',
    comparisonContext('C', 'company', 'ČEZ Distribuce', 30001, 40, 'C02d'),
  );
  expect(ranked.offers.find((o) => o.name === 'innogy')!.pricing).toContain('orientační');
  expect(assessInnogy('D', 'D02d', 'ČEZ Distribuce', 40, 40000, null).warning).toBeNull();
});
it('never invents other areas, C55d, missing splits, or invalid consumption', () => {
  for (const c of ['C', 'D'] as const)
    for (const area of ['EG.D', 'PREdistribuce'] as const) {
      const r = assessInnogy(c, c === 'C' ? 'C02d' : 'D02d', area, 40, 12000, null);
      expect(r.priceWithVat).toBeNull();
      expect(r.missing.join()).toContain('distribuční oblast');
    }
  expect(innogyTariff('C', 'C55d')).toBeNull();
  expect(assessInnogy('C', 'C25d', 'ČEZ Distribuce', 40, 12000, null).complete).toBe(false);
  expect(() =>
    assessInnogy('C', 'C25d', 'ČEZ Distribuce', 40, 12000, { annualVT: 1, annualNT: 2 }),
  ).toThrow();
  expect(() => assessInnogy('C', 'C02d', 'ČEZ Distribuce', 40, -1, null)).toThrow();
});
it('sorts all four business offers by the same full gross annual cost', () => {
  const r = compareBusinessOffers(
    'C02d',
    comparisonContext('C', 'company', 'ČEZ Distribuce', 12000, 40, 'C02d'),
  );
  expect(r.offers.map((o) => o.name)).toEqual(['ORLEN', 'ČEZ ESCO', 'E.ON Variant', 'innogy', 'PRE']);
  expect(r.offers.find((o) => o.name === 'innogy')!.value).toBeCloseTo(93110.952, 7);
});
it('adds innogy to shared household ranking without ORLEN or business limit warning', () => {
  const cez = assessHousehold('D02d', 'ČEZ Distribuce', 40, 3, 40000, 0);
  const html = renderToStaticMarkup(
    createElement(InnogyHouseholdComparison, {
      code: 'D02d',
      area: 'ČEZ Distribuce',
      amps: 40,
      phases: 3,
      vt: 40000,
      nt: 0,
      cezResult: cez,
    }),
  );
  expect(html).toContain('Pořadí domácích nabídek');
  expect(html).toContain('innogy');
  expect(html).not.toMatch(/ORLEN|Spotřeba nad 30 MWh/);
});
