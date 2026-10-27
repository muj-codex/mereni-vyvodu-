import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { blankEntry } from '../src/series/model';
import {
  findByNode,
  findByLocation,
  prefillReading,
  uzelDirectory,
  validateDirectory,
  type ReferenceRecord,
} from '../src/series/reference/directory';

describe('photo-backed reference directory', () => {
  it('accounts for original sheet rows, overlapping photographs, blanks and actual duplicate blocks', () => {
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
    expect(new Set(uzelDirectory.map((r) => r.cell)).size).toBe(994);
    expect(uzelDirectory.find((r) => r.cell === 'CW19')).toMatchObject({
      node: '21308015',
      location: 'ASU - AIP',
      placement: '10.3.21',
      mtpPrimary: 200,
      mtpSecondary: 1,
    });
  });
  it('does not silently infer missing UZELs, clipped locations or unusual MTP notation', () => {
    expect(uzelDirectory.find((r) => r.cell === 'CO27')!.node).toBeNull();
    expect(uzelDirectory.find((r) => r.cell === 'E30')!.location).toBeNull();
    expect(uzelDirectory.find((r) => r.cell === 'AC10')).toMatchObject({
      mtpPrimary: null,
      mtpSource: '0,25-5 (80A)',
    });
    const entry = { ...blankEntry(), actualMtp: '75', meterMtp: '100' };
    const result = prefillReading(entry, 'node', '10105018');
    expect(result.entry).toMatchObject({
      location: 'TS 2535/254',
      placement: 'RM3.37L',
      actualMtp: '75',
      meterMtp: '100',
    });
  });
  it('prefills only existing reading identifiers and primary MTP, preserving the independent meter and observation', () => {
    const entry = {
      ...blankEntry(),
      meterMtp: '150',
      serial: '001234',
      value: '1024',
      date: '2026-10-26',
    };
    const result = prefillReading(entry, 'node', '21111020');
    expect(result.entry).toEqual({
      ...entry,
      node: '21111020',
      location: 'TS 3308/250',
      placement: '3',
      actualMtp: '400',
    });
    expect(prefillReading(result.entry, 'actualMtp', '300').entry.actualMtp).toBe('300');
    expect(prefillReading(result.entry, 'meterMtp', '75').entry).toMatchObject({
      actualMtp: '400',
      meterMtp: '75',
    });
    const reverse = prefillReading({ ...entry, location: 'TS 3308/250' }, 'placement', '3');
    expect(reverse.entry).toMatchObject({ node: '21111020', actualMtp: '400', meterMtp: '150' });
  });
  it('rejects conflicts in both directions, while identical sheet duplicates remain usable', () => {
    expect(findByNode('21201042').status).toBe('ambiguous');
    for (const p of ['4P', '5L']) expect(findByLocation('TS 4601/251', p).status).toBe('ambiguous');
    const entry = { ...blankEntry(), location: 'manual', placement: 'manual', actualMtp: '75' };
    expect(prefillReading(entry, 'node', '21201042').entry).toEqual({ ...entry, node: '21201042' });
    expect(findByNode('21108027').status).toBe('matched');
    expect(findByNode('999999999999999').status).toBe('missing');
    expect(findByLocation('TS 1613/CHEZA', '10a')).toMatchObject({
      status: 'matched',
      record: { node: '21207027' },
    });
    expect(findByLocation('TS 1613/CHEZA', '10A')).toMatchObject({
      status: 'matched',
      record: { node: '21207051' },
    });
  });
  it('rejects ambiguous reverse keys including unknown nodes, preserving string identifiers of any length', () => {
    const row = { ...uzelDirectory[0], node: '000123456789012345' } as ReferenceRecord;
    expect(findByNode(row.node!, [row])).toMatchObject({
      status: 'matched',
      record: { node: row.node },
    });
    expect(
      findByLocation(row.location!, row.placement!, [row, { ...row, node: null }]).status,
    ).toBe('ambiguous');
  });
  it('offers optional UZEL in the main identification without moving reference logic into the electrical core', () => {
    expect(readFileSync('src/ui/Identification.tsx', 'utf8')).toContain('<span>UZEL</span>');
    expect(readFileSync('src/series/reference/directory.ts', 'utf8')).not.toMatch(
      /from ['"].*core\//,
    );
  });
});
