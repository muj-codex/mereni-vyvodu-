import { test, expect, type Page } from '@playwright/test';
async function noOverflow(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
}
async function enterMeasurement(page: Page, serial = '0012345678', energis = '9,17') {
  await page.getByLabel('VÝROBNÍ ČÍSLO ELEKTROMĚRU', { exact: true }).fill(serial);
  await page.getByRole('button', { name: 'PŘESKOČIT → KYORITSU' }).click();
  for (const [i, [u, current]] of [
    ['506', '15,2'],
    ['506,6', '9,2'],
    ['506,5', '12,9'],
  ].entries()) {
    await page.getByLabel(`U${i + 1}`, { exact: true }).fill(u);
    await page.getByLabel(`I${i + 1}`, { exact: true }).fill(current);
  }
  await noOverflow(page);
  await page.getByRole('button', { name: 'POKRAČOVAT NA PF A VÝKONY' }).click();
  for (const [i, [pf, p]] of [
    ['+0,866', '3,7'],
    ['0,844', '2,2'],
    ['0,979', '3,5'],
  ].entries()) {
    await page.getByLabel(`PF${i + 1}`, { exact: true }).fill(pf);
    await page.getByLabel(`P${i + 1}`, { exact: true }).fill(p);
  }
  await page.getByLabel('Celkový výkon Kyoritsu', { exact: true }).fill('9,2');
  await page.getByLabel('Trend Energis', { exact: true }).fill(energis);
  await noOverflow(page);
  await page.getByRole('button', { name: 'VYHODNOTIT MĚŘENÍ' }).click();
}
test('sériové měření, historie, výběr, export a bezpečné mazání', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/');
  await noOverflow(page);
  expect(await page.locator('input').first().getAttribute('id')).toBe('serial');
  await page.screenshot({
    path: `test-results/${test.info().project.name}-zaklad.png`,
    fullPage: true,
  });
  await enterMeasurement(page);
  await expect(page.getByRole('heading', { name: 'MĚŘENÍ V POŘÁDKU' })).toBeVisible();
  await expect(page.getByText('DALŠÍ MOŽNÁ VARIANTA', { exact: true })).toHaveCount(0);
  for (const [key, color] of [
    ['U1', 'rgb(207, 52, 60)'],
    ['I1', 'rgb(207, 52, 60)'],
    ['U2', 'rgb(33, 131, 74)'],
    ['I2', 'rgb(33, 131, 74)'],
    ['U3', 'rgb(242, 201, 76)'],
    ['I3', 'rgb(242, 201, 76)'],
  ])
    await expect(page.locator(`[data-phase="${key}"]`)).toHaveCSS('background-color', color);
  await noOverflow(page);
  await page.screenshot({
    path: `test-results/${test.info().project.name}-vysledek.png`,
    fullPage: true,
  });
  await page.getByRole('button', { name: 'ULOŽIT MĚŘENÍ', exact: true }).click();
  await expect(page.getByLabel('VÝROBNÍ ČÍSLO ELEKTROMĚRU', { exact: true })).toHaveValue('');
  await enterMeasurement(page, '00000002', '5');
  await expect(
    page.getByRole('heading', { name: 'MIMO TOLERANCI – PROVĚŘIT ZAPOJENÍ' }),
  ).toBeVisible();
  expect(await page.locator('.mapping-card').count()).toBeLessThanOrEqual(2);
  await noOverflow(page);
  await page.screenshot({
    path: `test-results/${test.info().project.name}-chyba.png`,
    fullPage: true,
  });
  await page.getByRole('button', { name: 'CO PROVĚŘIT NA ELEKTROMĚRU', exact: true }).click();
  await noOverflow(page);
  await page.getByRole('button', { name: 'DETAIL VÝSLEDKU', exact: true }).click();
  await page.getByText('Všech 48 scénářů · technický detail').click();
  await expect(page.locator('.scenario-list li')).toHaveCount(48);
  await noOverflow(page);
  await page.getByRole('button', { name: 'ULOŽIT MĚŘENÍ', exact: true }).click();
  await page.getByRole('button', { name: 'Výsledky měření', exact: false }).last().click();
  await expect(page.locator('.history-item')).toHaveCount(2);
  await page.reload();
  await expect(page.locator('#serial')).toBeVisible();
  await page.getByRole('button', { name: 'Výsledky měření', exact: false }).last().click();
  await expect(page.locator('.history-item')).toHaveCount(2);
  await page.locator('.record-open').filter({ hasText: '0012345678' }).click();
  await expect(page.getByRole('heading', { name: 'MĚŘENÍ V POŘÁDKU' })).toBeVisible();
  await noOverflow(page);
  await page.getByRole('button', { name: 'Data / detail' }).click();
  await expect(page.getByText('9,17 kW', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Zpět na výsledky měření' }).click();
  await page.getByRole('button', { name: 'SDÍLET', exact: true }).click();
  await page.getByLabel('Vybrat všechna', { exact: true }).check();
  await expect(page.getByText('Vybráno: 2')).toBeVisible();
  await page.getByRole('button', { name: 'E-mail se neotevřel?', exact: false }).click();
  const text = await page.getByLabel('Text pro ruční zkopírování').inputValue();
  expect(text).toContain('0012345678');
  expect(text).toContain('Měření 2');
  expect(text).not.toMatch(/shoda|varianta|prověřit|scénář/i);
  await page.getByRole('button', { name: 'Zavřít', exact: true }).click();
  await page.getByRole('button', { name: 'KOPÍROVAT PRO EXCEL' }).click();
  // Clipboard can be restricted by the host; either successful toast or selectable fallback is valid.
  await expect(
    page
      .getByText('TSV zkopírováno pro Excel.')
      .or(page.getByRole('heading', { name: 'Data pro Excel' })),
  ).toBeVisible();
  if (await page.getByRole('button', { name: 'Zavřít', exact: true }).isVisible())
    await page.getByRole('button', { name: 'Zavřít', exact: true }).click();
  await page.getByRole('button', { name: 'Smazat celou historii', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Trvale smazat' })).toBeDisabled();
  await page.getByLabel('Pro potvrzení napište SMAZAT').fill('SMAZAT');
  await page.getByRole('button', { name: 'Zrušit', exact: true }).click();
  await expect(page.locator('.history-item')).toHaveCount(2);
  await noOverflow(page);
  expect(errors).toEqual([]);
});
test('PWA se znovu načte offline a uchová historii', async ({ page, context }) => {
  await page.goto('/');
  await expect(page.getByText('Offline připraveno', { exact: true })).toBeVisible();
  await enterMeasurement(page);
  await page.getByRole('button', { name: 'ULOŽIT MĚŘENÍ', exact: true }).click();
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Základ / pulz' })).toBeVisible();
  await page.getByRole('button', { name: 'Výsledky měření', exact: false }).last().click();
  await expect(page.locator('.history-item')).toHaveCount(1);
  await page.getByRole('button', { name: 'Nové měření', exact: true }).click();
  await enterMeasurement(page, '0003', '5');
  await expect(
    page.getByRole('heading', { name: 'MIMO TOLERANCI – PROVĚŘIT ZAPOJENÍ' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'ULOŽIT MĚŘENÍ', exact: true }).click();
  await page.getByRole('button', { name: 'Výsledky měření', exact: false }).last().click();
  await expect(page.locator('.history-item')).toHaveCount(2);
});

test('volitelný interval, MTP, pulz X a nezávislá historie při rozpracovaném měření', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByLabel('VÝROBNÍ ČÍSLO ELEKTROMĚRU', { exact: true }).fill('00042');
  await page.getByRole('combobox', { name: 'MTP primár', exact: true }).selectOption('200');
  await page.getByRole('combobox', { name: 'Váha pulzu Energis', exact: true }).selectOption('X');
  await page.getByRole('checkbox', { name: 'Porovnat stavy s Energis', exact: false }).check();
  await page.getByLabel('Datum a čas OD', { exact: true }).fill('2026-10-17T08:00');
  await page.getByLabel('Datum a čas DO', { exact: true }).fill('2026-10-17T08:15');
  await page.getByLabel('Stav elektroměru OD', { exact: true }).fill('100');
  await page.getByLabel('Stav elektroměru DO', { exact: true }).fill('110');
  await page.getByLabel('Spotřeba Energis za interval', { exact: true }).fill('20');
  await expect(page.getByText('Nejbližší smysluplná váha: 200 Wh', { exact: false })).toBeVisible();
  await noOverflow(page);
  await page.getByRole('button', { name: 'Použít kontrolu stavů a pokračovat' }).click();
  await expect(page.getByRole('heading', { name: 'Napětí a proudy' })).toBeVisible();
  await page.getByRole('button', { name: 'Zpět', exact: true }).click();
  // Existing helper explicitly skips the interval; skipping must clear it from the saved record.
  await enterMeasurement(page, '00042');
  await page.getByRole('button', { name: 'ULOŽIT MĚŘENÍ', exact: true }).click();
  await expect(page.getByRole('combobox', { name: 'MTP primár', exact: true })).toHaveValue('200');
  await expect(
    page.getByRole('checkbox', { name: 'Porovnat stavy s Energis', exact: false }),
  ).not.toBeChecked();
  await page.getByLabel('VÝROBNÍ ČÍSLO ELEKTROMĚRU', { exact: true }).fill('999');
  await page.getByRole('button', { name: 'Výsledky měření', exact: false }).last().click();
  await page.locator('.record-open').click();
  await expect(page.getByRole('heading', { name: '00042', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Smazat toto měření' }).click();
  await page.getByRole('button', { name: 'Zrušit', exact: true }).click();
  await expect(page.getByRole('heading', { name: '00042', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Smazat toto měření' }).click();
  await page.getByRole('button', { name: 'Trvale smazat' }).click();
  await expect(page.getByRole('heading', { name: 'Zatím žádná měření' })).toBeVisible();
  await page.getByRole('button', { name: 'Nové měření', exact: true }).click();
  await expect(page.getByLabel('VÝROBNÍ ČÍSLO ELEKTROMĚRU', { exact: true })).toHaveValue('999');
});
