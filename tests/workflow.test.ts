import { describe, expect, it } from 'vitest';
import {
  emptyDraft,
  followingPowerDraft,
  resetInterval,
  saveAndReset,
} from '../src/core/measurement';
import { emptyCurrent, resetCurrentDraft } from '../src/core/current';
import { createIntervalCheck } from '../src/core/intervalCheck';
import { intervalSubject, mailtoLink, toTSV } from '../src/data/export';
function base() {
  const d = emptyDraft();
  d.serial = '66666777';
  d.identification = {
    date: '2026-10-22',
    location: 'TS 3308/250',
    placement: '25',
    networkVoltage: 500,
  };
  d.config = { ...d.config, voltage: 500, actualMtp: 300, meterMtp: 600 };
  d.intervalEnabled = true;
  d.interval = {
    from: '2026-10-22T09:45',
    to: '2026-10-25T11:15',
    start: '100',
    end: '120',
    energis: '10',
  };
  d.phases = d.phases.map(() => ({ u: '500', i: '10', pf: '0.866', p: '2' })) as typeof d.phases;
  d.kyoritsu = '4';
  d.energis = '3.9';
  return d;
}
describe('1.2.3 workflow', () => {
  it('defaults carry ON, carries only header/config and deep copies them', () => {
    const d = base(),
      n = followingPowerDraft(d);
    expect(emptyDraft().carryIdentification).toBe(true);
    expect(n.serial).toBe(d.serial);
    expect(n.identification).toEqual(d.identification);
    expect(n.config).toEqual(d.config);
    expect(n.phases).toEqual(emptyDraft().phases);
    expect(n.interval).toEqual(emptyDraft().interval);
    expect(n.intervalEnabled).toBe(false);
    expect(n.kyoritsu).toBe('');
    expect(n.energis).toBe('');
    n.identification!.placement = 'other';
    n.config.actualMtp = 999;
    expect(d.identification!.placement).toBe('25');
    expect(d.config.actualMtp).toBe(300);
  });
  it('OFF copies neither identification nor configuration', () => {
    const d = base();
    d.carryIdentification = false;
    expect(followingPowerDraft(d)).toEqual({ ...emptyDraft(), carryIdentification: false });
  });
  it('accepts combined date/time spanning multiple days without changing history format', () => {
    const r = createIntervalCheck(base());
    expect(r.input.interval.from).toBe('2026-10-22T09:45');
    expect(r.input.interval.to).toBe('2026-10-25T11:15');
    expect(toTSV([r])).toContain('2026-10-25T11:15');
    expect(r.result.meterEnergy).toBe(10);
  });
  it('rejects reversed dates and incomplete date/time', () => {
    const d = base();
    d.interval.to = '2026-10-21T11:15';
    expect(() => createIntervalCheck(d)).toThrow(/DO/);
    d.interval.to = '2026-10-25T';
    expect(() => createIntervalCheck(d)).toThrow(/DO/);
  });
  it('preserves dates but resets times, registers and Energis', () => {
    expect(resetInterval(base().interval)).toEqual({
      from: '2026-10-22T',
      to: '2026-10-25T',
      start: '',
      end: '',
      energis: '',
    });
    expect(resetInterval(emptyDraft().interval)).toEqual(emptyDraft().interval);
  });
  it.each([true, false])(
    'successful 3f save retains header/config and checkbox %s',
    async (carry) => {
      const d = base();
      d.carryIdentification = carry;
      const snapshot = structuredClone(d);
      let saved: unknown;
      const { nextDraft, record } = await saveAndReset(d, async (r) => {
        saved = structuredClone(r);
      });
      expect(saved).toEqual(record);
      expect(nextDraft.serial).toBe(d.serial);
      expect(nextDraft.identification).toEqual(d.identification);
      expect(nextDraft.config).toEqual(d.config);
      expect(nextDraft.carryIdentification).toBe(carry);
      expect(nextDraft.phases).toEqual(emptyDraft().phases);
      expect(nextDraft.energis).toBe('');
      expect(nextDraft.kyoritsu).toBe('');
      expect(d).toEqual(snapshot);
      expect(record.originalDraft).toEqual(snapshot);
    },
  );
  it('a rejected save leaves every original input intact', async () => {
    const d = base(),
      snapshot = structuredClone(d);
    await expect(
      saveAndReset(d, async () => {
        throw Error('quota');
      }),
    ).rejects.toThrow('quota');
    expect(d).toEqual(snapshot);
  });
  it('validation failure never writes or clears inputs', async () => {
    const d = base();
    d.phases[0].pf = '9';
    const snapshot = structuredClone(d);
    let wrote = false;
    await expect(
      saveAndReset(d, async () => {
        wrote = true;
      }),
    ).rejects.toThrow();
    expect(wrote).toBe(false);
    expect(d).toEqual(snapshot);
  });
  it.each([false, true])('1f reset preserves configuration and clears readings, VN=%s', (vn) => {
    const d = emptyCurrent(vn);
    d.serial = '12345';
    d.ctPrimary = 408;
    d.range = '20 A';
    d.voltageEnabled = true;
    d.phases[0] = { primary: '30', raw: '50', unit: 'V' };
    d.voltage.primary = ['10', '10', '10'];
    d.voltage.secondary = ['99', '98', '97'];
    const n = resetCurrentDraft(d);
    expect(n.serial).toBe('12345');
    expect(n.identification).toEqual(d.identification);
    expect(n.ctPrimary).toBe(408);
    expect(n.range).toBe('20 A');
    expect(n.voltageEnabled).toBe(true);
    expect(n.phases[0]).toEqual({ primary: '', raw: '', unit: 'V' });
    expect(n.voltage.secondary).toEqual(['', '', '']);
    expect(n.voltage.primary).toEqual(vn ? ['10', '10', '10'] : ['', '', '']);
    expect(d.phases[0].raw).toBe('50');
  });
  it.each([
    ['TS 3308/250', '66666777'],
    ['R201', '12345'],
  ])('subject uses actual meter and %s', (location, serial) => {
    const d = base();
    d.serial = serial;
    d.identification!.location = location;
    const r = createIntervalCheck(d),
      subject = `Kontrola stavů – elektroměr ${serial} – ${location}`;
    expect(intervalSubject(r)).toBe(subject);
    const url = new URL(mailtoLink([r]));
    expect(url.searchParams.get('subject')).toBe(subject);
    expect(url.searchParams.get('body')).toBe(toTSV([r]));
  });
});
