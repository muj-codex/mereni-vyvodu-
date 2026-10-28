import { frozen1413Content } from './frozen-reference1414';
import assert from 'node:assert/strict';
import patches from './fixtures/tariff-1413-integration.json';
export function frozen1412Content(path: string) {
  let content = frozen1413Content(path);
  for (const patch of [
    ...((patches as Record<string, { before: string; after: string }[]>)[path] ?? []),
  ].reverse()) {
    assert.equal(content.split(patch.after).length, 2, path);
    content = content.replace(patch.after, patch.before);
  }
  return content;
}
