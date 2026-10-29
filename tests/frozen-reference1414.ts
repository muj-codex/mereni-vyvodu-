import { frozen1414Content } from './frozen-reference1415';
import assert from 'node:assert/strict';
import patches from './fixtures/tariff-1414-integration.json';
export function frozen1413Content(path: string) {
  let content = frozen1414Content(path);
  for (const patch of [
    ...((patches as Record<string, { before: string; after: string }[]>)[path] ?? []),
  ].reverse()) {
    assert.equal(content.split(patch.after).length, 2, path);
    content = content.replace(patch.after, patch.before);
  }
  return content;
}
