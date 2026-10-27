import { test, expect } from '@playwright/test';
import { fillFlat, rates } from './tariffs';
import corrections from '../tests/fixtures/reference-146-changes.json' with { type: 'json' };
const verified = 'Vazba ověřena podle referenčních dat.';

test('CHEZA first block and case-sensitive field pairs use the repaired bidirectional binding in main Measurement', async ({
  page,
}) => {
  await page.goto('/');
  const node = page.getByLabel('UZEL', { exact: true });
  const location = page.getByLabel('TRAFOSTANICE', { exact: true });
  const placement = page.getByLabel('POLE / UMÍSTĚNÍ', { exact: true });
  await page.getByLabel('MTP elektroměr', { exact: true }).selectOption('100');
  await node.fill('21207020');
  await expect(location).toHaveValue('TS 1613/CHEZA');
  await expect(placement).toHaveValue('3a');
  await expect(page.getByLabel('MTP primár', { exact: true })).toHaveValue('300');
  await expect(page.locator('.reference-binding')).toHaveText(verified);
  for (const [field, id] of [
    ['5a', '21207022'],
    ['5A', '21207044'],
    ['5b', '21207033'],
    ['5B', '21207055'],
    ['10a', '21207027'],
    ['10A', '21207051'],
  ]) {
    await placement.fill(field);
    await expect(node).toHaveValue(id);
    await expect(placement).toHaveValue(field);
    await expect(page.locator('.reference-binding')).toHaveText(verified);
  }
  await node.fill('21207045');
  await expect(location).toHaveValue('TS 1613/CHEZA');
  await expect(placement).toHaveValue('6A');
  await expect(page.getByLabel('MTP elektroměr', { exact: true })).toHaveValue('100');
});
for (const group of ['RWA', 'RWB', 'RWC', 'RWD']) {
  test(`all supplied ${group} outlets resolve in both directions with independent meter CT`, async ({
    page,
  }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Jednotlivý odečet', exact: true }).click();
    const s = page.getByRole('region', { name: 'Odečtové série', exact: true }).first();
    await s.getByLabel('Napětí', { exact: true }).selectOption('VN');
    await s.getByLabel('MTP elektroměr', { exact: true }).selectOption('100');
    const node = s.getByLabel('UZEL (nepovinný)', { exact: true });
    const location = s.getByLabel('TS / rozvodna', { exact: true });
    const placement = s.getByLabel('Pole / kobka / umístění', { exact: true });
    const primary = s.getByLabel('MTP primár', { exact: true });
    const rows = corrections.changes.filter(
      (r) => r.before.node === null && r.after.placement.startsWith(group),
    );
    expect(rows.length).toBeGreaterThan(0);
    for (const { after: r } of rows) {
      await node.fill(r.node!);
      await expect(location).toHaveValue(r.location!);
      await expect(placement).toHaveValue(r.placement);
      await expect(primary).toHaveValue(String(r.mtpPrimary));
      await expect(s.locator('.reference-binding')).toHaveText(verified);
      await expect(s.getByLabel('MTP elektroměr', { exact: true })).toHaveValue('100');
      await node.fill('');
      await location.selectOption(r.location!);
      await placement.fill(r.placement);
      await expect(node).toHaveValue(r.node!);
      await expect(primary).toHaveValue(String(r.mtpPrimary));
      await expect(s.locator('.reference-binding')).toHaveText(verified);
    }
  });
}
test('flat tariffs show 2T labels while option values and the verified C02d total remain unchanged', async ({
  page,
}) => {
  await page.goto('/');
  await fillFlat(page);
  const s = rates(page);
  await s.getByLabel('Použitý jistič', { exact: true }).selectOption('3×40 A');
  await s.getByRole('button', { name: 'POKRAČOVAT K POROVNÁNÍ', exact: true }).click();
  const select = s.getByLabel('Cenové položky ORLEN pro sazbu', { exact: true });
  await expect(select.locator('option')).toHaveText([
    'C01d',
    'C02d',
    'C03d',
    'C25d · 2T',
    'C45d · 2T',
  ]);
  await expect(select).toHaveValue('C02d');
  await expect(s.getByLabel('Konečná roční cena ORLEN', { exact: true })).toContainText(
    /81\s959,59 Kč\/rok/,
  );
  for (const code of ['C25d', 'C45d']) {
    await select.selectOption(code);
    await expect(select).toHaveValue(code);
    await expect(
      s.getByRole('heading', { name: `ORLEN 2026 – ${code}`, exact: true }),
    ).toBeVisible();
  }
  await select.selectOption('C02d');
  await expect(s.getByLabel('Konečná roční cena ORLEN', { exact: true })).toContainText(
    /81\s959,59 Kč\/rok/,
  );
});
