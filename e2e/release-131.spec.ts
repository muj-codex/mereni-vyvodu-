import { test, expect, type Page } from '@playwright/test';
const scope = (page: Page) => page.getByRole('region', { name: 'Odečtové série' }).first();
async function first(page: Page, serial: string, node: string, time = '8:32') {
  const s = scope(page);
  await s.getByLabel('TS / rozvodna', { exact: true }).selectOption('TS 3831/257');
  await s.getByLabel('UZEL (nepovinný)', { exact: true }).fill(node);
  await s.getByLabel('Pole / kobka / umístění', { exact: true }).fill(`pole ${serial}`);
  await s.getByLabel('Číslo elektroměru', { exact: true }).fill(serial);
  await s.getByLabel('Datum odečtu', { exact: true }).fill('2026-10-23');
  await s.getByLabel('Čas odečtu (HH:MM)', { exact: true }).fill(time);
  await s
    .getByLabel('Datum kola', { exact: true })
    .fill((await s.getByLabel('Datum odečtu', { exact: true }).inputValue()) || '2026-10-22');
  await s.getByLabel('Čas kola', { exact: true }).fill('08:00');
  await s.getByLabel('Stav elektroměru [kWh]', { exact: true }).fill('100');
  await s.getByRole('button', { name: 'ULOŽIT DÍLČÍ ODEČET', exact: true }).click();
  await expect(s.locator('p[role=status]')).toContainText('uložen');
}
test('NN/VN presets, custom MTP, correction, TEĎ and normalized hour', async ({ page }) => {
  await page.clock.install({ time: new Date(2026, 9, 24, 8, 3) });
  await page.goto('/');
  await page.getByRole('button', { name: 'Jednotlivý odečet', exact: true }).click();
  const s = scope(page);
  await expect(s.getByLabel('Čas odečtu (HH:MM)', { exact: true })).toHaveValue('');
  await s
    .getByLabel('Čas odečtu (HH:MM)', { exact: true })
    .locator('..')
    .getByRole('button', { name: 'TEĎ', exact: true })
    .click();
  await expect(s.getByLabel('Čas odečtu (HH:MM)', { exact: true })).toHaveValue('08:03');
  await s.getByLabel('Napětí', { exact: true }).selectOption('VN');
  await expect(s.getByLabel('TS / rozvodna', { exact: true }).locator('option')).toHaveText([
    'Vyberte TS / rozvodnu',
    'R201',
    'R202',
    'R701',
    'R702',
    'R105-106',
    'RPCH',
    'RASU-AIP',
  ]);
  await expect(s.getByLabel('MTP primár', { exact: true }).locator('option').first()).toHaveText(
    '70/1 A',
  );
  await s.getByLabel('Napětí', { exact: true }).selectOption('NN');
  await s.getByLabel('MTP primár', { exact: true }).selectOption('300');
  await s.getByLabel('MTP elektroměr', { exact: true }).selectOption('200');
  await expect(s.getByLabel('Korekční koeficient', { exact: true })).toHaveText('× 1,500');
  await first(page, '111', '21210034123456789');
  await s.getByRole('button', { name: 'DOKONČIT DÍLČÍ ODEČET', exact: true }).click();
  await s.getByRole('button', { name: 'Historie EM 111', exact: true }).click();
  await expect(
    s.getByRole('heading', { name: 'UZEL 21210034123456789', exact: true }),
  ).toBeVisible();
  await expect(s.getByText('2026-10-23 08:32 – 100 kWh', { exact: true })).toBeVisible();
});
test('shared sticky date, explicit skip and next visit use the last saved reading', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Série odečtů', exact: true }).click();
  const s = scope(page);
  await first(page, '111', '21210034');
  await first(page, '222', '21210035');
  await s.getByRole('button', { name: 'DOKONČIT DÍLČÍ ODEČET', exact: true }).click();
  await s.getByRole('button', { name: 'Vybrat vše', exact: true }).click();
  const begin = () =>
    s.getByRole('button', { name: 'POKRAČOVAT DALŠÍM ODEČTEM', exact: true }).click();
  await begin();
  const cards = s.locator('.series-meter');
  await s.getByLabel('Datum nového odečtu', { exact: true }).fill('2026-10-24');
  await s.getByLabel('Čas kola', { exact: true }).fill('08:00');
  await expect(s.getByLabel('Nové datum', { exact: true })).toHaveCount(0);
  await cards.nth(1).getByRole('checkbox', { name: 'ODEČÍST', exact: true }).uncheck();
  await expect(cards.nth(1).getByLabel('Nový čas', { exact: true })).toBeDisabled();
  await cards.first().getByLabel('Nový čas', { exact: true }).fill('8:35');
  await cards.first().getByLabel('Nový stav [kWh]', { exact: true }).fill('110');
  await s.getByRole('button', { name: 'ULOŽIT VYPLNĚNÉ ODEČTY', exact: true }).click();
  await expect(s.locator('p[role=status]')).toContainText('Uloženo 1');
  await s.getByRole('button', { name: 'Vybrat vše', exact: true }).click();
  await begin();
  await expect(cards.first().getByLabel('Předchozí stav [kWh]', { exact: true })).toHaveValue(
    '110',
  );
  await expect(cards.nth(1).getByLabel('Předchozí stav [kWh]', { exact: true })).toHaveValue('100');
  await expect(cards.nth(1).getByRole('checkbox', { name: 'ODEČÍST', exact: true })).toBeChecked();
});
test('global live search, compact rows and results navigation', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Jednotlivý odečet', exact: true }).click();
  await first(page, '777666', '21210034');
  await first(page, '222', '999', '8:35');
  await page.getByRole('button', { name: /Výsledky měření/ }).click();
  await expect(page.getByRole('button', { name: 'Série odečtů', exact: true })).toHaveCount(0);
  await expect(page.locator('.record-open').first()).toContainText('23.10.2026 08:35');
  for (const query of ['3831', '257', '21210034', '766']) {
    await page.getByLabel('Hledat ve všech výsledcích a odečtech').fill(query);
    await expect(page.locator('.record-open')).toHaveCount(['3831', '257'].includes(query) ? 2 : 1);
  }
  await expect(page.locator('.record-open')).toContainText('EM 777666');
  await page.locator('.record-open').click();
  await expect(
    scope(page).getByRole('heading', { name: 'UZEL 21210034', exact: true }),
  ).toBeVisible();
});
