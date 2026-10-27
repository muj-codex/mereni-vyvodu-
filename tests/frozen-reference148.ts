import { frozen148Content } from './frozen-reference149';
import assert from 'node:assert/strict';
import patches from './fixtures/tariff-148-integration.json';
export function frozen147Content(path: string) {
  let content = frozen148Content(path);
  for (const patch of [
    ...((patches as Record<string, { before: string; after: string }[]>)[path] ?? []),
  ].reverse()) {
    assert.equal(content.split(patch.after).length, 2, path);
    content = content.replace(patch.after, patch.before);
  }
  return content;
}
