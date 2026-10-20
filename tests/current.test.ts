import { describe, it, expect } from 'vitest';
import {
  convertClamp,
  emptyCurrent,
  evaluateCurrent,
  currentOptions,
  locations,
  percentDifference,
  signedPercent,
  workingBand,
  diagnoseVoltage,
} from '../src/core/current';
import { toTSV, backupTSV, emailBody } from '../src/data/export';
import { createRecord } from '../src/core/measurement';
import { emptyDraft } from '../src/core/measurement';
const reference = {
  serial: '0001',
  config: emptyDraft().config,
  phases: [
    { u: 230, i: 1, pf: 1, p: 0.23 },
    { u: 230, i: 1, pf: 1, p: 0.23 },
    { u: 230, i: 1, pf: 1, p: 0.23 },
  ] as import('../src/core/types').MeasurementInput['phases'],
  kyoritsu: 0.69,
  energis: 0.69,
};
const draft = () => {
  const d = emptyCurrent();
  d.serial = '00AB01';
  d.identification.placement = '8L';
  d.phases = d.phases.map(() => ({ primary: '20,0', raw: '33,0', unit: 'mV' })) as typeof d.phases;
  return d;
};
describe('Kyoritsu 8112', () => {
  it.each([
    ['200 mA', 0.083],
    ['2 A', 0.83],
    ['20 A', 8.3],
  ] as const)('%s převod', (range, expected) =>
    expect(convertClamp('83', 'mV', range).secondaryA).toBeCloseTo(expected),
  );
  it.each(['0,083', '0.083'])('V → mV %s', (raw) =>
    expect(convertClamp(raw, 'V', '2 A')).toEqual(convertClamp('83', 'mV', '2 A')),
  );
  it('300/5 reprodukuje příklad', () => {
    const r = evaluateCurrent(draft());
    for (const p of r.phases) {
      expect(p.expectedA).toBeCloseTo(1 / 3);
      expect(p.secondaryA).toBe(0.33);
      expect(p.primaryFromSecondary).toBeCloseTo(19.8);
      expect(p.differencePercent).toBeCloseTo(-1);
      expect(p.raw).toBe('33,0');
    }
  });
  it('300/1 VN', () => {
    const d = draft();
    d.vn = true;
    d.identification.location = 'R201';
    d.phases = d.phases.map((p) => ({ ...p, raw: '6,6' })) as typeof d.phases;
    const r = evaluateCurrent(d);
    expect(r.input.ctSecondary).toBe(1);
    expect(r.phases[0].expectedA).toBeCloseTo(20 / 300);
    expect(r.phases[0].primaryFromSecondary).toBeCloseTo(19.8);
    expect(r.phases[0].source).toBe('SCADA');
  });
  it.each([
    [110, 100, 10],
    [92, 100, -8],
    [100, 100, 0],
    [20.6, 20, 3],
    [19.8, 20, -1],
  ])('procenta %s/%s', (actual, ref, p) => expect(percentDifference(actual, ref)).toBeCloseTo(p));
  it('znaménka, nula a pásma', () => {
    expect(signedPercent(10)).toBe('+10,0 %');
    expect(signedPercent(-8)).toBe('−8,0 %');
    expect(signedPercent(0)).toBe('0,0 %');
    expect(percentDifference(1, 0)).toBeNull();
    expect(workingBand(15)).toBe('success');
    expect(workingBand(-25)).toBe('intermediate');
    expect(workingBand(25.1)).toBe('warning');
  });
  it('NN/VN datově oddělené nabídky', () => {
    expect(currentOptions(false).every((c) => c.secondary === 5)).toBe(true);
    expect(currentOptions(true).every((c) => c.secondary === 1)).toBe(true);
    expect(currentOptions(true)).toHaveLength(17);
    expect(locations(false).every((v) => v.startsWith('TS '))).toBe(true);
    expect(locations(true).every((v) => v.startsWith('R'))).toBe(true);
  });
  it.each(['', '-1', 'NaN', 'Infinity', '1e999', 'text'])(
    'neplatná hodnota %s zachová vstup',
    (raw) => {
      const d = draft();
      d.phases[0].raw = raw;
      const before = structuredClone(d);
      expect(() => evaluateCurrent(d)).toThrow();
      expect(d).toEqual(before);
    },
  );
  it('neplatný MTP, rozsah, jednotka a překročený rozsah', () => {
    const d = draft();
    d.ctPrimary = 0;
    expect(() => evaluateCurrent(d)).toThrow();
    expect(() => convertClamp('1', 'mV', 'bad' as never)).toThrow();
    expect(() => convertClamp('1', 'bad' as never, '2 A')).toThrow();
    expect(() => convertClamp('201', 'mV', '200 mA')).toThrow();
    d.ctPrimary = 300;
    d.vn = true;
    expect(() => evaluateCurrent(d)).toThrow();
  });
  it('nulová reference dává neurčená procenta bez Infinity', () => {
    const d = draft();
    d.phases[0].primary = '0';
    expect(evaluateCurrent(d).phases[0].differencePercent).toBeNull();
  });
  it('napětí je skutečně volitelné, změna výchozího sekundáru se uloží', () => {
    const d = draft();
    expect(evaluateCurrent(d).voltage).toBeUndefined();
    d.voltageEnabled = true;
    expect(() => evaluateCurrent(d)).toThrow();
    d.voltage.primary = ['400', '400', '400'];
    d.voltage.secondary[0] = '103,7';
    d.voltage.secondaryEdited[0] = true;
    const v = evaluateCurrent(d).voltage!;
    expect(v.secondary[0]).toBe(103.7);
    expect(v.input.secondaryEdited).toEqual([true, false, false]);
    expect(v.diagnosis).toContain('nelze');
  });
  it('VN kV převádí na V a zachová SCADA původ', () => {
    const d = draft();
    d.vn = true;
    d.identification.location = 'R202';
    d.voltageEnabled = true;
    d.voltage.primary = ['10.3', '10.3', '10.3'];
    d.voltage.preset = '10.3';
    const v = evaluateCurrent(d).voltage!;
    expect(v.primary).toEqual([10300, 10300, 10300]);
    expect(v.source).toBe('SCADA');
    expect(
      backupTSV([evaluateCurrent(d)])
        .split('\n')[0]
        .split('\t')[2],
    ).toBe('Rozvodna');
  });
  it('napětí nehádá při podobnosti; rozliší přesvědčivou záměnu', () => {
    expect(diagnoseVoltage([400, 401, 400], [100, 100, 100])).toContain('nelze');
    expect(diagnoseVoltage([360, 400, 440], [110, 90, 100])).toContain('UL1-L2 ← UL1-L3');
    expect(diagnoseVoltage([360, 400, 440], [90, 100, 140])).toContain('nelze');
  });
  it('TSV, sdílení a smíšená záloha zachovají číslo i samostatné buňky', () => {
    const r = evaluateCurrent(draft());
    const cells = toTSV([r]).split('\t');
    expect(cells.slice(2, 6)).toEqual(['TS 3308/250', '8L', '00AB01', '300/5 A']);
    expect(emailBody([r])).toBe(toTSV([r]));
    const lines = backupTSV([r, createRecord(reference)]).split('\n');
    expect(lines).toHaveLength(3);
    expect(new Set(lines.map((l) => l.split('\t').length)).size).toBe(1);
  });
});
