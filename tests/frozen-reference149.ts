import { frozen149Content } from './frozen-reference1410';
import assert from 'node:assert/strict';
import patches from './fixtures/tariff-149-integration.json';
export function frozen148Content(path: string) {
  let content = frozen149Content(path);
  for (const patch of [
    ...((patches as Record<string, { before: string; after: string }[]>)[path] ?? []),
  ].reverse()) {
    assert.equal(content.split(patch.after).length, 2, path);
    content = content.replace(patch.after, patch.before);
  }
  return content;
}
