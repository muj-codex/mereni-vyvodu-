import { it, expect } from 'vitest';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { createElement } from 'react';
import { assessEpet, epetSources, epetTariff, epetBreaker } from '../src/tariffs/epetCosts';
import { compareBusinessOffers } from '../src/tariffs/businessOffers';
import { comparisonContext } from '../src/tariffs/calculations';
import { InnogyHouseholdComparison } from '../src/tariffs/InnogyHouseholdComparison';
import { assessHousehold } from '../src/tariffs/cezCosts';
import frozen from './fixtures/frozen-1414.json';
import { frozen1414Content } from './frozen-reference1415';
it('preserves every old source except the exact audited EPET integration patches', () => {
  for (const [p, h] of Object.entries(frozen))
    expect(createHash('sha256').update(frozen1414Content(p)).digest('hex'), p).toBe(h);
});
const areas = ['ČEZ Distribuce', 'EG.D', 'PREdistribuce'] as const;
const cPrices = [
  ['C01d', 2819, null],
  ['C02d', 2819, null],
  ['C03d', 2819, null],
  ['C25d', 2849, 2749],
  ['C26d', 2849, 2749],
  ['C27d', 2849, 2749],
  ['C35d', 2849, 2749],
  ['C45d', 2849, 2749],
  ['C46d', 2849, 2749],
  ['C56d', 2849, 2749],
  ['C62d', 2699, null],
] as const;
const dPrices = [
  ['D01d', 2539, null],
  ['D02d', 2539, null],
  ['D25d', 2599, 2549],
  ['D26d', 2599, 2549],
  ['D27d', 2599, 2549],
  ['D35d', 2599, 2549],
  ['D45d', 2599, 2549],
  ['D56d', 2599, 2549],
  ['D57d', 2599, 2549],
  ['D61d', 2599, 2549],
] as const;
for (const area of areas) {
  it(`${area}: retains the exact originals, 24 months from actual supply start for both categories`, () => {
    for (const c of ['C', 'D'] as const) {
      const m = epetSources[c][area].metadata;
      expect(
        createHash('sha256')
          .update(readFileSync(`docs/sources/epet-2026/${m.sourceFile}`))
          .digest('hex'),
      ).toBe(m.sha256);
      expect(m).toMatchObject({
        validFrom: '2026-07-20',
        fixationMonths: 24,
        fixationStarts: 'actual supply start',
        prolongationProduct: 'STANDARD',
        excludedOptionalServicesPage: 3,
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
        const t = epetTariff(customer, code, area)!;
        expect(t.commodityVT.priceWithoutVat).toBe(vt);
        expect(t.commodityNT?.priceWithoutVat ?? null).toBe(nt);
        expect(t.fixedMonthly).toEqual({ priceWithoutVat: 130, priceWithVat: 157.3 });
        const r = assessEpet(
          customer,
          code,
          area,
          40,
          12000,
          nt ? { annualVT: 4000, annualNT: 8000 } : null,
        );
        expect(r.complete).toBe(true);
        expect(r.commercial).toBeCloseTo((nt ? 4 * vt + 8 * nt : 12 * vt) + 12 * 130, 8);
        expect(r.priceWithVat).toBeCloseTo(r.priceWithoutVat! * 1.21, 8);
        const infra = r.lines.filter((l) => l.label === 'Nesíťová infrastruktura');
        expect(infra).toHaveLength(1);
        expect(infra[0].priceWithoutVat).toBe(154.44);
        expect(r.poze).toBe(0);
        expect(r.lines.some((l) => /sankce|ukončení|40 %/.test(l.label))).toBe(false);
      },
    );
  }
  it(`${area}: no invented EPET 30MWh limit, own source A/B and infrastructure once`, () => {
    for (const customer of ['C', 'D'] as const) {
      const source = epetSources[customer][area];
      expect(source.common.pozePerAmp.priceWithoutVat).toBe(0);
      expect(source.common.pozeCapPerMwh.priceWithoutVat).toBe(495);
      expect(
        Object.values(source.infrastructureComponentsWithoutVat).reduce((a, b) => a + b, 0),
      ).toBeCloseTo(12.87, 10);
      const r = assessEpet(customer, customer === 'C' ? 'C02d' : 'D02d', area, 40, 40000, null);
      expect(r.complete).toBe(true);
      expect(r.warning).toBeNull();
      expect(r.poze).toBe(0);
    }
  });
  it(`${area}: D57d-only high bands, distinct ordinary D per-amp rule, 1f and business over160A`, () => {
    const special = epetTariff('D', 'D57d', area)!;
    const ordinary = epetTariff('D', 'D02d', area)!;
    expect(epetBreaker('D', 'D57d', area, 80)).toBe(special.breakerRows['17']!.priceWithoutVat);
    expect(epetBreaker('D', 'D57d', area, 200)).toBe(
      special.breakerRows['21']!.priceWithoutVat * 200,
    );
    expect(ordinary.breakerRows['17']).toBeNull();
    expect(epetBreaker('D', 'D02d', area, 80)).toBe(
      ordinary.breakerRows['22']!.priceWithoutVat * 80,
    );
    expect(epetBreaker('D', 'D02d', area, 32, 1)).toBe(
      ordinary.breakerRows['23']!.priceWithoutVat * 32,
    );
    expect(epetBreaker('C', 'C02d', area, 200)).toBe(
      epetTariff('C', 'C02d', area)!.breakerRows['21']!.priceWithoutVat * 200,
    );
  });
  it(`${area}: no C55d invented, missing VT/NT incomplete, inconsistent inputs rejected`, () => {
    expect(epetTariff('C', 'C55d', area)).toBeNull();
    expect(assessEpet('C', 'C25d', area, 40, 12000, null).priceWithVat).toBeNull();
    expect(() => assessEpet('C', 'C25d', area, 40, 12000, { annualVT: 1, annualNT: 2 })).toThrow();
  });
  it(`${area}: household ranking includes EPET, its breakdown and excludes ORLEN`, () => {
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
    expect(html).toContain('FIX 24 · GARANT 7_2026');
    expect(html).toContain('Pevná obchodní cena na 24 měsíců');
    expect(html).not.toContain('ORLEN');
    const order = html.split('aria-label="Pořadí domácích nabídek"')[1];
    expect(order).toContain('EPET');
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
      ['C', 'C02d', 2819, cDist, cBreaker],
      ['D', 'D02d', 2539, dDist, dBreaker],
    ] as const) {
      const r = assessEpet(c, code, area, 40, 12000, null);
      const net = 12 * (price + dist + 164.24 + 28.3) + 12 * (130 + breaker + 12.87);
      expect(r.breakerMonthly).toBe(breaker);
      expect(r.priceWithoutVat).toBeCloseTo(net, 8);
      expect(r.priceWithVat).toBeCloseTo(net * 1.21, 8);
    }
  },
);
it('uses net source prices and VAT once, excluding page3 optional services', () => {
  const c = epetTariff('C', 'C02d', 'ČEZ Distribuce')!;
  const d = epetTariff('D', 'D02d', 'ČEZ Distribuce')!;
  expect(c.commodityVT).toEqual({ priceWithoutVat: 2819, priceWithVat: 3410.99 });
  expect(d.commodityVT).toEqual({ priceWithoutVat: 2539, priceWithVat: 3072.19 });
  expect(assessEpet('C', 'C02d', 'ČEZ Distribuce', 40, 12000, null).commercial).toBe(35388);
});
it.each([
  ['ČEZ Distribuce', [3093, 5335, 10471, 19598], 122.49, 10.23, 14.43],
  ['EG.D', [2631, 4839, 9074, 17889], 111.81, 9.99, 15.09],
  ['PREdistribuce', [2494, 4801, 9841, 20779], 129.87, 8.67, 11.88],
] as const)(
  '%s: D57d-only boundaries, ordinary D per-A and C per-A remain independent',
  (area, bands, high, ordinary, cHigh) => {
    for (const [i, amp] of [80, 100, 125, 160].entries()) {
      expect(epetBreaker('D', 'D57d', area, amp)).toBe(bands[i]);
      expect(epetBreaker('D', 'D57d', area, amp - 0.5)).toBe(bands[i]);
    }
    expect(epetBreaker('D', 'D57d', area, 161)).toBeCloseTo(high * 161, 8);
    expect(epetBreaker('D', 'D02d', area, 80)).toBeCloseTo(ordinary * 80, 8);
    expect(epetBreaker('C', 'C02d', area, 161)).toBeCloseTo(cHigh * 161, 8);
  },
);
it.each(areas)('%s: business ranking uses the same area, code, breaker and VT/NT', (area) => {
  for (const code of ['C02d', 'C25d', 'C45d', 'C62d']) {
    const split = { annualVT: 4000, annualNT: 8000 };
    const ctx = comparisonContext('C', 'company', area, 12000, 40, code, split);
    const r = compareBusinessOffers(code, ctx);
    expect(r.offers.find((o) => o.name === 'EPET')!.value).toBe(
      assessEpet('C', code, area, 40, 12000, split).priceWithVat,
    );
    expect(r.offers.every((o, i) => i === 0 || o.value >= r.offers[i - 1].value)).toBe(true);
    expect(new Set(r.offers.map((o) => o.name)).size).toBe(r.offers.length);
  }
});
it('rejects invalid inputs and never charges a dual tariff without a valid split', () => {
  for (const amps of [0, -1, NaN, Infinity])
    expect(() => assessEpet('C', 'C02d', 'ČEZ Distribuce', amps, 12000, null)).toThrow();
  for (const kwh of [-1, NaN, Infinity])
    expect(() => assessEpet('D', 'D02d', 'ČEZ Distribuce', 40, kwh, null)).toThrow();
  expect(epetBreaker('D', 'D57d', 'ČEZ Distribuce', NaN)).toBeNull();
  expect(assessEpet('D', 'D57d', 'ČEZ Distribuce', 40, 12000, null).priceWithVat).toBeNull();
});
