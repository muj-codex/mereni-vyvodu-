import { test, expect } from '@playwright/test';
import { fillMainCheck, finishPower } from './measurement';

test('reading navigation has only three entries and saved results stay in global results', async ({
  page,
}) => {
  await page.goto('/');
  const nav = page.getByRole('navigation', { name: 'Odečty', exact: true });
  await nav.getByRole('button', { name: 'Jednotlivý odečet', exact: true }).click();
  await expect(nav.getByRole('button')).toHaveText(['Jednotlivý odečet', 'Série odečtů', 'Stylus']);
  await expect(page.getByRole('button', { name: 'Historie odečtů', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: /Výsledky měření/ }).click();
  await expect(nav).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Výsledky měření', exact: true })).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'Zatím žádná měření', exact: true }),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: 'ZÁLOHOVAT DATA', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Nové měření', exact: true }).click();
  await expect(nav.getByRole('button')).toHaveCount(3);
});

test('only the first measurement heading disappears; remaining form can complete and save', async ({
  page,
}) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /Základ.*kontrola stav/i })).toHaveCount(0);
  await expect(page.locator('.page-heading h1')).toHaveCount(0);
  await expect(page.getByText('ELEKTROMĚR', { exact: true })).toBeVisible();
  await expect(page.getByText('KROK 1 Z 6', { exact: true })).toBeVisible();
  await expect(page.locator('.progress-track button')).toHaveCount(6);
  await expect(
    page.getByText('Identifikace elektroměru a nastavení převodů.', { exact: true }),
  ).toBeVisible();
  await expect(page.getByText('IDENTIFIKACE MĚŘENÍ', { exact: true })).toBeVisible();
  await expect(page.getByLabel('DATUM', { exact: true })).toBeVisible();
  await expect(page.getByLabel('TRAFOSTANICE', { exact: true })).toBeVisible();
  await fillMainCheck(page);
  await page
    .getByRole('button', { name: 'POUŽÍT KONTROLU STAVŮ A POKRAČOVAT', exact: true })
    .click();
  await expect(page.getByRole('heading', { name: 'Napětí a proudy', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: '← Zpět', exact: true }).first()).toBeVisible();
  await finishPower(page);
  await page.getByRole('button', { name: 'ULOŽIT MĚŘENÍ', exact: true }).click();
  await expect(page.getByLabel('VÝROBNÍ ČÍSLO ELEKTROMĚRU', { exact: true })).toHaveValue('136777');
  await page.getByRole('button', { name: /Výsledky měření/ }).click();
  await expect(
    page.getByRole('region', { name: 'MĚŘENÍ', exact: true }).locator('.record-open'),
  ).toHaveCount(1);
});
