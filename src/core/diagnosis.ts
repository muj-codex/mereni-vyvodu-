import { checkPowerConsistency, powerNeedsVerification } from './powerConsistency';
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
  const differencePercent = ((energis - kyoritsu) / kyoritsu) * 100;
  if (!Number.isFinite(differencePercent))
    throw new Error('Výkon je příliš velký pro bezpečné vyhodnocení.');
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
            `UL${target + 1} ← IL${source + 1}: nelze určit ekvivalentní napětí nebo úhel.`,
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
  const powerConsistency = checkPowerConsistency(input);
  const comparison = directComparison(input.kyoritsu, input.energis);
  const warnings: string[] = [];
  const sum = input.phases.reduce(
    (s, p, index) => s + (input.config.voltage === 500 && index === 1 ? 0 : p.p),
    0,
  );
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
    powerConsistency,
    mode,
    scenarios,
    best,
    alternative,
    warnings,
    modelVersion: CONFIG.modelVersion,
  };
}
export function inspectionInstructions(diagnosis: Diagnosis): string[] {
  const physical = powerNeedsVerification(diagnosis)
    ? [
        'Prověř zadané hodnoty U, I, PF a výkon Kyoritsu. Z tohoto nesouladu nelze jednoznačně určit chybu zapojení.',
      ]
    : [];
  if (diagnosis.status === 'ok')
    return [
      ...physical,
      'Přímé porovnání je v toleranci ±15 %. Samotné porovnání nepotvrzuje správné zapojení.',
    ];
  return [
    ...physical,
    'Rozdíl proti Energis je významný. Z tohoto porovnání nelze jednoznačně určit chybu zapojení.',
    'Ověřte souběžnost měření, časový posun a agregaci / vyhlazení Energis.',
    'Možné příčiny: převod, proudový nebo napěťový obvod, zapojení či více závad současně. Změřte místně primár a sekundár přes MTP.',
  ];
}
