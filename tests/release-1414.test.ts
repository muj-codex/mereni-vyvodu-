import { it, expect } from 'vitest';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { createElement } from 'react';
import {
  assessMnd,
  mndSources,
  mndTariff,
  mndBreaker,
  mndLimitWarning,
} from '../src/tariffs/mndCosts';
import { compareBusinessOffers } from '../src/tariffs/businessOffers';
import { comparisonContext } from '../src/tariffs/calculations';
import { InnogyHouseholdComparison } from '../src/tariffs/InnogyHouseholdComparison';
import { assessHousehold } from '../src/tariffs/cezCosts';
import frozen from './fixtures/frozen-1413.json';
import { frozen1413Content } from './frozen-reference1414';
it('preserves every old source except the exact audited MND integration patches', () => {
  for (const [p, h] of Object.entries(frozen))
    expect(createHash('sha256').update(frozen1413Content(p)).digest('hex'), p).toBe(h);
});
const areas = ['ČEZ Distribuce', 'EG.D', 'PREdistribuce'] as const;
const cPrices = [
  ['C01d', 2899.17, null],
  ['C02d', 2899.17, null],
  ['C03d', 2899.17, null],
  ['C25d', 2930.57, 2757.85],
  ['C26d', 2930.57, 2757.85],
  ['C27d', 2930.57, 2757.85],
  ['C35d', 2947.93, 2839.66],
  ['C45d', 2935.53, 2908.26],
  ['C46d', 2935.53, 2908.26],
  ['C56d', 2935.53, 2908.26],
  ['C62d', 2771.9, null],
] as const;
const dPrices = [
  ['D01d', 2698.34, null],
  ['D02d', 2698.34, null],
  ['D25d', 2860.33, 2603.3],
  ['D26d', 2860.33, 2603.3],
  ['D27d', 2860.33, 2603.3],
  ['D35d', 2904.13, 2761.15],
  ['D45d', 2894.21, 2776.03],
  ['D56d', 2894.21, 2776.03],
  ['D57d', 2894.21, 2776.03],
  ['D61d', 2698.34, 2698.34],
] as const;
for (const area of areas) {
  it(`${area}: retains the exact originals, fixed expiry, transition and limit for both categories`, () => {
    for (const c of ['C', 'D'] as const) {
      const m = mndSources[c][area].metadata;
      expect(
        createHash('sha256')
          .update(readFileSync(`docs/sources/mnd-2026/${m.sourceFile}`))
          .digest('hex'),
      ).toBe(m.sha256);
      expect(m).toMatchObject({
        validFrom: '2026-10-07',
        priceGuaranteeUntil: '2028-12-31',
        revertsToBasicFrom: '2029-01-01',
        limitKwh: 30000,
        distributionArea: area,
      });
    }
  });
  for (const [customer, cases] of [
    ['C', cPrices],
    ['D', dPrices],
  ] as const) {
    it.each(cases.map(([code, vt, nt]): [string, number, number | null] => [code, vt, nt]))(
      `${area} ${customer} %s: exact net commodity, VAT once and infrastructure once`,
      (code, vt, nt) => {
        const t = mndTariff(customer, code, area)!;
        expect(t.commodityVT.priceWithoutVat).toBe(vt);
        expect(t.commodityNT?.priceWithoutVat ?? null).toBe(nt);
        expect(t.fixedMonthly).toEqual({ priceWithoutVat: 138.84, priceWithVat: 168 });
        const r = assessMnd(
          customer,
          code,
          area,
          40,
          12000,
          nt ? { annualVT: 4000, annualNT: 8000 } : null,
        );
        expect(r.complete).toBe(true);
        expect(r.commercial).toBeCloseTo((nt ? 4 * vt + 8 * nt : 12 * vt) + 12 * 138.84, 8);
        expect(r.priceWithVat).toBeCloseTo(r.priceWithoutVat! * 1.21, 8);
        const infra = r.lines.filter((l) => l.label === 'Nesíťová infrastruktura');
        expect(infra).toHaveLength(1);
        expect(infra[0].priceWithoutVat).toBe(154.44);
        expect(r.poze).toBe(0);
        expect(r.lines.some((l) => /sankce|ukončení|40 %/.test(l.label))).toBe(false);
      },
    );
  }
  it(`${area}: business and household limits are inclusive at 30 MWh, conditional above`, () => {
    for (const c of ['C', 'D'] as const) {
      const code = c === 'C' ? 'C02d' : 'D02d';
      expect(assessMnd(c, code, area, 40, 30000, null).warning).toBeNull();
      const above = assessMnd(c, code, area, 40, 30000.01, null);
      expect(above.complete).toBe(true);
      expect(above.priceWithVat).not.toBeNull();
      expect(above.warning).toBe(mndLimitWarning);
    }
    const rank = compareBusinessOffers(
      'C02d',
      comparisonContext('C', 'company', area, 30001, 40, 'C02d'),
    );
    expect(rank.offers.find((o) => o.name === 'MND')!.pricing).toContain('pouze orientační');
  });
  it(`${area}: D57d-only high bands, distinct ordinary D per-amp rule, 1f and business over160A`, () => {
    const special = mndTariff('D', 'D57d', area)!;
    const ordinary = mndTariff('D', 'D02d', area)!;
    expect(mndBreaker('D', 'D57d', area, 80)).toBe(special.breakerRows['17']!.priceWithoutVat);
    expect(mndBreaker('D', 'D57d', area, 200)).toBe(
      special.breakerRows['21']!.priceWithoutVat * 200,
    );
    expect(ordinary.breakerRows['17']).toBeNull();
    expect(mndBreaker('D', 'D02d', area, 80)).toBe(
      ordinary.breakerRows['22']!.priceWithoutVat * 80,
    );
    expect(mndBreaker('D', 'D02d', area, 32, 1)).toBe(
      ordinary.breakerRows['23']!.priceWithoutVat * 32,
    );
    expect(mndBreaker('C', 'C02d', area, 200)).toBe(
      mndTariff('C', 'C02d', area)!.breakerRows['21']!.priceWithoutVat * 200,
    );
  });
  it(`${area}: no C55d invented, missing VT/NT incomplete, inconsistent inputs rejected`, () => {
    expect(mndTariff('C', 'C55d', area)).toBeNull();
    expect(assessMnd('C', 'C25d', area, 40, 12000, null).priceWithVat).toBeNull();
    expect(() => assessMnd('C', 'C25d', area, 40, 12000, { annualVT: 1, annualNT: 2 })).toThrow();
  });
  it(`${area}: household ranking retains MND above30 with warning and excludes ORLEN`, () => {
    const html = renderToStaticMarkup(
      createElement(InnogyHouseholdComparison, {
        code: 'D02d',
        area,
        amps: 40,
        phases: 3,
        vt: 40000,
        nt: 0,
        cezResult: assessHousehold('D02d', area, 40, 3, 40000, 0),
      }),
    );
    expect(html).toContain('Proud – Ceník Prosinec 28');
    expect(html).toContain(mndLimitWarning);
    expect(html).not.toContain('ORLEN');
    expect(html).toContain('Pořadí domácích nabídek');
  });
}
it.each([
  ['ČEZ Distribuce', 2263.19, 577, 2078.58, 409],
  ['EG.D', 3185.49, 604, 2295.34, 400],
  ['PREdistribuce', 2593.88, 475, 1516.53, 347],
] as const)(
  '%s: independent C02d and D02d full annual totals',
  (area, cDist, cBreaker, dDist, dBreaker) => {
    for (const [c, code, price, dist, breaker] of [
      ['C', 'C02d', 2899.17, cDist, cBreaker],
      ['D', 'D02d', 2698.34, dDist, dBreaker],
    ] as const) {
      const r = assessMnd(c, code, area, 40, 12000, null);
      const net = 12 * (price + dist + 164.24 + 28.3) + 12 * (138.84 + breaker + 12.87);
      expect(r.breakerMonthly).toBe(breaker);
      expect(r.priceWithoutVat).toBeCloseTo(net, 8);
      expect(r.priceWithVat).toBeCloseTo(net * 1.21, 8);
    }
  },
);
it('charges the fixed package rather than the adjacent basic list and adds no early-termination fee', () => {
  const t = mndTariff('C', 'C02d', 'ČEZ Distribuce')!;
  expect(t.commodityVT.priceWithoutVat).toBe(2899.17);
  expect(t.commodityVT.priceWithoutVat).not.toBe(3464.46);
  expect(t.fixedMonthly.priceWithoutVat).not.toBe(99.17);
});
