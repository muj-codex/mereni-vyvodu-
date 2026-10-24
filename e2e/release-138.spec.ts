import { test, expect } from '@playwright/test';

test('one reading navigation selects all four views, retains drafts and hides in results', async ({
  page,
}) => {
  await page.goto('/');
  const nav = page.getByRole('navigation', { name: 'Odečty', exact: true });
  const labels = ['Jednotlivý odečet', 'Série odečtů', 'Stylus', 'Historie odečtů'];
  const single = page.getByLabel('Číslo elektroměru', { exact: true });
  for (const label of labels) {
    await nav.getByRole('button', { name: label, exact: true }).click();
    await expect(nav).toHaveCount(1);
    await expect(nav.getByRole('button')).toHaveCount(4);
    await expect(nav.locator('button.active')).toHaveCount(1);
    await expect(nav.getByRole('button', { name: label, exact: true })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await expect(page.getByRole('button', { name: label, exact: true })).toHaveCount(1);
    await expect(
      page.getByRole('button', { name: 'MĚŘENÍ + ODEČET ELEKTROMĚRU / ENERGIS', exact: true }),
    ).toBeVisible();
    if (label === 'Jednotlivý odečet') await single.fill('138777');
    if (label === 'Série odečtů') {
      await expect(page.getByRole('heading', { name: label, exact: true })).toBeVisible();
      await expect(single).toHaveValue('138777');
    }
    if (label === 'Stylus') await expect(page.getByLabel('Volný zápis STYLUS')).toBeVisible();
    if (label === 'Historie odečtů') {
      await expect(
        page.getByRole('heading', { name: 'Odečtové série', exact: true }),
      ).toBeVisible();
      await expect(page.getByRole('button', { name: '← Zpět', exact: true })).toBeVisible();
    }
    expect(await nav.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true);
    expect(new URL(page.url()).pathname).toBe('/');
  }
  await nav.getByRole('button', { name: labels[0], exact: true }).click();
  await expect(single).toHaveValue('138777');
  await page.getByRole('button', { name: /Výsledky měření/ }).click();
  await expect(nav).toHaveCount(0);
  await expect(page.getByRole('button', { name: /Nové měření/ })).toBeVisible();
});
