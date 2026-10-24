import { expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { Interval } from '../src/ui/Interval';
import { BackButton } from '../src/ui/BackButton';
import { emptyDraft } from '../src/core/measurement';
it('embedded check exposes no independent save action and one local back without changing inputs', () => {
  const draft = {
    ...emptyDraft(),
    serial: '136777',
    identification: { date: '2026-10-24', location: 'TS', placement: '21' },
    intervalEnabled: true,
    interval: {
      from: '2026-10-24T11:00',
      to: '2026-10-24T12:00',
      start: '100',
      end: '110',
      energis: '10',
    },
  };
  const before = structuredClone(draft);
  const html = renderToStaticMarkup(
    createElement(Interval, { draft, onChange: () => {}, onBack: () => {}, notify: () => {} }),
  );
  expect(html).not.toContain('ULOŽIT KONTROLU STAVŮ');
  expect(html).toContain('← Zpět');
  expect(html).toContain('Výsledek kontroly stavů');
  expect(draft).toEqual(before);
});
it('back is a local non-submit action', () => {
  const html = renderToStaticMarkup(createElement(BackButton, { onBack: () => {} }));
  expect(html).toContain('type="button"');
  expect(html).toContain('← Zpět');
});
