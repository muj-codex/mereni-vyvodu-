import { test, expect, type Page } from '@playwright/test';
const scope = (p: Page) => p.getByRole('region', { name: 'Odečtové série' }).first();
const card = (p: Page, serial: string) =>
  scope(p)
    .locator('.series-meter')
    .filter({ has: p.getByRole('button', { name: `Historie EM ${serial}`, exact: true }) });
const roundCard = (p: Page, serial: string) =>
  scope(p)
    .locator('.series-meter')
    .filter({ has: p.getByRole('heading', { name: `EM ${serial}`, exact: true }) });
async function createSeries(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'SÉRIE ODEČTŮ', exact: true }).click();
  const s = scope(page);
  for (const [serial, placement, node, value] of [
    ['123', 'pole 21', '21210001', '1000'],
    ['234', 'pole 54', '21210002', '1800'],
  ]) {
    await s.getByLabel('TS / rozvodna', { exact: true }).selectOption('TS 4601/251');
    await s.getByLabel('Pole / kobka / umístění', { exact: true }).fill(placement);
    await s.getByLabel('UZEL (nepovinný)', { exact: true }).fill(node);
    await s.getByLabel('Číslo elektroměru', { exact: true }).fill(serial);
    await s.getByLabel('Datum odečtu', { exact: true }).fill('2026-10-23');
    await s.getByLabel('Čas odečtu (HH:MM)', { exact: true }).fill('17:33');
    await s.getByLabel('Stav elektroměru [kWh]', { exact: true }).fill(value);
    await s.getByRole('button', { name: 'ULOŽIT DÍLČÍ ODEČET', exact: true }).click();
    await expect(s.locator('p[role=status]')).toContainText('uložen');
  }
  await page.getByRole('button', { name: /Výsledky měření/ }).click();
  await expect(page.locator('.record-open')).toHaveCount(1);
  await expect(page.locator('.record-open')).toHaveText(
    '23.10.2026 17:33TS 4601/251série 2 vývodů',
  );
  await page.locator('.record-open').click();
  await expect(
    scope(page).getByRole('checkbox', { name: 'Vybrat EM 123', exact: true }),
  ).toBeChecked();
  await expect(
    scope(page).getByRole('checkbox', { name: 'Vybrat EM 234', exact: true }),
  ).toBeChecked();
}
test('series detail replaces search with persisted chronological dates', async ({ page }) => {
  await createSeries(page);
  const s = scope(page);
  await s.getByRole('button', { name: 'POKRAČOVAT DALŠÍM ODEČTEM', exact: true }).click();
  await s.getByLabel('Datum nového odečtu', { exact: true }).fill('2026-10-26');
  for (const [serial, time, value] of [
    ['123', '08:36', '1020'],
    ['234', '08:42', '1820'],
  ]) {
    const c = roundCard(page, serial);
    await c.getByLabel('Nový čas', { exact: true }).fill(time);
    await c.getByLabel('Nový stav [kWh]', { exact: true }).fill(value);
  }
  await s.getByRole('button', { name: 'ULOŽIT VYPLNĚNÉ ODEČTY', exact: true }).click();
  await expect(s.locator('p[role=status]').first()).toContainText('Uloženo 2');
  await page.reload();
  await page.getByRole('button', { name: /Výsledky měření/ }).click();
  await page.locator('.record-open').click();
  await expect(
    scope(page).getByLabel('Vyhledat UZEL / pole / číslo elektroměru', { exact: true }),
  ).toHaveCount(0);
  await expect(scope(page).locator('.series-dates')).toHaveText(
    '23.10.2026 17:33; 26.10.2026 08:36',
  );
});
