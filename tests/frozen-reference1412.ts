import { frozen1412Content } from './frozen-reference1413';
import assert from 'node:assert/strict';
import patches from './fixtures/tariff-1412-integration.json';
export function frozen1411Content(path: string) {
  let content = frozen1412Content(path);
  for (const patch of [
    ...((patches as Record<string, { before: string; after: string }[]>)[path] ?? []),
  ].reverse()) {
    assert.equal(content.split(patch.after).length, 2, path);
    content = content.replace(patch.after, patch.before);
  }
  return content;
}
