import { describe, it, expect } from 'vitest';
import {
  blankTariffDraft,
  standardBreakerAmps,
  suppliersFor,
  blankSupplierUpdate,
  unknownAnnualCosts,
  type PriceList,
} from '../src/tariffs/model';
import {
  calculateFlat,
  calculateCompany,
  loadAfterSimultaneity,
  readingInstant,
  comparisonContext,
  usedBreaker,
} from '../src/tariffs/calculations';
import { supplierUpdateReducer } from '../src/tariffs/supplierUpdate';
import { SupplierCardView } from '../src/tariffs/SupplierCard';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
const flat = () => ({
  ...blankTariffDraft().flat,
  currentA: '40',
  simultaneity: '0,65',
  consumptionKwh: '1000',
});
const company = () => ({
  ...blankTariffDraft().company,
  tariffCode: 'C02d',
  breaker: { choice: '3×40 A', custom: '' },
  first: { date: '2026-01-01', time: '10:00', value: '1000' },
  second: { date: '2026-01-11', time: '10:00', value: '2250' },
});
describe('flat connection math kept inside tariffs', () => {
  it('40 × 0.65 = 26 and recommends 32, never 25', () => {
    expect(calculateFlat(flat())).toMatchObject({
      concurrentA: 26,
      recommendedA: 32,
      breakerA: 32,
      annualKwh: 12000,
    });
  });
  it('uses only the requested standard series and a strictly higher rating without display rounding', () => {
    expect(standardBreakerAmps).toEqual([10, 16, 20, 25, 32, 40, 50, 63, 80, 100, 125, 160]);
    expect(loadAfterSimultaneity('25,9999', '1').recommendedA).toBe(32);
    expect(loadAfterSimultaneity('32', '1').recommendedA).toBe(40);
    expect(loadAfterSimultaneity('63,999', '1').recommendedA).toBe(80);
    for (const current of [1, 10, 16, 25.00001, 63, 100, 125, 159]) {
      const r = loadAfterSimultaneity(String(current), '1');
      expect(r.recommendedA).toBeGreaterThan(r.concurrentA);
      expect(standardBreakerAmps).toContain(r.recommendedA);
    }
  });
  it.each(['0', '1,01', '2', '-1', '', 'NaN'])('rejects simultaneity %s', (simultaneity) => {
    expect(() => calculateFlat({ ...flat(), simultaneity })).toThrow();
  });
  it('accepts coefficient 1 and zero consumption, rejects nonpositive current', () => {
    expect(calculateFlat({ ...flat(), simultaneity: '1', consumptionKwh: '0' }).annualKwh).toBe(0);
    expect(() => calculateFlat({ ...flat(), currentA: '0' })).toThrow(/Proudové/);
  });
  it.each([1, 2, 3, 6, 12])('annualises N=%s months from raw consumption', (months) => {
    expect(calculateFlat({ ...flat(), periodMonths: String(months) }).annualKwh).toBe(
      (1000 * 12) / months,
    );
  });
  it('supports custom months and rejects zero/fractional periods', () => {
    expect(
      calculateFlat({ ...flat(), periodMonths: 'custom', customPeriodMonths: '5' }).annualKwh,
    ).toBe(2400);
    for (const months of ['0', '1,5', '', '-1'])
      expect(() =>
        calculateFlat({ ...flat(), periodMonths: 'custom', customPeriodMonths: months }),
      ).toThrow();
  });
  it('manual 64 A survives in all future comparison candidates and is never suggested', () => {
    const r = calculateFlat({ ...flat(), breaker: { choice: 'custom', custom: '64' } });
    expect(r.breakerA).toBe(64);
    expect(r.recommendedA).toBe(32);
    const c = comparisonContext('C', 'flat', 'ČEZ Distribuce', r.annualKwh, r.breakerA);
    expect(c.candidates).toHaveLength(8 * 13);
    expect(
      c.candidates.every(
        (x) =>
          x.breakerA === 64 &&
          x.distributionArea === 'ČEZ Distribuce' &&
          x.annualCosts.annualTotal === null,
      ),
    ).toBe(true);
    expect(c.verdict).toEqual({ kind: 'pending' });
    expect(JSON.stringify(unknownAnnualCosts())).not.toMatch(/:\d/);
  });
  it('accepts a manual standard override without replacing it or snapping a custom value', () => {
    expect(calculateFlat({ ...flat(), breaker: { choice: '3×50 A', custom: '' } }).breakerA).toBe(
      50,
    );
    expect(usedBreaker({ choice: 'custom', custom: '64' })).toBe(64);
    expect(() => usedBreaker({ choice: '3×64 A', custom: '' })).toThrow();
  });
  it('never clamps high currents down to the maximum standard rating', () => {
    expect(loadAfterSimultaneity('200', '1').recommendedA).toBeNull();
    expect(() => calculateFlat({ ...flat(), currentA: '200', simultaneity: '1' })).toThrow(
      /standardní/,
    );
    expect(
      calculateFlat({
        ...flat(),
        currentA: '200',
        simultaneity: '1',
        breaker: { choice: 'custom', custom: '250' },
      }).breakerA,
    ).toBe(250);
  });
});
describe('company readings use actual elapsed time in Europe/Prague', () => {
  it('1250 kWh over ten days annualises deterministically without changing the installed 40 A breaker', () => {
    expect(calculateCompany(company())).toMatchObject({
      consumptionKwh: 1250,
      elapsedHours: 240,
      annualKwh: 45625,
      breakerA: 40,
      originalTariff: 'C02d',
    });
  });
  it('uses time-of-day and minute precision, not rounded dates or months', () => {
    const x = company();
    x.second = { date: '2026-01-01', time: '10:30', value: '1001' };
    expect(calculateCompany(x)).toMatchObject({
      elapsedHours: 0.5,
      consumptionKwh: 1,
      annualKwh: 17520,
    });
  });
  it.each([
    ['2026-03-28', '2026-03-29', 23],
    ['2026-10-24', '2026-10-25', 25],
  ])('accounts for DST from %s to %s', (first, second, hours) => {
    const x = company();
    x.first = { date: first, time: '12:00', value: '0' };
    x.second = { date: second, time: '12:00', value: '100' };
    expect(calculateCompany(x).elapsedHours).toBe(hours);
    expect(calculateCompany(x).annualKwh).toBe(100 * (8760 / hours));
  });
  it('keeps the 365-day annual convention across leap days', () => {
    const x = company();
    x.first = { date: '2024-02-28', time: '10:00', value: '0' };
    x.second = { date: '2024-03-01', time: '10:00', value: '20' };
    expect(calculateCompany(x)).toMatchObject({ elapsedHours: 48, annualKwh: 3650 });
  });
  it.each([
    ['2026-03-29', '02:30'],
    ['2026-10-25', '02:30'],
    ['2026-02-30', '12:00'],
    ['2026-01-01', '24:00'],
  ])('rejects invalid or ambiguous local time %s %s', (date, time) => {
    expect(() => readingInstant({ date, time, value: '0' })).toThrow();
  });
  it('rejects reversed/equal timestamps, decreasing states and household tariffs', () => {
    const x = company();
    expect(() => calculateCompany({ ...x, second: { ...x.first } })).toThrow(/pozdější/);
    expect(() => calculateCompany({ ...x, second: { ...x.second, value: '999' } })).toThrow(
      /nižší/,
    );
    expect(() => calculateCompany({ ...x, tariffCode: 'D02d' })).toThrow(/sazbu C/);
    expect(calculateCompany({ ...x, second: { ...x.second, value: '1000' } }).annualKwh).toBe(0);
    expect(() => calculateCompany({ ...x, breaker: { choice: 'auto', custom: '' } })).toThrow();
  });
  it('keeps C/ORLEN-only candidates, original tariff, one area and fixed breaker', () => {
    const r = calculateCompany(company());
    const c = comparisonContext('C', 'company', 'EG.D', r.annualKwh, r.breakerA, r.originalTariff);
    expect(c.originalTariff).toBe('C02d');
    expect(c.candidates).toHaveLength(13);
    expect(
      c.candidates.every(
        (x) =>
          x.supplierId === 'orlen' &&
          x.tariffCode.startsWith('C') &&
          x.breakerA === 40 &&
          x.distributionArea === 'EG.D',
      ),
    ).toBe(true);
    expect(() => comparisonContext('D', 'company', 'EG.D', 100, 40)).toThrow();
    expect(suppliersFor('D', 'company')).toEqual([]);
    expect(suppliersFor('C', 'flat')).toHaveLength(8);
    expect(suppliersFor('D', 'flat')).toHaveLength(7);
  });
});
describe('supplier failures retain the last valid price list', () => {
  it('keeps E.ON data and the other seven supplier states intact', () => {
    const list: PriceList = {
      distributionArea: 'EG.D',
      validFrom: '2026-01-01',
      tariffs: [{ code: 'C02d', annualCosts: unknownAnnualCosts() }],
    };
    const states = suppliersFor('C').map((s) => ({ supplier: s, update: blankSupplierUpdate() }));
    const eon = states.find((x) => x.supplier.id === 'eon')!;
    eon.update = supplierUpdateReducer(eon.update, {
      type: 'success',
      validFrom: list.validFrom,
      lastChecked: '2026-10-25',
      priceList: list,
    });
    const before = states.filter((s) => s !== eon).map((s) => JSON.stringify(s));
    eon.update = supplierUpdateReducer(supplierUpdateReducer(eon.update, { type: 'start' }), {
      type: 'error',
      message: 'Zdroj není dostupný.',
    });
    expect(eon.update.lastValidPriceList).toBe(list);
    expect(eon.update.validFrom).toBe('2026-01-01');
    expect(states.filter((s) => s !== eon).map((s) => JSON.stringify(s))).toEqual(before);
    expect(
      renderToStaticMarkup(
        createElement(SupplierCardView, {
          supplier: eon.supplier,
          update: eon.update,
          onUpdate: () => {},
        }),
      ),
    ).toContain('Aktualizace selhala – používá se poslední platný ceník.');
  });
});
