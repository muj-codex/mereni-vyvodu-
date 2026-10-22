import { describe, it, expect } from 'vitest';
import {
  directComparison,
  diagnose,
  generateScenarios,
  PERMUTATIONS,
  SHORT_STATES,
  inspectionInstructions,
} from '../src/core/diagnosis';
import { branchPower, currentAngle, equivalentPhaseVoltage } from '../src/core/physics';
import { PHASE_COLORS, phaseColor, SHORT_COLOR, CONFIG } from '../src/core/config';
import { compareEnergy, mtpCorrection } from '../src/core/energy';
import { emptyDraft, readDraft, createRecord, saveAndReset } from '../src/core/measurement';
import { parseNumber, localTimestamp } from '../src/core/numbers';
import { EXPORT_COLUMNS, toTSV, emailBody, mailtoLink } from '../src/data/export';
import type { MeasurementInput } from '../src/core/types';
export const reference: MeasurementInput = {
  serial: '0012345678',
  config: emptyDraft().config,
  phases: [
    { u: 506, i: 15.2, pf: 0.866, p: 3.7 },
    { u: 506.6, i: 9.2, pf: 0.844, p: 2.2 },
    { u: 506.5, i: 12.9, pf: 0.979, p: 3.5 },
  ],
  kyoritsu: 9.2,
  energis: 9.17,
};
export const referenceDraft = () => ({
  ...emptyDraft(),
  serial: reference.serial,
  phases: reference.phases.map((p) =>
    Object.fromEntries(Object.entries(p).map(([k, v]) => [k, String(v)])),
  ) as ReturnType<typeof emptyDraft>['phases'],
  kyoritsu: '9,2',
  energis: '9,17',
});
describe('Přímé porovnání', () => {
  it('reálná data jsou v pořádku bez variant', () => {
    const r = diagnose(reference);
    expect(r.status).toBe('ok');
    expect(r.differencePercent).toBeCloseTo(-0.3260869);
    expect(r.scenarios).toEqual([]);
    expect(r.best).toBeUndefined();
  });
  it.each([8.5, 11.5])('zahrnuje hranici ±15 %% (%s)', (n) =>
    expect(directComparison(10, n).status).toBe('ok'),
  );
  it.each([8.4999, 11.5001])('mimo hranici (%s)', (n) =>
    expect(directComparison(10, n).status).toBe('outside'),
  );
  it('používá podepsanou referenci podle Promptu 1', () =>
    expect(directComparison(-10, -11).differencePercent).toBe(10));
  it.each([0, 0.00001, -0.00001])('bezpečná nula %s', (n) =>
    expect(directComparison(n, 1).status).toBe('near-zero'),
  );
  it('odmítá NaN', () => expect(() => directComparison(NaN, 1)).toThrow());
});
describe('Fázory a 48 scénářů', () => {
  it('6 unikátních permutací a 8 unikátních masek', () => {
    expect(new Set(PERMUTATIONS.map(String)).size).toBe(6);
    expect(new Set(SHORT_STATES.map(String)).size).toBe(8);
  });
  it('všech 48 unikátních kombinací', () => {
    const s = generateScenarios(reference);
    expect(s).toHaveLength(48);
    expect(new Set(s.map((x) => x.id)).size).toBe(48);
    expect(s.every((x) => x.power !== null)).toBe(true);
  });
  it('správné přiřazení rekonstruuje jednotlivé skutečné výkony', () => {
    expect(generateScenarios(reference).find((s) => s.id === '0-0')!.power).toBeCloseTo(9.4);
  });
  it('vyzkratování je nula, ne obrácený výkon ani třetina', () => {
    expect(generateScenarios(reference).find((s) => s.id === '0-2')!.power).toBeCloseTo(7.2);
    expect(
      generateScenarios(reference)
        .filter((s) => s.shorted.every(Boolean))
        .every((s) => s.power === 0),
    ).toBe(true);
  });
  it('kombinovaná chyba I3 / zkrat I2 / I1', () => {
    const s = generateScenarios(reference).find(
      (s) => s.permutation.join() === '2,1,0' && s.shorted.join() === 'false,true,false',
    )!;
    const expected =
      branchPower(equivalentPhaseVoltage(reference.phases[0]), 0, 2, reference.phases[2])! +
      branchPower(equivalentPhaseVoltage(reference.phases[2]), 2, 0, reference.phases[0])!;
    expect(s.power).toBeCloseTo(expected);
    expect(s.power).not.toBeCloseTo(7.2);
  });
  it('odvozuje napětí z P/I/|PF|, nikoli přímo z 506 V', () => {
    expect(equivalentPhaseVoltage(reference.phases[0])).toBeCloseTo(281.0867, 3);
  });
  it('přeházení respektuje ±120°', () => {
    const p = { u: 400, i: 10, pf: 1, p: 2.3 };
    expect(branchPower(230, 0, 1, p)).toBeCloseTo(-1.15);
  });
  it('PF bez + je lagging, záporné je leading', () => {
    expect(parseNumber('0,866')).toBe(parseNumber('+0,866'));
    expect(currentAngle({ ...reference.phases[0], pf: 0.866 }, 0)).toBeLessThan(0);
    expect(currentAngle({ ...reference.phases[0], pf: -0.866 }, 0)).toBeGreaterThan(0);
  });
  it('leading a lagging vedou po záměně k jiným výkonům', () => {
    const lag = branchPower(230, 1, 0, reference.phases[0]);
    const lead = branchPower(230, 1, 0, { ...reference.phases[0], pf: -0.866 });
    expect(lag).not.toBeCloseTo(lead!);
  });
  it('znaménko P je nezávislé na PF', () => {
    const p = reference.phases[0];
    expect(branchPower(equivalentPhaseVoltage(p), 0, 0, { ...p, p: -p.p, pf: -p.pf })).toBeCloseTo(
      -p.p,
    );
  });
  it('podporuje budoucí skutečný úhel', () =>
    expect(currentAngle({ ...reference.phases[0], currentAngleDegrees: 42 }, 0)).toBe(42));
  it.each([
    { i: 0, pf: 0.8, p: 0 },
    { i: 2, pf: 0, p: 0 },
    { i: 2, pf: 2, p: 1 },
    { i: NaN, pf: 0.8, p: 1 },
  ])('neodhaduje chybějící ekvivalentní napětí %j', (p) =>
    expect(equivalentPhaseVoltage({ u: 400, ...p })).toBeNull(),
  );
  it('při chybějícím napětí nevybere variantu z neúplného pořadí', () => {
    const r = diagnose({
      ...reference,
      energis: 5,
      phases: [{ u: 506, i: 0, pf: 0, p: 0 }, reference.phases[1], reference.phases[2]],
    });
    expect(r.best).toBeUndefined();
    expect(r.warnings.length).toBeGreaterThan(0);
  });
  it('seřazení a nejvýše jedna blízká alternativa', () => {
    const r = diagnose({ ...reference, energis: 5 });
    expect(r.scenarios).toHaveLength(48);
    const errors = r.scenarios.map((s) => s.error!);
    expect(errors).toEqual([...errors].sort((a, b) => a - b));
    if (r.alternative)
      expect(r.best!.score! - r.alternative.score!).toBeLessThanOrEqual(
        CONFIG.alternativeMaxScoreGap,
      );
  });
  it('vzdálená druhá varianta se nezobrazuje', () => {
    let found = false;
    for (let e = -15; e < 15; e += 0.05) {
      const r = diagnose({ ...reference, energis: e });
      if (r.best && r.best.score! - r.scenarios[1].score! > CONFIG.alternativeMaxScoreGap) {
        expect(r.alternative).toBeUndefined();
        found = true;
        break;
      }
    }
    expect(found).toBe(true);
  });
  it('Energis neprokazuje konkrétní chybu zapojení', () => {
    const r = diagnose({ ...reference, energis: 0 });
    expect(inspectionInstructions(r).join(' ')).toContain('nelze jednoznačně určit');
    expect(inspectionInstructions(r).join(' ')).toContain('souběžnost');
  });
});
describe('C1 fyzické barvy', () => {
  it('červená, zelená, žlutá a šedá jsou pevné identity', () => {
    expect(PHASE_COLORS).toEqual(['#cf343c', '#21834a', '#f2c94c']);
    expect(phaseColor(null)).toBe(SHORT_COLOR);
  });
  it('platí pro každou větev všech 48 scénářů', () => {
    for (const s of generateScenarios(reference)) {
      s.permutation.forEach((source, target) => {
        expect(phaseColor(target as 0 | 1 | 2)).toBe(PHASE_COLORS[target]);
        expect(phaseColor(s.shorted[source] ? null : source)).toBe(
          s.shorted[source] ? SHORT_COLOR : PHASE_COLORS[source],
        );
      });
    }
  });
});
describe('Stavy a korekce MTP', () => {
  const interval = {
    from: '2026-10-17T08:00',
    to: '2026-10-17T08:15',
    start: 100,
    end: 110,
    energis: 20,
  };
  it('samostatná korekce převodu', () => expect(mtpCorrection(200, 100)).toBe(2));
  it('čtvrthodinový interval a korekce spotřeby', () => {
    const r = compareEnergy(interval, { ...reference.config, actualMtp: 200 });
    expect(r.registerDelta).toBe(10);
    expect(r.meterEnergy).toBe(20);
    expect(r.percent).toBe(0);
  });
  it('správné rozdíly', () => {
    const r = compareEnergy({ ...interval, energis: 9 }, reference.config);
    expect(r.difference).toBe(-1);
    expect(r.percent).toBe(-10);
  });
  it('nulová spotřeba nedělí nulou', () =>
    expect(compareEnergy({ ...interval, end: 100 }, reference.config).percent).toBeNull());
  it('kontrola stavů odmítá špatný interval a pokles registru', () => {
    expect(() => compareEnergy({ ...interval, to: interval.from }, reference.config)).toThrow();
    expect(() => compareEnergy({ ...interval, end: 90 }, reference.config)).toThrow();
  });
  it('staré pulse hodnoty nemají vliv na porovnání', () => {
    expect(compareEnergy(interval, reference.config)).toEqual(
      compareEnergy(interval, {
        ...reference.config,
        meterPulse: 999,
        energisPulse: 'X',
      } as typeof reference.config),
    );
  });
});
describe('Data, čas, reset a export', () => {
  it('číslo elektroměru je textové včetně písmen a počátečních nul', () =>
    expect(readDraft({ ...referenceDraft(), serial: '000AB12' }).serial).toBe('000AB12'));
  it('počáteční nuly výrobního čísla', () =>
    expect(readDraft(referenceDraft()).serial).toBe('0012345678'));
  it.each(['', '   '])('odmítá výrobní číslo %s', (serial) =>
    expect(() => readDraft({ ...referenceDraft(), serial })).toThrow(),
  );
  it('timestamp na sekundy je uložen při vytvoření', () => {
    const d = new Date(2026, 9, 17, 8, 14, 37);
    expect(localTimestamp(d)).toBe('17.10.2026 08:14:37');
    expect(createRecord(reference, d).localTimestamp).toBe('17.10.2026 08:14:37');
  });
  it('kopie vstupu je nezávislá', () => {
    const input = structuredClone(reference);
    const r = createRecord(input);
    input.phases[0].p = 100;
    expect(r.input.phases[0].p).toBe(3.7);
  });
  it('po úspěšném uložení vyčistí celé měření, zachová konfiguraci', async () => {
    const draft = referenceDraft();
    draft.config.actualMtp = 300;
    draft.intervalEnabled = true;
    draft.interval = {
      from: '2026-10-17T08:00',
      to: '2026-10-17T08:15',
      start: '10',
      end: '20',
      energis: '30',
    };
    let saved;
    const result = await saveAndReset(draft, async (r) => {
      saved = r;
    });
    expect(saved).toBeDefined();
    expect(result.nextDraft.serial).toBe(draft.serial);
    expect(result.nextDraft.identification).toEqual(draft.identification);
    expect(result.nextDraft.config).toEqual(draft.config);
    expect(result.nextDraft.phases).toEqual(emptyDraft().phases);
    expect(result.nextDraft.interval).toEqual({
      from: '2026-10-17T',
      to: '2026-10-17T',
      start: '',
      end: '',
      energis: '',
    });
    expect(result.record.input.serial).toBe(reference.serial);
  });
  it('při selhání úložiště neresetuje', async () => {
    const draft = referenceDraft();
    await expect(
      saveAndReset(draft, async () => {
        throw Error('full');
      }),
    ).rejects.toThrow('full');
    expect(draft.serial).toBe(reference.serial);
  });
  it('TSV jeden záznam, 22 skutečných tabulátorových sloupců', () => {
    const r = createRecord(reference);
    const t = toTSV([r]);
    expect(t.split('\t')).toHaveLength(22);
    expect(t.split('\t')[4]).toBe('0012345678');
    expect(t.split('\t')[6]).toBe('506');
    expect(t.split('\t')[18]).toBe('9,2');
  });
  it('TSV více řádků a centrální pořadí', () => {
    expect(EXPORT_COLUMNS).toHaveLength(22);
    expect(
      toTSV([createRecord(reference), createRecord({ ...reference, serial: '0002' })]).split('\n'),
    ).toHaveLength(2);
  });
  it('e-mail ani TSV neexportují diagnostiku a mailto nemá příjemce', () => {
    const r = createRecord({ ...reference, energis: 5 });
    r.diagnosis.warnings.push('TAJNA_DIAGNOSTIKA');
    for (const text of [toTSV([r]), emailBody([r])]) {
      expect(text).not.toMatch(/TAJNA_DIAGNOSTIKA|scenarios|shoda|prověřit|diagnó|modelVersion/i);
    }
    expect(emailBody([r, r])).toBe(toTSV([r, r]));
    expect(mailtoLink([r])).toMatch(/^mailto:\?subject=/);
  });
});

it('fyzikální funkce nepropouští nekonečné a nekladné modelové napětí', () => {
  const p = { u: 400, i: 10, pf: 0.8, p: 2 };
  expect(branchPower(Infinity, 0, 1, p)).toBeNull();
  expect(branchPower(-230, 0, 1, p)).toBeNull();
  expect(equivalentPhaseVoltage({ ...p, p: 1e308 })).toBeNull();
});
