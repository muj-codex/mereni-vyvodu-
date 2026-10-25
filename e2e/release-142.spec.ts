import { test, expect } from '@playwright/test';
import { rates, fillFlat, fillCompany, back } from './tariffs';
test('flat validation, manual standard override and no downward clamping beyond the standard series', async ({
  page,
}) => {
  await page.goto('/');
  await fillFlat(page);
  const s = rates(page);
  const next = s.getByRole('button', { name: 'POKRAČOVAT K POROVNÁNÍ', exact: true });
  for (const invalid of ['0', '1,01']) {
    await s.getByLabel('Soudobost', { exact: true }).fill(invalid);
    await next.click();
    await expect(s.getByRole('alert')).toContainText('Soudobost musí být');
    await expect(s.getByRole('region', { name: 'Shrnutí vstupů', exact: true })).toHaveCount(0);
  }
  await s.getByLabel('Soudobost', { exact: true }).fill('1');
  await s.getByLabel('Proudové zatížení [A]', { exact: true }).fill('200');
  await next.click();
  await expect(s.getByRole('alert')).toContainText('standardní řady');
  await s.getByLabel('Použitý jistič', { exact: true }).selectOption('custom');
  await s.getByLabel('Vlastní jistič [A]', { exact: true }).fill('250');
  await next.click();
  await expect(s.getByRole('region', { name: 'Shrnutí vstupů', exact: true })).toContainText(
    'Použitý jistič3×250 A',
  );
  await back(page).click();
  await s.getByLabel('Proudové zatížení [A]', { exact: true }).fill('40');
  await s.getByLabel('Soudobost', { exact: true }).fill('0,65');
  await s.getByLabel('Použitý jistič', { exact: true }).selectOption('3×50 A');
  await next.click();
  await expect(s.getByRole('region', { name: 'Shrnutí vstupů', exact: true })).toContainText(
    'Použitý jistič3×50 A',
  );
  await expect(s.getByRole('region', { name: 'Shrnutí vstupů', exact: true })).toContainText(
    'Doporučený jistič3×32 A',
  );
});
test('company rejects invalid chronology, falling states and ambiguous DST time before offering distribution', async ({
  page,
}) => {
  await page.goto('/');
  await fillCompany(page);
  const s = rates(page);
  const next = s.getByRole('button', { name: 'POKRAČOVAT K OBLASTI', exact: true });
  await s.getByLabel('Datum druhého odečtu', { exact: true }).fill('2026-01-01');
  await next.click();
  await expect(s.getByRole('alert')).toContainText('pozdější');
  await expect(s.getByLabel('Distribuční oblast', { exact: true })).toHaveCount(0);
  await s.getByLabel('Datum druhého odečtu', { exact: true }).fill('2026-01-11');
  await s
    .getByRole('region', { name: 'Druhý odečet', exact: true })
    .getByLabel('Stav elektroměru VT / hlavní registr', { exact: true })
    .fill('999');
  await next.click();
  await expect(s.getByRole('alert')).toContainText('nižší');
  await s
    .getByRole('region', { name: 'Druhý odečet', exact: true })
    .getByLabel('Stav elektroměru VT / hlavní registr', { exact: true })
    .fill('2250');
  await s.getByLabel('Datum druhého odečtu', { exact: true }).fill('2026-10-25');
  await s.getByLabel('Čas druhého odečtu', { exact: true }).fill('02:30');
  await next.click();
  await expect(s.getByRole('alert')).toContainText('nejednoznačný');
  await s.getByLabel('Čas druhého odečtu', { exact: true }).fill('03:30');
  await next.click();
  await expect(s.getByLabel('Distribuční oblast', { exact: true })).toBeVisible();
});
