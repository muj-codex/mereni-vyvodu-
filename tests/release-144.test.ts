import { describe, it, expect } from 'vitest';
import { assessOrlen } from '../src/tariffs/orlenCosts';
import { orlenBreakerMonthly } from '../src/tariffs/orlen2026';
import { comparisonContext } from '../src/tariffs/calculations';

describe('verified ORLEN 1.4.4 end-to-end cost model', () => {
  it('calculates a hand-audited 12 MWh C02d invoice including annual tax and VAT without an invented fixed fee', () => {
    const r = assessOrlen('C02d', 'ČEZ Distribuce', 40, 12000, null);
    expect(r.complete).toBe(true);
    expect(r.missing).toEqual([]);
    expect(r.lines.map((v) => v.key)).not.toContain('supplierFixed');
    expect(r.lines.find((v) => v.key === 'taxes')!.priceWithoutVat).toBeCloseTo(339.6, 8);
    expect(r.priceWithoutVat).toBeCloseTo(67735.2, 8);
    expect(r.priceWithVat).toBeCloseTo(81959.592, 8);
    expect(r.priceWithVat! - r.priceWithoutVat!).toBeCloseTo(14224.392, 8);
    expect(r.lines.reduce((sum, v) => sum + v.priceWithVat!, 0)).toBeCloseTo(r.priceWithVat!, 8);
  });
  it.each([
    ['C01d', 66, 6.57, 2.19],
    ['C02d', 144, 14.43, 4.81],
    ['C03d', 819, 81.93, 27.31],
    ['C25d', 211, 21.09, 7.03],
    ['C45d', 586, 58.59, 19.53],
  ] as const)(
    '%s respects inclusive bands and independent 1f/3f per-A limits',
    (code, first, three, one) => {
      expect(orlenBreakerMonthly(code, 'ČEZ Distribuce', 1)!.priceWithoutVat).toBe(first);
      expect(orlenBreakerMonthly(code, 'ČEZ Distribuce', 25, 1)!.priceWithoutVat).toBe(first);
      expect(orlenBreakerMonthly(code, 'ČEZ Distribuce', 25.01, 1)!.priceWithoutVat).toBe(
        25.01 * one,
      );
      expect(orlenBreakerMonthly(code, 'ČEZ Distribuce', 160.01)!.priceWithoutVat).toBe(
        160.01 * three,
      );
      expect(orlenBreakerMonthly(code, 'ČEZ Distribuce', 0)).toBeNull();
      expect(orlenBreakerMonthly(code, 'ČEZ Distribuce', NaN)).toBeNull();
    },
  );
  it('uses ceiling bands for nonstandard breakers and never interpolates the price', () => {
    expect(orlenBreakerMonthly('C03d', 'ČEZ Distribuce', 40.01)!.priceWithoutVat).toBe(4097);
    expect(orlenBreakerMonthly('C03d', 'ČEZ Distribuce', 50)!.priceWithoutVat).toBe(4097);
    expect(orlenBreakerMonthly('C03d', 'ČEZ Distribuce', 50.01)!.priceWithoutVat).toBe(5162);
    expect(orlenBreakerMonthly('C25d', 'ČEZ Distribuce', 32.01)!.priceWithoutVat).toBe(844);
  });
  it('does not convert unknown areas, tariffs or missing low-tariff data into a final price', () => {
    expect(assessOrlen('C25d', 'ČEZ Distribuce', 40, 12000, null).priceWithVat).toBeNull();
    expect(assessOrlen('C02d', 'EG.D', 40, 12000, null).priceWithVat).toBeNull();
    expect(
      assessOrlen('C60d', 'ČEZ Distribuce', 40, 12000, { annualVT: 6000, annualNT: 6000 })
        .priceWithVat,
    ).toBeNull();
    expect(() =>
      assessOrlen('C02d', 'ČEZ Distribuce', 40, 12000, { annualVT: 1000, annualNT: 1000 }),
    ).toThrow(/VT\/NT/);
  });
  it('recommends from comparable verified prices, keeps the current tariff when cheapest and refuses unverified selections', () => {
    expect(comparisonContext('C', 'company', 'ČEZ Distribuce', 1000, 40, 'C02d').verdict).toEqual({
      kind: 'recommended',
      tariffCode: 'C01d',
    });
    expect(comparisonContext('C', 'company', 'ČEZ Distribuce', 12000, 40, 'C02d').verdict).toEqual({
      kind: 'matches',
      tariffCode: 'C02d',
    });
    expect(comparisonContext('C', 'company', 'ČEZ Distribuce', 1000, 40, 'C60d').verdict).toEqual({
      kind: 'pending',
    });
    expect(comparisonContext('C', 'company', 'EG.D', 1000, 40, 'C02d').verdict).toEqual({
      kind: 'pending',
    });
    expect(
      comparisonContext('C', 'company', 'ČEZ Distribuce', 10950, 63, 'C25d', {
        annualVT: 3650,
        annualNT: 7300,
      }).verdict,
    ).toEqual({ kind: 'matches', tariffCode: 'C25d' });
  });
});
