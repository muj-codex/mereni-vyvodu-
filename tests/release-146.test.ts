import { describe, it, expect } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  findByNode,
  findByLocation,
  editReference,
  validateDirectory,
  uzelDirectory,
} from '../src/series/reference/directory';
import { draftReference, editDraftReference } from '../src/ui/referenceDraft';
import { emptyDraft } from '../src/core/measurement';
import { OrlenPrices } from '../src/tariffs/OrlenPrices';
import { comparisonContext } from '../src/tariffs/calculations';
import { assessOrlen } from '../src/tariffs/orlenCosts';
import corrections from './fixtures/reference-146-changes.json';

const verified = [
  ['80620101', 'R701', 'RWA1.05', 1000],
  ['80620201', 'R701', 'RWA1.07', 1000],
  ['80620301', 'R701', 'RWA1.09', 1000],
  ['80620401', 'R701', 'RWA1.11', 250],
  ['80620501', 'R701', 'RWA1.13', 250],
  ['80620601', 'R701', 'RWA1.15', 250],
  ['80620701', 'R701', 'RWA1.17', 1000],
  ['80620801', 'R701', 'RWA1.19', 250],
  ['80620901', 'R701', 'RWA1.21', 250],
  ['80640101', 'R701', 'RWB1.29', 1000],
  ['80640201', 'R701', 'RWB1.31', 1000],
  ['80640301', 'R701', 'RWB1.33', 600],
  ['80640501', 'R701', 'RWB1.37', 250],
  ['80640601', 'R701', 'RWB1.39', 250],
  ['80640701', 'R701', 'RWB1.41', 250],
  ['80640801', 'R701', 'RWB1.43', 1000],
  ['80610201', 'R702', 'RWC.1 T108', 4000],
  ['80610102', 'R702', 'RWC.4 TG12', 4000],
  ['80680101', 'R702', 'RWD1.31', 1000],
  ['80680201', 'R702', 'RWD1.33', 1000],
  ['80680301', 'R702', 'RWD1.35', 1000],
  ['80680401', 'R702', 'RWD1.37', 250],
  ['80680501', 'R702', 'RWD1.39', 250],
  ['80680601', 'R702', 'RWD1.41', 250],
  ['80680701', 'R702', 'RWD1.43', 250],
  ['80680801', 'R702', 'RWD1.45', 250],
  ['80680901', 'R702', 'RWD1.47', 250],
  ['80681001', 'R702', 'RWD1.49', 750],
] as const;
const blank = () => ({ node: '', location: '', placement: '', actualMtp: '100' });
describe('1.4.6 explicitly verified reference corrections', () => {
  it('repairs exactly nine missing CHEZA locations without changing their UZEL, field or MTP', () => {
    const patches = corrections.changes.filter((r) => r.cell.startsWith('BM'));
    expect(patches).toHaveLength(9);
    for (const patch of patches) {
      const row = uzelDirectory.find((r) => r.cell === patch.cell)!;
      expect(row.location).toBe('1613/CHEZA');
      for (const key of ['node', 'placement', 'mtpPrimary', 'mtpSecondary', 'mtpSource'] as const)
        expect(row[key]).toBe(patch.before[key]);
    }
    const group = uzelDirectory.filter((r) => r.location === '1613/CHEZA');
    expect(group).toHaveLength(24);
    for (const row of group) {
      expect(findByNode(row.node!)).toMatchObject({
        status: 'matched',
        record: { location: '1613/CHEZA', placement: row.placement },
      });
      expect(findByLocation('TS 1613/CHEZA', row.placement!)).toMatchObject({
        status: 'matched',
        record: { node: row.node },
      });
      expect(editReference(blank(), undefined, 'node', row.node!).status).toBe('verified');
    }
    expect(findByNode('21207020')).toMatchObject({
      record: { placement: '3a', location: '1613/CHEZA' },
    });
    expect(findByNode('21207045')).toMatchObject({
      record: { placement: '6A', location: '1613/CHEZA' },
    });
  });
  it.each([
    ['5a', '21207022', '5A', '21207044'],
    ['5b', '21207033', '5B', '21207055'],
    ['10a', '21207027', '10A', '21207051'],
  ] as const)(
    'preserves distinct CHEZA fields %s (%s) and %s (%s)',
    (lower, nodeLower, upper, nodeUpper) => {
      expect(findByLocation('1613/CHEZA', lower)).toMatchObject({
        status: 'matched',
        record: { node: nodeLower },
      });
      expect(findByLocation('1613/CHEZA', upper)).toMatchObject({
        status: 'matched',
        record: { node: nodeUpper },
      });
      expect(
        editReference({ ...blank(), location: 'TS 1613/CHEZA' }, undefined, 'placement', lower)
          .values.node,
      ).toBe(nodeLower);
      expect(
        editReference({ ...blank(), location: 'TS 1613/CHEZA' }, undefined, 'placement', upper)
          .values.node,
      ).toBe(nodeUpper);
    },
  );
  it.each(verified)(
    '%s resolves in both directions to %s / %s / %d A primary',
    (node, location, placement, primary) => {
      expect(uzelDirectory.filter((r) => r.node === node)).toHaveLength(1);
      expect(findByNode(node)).toMatchObject({
        status: 'matched',
        record: { location, placement, mtpPrimary: primary, mtpSecondary: 1, unverified: [] },
      });
      const forward = editReference(blank(), undefined, 'node', node);
      expect(forward.values).toEqual({ node, location, placement, actualMtp: String(primary) });
      expect(forward.status).toBe('verified');
      const reverse = editReference({ ...blank(), location }, undefined, 'placement', placement);
      expect(reverse.values.node).toBe(node);
      expect(reverse.values.actualMtp).toBe(String(primary));
      expect(reverse.status).toBe('verified');
      const draft = emptyDraft();
      draft.config.meterMtp = 100;
      const result = editDraftReference(draft, 'node', node);
      expect(result.config.meterMtp).toBe(100);
      expect(draftReference(result).values.actualMtp).toBe(String(primary));
    },
  );
  it('adds no fabricated RWB1.35 or node 80640401 and clears stale automatic data for an unknown key', () => {
    expect(verified).toHaveLength(28);
    expect(findByNode('80640401').status).toBe('missing');
    expect(findByLocation('R701', 'RWB1.35').status).toBe('missing');
    const old = editReference(blank(), undefined, 'node', '80680701');
    const next = editReference(old.values, old.state, 'placement', 'RWD1.unknown');
    expect(next.values.node).toBe('');
    expect(next.values.actualMtp).toBe('');
    expect(next.status).toBe('unverified');
  });
  it('enriches existing incomplete rows without introducing duplicate or conflicting reverse keys', () => {
    const r = validateDirectory();
    expect(r).toMatchObject({
      sheetRecords: 994,
      recordsWithNode: 987,
      distinctNodes: 908,
      completeRecords: 981,
      incompleteRecords: 13,
    });
    expect(r.duplicateNodes).toHaveLength(40);
    expect(r.conflictingNodes.map((v) => v.key)).toEqual(['21201042']);
    expect(r.conflictingLocations).toHaveLength(0);
  });
});
describe('1.4.6 flat tariff labels only', () => {
  it('adds visible 2T labels with unchanged internal codes and an unchanged C02d annual total', () => {
    const context = comparisonContext('C', 'flat', 'ČEZ Distribuce', 12000, 40);
    const html = renderToStaticMarkup(createElement(OrlenPrices, { context })).replaceAll(
      ' selected=""',
      '',
    );
    for (const code of ['C01d', 'C02d', 'C03d'])
      expect(html).toContain(`<option value="${code}">${code}</option>`);
    for (const code of ['C25d', 'C45d'])
      expect(html).toContain(`<option value="${code}">${code} · 2T</option>`);
    expect(assessOrlen('C02d', 'ČEZ Distribuce', 40, 12000, null).priceWithVat).toBeCloseTo(
      81959.592,
      8,
    );
  });
});
