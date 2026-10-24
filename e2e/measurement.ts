import type { Page } from '@playwright/test';
export async function finishPower(page: Page) {
  for (const i of [1, 2, 3]) {
    await page.getByLabel(`U${i}`, { exact: true }).fill('230');
    if (await page.getByLabel(`IL${i}`, { exact: true }).count())
      await page.getByLabel(`IL${i}`, { exact: true }).fill('10');
  }
  await page.getByRole('button', { name: /POKRAČOVAT NA PF A VÝKONY/ }).click();
  for (const i of [1, 2, 3]) {
    if (await page.getByLabel(`PF${i}`, { exact: true }).count()) {
      await page.getByLabel(`PF${i}`, { exact: true }).fill('1');
      await page.getByLabel(`P${i}`, { exact: true }).fill('2.3');
    }
  }
  await page.getByLabel('Celkový výkon Kyoritsu', { exact: true }).fill('6.9');
  await page.getByLabel('Trend Energis', { exact: true }).fill('6.8');
  await page.getByRole('button', { name: 'VYHODNOTIT MĚŘENÍ', exact: true }).click();
}
export async function fillMainCheck(page: Page) {
  await page.getByLabel('VÝROBNÍ ČÍSLO ELEKTROMĚRU', { exact: true }).fill('136777');
  await page.getByLabel('DATUM', { exact: true }).fill('2026-10-24');
  await page.getByLabel('POLE / UMÍSTĚNÍ', { exact: true }).fill('pole 21');
  await page.getByLabel('TRAFOSTANICE', { exact: true }).selectOption('TS 4601/251');
  await page.getByRole('checkbox', { name: 'Porovnat stavy s Energis' }).check();
  for (const [label, value] of [
    ['Datum OD', '2026-10-24'],
    ['Čas OD', '11:00'],
    ['Datum DO', '2026-10-24'],
    ['Čas DO', '12:00'],
    ['Stav elektroměru OD', '100'],
    ['Stav elektroměru DO', '110'],
    ['Spotřeba Energis za interval', '10'],
  ])
    await page.getByLabel(label, { exact: true }).fill(value);
}
