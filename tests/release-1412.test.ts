import { it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { assessPre, preTariff, preBreaker, preSources } from '../src/tariffs/preCosts';
import { compareBusinessOffers } from '../src/tariffs/businessOffers';
import { comparisonContext } from '../src/tariffs/calculations';
import { InnogyHouseholdComparison } from '../src/tariffs/InnogyHouseholdComparison';
import { assessHousehold } from '../src/tariffs/cezCosts';
import frozen from './fixtures/frozen-1411.json';
import { frozen1411Content } from './frozen-reference1412';
it('preserves all prior sources except the exact audited PRE integrations', () => {
  for (const [p, sha] of Object.entries(frozen))
    expect(createHash('sha256').update(frozen1411Content(p)).digest('hex'), p).toBe(sha);
});
it('keeps both original PDFs, exact VAT variants and source metadata', () => {
  for (const customer of ['C', 'D'] as const) {
    const m = preSources[customer].metadata;
    expect(
      createHash('sha256')
        .update(readFileSync(`docs/sources/pre-2026/${m.sourceFile}`))
        .digest('hex'),
    ).toBe(m.sha256);
    expect(m).toMatchObject({
      supplier: 'PRE',
      productName: 'PRE PROUD FAVORIT 2 10/2026',
      pricingType: 'fixed',
      validFrom: '2026-10-01',
      priceGuaranteeUntil: '2028-09-30',
      distributionArea: 'CEZ_DISTRIBUCE',
    });
  }
  expect(preTariff('C', 'C02d')!.commodityVT).toEqual({
    priceWithoutVat: 3640,
    priceWithVat: 4404.4,
  });
  expect(preTariff('D', 'D02d')!.commodityVT).toEqual({
    priceWithoutVat: 3290,
    priceWithVat: 3980.9,
  });
});
const cases = [
  ['C', 'C01d', 3640, null, 3124.85, 263],
  ['C', 'C02d', 3640, null, 2263.19, 577],
  ['C', 'C03d', 3640, null, 993.15, 3277],
  ['C', 'C25d', 3540, 3340, 2208.39, 844],
  ['C', 'C26d', 3540, 3340, 1302.61, 2028],
  ['C', 'C27d', 3540, 3340, 2208.39, 802],
  ['C', 'C35d', 3640, 3440, 635.38, 2344],
  ['C', 'C45d', 3840, 3540, 635.38, 2344],
  ['C', 'C46d', 3840, 3540, 3124.85, 2368],
  ['C', 'C56d', 3840, 3540, 635.38, 2344],
  ['C', 'C62d', 3540, null, 297.41, 800],
  ['D', 'D01d', 3290, null, 2666.66, 198],
  ['D', 'D02d', 3290, null, 2078.58, 409],
  ['D', 'D25d', 3190, 2990, 2252.45, 430],
  ['D', 'D26d', 3190, 2990, 1202.06, 578],
  ['D', 'D27d', 3190, 2990, 2252.45, 408],
  ['D', 'D35d', 3290, 3090, 754.77, 888],
  ['D', 'D45d', 3490, 3190, 754.77, 888],
  ['D', 'D56d', 3490, 3190, 754.77, 888],
  ['D', 'D57d', 3490, 3190, 754.77, 896],
  ['D', 'D61d', 3190, 2990, 3306.67, 358],
] as const;
it.each(cases)(
  '%s %s: source commodity, own regulation, POZE, tax and VAT once',
  (customer, code, vt, nt, dist, breaker) => {
    const t = preTariff(customer, code)!;
    expect(t.commodityVT.priceWithoutVat).toBe(vt);
    expect(t.commodityNT?.priceWithoutVat ?? null).toBe(nt);
    expect(t.fixedMonthly).toEqual({ priceWithoutVat: 129, priceWithVat: 156.09 });
    const r = assessPre(
      customer,
      code,
      'ČEZ Distribuce',
      40,
      12000,
      nt === null ? null : { annualVT: 4000, annualNT: 8000 },
    );
    const commercial = (nt === null ? 12 * vt : 4 * vt + 8 * nt) + 12 * 129;
    const regulated =
      (nt === null ? 12 : 4) * dist +
      (nt === null ? 0 : 8 * 116.5) +
      12 * breaker +
      12 * (164.24 + 28.3) +
      12 * 12.87;
    expect(r.complete).toBe(true);
    expect(r.breakerMonthly).toBe(breaker);
    expect(r.commercial).toBe(commercial);
    expect(r.regulated).toBeCloseTo(regulated, 8);
    expect(r.priceWithoutVat).toBeCloseTo(commercial + regulated, 8);
    expect(r.priceWithVat).toBeCloseTo((commercial + regulated) * 1.21, 8);
    expect(r.pozeA).toBe(0);
    expect(r.pozeB).toBe(5940);
  },
);
it('uses the distinct domestic and business 1f and large breaker rules', () => {
  expect(preBreaker('C', 'C02d', 25, 1)).toBe(144);
  expect(preBreaker('C', 'C02d', 32, 1)).toBe(4.81 * 32);
  expect(preBreaker('C', 'C02d', 200)).toBe(14.43 * 200);
  expect(preBreaker('D', 'D02d', 25, 1)).toBe(102);
  expect(preBreaker('D', 'D02d', 32, 1)).toBe(3.41 * 32);
  expect(preBreaker('D', 'D02d', 80)).toBe(10.23 * 80);
  expect(preBreaker('D', 'D57d', 80)).toBe(3093);
  expect(preBreaker('D', 'D57d', 160)).toBe(19598);
  expect(preBreaker('D', 'D57d', 200)).toBe(122.49 * 200);
  expect(preBreaker('D', 'D57d', 32, 1)).toBe(40.83 * 32);
});
it('keeps unverified areas, C55d and missing splits unpriced; rejects inconsistent inputs', () => {
  for (const c of ['C', 'D'] as const)
    for (const area of ['EG.D', 'PREdistribuce'] as const) {
      const r = assessPre(c, c === 'C' ? 'C02d' : 'D02d', area, 40, 12000, null);
      expect(r.priceWithVat).toBeNull();
      expect(r.missing.join()).toContain(
        'Pro tuto distribuční oblast zatím nemáme ověřený ceník PRE PROUD FAVORIT 2.',
      );
    }
  expect(preTariff('C', 'C55d')).toBeNull();
  expect(assessPre('C', 'C25d', 'ČEZ Distribuce', 40, 12000, null).complete).toBe(false);
  expect(() =>
    assessPre('C', 'C25d', 'ČEZ Distribuce', 40, 12000, { annualVT: 1, annualNT: 2 }),
  ).toThrow();
  expect(() => assessPre('C', 'C02d', 'ČEZ Distribuce', 40, -1, null)).toThrow();
});
it('includes all five complete business offers with the same inputs, sorted by gross annual cost', () => {
  const result = compareBusinessOffers(
    'C02d',
    comparisonContext('C', 'company', 'ČEZ Distribuce', 12000, 40, 'C02d'),
  );
  expect(result.offers.map((o) => o.name)).toEqual([
    'ORLEN',
    'ČEZ ESCO',
    'Centropol',
    'E.ON Variant',
    'innogy',
    'PRE',
  ]);
  expect(result.offers.find((o) => o.name === 'PRE')!.value).toBeCloseTo(98947.992, 7);
  expect(result.offers.every((o, i) => i === 0 || o.value >= result.offers[i - 1].value)).toBe(
    true,
  );
});
it('adds household PRE to common ranking without ORLEN or an inherited business limit', () => {
  const html = renderToStaticMarkup(
    createElement(InnogyHouseholdComparison, {
      code: 'D02d',
      area: 'ČEZ Distribuce',
      amps: 40,
      phases: 3,
      vt: 40000,
      nt: 0,
      cezResult: assessHousehold('D02d', 'ČEZ Distribuce', 40, 3, 40000, 0),
    }),
  );
  expect(html).toContain('PRE PROUD FAVORIT 2');
  expect(html).toContain('Pořadí domácích nabídek');
  expect(html).not.toMatch(/ORLEN|Spotřeba nad 30 MWh/);
  expect(assessPre('C', 'C02d', 'ČEZ Distribuce', 40, 40000, null).warning).toBeNull();
});
