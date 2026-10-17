import { it, expect } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { Mapping } from '../src/ui/components';
import { generateScenarios } from '../src/core/diagnosis';
import { emptyDraft } from '../src/core/measurement';
it('C1 v opravdovém UI: všech 48 variant zachovává barvy U i I podle fyzické identity', () => {
  const scenarios = generateScenarios({
    serial: '001',
    config: emptyDraft().config,
    phases: [
      { u: 400, i: 10, pf: 0.8, p: 2 },
      { u: 400, i: 15, pf: 0.9, p: 3 },
      { u: 400, i: 20, pf: 0.95, p: 4 },
    ],
    kyoritsu: 9,
    energis: 5,
  });
  for (const scenario of scenarios) {
    const markup = renderToStaticMarkup(createElement(Mapping, { scenario, title: 'Test' }));
    const badges = [...markup.matchAll(/background-color:([^";]+)[^"]*" data-phase="([^"]+)"/g)];
    expect(badges).toHaveLength(6);
    for (const [, color, identity] of badges) {
      expect(color).toBe(
        identity === 'shorted'
          ? '#687680'
          : identity.endsWith('1')
            ? '#cf343c'
            : identity.endsWith('2')
              ? '#21834a'
              : '#f2c94c',
      );
    }
  }
});
