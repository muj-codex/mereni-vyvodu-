import { CONFIG, PHASES } from './config';
import type { Phase } from './config';
import { branchPower, equivalentPhaseVoltage } from './physics';
import { generateAronScenarios } from './aron';
import type { Diagnosis, MeasurementInput, ThreeCurrentScenario, Triple } from './types';
export const PERMUTATIONS: Triple<Phase>[] = [
  [0, 1, 2],
  [0, 2, 1],
  [1, 0, 2],
  [1, 2, 0],
  [2, 0, 1],
  [2, 1, 0],
];
// Masks address physical currents, never their voltage positions.
export const SHORT_STATES: Triple<boolean>[] = Array.from(
  { length: 8 },
  (_, mask) => PHASES.map((p) => Boolean(mask & (1 << p))) as Triple<boolean>,
);
export function directComparison(kyoritsu: number, energis: number) {
  if (![kyoritsu, energis].every(Number.isFinite)) throw new Error('Neplatný výkon.');
  if (Math.abs(kyoritsu) < CONFIG.powerEpsilonKw)
    return { status: 'near-zero' as const, differencePercent: null };
  const differencePercent = ((energis - kyoritsu) / Math.abs(kyoritsu)) * 100;
  return {
    status:
      Math.abs(differencePercent) <= CONFIG.tolerancePercent + 1e-9
        ? ('ok' as const)
        : ('outside' as const),
    differencePercent,
  };
}
export function generateScenarios(input: MeasurementInput): ThreeCurrentScenario[] {
  const voltages = input.phases.map(equivalentPhaseVoltage);
  const scale = Math.max(Math.abs(input.kyoritsu), CONFIG.powerEpsilonKw);
  return PERMUTATIONS.flatMap((permutation, permIndex) =>
    SHORT_STATES.map((shorted, mask) => {
      const issues: string[] = [];
      const contributions = PHASES.map((target) => {
        const source = permutation[target];
        if (shorted[source]) return 0;
        const value = branchPower(voltages[target], target, source, input.phases[source]);
        if (value === null)
          issues.push(
            `U${target + 1} ← I${source + 1}: nelze určit ekvivalentní napětí nebo úhel.`,
          );
        return value;
      });
      const power = contributions.some((v) => v === null)
        ? null
        : contributions.reduce<number>((sum, n) => sum + (n ?? 0), 0);
      const error = power === null ? null : Math.abs(power - input.energis);
      // A normalized closeness metric, not a statistical inference.
      const score = error === null ? null : Math.max(0, 100 * (1 - error / scale));
      return {
        id: `${permIndex}-${mask}`,
        permutation: [...permutation] as Triple<Phase>,
        shorted: [...shorted] as Triple<boolean>,
        power,
        error,
        score,
        issues,
      };
    }),
  ).sort((a, b) => (a.error ?? Infinity) - (b.error ?? Infinity) || a.id.localeCompare(b.id));
}
export function diagnose(input: MeasurementInput): Diagnosis {
  const comparison = directComparison(input.kyoritsu, input.energis);
  const warnings: string[] = [];
  const sum = input.phases.reduce((s, p) => s + p.p, 0);
  if (Math.abs(sum - input.kyoritsu) > Math.max(0.05, Math.abs(input.kyoritsu) * 0.05))
    warnings.push(
      'Součet P1–P3 se od celkového výkonu Kyoritsu liší o více než 5 % (min. 0,05 kW). Ověřte souběžnost a opis hodnot.',
    );
  if (comparison.status === 'near-zero')
    warnings.push(
      'Kyoritsu je téměř nulové. Procentní srovnání ani spolehlivý výběr varianty nelze určit.',
    );
  const mode = input.config.voltage === 500 ? 'aron' : 'three-current';
  const scenarios =
    comparison.status === 'outside'
      ? mode === 'aron'
        ? generateAronScenarios(input)
        : generateScenarios(input)
      : [];
  const incomplete = scenarios.some((s) => s.power === null);
  if (incomplete)
    warnings.push(
      'Část scénářů nelze spočítat z P/I/PF. Pořadí by bylo neúplné, proto se hlavní varianta neurčuje.',
    );
  const best = !incomplete ? scenarios[0] : undefined;
  const second = scenarios[1];
  const alternative =
    best && second && best.score! - second.score! <= CONFIG.alternativeMaxScoreGap + 1e-9
      ? second
      : undefined;
  return {
    ...comparison,
    mode,
    scenarios,
    best,
    alternative,
    warnings,
    modelVersion: CONFIG.modelVersion,
  };
}
export function inspectionInstructions(diagnosis: Diagnosis): string[] {
  if (diagnosis.status === 'ok')
    return ['ZAPOJENÍ V POŘÁDKU – podle přímého porovnání v toleranci ±15 %.'];
  if (!diagnosis.best)
    return [
      'Nejprve ověřit vstupní údaje a souběžnost odečtů. Z dostupných dat nelze určit hlavní variantu.',
    ];
  if (diagnosis.best.kind === 'aron') {
    const scenario = diagnosis.best;
    const result = scenario.currents.map((source, index) => {
      const target = index === 0 ? 1 : 3;
      const member = index === 0 ? '1–3' : '4–6';
      return `Na elektroměru prověřit člen ${member} (L${target}): proud I${source + 1}, ${scenario.reversed[index] ? 'obrácená polarita k/l' : 'souhlasná polarita k/l'}.`;
    });
    if (scenario.currents[0] === 2)
      result.unshift('Na elektroměru prověřit vzájemnou záměnu proudových větví L1 ↔ L3.');
    result.push('Napěťové vazby ARON: svorky 2–5 (L1–L2) a 8–5 (L3–L2); napěťový sekundár 100 V.');
    return result;
  }
  const best = diagnosis.best;
  const result: string[] = [];
  best.permutation.forEach((source, target) => {
    if (best.shorted[source])
      result.push(
        `Na elektroměru na L${target + 1} prověřit zapojení k/l (větev I${source + 1} v modelu nepřispívá).`,
      );
    if (source !== target)
      result.push(
        `Na elektroměru prověřit přiřazení proudových vodičů: na L${target + 1} model odpovídá proudu I${source + 1} z L${source + 1}.`,
      );
  });
  return result.length
    ? result
    : [
        'Nejbližší model má správné přiřazení. Prověřit nastavení převodu MTP, váhy pulzu a časový posun Energis.',
      ];
}
