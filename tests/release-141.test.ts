import { describe, it, expect } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { tariffsFor, tariffFor } from '../src/tariffs/catalog';
import { distributionAreas, suppliersFor, blankSupplierUpdate } from '../src/tariffs/model';
import { supplierUpdateReducer } from '../src/tariffs/supplierUpdate';
import { SupplierCardView } from '../src/tariffs/SupplierCard';

const C = [
  'C01d',
  'C02d',
  'C03d',
  'C25d',
  'C26d',
  'C27d',
  'C35d',
  'C45d',
  'C46d',
  'C56d',
  'C60d',
  'C62d',
];
const D = ['D01d', 'D02d', 'D25d', 'D26d', 'D27d', 'D35d', 'D45d', 'D56d', 'D57d', 'D61d'];
const single = ['C01d', 'C02d', 'C03d', 'D01d', 'D02d'];
describe('complete tariff metadata', () => {
  it('has exactly the requested 12 C and 10 D tariffs with no cross-category matches', () => {
    expect(tariffsFor('C').map((t) => t.code)).toEqual(C);
    expect(tariffsFor('D').map((t) => t.code)).toEqual(D);
    expect(tariffFor('C', 'D02d')).toBeUndefined();
    expect(tariffFor('D', 'C02d')).toBeUndefined();
  });
  it.each([...C, ...D])(
    '%s carries the declared tariff type, VT/NT and empty future data',
    (code) => {
      const category = code.startsWith('C') ? 'C' : 'D';
      const tariff = tariffFor(category, code)!;
      expect(tariff.category).toBe(category);
      expect(tariff.tariffType).toBe(single.includes(code) ? 'single' : 'dual');
      expect(tariff.usesVT).toBe(true);
      expect(tariff.usesNT).toBe(!single.includes(code));
      expect(tariff.dualTariff).toBe(!single.includes(code));
      expect(tariff.usageNote.length).toBeGreaterThan(0);
      expect(tariff.technicalConditions).toEqual({
        lowTariffHoursPerDay: null,
        waterHeating: null,
        storageHeating: null,
        directHeating: null,
        heatPump: null,
        electricVehicle: null,
        otherConditions: [],
      });
      expect(Object.keys(tariff.regulatedPricesByArea)).toEqual(distributionAreas);
      expect(Object.values(tariff.regulatedPricesByArea)).toEqual([null, null, null]);
    },
  );
});

describe('individual supplier state and card presentation', () => {
  it('keeps E.ON error, other suppliers and validity/verification dates independent', () => {
    const cards = suppliersFor('C').map((supplier) => ({
      supplier,
      update: blankSupplierUpdate(),
    }));
    const html = () =>
      cards.map(({ supplier, update }) =>
        renderToStaticMarkup(
          createElement(SupplierCardView, { supplier, update, onUpdate: () => {} }),
        ),
      );
    const before = html();
    const eon = cards.find((c) => c.supplier.id === 'eon')!;
    eon.update = supplierUpdateReducer(eon.update, {
      type: 'success',
      validFrom: '2026-01-01',
      lastChecked: '2026-10-25',
    });
    eon.update = supplierUpdateReducer(eon.update, { type: 'start' });
    eon.update = supplierUpdateReducer(eon.update, {
      type: 'error',
      message: 'Budoucí zdroj E.ON není dostupný.',
    });
    const after = html();
    cards.forEach((c, i) => {
      if (c.supplier.id !== 'eon') expect(after[i]).toBe(before[i]);
      else {
        expect(after[i]).toContain('data-update-state="error"');
        expect(after[i]).toContain('role="alert"');
        expect(after[i]).toContain('Budoucí zdroj E.ON není dostupný.');
        expect(after[i]).toContain('1. 1. 2026');
        expect(after[i]).toContain('25. 10. 2026');
      }
    });
    expect(eon.update.validFrom).toBe('2026-01-01');
    expect(eon.update.lastChecked).toBe('2026-10-25');
  });
  it('supports updating/success and preserves unknown validFrom separately from lastChecked', () => {
    const blank = blankSupplierUpdate();
    const updating = supplierUpdateReducer(blank, { type: 'start' });
    expect(updating.status).toBe('updating');
    expect(blank.status).toBe('idle');
    const success = supplierUpdateReducer(updating, {
      type: 'success',
      validFrom: null,
      lastChecked: '2026-10-25',
    });
    expect(success.status).toBe('success');
    expect(success.validFrom).toBeNull();
    expect(success.lastChecked).toBe('2026-10-25');
    expect(success.sourceStatus).toBe('verified');
  });
  it('placeholder updates invent no dates, success or source checks', () => {
    const before = blankSupplierUpdate();
    expect(supplierUpdateReducer(before, { type: 'placeholder' })).toEqual({
      ...before,
      message: 'Aktualizace ceníku bude doplněna v další etapě.',
    });
    expect(before.message).toBe('');
  });
  it('keeps source strategies unconfigured, branding separate and ORLEN out of households', () => {
    for (const supplier of suppliersFor('C')) {
      expect(supplier.source.kind).toBe(
        supplier.id === 'orlen' ? 'verified-transcription' : 'unconfigured',
      );
      expect(supplier.brand.accentColor).toMatch(/^#[0-9a-f]{6}$/i);
      expect(supplier.brand.logoPath).toBeUndefined();
    }
    expect(suppliersFor('C')[0].id).toBe('orlen');
    expect(suppliersFor('D').some((s) => s.id === 'orlen')).toBe(false);
  });
});
