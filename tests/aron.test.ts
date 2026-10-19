import { isCurrent } from '../src/data/export';
import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { aronBranchPower, generateAronScenarios } from '../src/core/aron';
import { diagnose, generateScenarios, inspectionInstructions } from '../src/core/diagnosis';
import { CONFIG, VOLTAGE_ANGLES } from '../src/core/config';
import { createRecord, emptyDraft, readDraft } from '../src/core/measurement';
import type { MeasurementInput, Triple, PhaseReading } from '../src/core/types';
import { AronMapping, Result, scenarioLabel } from '../src/ui/components';
import { MtpCoefficient } from '../src/ui/MtpCoefficient';
import { toTSV, emailBody } from '../src/data/export';
import { createHistory } from '../src/data/history';

function balanced(pf = 0.8): MeasurementInput {
  const v = 500 / Math.sqrt(3),
    p = (v * 10 * Math.abs(pf)) / 1000;
  return {
    serial: '000500',
    config: { ...emptyDraft().config, voltage: 500 },
    phases: [0, 1, 2].map(() => ({ u: 500, i: 10, pf, p })) as Triple<PhaseReading>,
    kyoritsu: 3 * p,
    energis: 3 * p,
  };
}
function scenario(input: MeasurementInput, id = 'aron-0-0') {
  return generateAronScenarios(input).find((s) => s.id === id)!;
}

describe('Přepnutí napětím a skutečný dvouwattmetrový ARON', () => {
  it('400 V přesně zachovává původní 48 scénářů', () => {
    const input = balanced();
    input.config.voltage = 400;
    input.energis = 1;
    const result = diagnose(input);
    expect(result.mode).toBe('three-current');
    expect(result.scenarios).toEqual(generateScenarios(input));
    expect(result.scenarios).toHaveLength(48);
  });
  it('500 V automaticky vybere ARON a pouze 8 variant přiřazení/polarit', () => {
    const result = diagnose({ ...balanced(), energis: 1 });
    expect(result.mode).toBe('aron');
    expect(result.scenarios).toHaveLength(8);
    expect(new Set(result.scenarios.map((s) => s.id)).size).toBe(8);
    expect(
      result.scenarios.every(
        (s) => s.kind === 'aron' && !('shorted' in s) && !('permutation' in s),
      ),
    ).toBe(true);
  });
  it('správné větve dávají známé analytické wattmetrové hodnoty při PF 0,8', () => {
    const input = balanced(),
      s = scenario(input);
    // Independent line-voltage formula: W1=Ull I cos(30°+phi), W3=Ull I cos(30°-phi).
    const w1 = 5 * ((Math.sqrt(3) / 2) * 0.8 - 0.5 * 0.6),
      w3 = 5 * ((Math.sqrt(3) / 2) * 0.8 + 0.5 * 0.6);
    expect(s.branchPowers[0]).toBeCloseTo(w1, 10);
    expect(s.branchPowers[1]).toBeCloseTo(w3, 10);
    expect(s.power).toBeCloseTo(input.kyoritsu, 10);
    expect(s.power).not.toBeCloseTo(input.phases[0].p + input.phases[2].p);
  });
  it('leading zamění známé wattmetrové příspěvky, celkový výkon zůstává správný', () => {
    const lag = scenario(balanced(0.8)),
      lead = scenario(balanced(-0.8));
    expect(lead.branchPowers[0]).toBeCloseTo(lag.branchPowers[1]!);
    expect(lead.branchPowers[1]).toBeCloseTo(lag.branchPowers[0]!);
    expect(lead.power).toBeCloseTo(lag.power!);
  });
  it('nesymetrické zatížení se třemi nenulovými proudy: součet ARON = všechna P', () => {
    // Independent complex currents, obeying Kirchhoff: (8,-6)+(-6,-3)+(-2,9)=0.
    const currents = [
      [8, -6],
      [-6, -3],
      [-2, 9],
    ];
    const input = balanced();
    input.phases = currents.map(([real, imag], index) => {
      const angle = (VOLTAGE_ANGLES[index] * Math.PI) / 180;
      const i = Math.hypot(real, imag),
        p = (230 * (Math.cos(angle) * real + Math.sin(angle) * imag)) / 1000;
      const delta = Math.atan2(
        Math.sin(angle - Math.atan2(imag, real)),
        Math.cos(angle - Math.atan2(imag, real)),
      );
      return { u: Math.sqrt(3) * 230, i, p, pf: Math.abs(Math.cos(delta)) * (delta < 0 ? -1 : 1) };
    }) as Triple<PhaseReading>;
    input.kyoritsu = input.phases.reduce((sum, p) => sum + p.p, 0);
    expect(scenario(input).power).toBeCloseTo(input.kyoritsu, 10);
    expect(input.phases[1].i).toBeCloseTo(Math.sqrt(45));
  });
  it('V2 se skutečně účastní obou rozdílových napěťových vazeb', () => {
    const input = balanced(),
      before = scenario(input);
    input.phases[1].p *= 1.1;
    const after = scenario(input);
    expect(after.branchPowers[0]).not.toBeCloseTo(before.branchPowers[0]!);
    expect(after.branchPowers[1]).not.toBeCloseTo(before.branchPowers[1]!);
  });
  it.each([
    ['aron-0-1', true, false],
    ['aron-0-2', false, true],
    ['aron-0-3', true, true],
  ] as const)('polarita %s obrací pouze odpovídající wattmetrový člen', (id, rev1, rev3) => {
    const input = balanced(),
      normal = scenario(input),
      s = scenario(input, id);
    expect(s.branchPowers[0]).toBeCloseTo(normal.branchPowers[0]! * (rev1 ? -1 : 1));
    expect(s.branchPowers[1]).toBeCloseTo(normal.branchPowers[1]! * (rev3 ? -1 : 1));
    expect(s.power).toBeCloseTo(s.branchPowers[0]! + s.branchPowers[1]!);
  });
  it('záměna L1/L3 je samostatná varianta i se všemi polaritami', () => {
    const input = balanced();
    const swapped = generateAronScenarios(input).filter((s) => s.currents[0] === 2);
    expect(swapped).toHaveLength(4);
    expect(scenario(input, 'aron-1-0').power).toBeCloseTo(0, 10);
    expect(scenario(input, 'aron-1-0').power).not.toBeCloseTo(scenario(input).power!);
    const s = scenario(input, 'aron-1-1');
    expect(s.branchPowers[0]).toBeCloseTo(-aronBranchPower(input, 0, 2, false)!);
  });
  it('k/l u ARON dovoluje záporný součet, nikdy nemodeluje vyzkratování', () => {
    const input = balanced();
    expect(scenario(input, 'aron-0-3').power).toBeCloseTo(-input.kyoritsu);
    expect(generateAronScenarios(input).map(scenarioLabel).join(' ')).not.toMatch(/zkrat|I2/);
  });
  it('známý obrácený člen je nalezen jako nejlepší model', () => {
    const input = balanced();
    input.energis = scenario(input, 'aron-0-1').power!;
    const result = diagnose(input);
    expect(result.best?.id).toBe('aron-0-1');
    expect(result.best?.score).toBeCloseTo(100);
    expect(inspectionInstructions(result).join(' ')).toContain('obrácená polarita k/l');
    if (result.alternative)
      expect(result.best!.score! - result.alternative.score!).toBeLessThanOrEqual(
        CONFIG.alternativeMaxScoreGap,
      );
  });
  it('neurčitelný fázor společné L2 nevydává za chybějící proudovou větev', () => {
    const input = balanced();
    input.phases[1] = { u: 500, i: 0, p: 0, pf: 0 };
    input.energis = 1;
    expect(diagnose(input).best).toBeUndefined();
    expect(generateAronScenarios(input).every((s) => s.power === null)).toBe(true);
  });
  it.each([400, 500])('%s V stále používá právě ±15 %%', (voltage) => {
    const input = balanced();
    input.config.voltage = voltage;
    for (const multiplier of [0.85, 1.15])
      expect(diagnose({ ...input, energis: input.kyoritsu * multiplier }).status).toBe('ok');
    for (const multiplier of [0.849, 1.151, 1.2])
      expect(diagnose({ ...input, energis: input.kyoritsu * multiplier }).status).toBe('outside');
    expect(CONFIG.tolerancePercent).toBe(15);
  });
});
describe('ARON vzhled, informace MTP a zachování dat', () => {
  it.each([
    [100, 250, '0,400'],
    [300, 100, '3,000'],
    [100, 100, '1,000'],
  ])('informace MTP %s/%s = %s', (primary, meter, value) => {
    expect(
      renderToStaticMarkup(
        createElement(MtpCoefficient, { primary: primary as number, meter: meter as number }),
      ),
    ).toContain(`× ${value}`);
  });
  it('informační koeficient nemutuje model, data ani export a nevstupuje do skóre', () => {
    const input = balanced(),
      snapshot = structuredClone(input),
      before = diagnose(input),
      record = createRecord(input);
    const tsv = toTSV([record]),
      email = emailBody([record]);
    renderToStaticMarkup(createElement(MtpCoefficient, { primary: 100, meter: 250 }));
    expect(input).toEqual(snapshot);
    expect(diagnose(input)).toEqual(before);
    expect(toTSV([record])).toBe(tsv);
    expect(emailBody([record])).toBe(email);
    const other = { ...input, config: { ...input.config, actualMtp: 300, meterMtp: 250 } };
    expect(generateAronScenarios(other)).toEqual(generateAronScenarios(input));
    expect(generateScenarios(other)).toEqual(generateScenarios(input));
    expect(emailBody([record])).not.toMatch(/koeficient|ARON|k\/l/);
  });
  it('všech 8 vizuálních variant má pouze šedé ARON uprostřed a fyzické barvy L1/L3', () => {
    for (const s of generateAronScenarios(balanced())) {
      const html = renderToStaticMarkup(
        createElement(AronMapping, { scenario: s, title: 'ARON model' }),
      );
      expect(html).toContain('class="aron-center" data-mode="aron">ARON</span>');
      expect(html).not.toMatch(/VYZKRATOVÁNO|data-phase="[UI]2"/);
      const badges = [...html.matchAll(/background-color:([^";]+)[^"]*" data-phase="([^"]+)"/g)];
      expect(badges).toHaveLength(4);
      for (const [, color, identity] of badges)
        expect(color).toBe(identity.endsWith('1') ? '#cf343c' : '#f2c94c');
    }
  });
  it('výsledek v toleranci má také ARON bez chybových variant', () => {
    const input = balanced(),
      d = diagnose(input),
      html = renderToStaticMarkup(createElement(Result, { diagnosis: d, serial: input.serial }));
    expect(html).toContain('data-mode="aron">ARON');
    expect(html).not.toContain('DALŠÍ MOŽNÁ VARIANTA');
    expect(d.scenarios).toEqual([]);
  });
  it('starší záznamy bez mode a starší 500 V model zůstávají původním výsledkem', () => {
    const input = balanced(),
      diagnosis = diagnose({ ...input, config: { ...input.config, voltage: 400 } });
    delete diagnosis.mode;
    const html = renderToStaticMarkup(createElement(Result, { diagnosis, serial: input.serial }));
    expect(html).not.toContain('data-mode="aron"');
    expect(html).toContain('data-phase="I2"');
  });
  it('500 V zachovává všechna U/I/PF/P v uložení, po znovuotevření IndexedDB a v exportu', async () => {
    const input = balanced(),
      draft = emptyDraft(input.config);
    draft.serial = input.serial;
    draft.kyoritsu = String(input.kyoritsu);
    draft.energis = String(input.energis);
    draft.phases = input.phases.map((p) => ({
      u: String(p.u),
      i: String(p.i),
      pf: String(p.pf),
      p: String(p.p),
    })) as typeof draft.phases;
    const parsed = readDraft(draft);
    expect(parsed.phases).toEqual(input.phases);
    const record = createRecord(parsed),
      name = crypto.randomUUID(),
      store = createHistory(name);
    await store.add(record);
    await store.close();
    const reopened = createHistory(name);
    const [saved] = await reopened.all();
    if (isCurrent(saved)) throw Error('Expected power record');
    expect(saved.input.phases).toEqual(input.phases);
    expect(saved.diagnosis.mode).toBe('aron');
    const cells = toTSV([saved]).split('\t');
    expect(cells).toHaveLength(22);
    expect(cells.slice(6, 12)).toEqual(['500', '500', '500', '10', '10', '10']);
    expect(emailBody([saved])).toContain('I2 [A]: 10');
    await reopened.close();
  });
});
