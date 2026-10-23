import { test, expect, type Page } from '@playwright/test';
async function aron(page: Page, bad = false, energis = bad ? '4' : '18') {
  await page.goto('/');
  await page.getByLabel('VÝROBNÍ ČÍSLO ELEKTROMĚRU', { exact: true }).fill('000127');
  await page.getByLabel('Režim sítě / napětí', { exact: true }).selectOption('500');
  await page.getByRole('button', { name: 'MĚŘENÍ KYORITSU', exact: true }).click();
  for (const i of [1, 2, 3]) await page.getByLabel(`U${i}`, { exact: true }).fill('500');
  await expect(page.getByLabel('IL2', { exact: true })).toHaveCount(0);
  await page.getByLabel('IL1', { exact: true }).fill(bad ? '22' : '20');
  await page.getByLabel('IL3', { exact: true }).fill(bad ? '32' : '20');
  await page.getByRole('button', { name: 'POKRAČOVAT NA PF A VÝKONY' }).click();
  await expect(page.getByLabel('PF2', { exact: true })).toHaveCount(0);
  await page.getByLabel('PF1', { exact: true }).fill('0,90');
  await page.getByLabel('PF3', { exact: true }).fill(bad ? '0,89' : '0,90');
  for (const i of [1, 3]) await page.getByLabel(`P${i}`, { exact: true }).fill(bad ? '2' : '9');
  await page.getByLabel('Celkový výkon Kyoritsu', { exact: true }).fill(bad ? '4' : '18');
  await page.getByLabel('Trend Energis', { exact: true }).fill(energis);
  await page.getByRole('button', { name: 'VYHODNOTIT MĚŘENÍ', exact: true }).click();
}
test('ARON 24.14 kW vs entered 4 kW never green; persisted detail', async ({ page }) => {
  await aron(page, true);
  await expect(
    page.getByRole('heading', { name: 'OVĚŘIT HODNOTY KYORITSU', exact: true }),
  ).toBeVisible();
  await expect(page.locator('.result-banner')).not.toHaveClass(/success/);
  const check = page.getByRole('region', { name: 'Kontrola výkonu Kyoritsu' });
  await expect(check).toContainText('24,14 kW');
  await expect(check).toContainText('-83,43 %');
  await expect(page.getByRole('region', { name: 'Porovnání', exact: true })).toContainText(
    'Kyoritsu ↔ Energis: 0 %',
  );
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole('button', { name: 'ULOŽIT MĚŘENÍ', exact: true }).click();
  await page.getByRole('button', { name: 'Výsledky měření' }).last().click();
  await page.locator('.record-open').click();
  await expect(
    page.getByRole('heading', { name: 'OVĚŘIT HODNOTY KYORITSU', exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Data / detail', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Kontrola výkonu Kyoritsu' })).toContainText(
    '24,14 kW',
  );
});
test('consistent ARON allows green; mismatch with Energis stays independently visible', async ({
  page,
}) => {
  await aron(page);
  await expect(page.getByRole('heading', { name: 'MĚŘENÍ V POŘÁDKU', exact: true })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Kontrola výkonu Kyoritsu' })).toContainText(
    'odpovídá',
  );
});
test('consistent ARON with wrong Energis is not green', async ({ page }) => {
  await aron(page, false, '10');
  await expect(page.getByRole('region', { name: 'Kontrola výkonu Kyoritsu' })).toContainText(
    'odpovídá',
  );
  await expect(page.getByRole('heading', { name: 'MĚŘENÍ V POŘÁDKU', exact: true })).toHaveCount(0);
  await expect(page.getByRole('region', { name: 'Porovnání', exact: true })).toContainText(
    'Kyoritsu ↔ Energis: -44,444 %',
  );
});
