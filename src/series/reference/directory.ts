import source from './uzel.json';
import type { Entry } from '../model';

export interface ReferenceRecord {
  cell: string;
  node: string | null;
  location: string | null;
  placement: string | null;
  mtpPrimary: number | null;
  mtpSecondary: number | null;
  mtpSource: string | null;
  sources: string[];
  unverified: string[];
  note?: string;
}
export const uzelDirectory: readonly ReferenceRecord[] = source.records;
// Only presentation aliases with the same explicitly visible identifier.
export function displayLocation(location: string) {
  if (/^\d{4}\//.test(location)) return `TS ${location}`;
  return location.replace(/^R\s+(?=\d)/, 'R');
}
const locationKey = (s: string) =>
  s
    .replace(/^TS\s*/i, '')
    .replace(/\s/g, '')
    .toUpperCase();
// Case is significant: the source distinguishes 3a from 3A, 5b from 5B, etc.
const placementKey = (s: string) => s.trim().replace(/\s+/g, '');
const signature = (r: ReferenceRecord) =>
  JSON.stringify([
    r.node,
    r.location && locationKey(r.location),
    r.placement && placementKey(r.placement),
    r.mtpPrimary,
    r.mtpSecondary,
  ]);
export type ReferenceMatch =
  | { status: 'missing' | 'ambiguous'; records: readonly ReferenceRecord[] }
  | { status: 'matched'; record: ReferenceRecord; records: readonly ReferenceRecord[] };
function unique(matches: readonly ReferenceRecord[]): ReferenceMatch {
  if (!matches.length) return { status: 'missing', records: matches };
  if (new Set(matches.map(signature)).size !== 1) return { status: 'ambiguous', records: matches };
  return { status: 'matched', record: matches[0], records: matches };
}
export function findByNode(node: string, directory = uzelDirectory): ReferenceMatch {
  if (!node) return { status: 'missing', records: [] };
  return unique(directory.filter((r) => r.node === node));
}
export function findByLocation(
  location: string,
  placement: string,
  directory = uzelDirectory,
): ReferenceMatch {
  if (!location.trim() || !placement.trim()) return { status: 'missing', records: [] };
  const matches = directory.filter(
    (r) =>
      r.location &&
      r.placement &&
      locationKey(r.location) === locationKey(location) &&
      placementKey(r.placement) === placementKey(placement),
  );
  const match = unique(matches);
  // A conflicting node must never become a trusted association through reverse lookup.
  if (
    match.status === 'matched' &&
    match.record.node &&
    findByNode(match.record.node, directory).status === 'ambiguous'
  )
    return { status: 'ambiguous', records: matches };
  return match;
}
export type ReferenceValues = Pick<Entry, 'node' | 'location' | 'placement' | 'actualMtp'>;
export type ReferenceKey = keyof ReferenceValues;
export interface ReferenceState {
  automatic: Partial<Record<ReferenceKey, string>>;
  touched: boolean;
}
export const emptyReferenceState = (): ReferenceState => ({ automatic: {}, touched: false });
export type BindingStatus = 'empty' | 'verified' | 'unverified';
export function bindingStatus(
  values: ReferenceValues,
  state = emptyReferenceState(),
  directory = uzelDirectory,
): BindingStatus {
  if (!values.node && !values.placement && !(state?.touched && values.location)) return 'empty';
  const match = findByNode(values.node, directory);
  if (match.status !== 'matched') return 'unverified';
  const r = match.record;
  return r.location !== null &&
    r.placement !== null &&
    r.mtpPrimary !== null &&
    r.mtpSecondary !== null &&
    locationKey(r.location) === locationKey(values.location) &&
    placementKey(r.placement) === placementKey(values.placement) &&
    values.actualMtp.trim() !== '' &&
    Number(values.actualMtp.replace(',', '.')) === r.mtpPrimary
    ? 'verified'
    : 'unverified';
}
/** Shared form transition. Stored values with no provenance are always treated as manual. */
export function editReference(
  values: ReferenceValues,
  state: ReferenceState | undefined,
  changed: ReferenceKey,
  value: string,
  directory = uzelDirectory,
) {
  const next = { ...values, [changed]: value };
  const automatic: ReferenceState['automatic'] = {};
  for (const key of ['node', 'location', 'placement', 'actualMtp'] as const)
    if (state?.automatic?.[key] === values[key]) automatic[key] = values[key];
  delete automatic[changed];
  const clear = (...keys: ReferenceKey[]) => {
    for (const key of keys) {
      if (automatic[key] !== undefined) next[key] = '';
      delete automatic[key];
    }
  };
  let match: ReferenceMatch | null = null;
  if (changed === 'node') {
    clear('location', 'placement', 'actualMtp');
    match = findByNode(value, directory);
    if (match.status === 'matched') {
      const r = match.record;
      for (const [key, field] of [
        ['location', r.location === null ? null : displayLocation(r.location)],
        ['placement', r.placement],
        ['actualMtp', r.mtpPrimary === null ? null : String(r.mtpPrimary)],
      ] as const)
        if (field !== null) {
          next[key] = field;
          automatic[key] = field;
        }
      // A resolved identifier belongs to this confirmed reference binding. An unknown,
      // explicitly entered identifier remains manual and is never silently discarded.
      automatic.node = next.node;
    }
  } else if (changed === 'location' || changed === 'placement') {
    match = findByLocation(next.location, next.placement, directory);
    clear('node', 'actualMtp');
    if (match.status === 'matched') {
      if (match.record.node !== null) next.node = automatic.node = match.record.node;
      if (match.record.mtpPrimary !== null)
        next.actualMtp = automatic.actualMtp = String(match.record.mtpPrimary);
    } else if (changed === 'location') clear('placement');
  }
  const provenance: ReferenceState = {
    automatic,
    touched:
      !!state?.touched || ((changed === 'node' || changed === 'placement') && value.trim() !== ''),
  };
  return {
    values: next,
    state: provenance,
    match,
    status: bindingStatus(next, provenance, directory),
  };
}
/** Compatibility adapter; all lookup and clearing rules live in editReference. */
export function prefillReading(
  entry: Entry,
  changed: keyof Entry,
  value: string,
  directory = uzelDirectory,
) {
  if (!['node', 'location', 'placement', 'actualMtp'].includes(changed))
    return { entry: { ...entry, [changed]: value }, match: null };
  const result = editReference(entry, undefined, changed as ReferenceKey, value, directory);
  return { entry: { ...entry, ...result.values }, match: result.match };
}
export const referenceLocations = [
  ...new Set(uzelDirectory.flatMap((r) => (r.location ? [displayLocation(r.location)] : []))),
];

export function validateDirectory(directory: readonly ReferenceRecord[] = uzelDirectory) {
  const nodeGroups = new Map<string, ReferenceRecord[]>();
  const pairGroups = new Map<string, ReferenceRecord[]>();
  for (const r of directory) {
    if (r.node) nodeGroups.set(r.node, [...(nodeGroups.get(r.node) ?? []), r]);
    if (r.location && r.placement) {
      const key = `${locationKey(r.location)} | ${placementKey(r.placement)}`;
      pairGroups.set(key, [...(pairGroups.get(key) ?? []), r]);
    }
  }
  const incomplete = directory.filter((r) =>
    [r.node, r.location, r.placement, r.mtpPrimary, r.mtpSecondary].some((v) => v === null),
  );
  const summarize = ([key, rows]: [string, ReferenceRecord[]]) => ({
    key,
    cells: rows.map((r) => r.cell),
    records: rows,
  });
  return {
    sheetRecords: directory.length,
    recordsWithNode: directory.filter((r) => r.node !== null).length,
    distinctNodes: nodeGroups.size,
    completeRecords: directory.length - incomplete.length,
    incompleteRecords: incomplete.length,
    incomplete,
    duplicateNodes: [...nodeGroups].filter(([, rows]) => rows.length > 1).map(summarize),
    conflictingNodes: [...nodeGroups]
      .filter(([, rows]) => new Set(rows.map(signature)).size > 1)
      .map(summarize),
    conflictingLocations: [...pairGroups]
      .filter(([, rows]) => new Set(rows.map(signature)).size > 1)
      .map(summarize),
  };
}
