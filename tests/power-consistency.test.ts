import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  checkPowerConsistency,
  expectedBranchPower,
  measurementIsOk,
} from '../src/core/powerConsistency';
import { diagnose } from '../src/core/diagnosis';
import { createRecord, DEFAULT_CONFIG } from '../src/core/measurement';
import { Result, Detail } from '../src/ui/components';
import { backupJSON, parseBackup } from '../src/data/backup';
import { backupTSV, emailBody } from '../src/data/export';
import { createHistory } from '../src/data/history';
import type { MeasurementInput } from '../src/core/types';
import 'fake-indexeddb/auto';
const aron = (): MeasurementInput => ({
  serial: '001',
  config: { ...DEFAULT_CONFIG, voltage: 500 },
  phases: [
    { u: 500, i: 20, pf: 0.9, p: 9 },
    { u: 500, i: 0, pf: 0, p: 0 },
    { u: 500, i: 20, pf: 0.9, p: 9 },
  ],
  kyoritsu: 18,
  energis: 18,
});
const bad = () => {
  const i = aron();
  i.phases[0] = { u: 500, i: 22, pf: 0.9, p: 2 };
  i.phases[2] = { u: 500, i: 32, pf: 0.89, p: 2 };
  i.kyoritsu = i.energis = 4;
  return i;
};
describe('independent U/I/|PF| power consistency', () => {
  it('A: correct ARON branches and total allow green', () => {
    const d = diagnose(aron());
    expect(d.powerConsistency).toMatchObject({
      status: 'consistent',
      total: { expected: 18, percent: 0 },
    });
    expect(d.powerConsistency?.branches.map((b) => b.expected)).toEqual([9, 9]);
    expect(measurementIsOk(d)).toBe(true);
  });
  it('B: 4 kW matching Energis cannot hide 24.14 kW expected power', () => {
    const d = diagnose(bad());
    expect(d.differencePercent).toBe(0);
    expect(d.powerConsistency?.status).toBe('mismatch');
    expect(d.powerConsistency?.total?.expected).toBeCloseTo(24.14, 12);
    expect(d.powerConsistency?.total?.percent).toBeCloseTo(-83.4299917);
    expect(measurementIsOk(d)).toBe(false);
    const html = renderToStaticMarkup(createElement(Result, { diagnosis: d, serial: '001' }));
    expect(html).toContain('OVĚŘIT HODNOTY KYORITSU');
    expect(html).not.toContain('MĚŘENÍ V POŘÁDKU');
    expect(html).toContain('24,14');
    expect(html).toContain('-83,43');
    expect(html).not.toContain('result-banner success');
    expect(html).not.toContain('PROVĚŘIT ZAPOJENÍ');
  });
  it('C: physical consistency and Energis mismatch stay distinct', () => {
    const d = diagnose({ ...aron(), energis: 10 });
    expect(d.powerConsistency?.status).toBe('consistent');
    expect(d.status).toBe('outside');
    expect(measurementIsOk(d)).toBe(false);
  });
  it('D: missing PF gives a neutral unavailable check without NaN', () => {
    const i = aron();
    i.phases[0].pf = NaN;
    const d = diagnose(i);
    expect(d.powerConsistency?.status).toBe('unavailable');
    expect(d.powerConsistency?.total).toBeUndefined();
    expect(
      renderToStaticMarkup(createElement(Result, { diagnosis: d, serial: '001' })),
    ).not.toMatch(/NaN|Infinity|MĚŘENÍ V POŘÁDKU/);
  });
  it.each([15, 25, 25.01, -15, -25, -25.01])(
    'tolerance boundary %s%% uses shared bands',
    (percent) => {
      const i = aron();
      i.phases[0].p *= 1 + percent / 100;
      i.phases[2].p *= 1 + percent / 100;
      i.kyoritsu = i.phases[0].p + i.phases[2].p;
      expect(checkPowerConsistency(i).status).toBe(
        Math.abs(percent) <= 15 ? 'consistent' : Math.abs(percent) <= 25 ? 'verify' : 'mismatch',
      );
    },
  );
  it('does not hide the existing branch-sum warning behind a physically acceptable total', () => {
    const i = aron();
    i.kyoritsu = i.energis = 16;
    const d = diagnose(i);
    expect(d.powerConsistency?.status).toBe('consistent');
    expect(d.warnings.length).toBeGreaterThan(0);
    expect(measurementIsOk(d)).toBe(false);
  });
  it('uses the actual voltage of each ARON branch, not nominal network voltage', () => {
    const i = aron();
    i.phases[0].u = 480;
    i.phases[0].p = 8.64;
    i.phases[2].u = 520;
    i.phases[2].p = 9.36;
    expect(checkPowerConsistency(i).status).toBe('consistent');
    expect(checkPowerConsistency(i).branches.map((b) => b.expected)).toEqual([8.64, 9.36]);
  });
  it('checks individual branches even if totals cancel their errors', () => {
    const i = aron();
    i.phases[0].p = 2;
    i.phases[2].p = 16;
    expect(checkPowerConsistency(i).total?.percent).toBe(0);
    expect(checkPowerConsistency(i).status).toBe('mismatch');
  });
  it('checks independent total as well as valid branches', () => {
    const i = aron();
    i.kyoritsu = 4;
    expect(checkPowerConsistency(i).status).toBe('mismatch');
  });
  it('ignores IL2 completely in ARON', () => {
    const i = aron();
    i.phases[1] = { u: NaN, i: NaN, pf: NaN, p: NaN };
    expect(checkPowerConsistency(i).status).toBe('consistent');
  });
  it('PF sign stays independent of active-power sign including reverse and mixed flows', () => {
    const i = aron();
    i.phases[0].pf = -0.9;
    expect(checkPowerConsistency(i).status).toBe('consistent');
    i.phases[0].p = -9;
    i.kyoritsu = 0;
    expect(checkPowerConsistency(i).status).toBe('consistent');
    i.phases[2].p = -9;
    i.kyoritsu = -18;
    expect(checkPowerConsistency(i).status).toBe('consistent');
    i.kyoritsu = 18;
    expect(checkPowerConsistency(i).status).toBe('mismatch');
  });
  it('zero references never produce infinite percentages or green for nonzero P', () => {
    const i = aron();
    i.phases[0].i = i.phases[2].i = 0;
    expect(checkPowerConsistency(i).status).toBe('mismatch');
    i.phases[0].p = i.phases[2].p = i.kyoritsu = 0;
    expect(checkPowerConsistency(i).status).toBe('consistent');
  });
  it.each([0, -1, NaN, Infinity])('rejects invalid branch voltage %s', (u) =>
    expect(expectedBranchPower({ u, i: 20, pf: 0.9, p: 9 })).toBeNull(),
  );
  it('handles PF = 0, invalid PF, negative current and overflow safely', () => {
    const p = aron().phases[0];
    expect(expectedBranchPower({ ...p, pf: 0 })).toBe(0);
    for (const invalid of [
      { ...p, pf: 1.01 },
      { ...p, i: -1 },
      { ...p, u: Number.MAX_VALUE },
    ])
      expect(expectedBranchPower(invalid)).toBeNull();
  });
  it('400 V: explicit phase voltages sum branches; symmetric line voltages divide by sqrt(3)', () => {
    const i = aron();
    i.config.voltage = 400;
    i.voltageBasis = 'phase-neutral';
    i.phases = [0, 1, 2].map(() => ({
      u: 230,
      i: 20,
      pf: 0.9,
      p: 4.14,
    })) as MeasurementInput['phases'];
    i.kyoritsu = 12.42;
    expect(checkPowerConsistency(i).status).toBe('consistent');
    i.voltageBasis = 'line-line';
    i.phases.forEach((p) => {
      p.u = 400;
      p.p = ((400 / Math.sqrt(3)) * 20 * 0.9) / 1000;
    });
    i.kyoritsu = (Math.sqrt(3) * 400 * 20 * 0.9) / 1000;
    expect(checkPowerConsistency(i).status).toBe('consistent');
    delete i.voltageBasis;
    expect(checkPowerConsistency(i).status).toBe('unavailable');
  });
  it('saves physical results through IndexedDB and JSON; old records still open', async () => {
    const repo = createHistory('power-test-' + crypto.randomUUID());
    const r = createRecord(bad());
    await repo.add(r);
    const saved = (await repo.all())[0];
    expect(saved).toEqual(r);
    expect(parseBackup(backupJSON([r]))).toEqual([r]);
    const old = structuredClone(r);
    delete old.diagnosis.powerConsistency;
    expect(parseBackup(backupJSON([old]))).toEqual([old]);
    expect(renderToStaticMarkup(createElement(Detail, { record: old }))).toBeTruthy();
    expect(renderToStaticMarkup(createElement(Detail, { record: r }))).toContain('24,14');
    await repo.close();
  });
  it('exports expected, entered, status and two-decimal percentages', () => {
    const r = createRecord(bad());
    expect(backupTSV([r])).toContain('Kyoritsu vypočteno z U/I/PF');
    expect(emailBody([r])).toContain('24,14\t4\t-83,43 %');
    expect(emailBody([r])).toContain('významný nesoulad');
  });
});
