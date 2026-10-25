import { describe, it, expect } from 'vitest';
import { blankTariffDraft, blankSupplierUpdate, suppliersFor } from '../src/tariffs/model';

describe('tariff input scaffold boundaries', () => {
  it('offers ORLEN as the company reference and excludes it entirely for households', () => {
    expect(suppliersFor('C')[0]).toMatchObject({
      id: 'orlen',
      name: 'ORLEN Unipetrol',
      workingReference: true,
    });
    expect(suppliersFor('D').map((s) => s.id)).toEqual(['cez', 'eon', 'pre', 'innogy']);
    expect(JSON.stringify(suppliersFor('D'))).not.toMatch(/orlen|reference/i);
  });
  it('keeps update and verification state independent for each supplier', () => {
    const company = suppliersFor('C').map((s) => ({ ...s, update: blankSupplierUpdate() }));
    company[0].update.status = 'error';
    company[0].update.error = 'future update error';
    company[1].update.status = 'success';
    company[1].update.lastChecked = '2026-10-25';
    expect(company[0].update.lastChecked).toBeNull();
    expect(company[1].update.error).toBeNull();
    expect(
      company.slice(2).every((s) => s.update.status === 'idle' && s.update.lastChecked === null),
    ).toBe(true);
  });
  it('starts without customer or area and does not invent or share input values', () => {
    const a = blankTariffDraft(),
      b = blankTariffDraft();
    expect(a.customer).toBeNull();
    expect(a.method).toBeNull();
    expect(a.distributionArea).toBe('');
    a.distributionArea = 'EG.D';
    a.estimate.powerKw = '123,456';
    a.estimate.breaker.custom = '1×40 A';
    a.actual.vtKwh = '100';
    a.actual.ntKwh = '200';
    expect(b).toEqual(blankTariffDraft());
    expect(a.estimate.powerKw).toBe('123,456');
    expect(a.actual.consumptionKwh).toBe('');
  });
});
