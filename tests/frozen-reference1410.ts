import { frozen1410Content } from './frozen-reference1411';
import assert from 'node:assert/strict';
import patches from './fixtures/tariff-1410-integration.json';
export function frozen149Content(path: string) {
  let content = frozen1410Content(path);
  for (const patch of [
    ...((patches as Record<string, { before: string; after: string }[]>)[path] ?? []),
  ].reverse()) {
    assert.equal(content.split(patch.after).length, 2, path);
    content = content.replace(patch.after, patch.before);
  }
  return content;
}
