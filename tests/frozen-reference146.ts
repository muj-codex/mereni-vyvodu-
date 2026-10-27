import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import corrections from './fixtures/reference-146-changes.json';
import integration from './fixtures/tariff-147-integration.json';

// Keep the original 1.4.4 SHA baseline intact. Only the explicitly approved
// data corrections and visible option labels may differ; validate them first,
// then undo exactly those changes for the existing whole-file hash assertion.
export function frozen144Content(path: string) {
  const content = readFileSync(path, 'utf8');
  if (path === 'src/series/reference/uzel.json') {
    const data = JSON.parse(content);
    for (const patch of corrections.changes) {
      const i = data.records.findIndex((r: { cell: string }) => r.cell === patch.cell);
      assert(i >= 0);
      assert.deepEqual(data.records[i], patch.after, `Unapproved change to ${patch.cell}`);
      data.records[i] = patch.before;
    }
    const i = data.sources.findIndex((s: { file: string }) => s.file === corrections.source);
    assert(i >= 0);
    data.sources.splice(i, 1);
    return JSON.stringify(data, null, 2) + '\n';
  }
  if (path === 'src/tariffs/OrlenPrices.tsx') {
    const labels = `<option key={code} value={code}>\n                {code === 'C25d' || code === 'C45d' ? \`\${code} · 2T\` : code}\n              </option>`;
    assert.equal(content.split(labels).length, 2);
    return content.replace(labels, '<option key={code}>{code}</option>');
  }
  if (path === 'src/tariffs/TariffCalculator.tsx') {
    let restored = content;
    for (const patch of integration) {
      assert.equal(restored.split(patch.after).length, 2);
      restored = restored.replace(patch.after, patch.before);
    }
    return restored;
  }
  return content;
}
