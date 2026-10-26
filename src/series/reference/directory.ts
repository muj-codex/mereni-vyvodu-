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
export function prefillReading(
  entry: Entry,
  changed: keyof Entry,
  value: string,
  directory = uzelDirectory,
) {
  const next = { ...entry, [changed]: value };
  const match =
    changed === 'node'
      ? findByNode(value, directory)
      : changed === 'location' || changed === 'placement'
        ? findByLocation(next.location, next.placement, directory)
        : null;
  if (match?.status !== 'matched') return { entry: next, match };
  const r = match.record;
  if (changed === 'node') {
    if (r.location !== null) next.location = displayLocation(r.location);
    if (r.placement !== null) next.placement = r.placement;
  } else if (r.node !== null) next.node = r.node;
  // No meter, serial, reading, voltage or calculation data is taken from this directory.
  if (r.mtpPrimary !== null) next.actualMtp = String(r.mtpPrimary);
  return { entry: next, match };
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
