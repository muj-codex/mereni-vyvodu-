import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { openDB } from 'idb';
import { formatNumber } from '../src/core/numbers';
import { emptyDraft, createRecord } from '../src/core/measurement';
import { assessEnergy, createIntervalCheck } from '../src/core/intervalCheck';
import { currentInstructions, emptyCurrent, evaluateCurrent } from '../src/core/current';
import {
  filterHistory,
  isIntervalCheck,
  recordTypeLabel,
  recordVoltage,
} from '../src/core/historyView';
import { backupTSV, emailBody, exportPercent, mailtoLink, toTSV } from '../src/data/export';
import { createHistory } from '../src/data/history';
import { History } from '../src/ui/History';
import { IntervalResult } from '../src/ui/Interval';
function draft(voltage = 400, location = 'TS 0425/259') {
  const d = emptyDraft();
  d.serial = '00042';
  d.identification = { date: '2026-10-20', location, placement: 'pole 54' };
  d.config = { ...d.config, actualMtp: 300, meterMtp: 600, voltage };
  d.interval = {
    from: '2026-10-20T08:00',
    to: '2026-10-20T09:00',
    start: '100',
    end: '120',
    energis: '10',
  };
  return d;
}
describe('Central numeric formatting', () => {
  it.each([
    [1.234567, '1,235'],
    [0.769, '0,769'],
    [0.76987654, '0,77'],
    [1, '1'],
  ])('%s → %s', (n, expected) => expect(formatNumber(n)).toBe(expected));
  it('caps even explicit precision at three decimals', () =>
    expect(formatNumber(1.234567, 10)).toBe('1,235'));
  it('exports exactly two decimals and percent sign', () =>
    expect(exportPercent(-0.3260869565)).toBe('-0,33 %'));
});
describe('Independent register checks', () => {
  it('300/600 correction and 20 kWh register produce 10 kWh', () => {
    const r = createIntervalCheck(draft());
    expect(r.result).toMatchObject({
      correction: 0.5,
      registerDelta: 20,
      meterEnergy: 10,
      difference: 0,
      percent: 0,
    });
    expect(formatNumber(r.result.correction, 3, true)).toBe('0,500');
    expect(r.assessment.summary).toBe('Spotřeba elektroměru a Energis odpovídá.');
  });
  it('works without pulses, phases or Kyoritsu and does not store or estimate them', () => {
    const d = draft();
    delete (d.config as Partial<typeof d.config>).meterPulse;
    delete (d.config as Partial<typeof d.config>).energisPulse;
    const r = createIntervalCheck(d);
    expect(Object.keys(r.input)).toEqual(['serial', 'identification', 'config', 'interval']);
    expect(JSON.stringify(r)).not.toMatch(/pulse|kyoritsu|phases|nearest|effective/i);
  });
  it('snapshots identification, config, times, input and full precision result', () => {
    const d = draft();
    d.interval.energis = '9,967391304347827';
    const r = createIntervalCheck(d, new Date('2026-10-20T10:20:30Z'));
    const snapshot = structuredClone(r);
    d.serial = '99';
    d.identification!.placement = 'changed';
    d.config.actualMtp = 408;
    d.interval.end = '999';
    expect(r).toEqual(snapshot);
    expect(r.savedAt).toBe('2026-10-20T10:20:30.000Z');
    expect(r.input.identification.time).toMatch(/\d{2}:\d{2}:\d{2}/);
    expect(r.result.percent).toBeCloseTo(-0.3260869565, 9);
  });
  it.each([
    [15, 'success'],
    [-15, 'success'],
    [15.001, 'intermediate'],
    [25, 'intermediate'],
    [-25, 'intermediate'],
    [25.001, 'warning'],
  ])('tolerance %s → %s', (p, band) => expect(assessEnergy(p as number).band).toBe(band));
  it('large differences recommend pulse settings then actual field measurement', () => {
    const a = assessEnergy(26);
    expect(a.summary).toBe('Rozdíl spotřeby elektroměru a Energis je významný.');
    expect(a.recommendations.join(' ')).toContain('nastavení váhy pulzu');
    expect(a.recommendations.join(' ')).toContain('kontrolou měření vývodu');
    expect(a.recommendations.join(' ')).not.toMatch(/zkrat|přerušen|7–9/);
  });
  it('handles zero use conservatively', () => {
    const d = draft();
    d.interval.end = '100';
    d.interval.energis = '0';
    expect(createIntervalCheck(d).assessment.band).toBe('success');
    d.interval.energis = '1';
    expect(createIntervalCheck(d).assessment.band).toBe('unknown');
  });
  it.each(['end', 'start', 'energis'] as const)(
    'rejects missing %s rather than saving partial input',
    (key) => {
      const d = draft();
      d.interval[key] = '';
      expect(() => createIntervalCheck(d)).toThrow();
    },
  );
  it('three history tabs return distinct meaningful content', () => {
    const record = createIntervalCheck(draft());
    const tabs = ['result', 'inspection', 'detail'].map((section) =>
      renderToStaticMarkup(createElement(IntervalResult, { record, section })),
    );
    expect(new Set(tabs).size).toBe(3);
    expect(tabs[0]).toContain('Spotřeba elektroměru po korekci');
    expect(tabs[1]).not.toContain('Stav elektroměru OD');
    expect(tabs[2]).toContain('Stav elektroměru OD');
  });
  it('TSV and email contain cells, separate identity, two decimal percent and no raw floats', () => {
    const d = draft();
    d.interval.energis = '9.967391304347827';
    const r = createIntervalCheck(d);
    const text = toTSV([r]);
    expect(text).toContain('\tTS 0425/259\tpole 54\t00042\t');
    expect(text).toContain('-0,33 %');
    expect(text).not.toMatch(/(?:^|[\t\n])[-+]?\d+[.,]\d{4}/);
    expect(emailBody([r])).toBe(text);
    const url = new URL(mailtoLink([r]));
    expect(url.searchParams.get('body')).toBe(text);
    expect([...url.searchParams.keys()]).toEqual(['subject', 'body']);
    expect(text.split('\t')).toHaveLength(21);
  });
});
describe('Current diagnosis and history', () => {
  it('1f good branches never mention Energis, including ARON', () => {
    const d = emptyCurrent();
    d.serial = '0001';
    d.networkVoltage = 500;
    d.phases = d.phases.map(() => ({ primary: '30', raw: '50', unit: 'mV' })) as typeof d.phases;
    const r = evaluateCurrent(d);
    expect(currentInstructions(r).join(' ')).not.toMatch(/Energis|4–6|IL2/);
    d.phases[2].raw = '0';
    expect(currentInstructions(evaluateCurrent(d)).join(' ')).toContain('7–9');
  });
  const records = [
    createIntervalCheck(draft()),
    createIntervalCheck(draft(500)),
    createIntervalCheck(draft(10300, 'R201')),
    createIntervalCheck(draft(10300, 'R202')),
  ];
  it.each([
    ['TS 0425/259', '', 2],
    ['R201', '', 1],
    ['', '400', 1],
    ['', '500', 1],
    ['', '10300', 2],
    ['R201', '10300', 1],
    ['TS 0425/259', '500', 1],
    ['', '', 4],
  ])('filters %s + %s = %s', (location, voltage, count) => {
    const before = structuredClone(records);
    expect(filterHistory(records, location as string, voltage as string)).toHaveLength(
      count as number,
    );
    expect(records).toEqual(before);
  });
  it('legacy records without discriminator or identification remain readable', () => {
    const r = createRecord({
      serial: '000old',
      config: emptyDraft().config,
      phases: [0, 1, 2].map(() => ({ u: 230, i: 1, pf: 1, p: 0.23 })) as any,
      kyoritsu: 0.69,
      energis: 0.7,
    });
    expect(isIntervalCheck(r)).toBe(false);
    expect(recordTypeLabel(r)).toBe('3f měření');
    expect(recordVoltage(r)).toBe(400);
    expect(filterHistory([r])).toEqual([r]);
    expect(toTSV([r])).toContain('000old');
    const lines = backupTSV([r, records[0]])
      .split('\n')
      .map((line) => line.split('\t'));
    expect(lines.every((line) => line.length === lines[0].length)).toBe(true);
  });
  it('existing v1 pulse data survive adding a new independent check and reopening sorted', async () => {
    const name = crypto.randomUUID();
    const old = {
      ...records[0],
      id: 'legacy',
      savedAt: '2026-10-19T08:00:00Z',
      legacyPulse: { meterPulse: 0.1, energisPulse: 'X' },
    };
    const db = await openDB(name, 1, {
      upgrade(db) {
        const s = db.createObjectStore('measurements', { keyPath: 'id' });
        s.createIndex('by-time', 'savedAt');
      },
    });
    await db.add('measurements', old);
    db.close();
    const repo = createHistory(name);
    const newer = createIntervalCheck(draft(), new Date('2026-10-20T08:00:00Z'));
    await repo.add(newer);
    await repo.close();
    const reopened = createHistory(name);
    expect(await reopened.all()).toEqual([newer, old]);
    await reopened.close();
  });
});

it('3f and 1f exports round PF, raw inputs and every percent without changing stored precision', () => {
  const power = createRecord({
    serial: '0003f',
    config: emptyDraft().config,
    phases: [0, 1, 2].map(() => ({
      u: 230.1234567,
      i: 1.234567,
      pf: 0.76987654,
      p: 0.23456789,
    })) as any,
    kyoritsu: 9.2,
    energis: 9.17,
  });
  const current = emptyCurrent();
  current.serial = '0001f';
  current.phases = current.phases.map(() => ({
    primary: '30.1234567',
    raw: '50.1234567',
    unit: 'mV',
  })) as typeof current.phases;
  const measured = evaluateCurrent(current);
  for (const text of [toTSV([power]), emailBody([measured]), backupTSV([power, measured])]) {
    expect(text).not.toMatch(/(?:^|[\t\n])[-+]?\d+[.,]\d{4}/);
    for (const cell of text.split(/[\t\n]/).filter((v) => v.endsWith(' %') && /^[+-]?\d/.test(v)))
      expect(cell).toMatch(/^[+-]?\d+,\d{2} %$/);
  }
  expect(toTSV([power])).toContain('-0,33 %');
  expect(toTSV([power])).toContain('0,77');
  expect(power.input.phases[0].pf).toBe(0.76987654);
  expect(measured.phases[0].raw).toBe('50.1234567');
});

describe('1.2.4 actual interval presentation', () => {
  const historyMarkup = (records: import('../src/core/types').HistoryRecord[]) =>
    renderToStaticMarkup(
      createElement(History, {
        records,
        loading: false,
        onDelete: async () => {},
        onClear: async () => {},
        onImport: async () => ({ added: 0, existing: 0 }),
        notify: () => {},
      }),
    );
  it.each([
    ['2026-10-22T14:45', '2026-10-22T16:45', '22.10.2026 14:45 → 22.10.2026 16:45'],
    ['2026-10-22T23:45', '2026-10-23T00:30', '22.10.2026 23:45 → 23.10.2026 00:30'],
  ])('uses saved %s → %s in history, result, detail and exports', (from, to, label) => {
    const d = draft();
    d.identification!.date = '2026-10-19';
    d.interval.from = from;
    d.interval.to = to;
    const record = createIntervalCheck(d);
    expect(historyMarkup([record])).toContain(`Interval: ${label}`);
    expect(historyMarkup([record])).not.toContain('2026-10-19');
    for (const section of ['result', 'detail'])
      expect(renderToStaticMarkup(createElement(IntervalResult, { record, section }))).toContain(
        `Interval: ${label}`,
      );
    for (const text of [toTSV([record]), emailBody([record]), backupTSV([record])]) {
      expect(text).toContain(from);
      expect(text).toContain(to);
      expect(text).not.toContain('2026-10-19');
    }
    expect(toTSV([record]).split('\t').slice(0, 2)).toEqual(from.split('T'));
    expect(new URL(mailtoLink([record])).searchParams.get('subject')).toBe(
      'Kontrola stavů – elektroměr 00042 – TS 0425/259',
    );
  });
  it('opens legacy combined interval fields and falls back safely when absent', () => {
    const record = createIntervalCheck(draft());
    expect(historyMarkup([record])).toContain('20.10.2026 08:00 → 20.10.2026 09:00');
    delete (record.input as Partial<typeof record.input>).interval;
    expect(historyMarkup([record])).toContain('2026-10-20');
    for (const section of ['result', 'detail'])
      expect(renderToStaticMarkup(createElement(IntervalResult, { record, section }))).toContain(
        '2026-10-20',
      );
    expect(toTSV([record])).toContain('2026-10-20');
    delete (record.input as Partial<typeof record.input>).identification;
    expect(historyMarkup([record])).toContain(record.localTimestamp);
  });
  it('preserves the original date and timestamp for 1f and 3f history and exports', () => {
    const current = emptyCurrent();
    current.serial = 'current';
    current.identification.date = '2026-10-19';
    current.phases = current.phases.map(() => ({
      primary: '30',
      raw: '50',
      unit: 'mV',
    })) as typeof current.phases;
    const power = createRecord({
      serial: 'power',
      config: emptyDraft().config,
      identification: { date: '2026-10-19', location: 'TS 3308/250', placement: '' },
      phases: [0, 1, 2].map(() => ({ u: 230, i: 1, pf: 1, p: 0.23 })) as any,
      kyoritsu: 0.69,
      energis: 0.7,
    });
    for (const record of [evaluateCurrent(current), power]) {
      const markup = historyMarkup([record]);
      expect(markup).toContain('Datum měření: 2026-10-19');
      expect(markup).toContain(record.localTimestamp);
      expect(toTSV([record]).split('\t')[0]).toBe('2026-10-19');
    }
  });
});
