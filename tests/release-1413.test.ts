import { it, expect } from 'vitest';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import {
  assessCentropol,
  centropolSources,
  centropolTariff,
  centropolBreaker,
} from '../src/tariffs/centropolCosts';
import { compareBusinessOffers } from '../src/tariffs/businessOffers';
import { comparisonContext } from '../src/tariffs/calculations';
import { renderToStaticMarkup } from 'react-dom/server';
import { createElement } from 'react';
import { InnogyHouseholdComparison } from '../src/tariffs/InnogyHouseholdComparison';
import { assessHousehold } from '../src/tariffs/cezCosts';
import frozen from './fixtures/frozen-1412.json';
import { frozen1412Content } from './frozen-reference1413';
it('freezes every previous source except exact audited Centropol integration patches', () => {
  for (const [p, h] of Object.entries(frozen))
    expect(createHash('sha256').update(frozen1412Content(p)).digest('hex'), p).toBe(h);
});
const areas = ['ČEZ Distribuce', 'EG.D', 'PREdistribuce'] as const;
const cPrices = [
  ['C01d', 2868, null],
  ['C02d', 2868, null],
  ['C03d', 2868, null],
  ['C25d', 2987, 2702],
  ['C26d', 2987, 2702],
  ['C27d', 2987, 2702],
  ['C35d', 2998, 2802],
  ['C45d', 2996, 2854],
  ['C46d', 2996, 2854],
  ['C55d', 2996, 2854],
  ['C56d', 2996, 2854],
  ['C62d', 2878, null],
] as const;
const dPrices = [
  ['D01d', 2718, null],
  ['D02d', 2718, null],
  ['D25d', 2854, 2583],
  ['D26d', 2854, 2583],
  ['D27d', 2854, 2583],
  ['D35d', 2881, 2773],
  ['D45d', 2854, 2800],
  ['D56d', 2854, 2800],
  ['D57d', 2854, 2800],
  ['D61d', 2854, 2610],
] as const;
for (const area of areas) {
  it(`${area}: retains both PDF originals and independent source metadata`, () => {
    for (const c of ['C', 'D'] as const) {
      const m = centropolSources[c][area].metadata;
      expect(
        createHash('sha256')
          .update(readFileSync(`docs/sources/centropol-2026/${m.sourceFile}`))
          .digest('hex'),
      ).toBe(m.sha256);
      expect(m.distributionArea).toBe(area);
      expect(m.pricingType).toBe('fixed');
      expect(m.validFrom).toBe(c === 'C' ? '2026-09-21' : '2026-09-24');
    }
  });
  it.each(cPrices)(`${area} business %s exact commodity and completion gates`, (code, vt, nt) => {
    const t = centropolTariff('C', code, area)!;
    expect(t.commodityVT.priceWithoutVat).toBe(vt);
    expect(t.commodityNT?.priceWithoutVat ?? null).toBe(nt);
    expect(t.fixedMonthly.priceWithoutVat).toBe(130);
    const r = assessCentropol(
      'C',
      code,
      area,
      40,
      12000,
      nt ? { annualVT: 4000, annualNT: 8000 } : null,
    );
    expect(r.complete).toBe(code !== 'C55d');
    if (code === 'C55d') {
      expect(r.priceWithVat).toBeNull();
      expect(r.commercial).toBe(36376);
      expect(r.missing.join()).toContain('C55d');
      expect(t.distributionVT).toBeNull();
      expect(Object.values(t.breakerRows).every((v) => v === null)).toBe(true);
    } else {
      expect(r.priceWithVat).toBeCloseTo(r.priceWithoutVat! * 1.21, 8);
      expect(r.commercial).toBe((nt ? 4 * vt + 8 * nt : 12 * vt) + 1560);
    }
  });
  it.each(dPrices)(`${area} household %s exact commodity and complete price`, (code, vt, nt) => {
    const t = centropolTariff('D', code, area)!;
    expect(t.commodityVT.priceWithoutVat).toBe(vt);
    expect(t.commodityNT?.priceWithoutVat ?? null).toBe(nt);
    expect(t.fixedMonthly.priceWithoutVat).toBe(135);
    const r = assessCentropol(
      'D',
      code,
      area,
      40,
      12000,
      nt ? { annualVT: 4000, annualNT: 8000 } : null,
    );
    expect(r.complete).toBe(true);
    expect(r.priceWithVat).toBeCloseTo(r.priceWithoutVat! * 1.21, 8);
    expect(r.commercial).toBe((nt ? 4 * vt + 8 * nt : 12 * vt) + 1620);
  });
  it(`${area}: applies D57d-only high bands and category-specific one-phase prices`, () => {
    const d = centropolTariff('D', 'D57d', area)!;
    const ordinary = centropolTariff('D', 'D02d', area)!;
    expect(centropolBreaker('D', 'D57d', area, 80)).toBe(d.breakerRows['17']!.priceWithoutVat);
    expect(centropolBreaker('D', 'D57d', area, 200)).toBe(
      200 * d.breakerRows['21']!.priceWithoutVat,
    );
    expect(centropolBreaker('D', 'D02d', area, 80)).toBe(
      80 * ordinary.breakerRows['22']!.priceWithoutVat,
    );
    expect(ordinary.breakerRows['17']).toBeNull();
    expect(centropolBreaker('D', 'D57d', area, 32, 1)).toBe(
      32 * d.breakerRows['23']!.priceWithoutVat,
    );
    expect(centropolBreaker('C', 'C02d', area, 200)).toBe(
      200 * centropolTariff('C', 'C02d', area)!.breakerRows['21']!.priceWithoutVat,
    );
  });
  it(`${area}: C55d and missing NT never create a complete ranked offer`, () => {
    expect(
      compareBusinessOffers(
        'C55d',
        comparisonContext('C', 'company', area, 12000, 40, 'C55d', {
          annualVT: 4000,
          annualNT: 8000,
        }),
      ).offers,
    ).toEqual([]);
    expect(assessCentropol('C', 'C25d', area, 40, 12000, null).priceWithVat).toBeNull();
    expect(() =>
      assessCentropol('C', 'C25d', area, 40, 12000, { annualVT: 1, annualNT: 2 }),
    ).toThrow();
  });
  it(`${area}: common household ranking adds Centropol and excludes ORLEN`, () => {
    const html = renderToStaticMarkup(
      createElement(InnogyHouseholdComparison, {
        code: 'D02d',
        area,
        amps: 40,
        phases: 3,
        vt: 12000,
        nt: 0,
        cezResult: assessHousehold('D02d', area, 40, 3, 12000, 0),
      }),
    );
    expect(html).toContain('Centropol');
    expect(html).toContain('Pořadí domácích nabídek');
    expect(html).not.toMatch(/ORLEN|Spotřeba nad 30 MWh/);
  });
}
it.each([
  ['ČEZ Distribuce', 2263.19, 577, 2078.58, 409],
  ['EG.D', 3185.49, 604, 2295.34, 400],
  ['PREdistribuce', 2593.88, 475, 1516.53, 347],
] as const)(
  '%s: independent full annual C02d and D02d checks',
  (area, distC, breakerC, distD, breakerD) => {
    for (const [customer, code, price, fixed, dist, breaker] of [
      ['C', 'C02d', 2868, 130, distC, breakerC],
      ['D', 'D02d', 2718, 135, distD, breakerD],
    ] as const) {
      const r = assessCentropol(customer, code, area, 40, 12000, null);
      expect(r.breakerMonthly).toBe(breaker);
      const net = 12 * (price + dist + 164.24 + 28.3) + 12 * (fixed + breaker + 12.87);
      expect(r.priceWithoutVat).toBeCloseTo(net, 8);
      expect(r.priceWithVat).toBeCloseTo(net * 1.21, 8);
      expect(r.pozeA).toBe(0);
      expect(r.pozeB).toBeNull();
    }
  },
);
it('preserves the source-specific C45d 635.80 and does not use a non-applicable C62d NT summary', () => {
  expect(centropolTariff('C', 'C45d', 'ČEZ Distribuce')!.distributionVT!.priceWithoutVat).toBe(
    635.8,
  );
  expect(centropolTariff('C', 'C62d', 'ČEZ Distribuce')!.commodityNT).toBeNull();
  expect(centropolTariff('C', 'C62d', 'ČEZ Distribuce')!.distributionNT).toBeNull();
});
