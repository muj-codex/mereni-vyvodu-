import 'fake-indexeddb/auto';
import { openDB } from 'idb';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, it, expect } from 'vitest';
import {
  emptyCurrent,
  evaluateCurrent,
  currentInstructions,
  currentTerminals,
  changeClampRange,
  rangeAdvice,
  VN_VOLTAGES,
} from '../src/core/current';
import { emptyDraft, readDraft, saveAndReset } from '../src/core/measurement';
import { createHistory } from '../src/data/history';
import { emailBody, mailtoLink, toTSV } from '../src/data/export';
import { CurrentResult, CurrentMeasurement } from '../src/ui/CurrentMeasurement';
import { Result } from '../src/ui/components';
import { diagnose } from '../src/core/diagnosis';
import { parseNumber } from '../src/core/numbers';
function draft(voltage = 400) {
  const d = emptyCurrent(voltage > 500);
  d.serial = '00042';
  d.networkVoltage = voltage;
  d.identification.placement = 'pole 3L';
  d.ctPrimary = 408;
  d.phases = d.phases.map(() => ({
    primary: '40,8',
    raw: voltage > 500 ? '10' : '50',
    unit: 'mV',
  })) as typeof d.phases;
  if (voltage === 500) d.phases[1] = { primary: '', raw: '', unit: 'mV' };
  return d;
}
describe('Prompt 1.1 field regressions', () => {
  it('NN physical current terminals', () =>
    expect([0, 1, 2].map(currentTerminals)).toEqual(['1–3', '4–6', '7–9']));
  it('ARON continues without IL2 and ignores even invalid stale values', () => {
    const d = draft(500);
    const r = evaluateCurrent(d);
    expect(r.phases[1].unused).toBe(true);
    d.phases[1] = { primary: '-999', raw: 'bad', unit: 'V' };
    expect(evaluateCurrent(d).phases).toEqual(r.phases);
    expect(currentInstructions(r).join(' ')).not.toMatch(/4–6|IL2/);
  });
  it('ARON IL3 failure checks 7–9 and lists shorted circuit as a possibility', () => {
    const d = draft(500);
    d.phases[2].raw = '0';
    const r = evaluateCurrent(d);
    const text = currentInstructions(r).join(' ');
    expect(text).toContain('Prověř IL3 – proudový obvod elektroměru 7–9');
    expect(text).toContain('ponechané zkratování');
    expect(text).not.toContain('4–6');
  });
  it('500 V voltage remains available without middle secondary voltage', () => {
    const d = draft(500);
    d.voltageEnabled = true;
    d.voltage.primary = ['500', '501', '499'];
    d.voltage.secondary = ['100', '', '100'];
    const r = evaluateCurrent(d);
    expect(r.voltage?.primary).toEqual([500, 501, 499]);
    expect(r.voltage?.diagnosis).toBe(
      'Napěťové zapojení nelze z naměřených hodnot jednoznačně určit.',
    );
  });
  it.each(VN_VOLTAGES)('VN %s and fixed /1 A', (voltage) => {
    const d = draft(voltage);
    d.voltageEnabled = true;
    const v = String(voltage / 1000);
    d.voltage.preset = v;
    d.voltage.primary = [v, v, v];
    const r = evaluateCurrent(d);
    expect(r.voltage?.primary).toEqual([voltage, voltage, voltage]);
    expect(r.input.ctSecondary).toBe(1);
  });
  it.each(['custom', '22', '0'])('rejects VN preset %s', (preset) => {
    const d = draft(6300);
    d.voltageEnabled = true;
    d.voltage.preset = preset;
    expect(() => evaluateCurrent(d)).toThrow();
  });
  it.each([0, -1, NaN, Infinity])('rejects invalid custom MTP %s', (primary) => {
    const d = draft();
    d.ctPrimary = primary;
    expect(() => evaluateCurrent(d)).toThrow();
  });
  it.each([400, 6300])('408 custom MTP in %s', (voltage) => {
    const r = evaluateCurrent(draft(voltage));
    expect(r.input.ctPrimary).toBe(408);
    expect(r.input.ctSecondary).toBe(voltage > 500 ? 1 : 5);
    expect(r.phases[0].primaryFromSecondary).toBeCloseTo(40.8);
    expect(r.phases[0].differencePercent).toBeCloseTo(0);
  });
  it.each(['408,25', '408.25'])('decimal custom primary %s', (raw) => {
    const d = draft();
    d.ctPrimary = parseNumber(raw);
    expect(evaluateCurrent(d).input.ctPrimary).toBe(408.25);
  });
  it('range change clears all raw readings and retains primary', () => {
    const d = draft();
    const changed = changeClampRange(d, '20 A');
    expect(changed.phases.map((p) => p.raw)).toEqual(['', '', '']);
    expect(changed.phases[0].primary).toBe(d.phases[0].primary);
    expect(() => evaluateCurrent(changed)).toThrow();
  });
  it('predicts too-small range and overrange identifies exact phase/value', () => {
    const d = draft(500);
    d.range = '200 mA';
    expect(rangeAdvice(d).join(' ')).toContain('Pro IL1');
    expect(rangeAdvice(d).join(' ')).not.toContain('IL2');
    d.phases[0].raw = '201';
    expect(() => evaluateCurrent(d)).toThrow(/IL1.*201,0 mA/);
  });
  it('current form has descriptive labels and no duplicate identification editors', () => {
    const d = draft();
    const html = renderToStaticMarkup(
      createElement(CurrentMeasurement, {
        shared: { serial: d.serial, identification: d.identification },
        onSave: async () => {},
        notify: () => {},
      }),
    );
    for (const i of [1, 2, 3]) expect(html).toContain(`Klešťový ampérmetr L${i} (mV / V)`);
    expect(html).not.toMatch(/id="serial"|type="date"|>VN<|VLASTNÍ<\/option>/);
  });
  it('history sections have different contents', () => {
    const record = evaluateCurrent(draft(500));
    const contents = ['result', 'inspection', 'detail'].map((section) =>
      renderToStaticMarkup(createElement(CurrentResult, { record, section })),
    );
    expect(new Set(contents).size).toBe(3);
    expect(contents[0]).not.toContain('Skutečný sekundár');
    expect(contents[1]).toContain('Co prověřit');
    expect(contents[2]).toContain('Skutečný sekundár');
  });
  it('ARON 3f ignores middle current and keeps measured voltage', () => {
    const d = emptyDraft();
    d.serial = '00042';
    d.config.voltage = 500;
    d.kyoritsu = '9';
    d.energis = '4';
    d.phases = d.phases.map(() => ({ u: '500', i: '10', pf: '0,8', p: '2,3' })) as typeof d.phases;
    d.phases[1] = { u: '501', i: '', pf: '', p: '' };
    const input = readDraft(d);
    expect(input.phases[1]).toEqual({ u: 501, i: 0, pf: 0, p: 0 });
    d.phases[1] = { u: '501', i: '999', pf: 'invalid', p: '99999' };
    expect(readDraft(d)).toEqual(input);
    const html = renderToStaticMarkup(
      createElement(Result, { diagnosis: diagnose(input), serial: d.serial }),
    );
    expect(html).not.toMatch(/DALŠÍ MOŽNÁ VARIANTA|4–6/);
    expect(html).toContain('nelze jednoznačně určit');
  });
  it('identification snapshot remains independent of later changes and pulses', async () => {
    const d = draft();
    const r = evaluateCurrent(d);
    d.identification.location = 'changed';
    d.phases[0].raw = '999';
    expect(r.input.identification.location).not.toBe('changed');
    expect(r.originalDraft?.phases[0].raw).toBe('50');
    expect(r.diagnostics?.length).toBe(3);
    const power = emptyDraft();
    power.serial = '0042';
    power.kyoritsu = '1';
    power.energis = '1';
    power.phases = power.phases.map(() => ({
      u: '230',
      i: '1',
      pf: '1',
      p: '0.23',
    })) as typeof power.phases;
    const { record } = await saveAndReset(power, async () => {});
    power.identification!.placement = 'changed';
    expect(record.originalDraft?.identification?.placement).not.toBe('changed');
  });
  it('plain email body decodes to exact TSV with tabs, rows and no attachment', () => {
    const r = evaluateCurrent(draft());
    const records = [r, r];
    const url = new URL(mailtoLink(records));
    expect(url.searchParams.get('body')).toBe(toTSV(records));
    expect(emailBody(records)).toContain('\t');
    expect(emailBody(records).split('\n')).toHaveLength(2);
    expect([...url.searchParams.keys()]).toEqual(['subject', 'body']);
  });
  it('history migration includes older records missing indexed savedAt', async () => {
    const name = crypto.randomUUID();
    const old = evaluateCurrent(draft());
    delete (old as Partial<typeof old>).savedAt;
    const db = await openDB(name, 1, {
      upgrade(db) {
        const s = db.createObjectStore('measurements', { keyPath: 'id' });
        s.createIndex('by-time', 'savedAt');
      },
    });
    await db.add('measurements', old);
    db.close();
    const history = createHistory(name);
    expect(await history.all()).toEqual([old]);
    const newer = evaluateCurrent(draft(), new Date('2026-10-21T12:00:00Z'));
    await history.add(newer);
    expect(await history.all()).toHaveLength(2);
    await history.close();
    const reopened = createHistory(name);
    expect(await reopened.all()).toHaveLength(2);
    await reopened.close();
  });
});
