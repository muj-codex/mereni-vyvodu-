import { describe, it, expect } from 'vitest';
import { createHash } from 'node:crypto';
import { frozen144Content } from './frozen-reference146';
import baseline from './frozen-144.json';
import {
  editReference,
  emptyReferenceState,
  bindingStatus,
  type ReferenceValues,
} from '../src/series/reference/directory';
import { draftReference, editDraftReference } from '../src/ui/referenceDraft';
import { emptyDraft } from '../src/core/measurement';
import { mtpCorrection } from '../src/core/energy';
const blank = (): ReferenceValues => ({ node: '', location: '', placement: '', actualMtp: '100' });
const known = () => editReference(blank(), undefined, 'node', '21111020');

describe('1.4.5 reference binding provenance and clearing', () => {
  it('does not warn for an untouched default identification', () => {
    expect(bindingStatus({ ...blank(), location: 'TS 3308/250' })).toBe('empty');
  });
  it('does not warn for a selected location until a UZEL or placement can be checked', () => {
    const r = editReference(blank(), undefined, 'location', 'TS 6910');
    expect(r.status).toBe('empty');
  });
  it('clears stale automatic placement when changing TS, while preserving a manually confirmed placement', () => {
    const r = known();
    const changed = editReference(r.values, r.state, 'location', 'TS 6910');
    expect(changed.values).toEqual({ node: '', location: 'TS 6910', placement: '', actualMtp: '' });
    expect(changed.status).toBe('unverified');
    const manual = editReference(r.values, r.state, 'placement', '3');
    const next = editReference(manual.values, manual.state, 'location', 'TS 6910');
    expect(next.values.placement).toBe('3');
    expect(next.values.node).toBe('');
  });
  it('resolves a known UZEL and validates the full four-field binding', () => {
    const r = known();
    expect(r.values).toEqual({
      node: '21111020',
      location: 'TS 3308/250',
      placement: '3',
      actualMtp: '400',
    });
    expect(r.status).toBe('verified');
    expect(r.state.automatic).toEqual(r.values);
  });
  it('resolves the opposite direction and discards only stale automatically supplied values', () => {
    const r = editReference({ ...blank(), location: 'TS 3308/250' }, undefined, 'placement', '3');
    expect(r.status).toBe('verified');
    const next = editReference(r.values, r.state, 'placement', 'unlisted');
    expect(next.values).toEqual({
      node: '',
      location: 'TS 3308/250',
      placement: 'unlisted',
      actualMtp: '',
    });
    expect(next.status).toBe('unverified');
  });
  it('clears a previously confirmed UZEL and primary MTP when the user breaks a forward-resolved binding', () => {
    const r = known();
    const next = editReference(r.values, r.state, 'placement', 'unlisted');
    expect(next.values.node).toBe('');
    expect(next.values.actualMtp).toBe('');
    expect(next.values.placement).toBe('unlisted');
    expect(next.status).toBe('unverified');
  });
  it('clears automatic location, placement and primary MTP for an unknown UZEL, preserving the exact new identifier', () => {
    const r = known();
    const next = editReference(r.values, r.state, 'node', '000123456789012345');
    expect(next.values).toEqual({
      node: '000123456789012345',
      location: '',
      placement: '',
      actualMtp: '',
    });
    expect(next.status).toBe('unverified');
  });
  it('protects manually overridden primary MTP and placement on a later unknown UZEL', () => {
    let r = known();
    r = editReference(r.values, r.state, 'actualMtp', '300');
    expect(r.status).toBe('unverified');
    r = editReference(r.values, r.state, 'placement', 'manual field');
    r = editReference(r.values, r.state, 'node', '99999999');
    expect(r.values).toEqual({
      node: '99999999',
      location: '',
      placement: 'manual field',
      actualMtp: '300',
    });
  });
  it('retains manual unknown data and never assigns automatic provenance to old records', () => {
    const manual = {
      node: '99999999',
      location: 'manual TS',
      placement: 'custom 1',
      actualMtp: '123',
    };
    const r = editReference(manual, undefined, 'placement', 'custom 2');
    expect(r.values).toEqual({ ...manual, placement: 'custom 2' });
    expect(r.state.automatic).toEqual({});
    expect(r.status).toBe('unverified');
  });
  it('rebinds a different known placement without stale values or sticky verification', () => {
    const r = known();
    const next = editReference(r.values, r.state, 'placement', '4');
    expect(next.values.node).toBe('21111043');
    expect(next.status).toBe('verified');
    const manual = editReference(next.values, next.state, 'actualMtp', '300');
    expect(manual.status).toBe('unverified');
    expect(manual.values.node).toBe('21111043');
  });
  it('rejects ambiguous bindings in both directions and never marks incomplete source rows verified', () => {
    const r = known();
    expect(editReference(r.values, r.state, 'node', '21201042')).toMatchObject({
      values: { node: '21201042', location: '', placement: '', actualMtp: '' },
      status: 'unverified',
    });
    expect(
      editReference({ ...blank(), location: 'TS 4601/251' }, undefined, 'placement', '4P').status,
    ).toBe('unverified');
    const partial = editReference(r.values, r.state, 'node', '10105018');
    expect(partial.values.actualMtp).toBe('');
    expect(partial.status).toBe('unverified');
  });
  it('isolates transitions for different outlets and leaves unrelated input fields untouched', () => {
    const one = known();
    const two = editReference(blank(), undefined, 'node', '21201066');
    const snapshot = structuredClone(two);
    editReference(one.values, one.state, 'placement', 'new manual field');
    expect(two).toEqual(snapshot);
  });
  it('preserves provenance across the existing draft JSON roundtrip and leaves the meter, voltage and readings independent', () => {
    const draft = emptyDraft();
    draft.config.meterMtp = 100;
    draft.interval.start = '123.456789';
    let next = editDraftReference(draft, 'node', '21201066');
    expect(next.config.actualMtp).toBe(300);
    expect(next.config.meterMtp).toBe(100);
    expect(mtpCorrection(next.config.actualMtp, next.config.meterMtp)).toBe(3);
    expect(next.config.voltage).toBe(draft.config.voltage);
    expect(next.interval).toEqual(draft.interval);
    next = JSON.parse(JSON.stringify(next));
    next = editDraftReference(next, 'placement', 'unlisted');
    expect(draftReference(next).values).toMatchObject({
      node: '',
      actualMtp: '',
      placement: 'unlisted',
    });
    expect(next.config.meterMtp).toBe(100);
  });
  it('does not erase a manual value whose automatic snapshot no longer matches', () => {
    const r = known();
    const externallyChanged = { ...r.values, actualMtp: '175' };
    expect(editReference(externallyChanged, r.state, 'node', '99999999').values.actualMtp).toBe(
      '175',
    );
  });
  it('keeps 1.4.4 calculations and storage unchanged, allowing only the audited 1.4.6 data and display-label patches', () => {
    for (const [path, expected] of Object.entries(baseline))
      expect(createHash('sha256').update(frozen144Content(path)).digest('hex'), path).toBe(
        expected,
      );
  });
});
