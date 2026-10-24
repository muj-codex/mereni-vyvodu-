import { expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createRecord, DEFAULT_CONFIG } from '../src/core/measurement';
import { measurementComparisons } from '../src/core/comparisons';
import { Comparisons } from '../src/ui/Comparisons';
import { Result } from '../src/ui/components';
import type { MeasurementInput } from '../src/core/types';
const record = (energis: number) =>
  createRecord({
    serial: '137',
    config: DEFAULT_CONFIG,
    voltageBasis: 'phase-neutral',
    phases: [0, 1, 2].map(() => ({
      u: 100,
      i: 1000 / 3,
      pf: 1,
      p: 100 / 3,
    })) as MeasurementInput['phases'],
    kyoritsu: 100,
    energis,
  });
it.each([
  [104.9, false],
  [105, false],
  [95, false],
  [105.01, true],
  [94.2, true],
  [105.0001, true],
] as const)('raw Energis %s selects only the presentation warning (%s)', (energis, warning) => {
  const r = record(energis),
    before = structuredClone(r);
  const percent = measurementComparisons(r).find((c) => c.key === 'kyoritsu-energis')!.percent!;
  expect(Math.abs(percent) > 5).toBe(warning);
  const html = renderToStaticMarkup(createElement(Comparisons, { record: r }));
  expect(html.includes('class="comparison-warning"')).toBe(warning);
  expect(html.includes('aria-label="Upozornění"')).toBe(warning);
  expect(html.includes('Rozdíl překročil 5 %.')).toBe(warning);
  expect(r).toEqual(before);
});
it('a value displayed as +5 % still warns when its internal value exceeds five', () => {
  const html = renderToStaticMarkup(createElement(Comparisons, { record: record(105.0001) }));
  expect(html).toContain('Kyoritsu ↔ Energis:');
  expect(html).toContain('+5 %');
  expect(html).toContain('class="comparison-warning"');
});
it('the old Kyoritsu banner is absent while physical inconsistency remains visible', () => {
  const r = record(100);
  r.input.kyoritsu = 4;
  const bad = createRecord(r.input);
  const html = renderToStaticMarkup(
    createElement(Result, { diagnosis: bad.diagnosis, serial: '137' }),
  );
  expect(html).not.toContain('OVĚŘIT HODNOTY KYORITSU');
  expect(html).not.toContain('result-banner');
  expect(html).toContain('Kontrola výkonu Kyoritsu');
  expect(bad.diagnosis.powerConsistency?.status).toBe('mismatch');
});
