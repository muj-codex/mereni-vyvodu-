import { it, expect, describe } from 'vitest';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import frozen from './fixtures/frozen-149.json';
import { frozen149Content } from './frozen-reference1410';
import {
  electricity24Tariff,
  escoElectricity24Source,
  assessElectricity24,
} from '../src/tariffs/escoElectricity24Costs';
import { compareBusinessOffers } from '../src/tariffs/businessOffers';
import { comparisonContext } from '../src/tariffs/calculations';
import { EscoElectricity24Prices } from '../src/tariffs/EscoElectricity24Prices';
import { EonVariantPrices } from '../src/tariffs/EonVariantPrices';
import { assessOrlen } from '../src/tariffs/orlenCosts';
import { assessEonVariant } from '../src/tariffs/eonVariantCosts';
import { CezPrices } from '../src/tariffs/CezPrices';
import { tariffsFor } from '../src/tariffs/catalog';
it('preserves every old source file except the four exact audited fixed-product integrations', () => {
  for (const [path, sha] of Object.entries(frozen))
    expect(createHash('sha256').update(frozen149Content(path)).digest('hex'), path).toBe(sha);
});
it('retains the exact source PDF and selects fixed 24-month delivery terms, not the 12/36-month blocks', () => {
  const m = escoElectricity24Source.metadata;
  expect(
    createHash('sha256')
      .update(readFileSync(`docs/sources/cez-2026/${m.sourceFile}`))
      .digest('hex'),
  ).toBe(m.sha256);
  expect(m).toMatchObject({
    productName: 'Elektřina 24',
    pricingType: 'fixed',
    fixationMonths: 24,
    coverage: 'nationwide',
    deliveriesStartedFrom: '2026-06-01',
    lastVerifiedAt: '2026-10-27',
  });
  expect(m).not.toHaveProperty('referenceMonth');
  expect(m).not.toHaveProperty('refreshAfterDays');
  expect(electricity24Tariff('C02d')!.vtPerMwh).toEqual({
    priceWithoutVat: 2860,
    priceWithVat: 3460.6,
  });
  expect(electricity24Tariff('C02d')!.supplierFixedMonthly).toEqual({
    priceWithoutVat: 95,
    priceWithVat: 114.95,
  });
  expect(escoElectricity24Source.unimported).toEqual([]);
});
it.each([
  ['C01d', 2860, false],
  ['C02d', 2860, false],
  ['C03d', 2860, false],
  ['C25d', 2839, true],
  ['C26d', 2839, true],
  ['C27d', 2839, true],
  ['C35d', 2839, true],
  ['C45d', 2887, true],
  ['C46d', 2887, true],
  ['C55d', 2887, true],
  ['C56d', 2887, true],
  ['C62d', 2860, false],
] as const)('uses only verified Electricity 24 values for %s', (code, price, dual) => {
  const data = electricity24Tariff(code)!;
  expect(data.vtPerMwh.priceWithoutVat).toBe(price);
  expect(data.ntPerMwh?.priceWithoutVat ?? null).toBe(dual ? price : null);
  expect(data.supplierFixedMonthly.priceWithoutVat).toBe(95);
});
describe.each([
  ['C02d', 12000, 0, 2860, 2263.19, 577, 72007.2],
  ['C25d', 4000, 8000, 2839, 2208.39, 844, 57566.48],
  ['C45d', 4000, 8000, 2887, 635.38, 2344, 69850.44],
  ['C62d', 12000, 0, 2860, 297.41, 800, 51093.84],
] as const)('fixed annual cost %s', (code, vt, nt, price, distributionVT, breaker, expected) => {
  it('uses 95/month, exact known distribution, a single VAT addition and no SPOT surcharge', () => {
    const result = assessElectricity24(
      code,
      'ČEZ Distribuce',
      40,
      12000,
      nt ? { annualVT: vt, annualNT: nt } : null,
    )!;
    expect(result.complete).toBe(true);
    expect(result.commercial).toBe(12 * price + 1140);
    const regulated =
      (vt / 1000) * distributionVT +
      (nt / 1000) * 116.5 +
      12 * breaker +
      12 * (28.3 + 164.24) +
      154.44;
    expect(result.regulated!.priceWithoutVat).toBeCloseTo(regulated, 8);
    expect(result.priceWithoutVat).toBeCloseTo(expected, 8);
    expect(result.priceWithVat).toBeCloseTo(expected * 1.21, 8);
    expect(result.lines.some((l) => /přirážka|SPOT|odchylka/i.test(l.label))).toBe(false);
  });
  it('re-ranks against unchanged ORLEN and E.ON using the new complete total', () => {
    const context = comparisonContext(
      'C',
      'company',
      'ČEZ Distribuce',
      12000,
      40,
      code,
      nt ? { annualVT: vt, annualNT: nt } : null,
    );
    const ranked = compareBusinessOffers(code, context);
    expect(ranked.offers.map((o) => o.name)).toEqual(
      code === 'C62d' ? ['ČEZ ESCO', 'E.ON Variant', 'innogy'] : ['ORLEN', 'ČEZ ESCO', 'E.ON Variant', 'innogy'],
    );
    expect(ranked.offers.find((o) => o.name === 'ČEZ ESCO')!.value).toBeCloseTo(expected * 1.21, 8);
    expect(ranked.offers.every((o, i) => i === 0 || o.value >= ranked.offers[i - 1].value)).toBe(
      true,
    );
    const html = renderToStaticMarkup(createElement(EonVariantPrices, { context }));
    expect(html).toContain('Elektřina 24 · Fixace 24 měsíců');
    expect(html).not.toMatch(/SPOT|září 2026/);
  });
});
it('adds C55d only as verified ESCO commodity coverage, never borrows C56d regulation or other supplier prices', () => {
  expect(tariffsFor('C').filter((t) => t.code === 'C55d')).toHaveLength(1);
  const result = assessElectricity24('C55d', 'ČEZ Distribuce', 40, 12000, {
    annualVT: 4000,
    annualNT: 8000,
  })!;
  expect(result.commercial).toBe(35784);
  expect(result.regulated).toBeNull();
  expect(result.priceWithVat).toBeNull();
  expect(
    assessEonVariant('C55d', 'ČEZ Distribuce', 40, 12000, { annualVT: 4000, annualNT: 8000 })
      .supported,
  ).toBe(false);
  expect(
    assessOrlen('C55d', 'ČEZ Distribuce', 40, 12000, { annualVT: 4000, annualNT: 8000 }).verified,
  ).toBe(false);
  expect(
    compareBusinessOffers(
      'C55d',
      comparisonContext('C', 'company', 'ČEZ Distribuce', 12000, 40, 'C55d', {
        annualVT: 4000,
        annualNT: 8000,
      }),
    ).offers,
  ).toEqual([]);
  const eon = renderToStaticMarkup(
    createElement(EonVariantPrices, {
      context: comparisonContext('C', 'flat', 'ČEZ Distribuce', 12000, 40),
    }),
  );
  expect(eon).not.toContain('value="C55d"');
});
it('keeps missing tariffs, areas and splits incomplete instead of extrapolating', () => {
  expect(electricity24Tariff('C60d')).toBeNull();
  expect(assessElectricity24('C60d', 'ČEZ Distribuce', 40, 12000, null)).toBeNull();
  for (const area of ['EG.D', 'PREdistribuce'] as const) {
    const partial = assessElectricity24('C02d', area, 40, 12000, null)!;
    expect(partial.commercial).toBe(35460);
    expect(partial.complete).toBe(false);
    expect(partial.priceWithVat).toBeNull();
  }
  const partial = assessElectricity24('C25d', 'ČEZ Distribuce', 40, 12000, null)!;
  expect(partial.commercial).toBe(35208);
  expect(partial.priceWithVat).toBeNull();
  expect(() =>
    assessElectricity24('C25d', 'ČEZ Distribuce', 40, 12000, { annualVT: 1, annualNT: 2 }),
  ).toThrow();
});
it('keeps fixed output after the old refresh window and never renders an active SPOT alternative', () => {
  const html = renderToStaticMarkup(
    createElement(CezPrices, {
      context: comparisonContext('C', 'flat', 'ČEZ Distribuce', 12000, 40),
    }),
  );
  expect(html).toContain('ČEZ ESCO Elektřina 24');
  expect(html).toContain('Fixace 24 měsíců');
  expect(html).not.toMatch(/SPOT|září 2026|285 Kč|Doporučena kontrola/);
});
it('keeps household output and independent ORLEN/E.ON totals unchanged', () => {
  for (const area of ['ČEZ Distribuce', 'EG.D', 'PREdistribuce'] as const) {
    const html = renderToStaticMarkup(
      createElement(CezPrices, { context: comparisonContext('D', 'flat', area, 12000, 40) }),
    );
    expect(html).toContain('ČEZ domácnosti');
    expect(html).toContain('E.ON domácnosti');
    expect(html).not.toContain('Elektřina 24');
    expect(html).not.toMatch(/ORLEN/i);
  }
  expect(assessOrlen('C02d', 'ČEZ Distribuce', 40, 12000, null).priceWithVat).toBeCloseTo(
    81959.592,
    8,
  );
  expect(assessEonVariant('C02d', 'ČEZ Distribuce', 40, 12000, null).priceWithVat).toBeCloseTo(
    89785.872,
    8,
  );
  expect(
    renderToStaticMarkup(
      createElement(EscoElectricity24Prices, {
        context: comparisonContext('D', 'flat', 'ČEZ Distribuce', 12000, 40),
      }),
    ),
  ).toBe('');
});
