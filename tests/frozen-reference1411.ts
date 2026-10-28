import { frozen1411Content } from './frozen-reference1412';
import assert from 'node:assert/strict';
import patches from './fixtures/tariff-1411-integration.json';
export function frozen1410Content(path: string) {
  let content = frozen1411Content(path);
  for (const patch of [
    ...((patches as Record<string, { before: string; after: string }[]>)[path] ?? []),
  ].reverse()) {
    assert.equal(content.split(patch.after).length, 2, path);
    content = content.replace(patch.after, patch.before);
  }
  return content;
}
