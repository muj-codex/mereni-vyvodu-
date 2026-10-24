import { test, expect, type Page } from '@playwright/test';
import { fillMainCheck } from './measurement';
async function evaluate(page: Page, energis: string, example = false) {
  await page.goto('/');
  if (example) {
    await fillMainCheck(page);
    await page.getByLabel('Spotřeba Energis za interval', { exact: true }).fill('9.9');
  } else {
    await page.getByLabel('VÝROBNÍ ČÍSLO ELEKTROMĚRU', { exact: true }).fill('137777');
    await page.getByLabel('POLE / UMÍSTĚNÍ', { exact: true }).fill('pole 21');
  }
  await page
    .getByRole('button', {
      name: example ? 'POUŽÍT KONTROLU STAVŮ A POKRAČOVAT' : 'MĚŘENÍ KYORITSU',
      exact: true,
    })
    .click();
  await page.getByLabel('Typ zadaného napětí U1–U3').selectOption('phase-neutral');
  for (const i of [1, 2, 3]) {
    await page.getByLabel(`U${i}`, { exact: true }).fill(example ? '230' : '100');
    await page.getByLabel(`IL${i}`, { exact: true }).fill(example ? '2' : '333.3333333333333');
  }
  await page.getByRole('button', { name: /POKRAČOVAT NA PF A VÝKONY/ }).click();
  for (const i of [1, 2, 3]) {
    await page.getByLabel(`PF${i}`, { exact: true }).fill('1');
    await page.getByLabel(`P${i}`, { exact: true }).fill(example ? '0.46' : '33.3333333333333');
  }
  await page.getByLabel('Celkový výkon Kyoritsu', { exact: true }).fill(example ? '1.38' : '100');
  await page.getByLabel('Trend Energis', { exact: true }).fill(energis);
  await page.getByRole('button', { name: 'VYHODNOTIT MĚŘENÍ', exact: true }).click();
}
for (const [label, energis, warning] of [
  ['4.9 %', '104.9', false],
  ['5.0 %', '105', false],
  ['-5.0 %', '95', false],
  ['5.01 %', '105.01', true],
  ['-5.8 %', '94.2', true],
  ['5.0001 % (display 5 %)', '105.0001', true],
] as const) {
  test(`${label}: inline warning uses raw percentage without changing the physical check`, async ({
    page,
  }) => {
    await evaluate(page, energis);
    const row = page.locator('[data-comparison="kyoritsu-energis"]');
    if (warning) {
      await expect(row).toHaveClass('comparison-warning');
      await expect(row).toHaveCSS('border-top-color', 'rgb(180, 35, 24)');
      await expect(row).toHaveCSS('border-top-width', '3px');
      await expect(row.locator('strong')).toHaveCSS('font-weight', '800');
      await expect(row.getByLabel('Upozornění')).toHaveText('!');
      await expect(row).toContainText(
        'Rozdíl překročil 5 %. Trend Energis může být časově posunutý.',
      );
    } else {
      await expect(row).not.toHaveClass(/comparison-warning/);
      await expect(row).toHaveCSS('border-top-width', '0px');
      await expect(row.getByLabel('Upozornění')).toHaveCount(0);
    }
    await expect(
      page.getByRole('region', { name: 'Kontrola výkonu Kyoritsu', exact: true }),
    ).toContainText('U / I / PF ↔ výkon Kyoritsu: odpovídá');
    await expect(page.getByText('OVĚŘIT HODNOTY KYORITSU', { exact: true })).toHaveCount(0);
    await expect(page.locator('.comparison-warning')).toHaveCount(warning ? 1 : 0);
    if (energis === '105.0001') await expect(row).toContainText('Kyoritsu ↔ Energis: +5 %');
  });
}
test('1.38 kW versus 1.30 kW warns only at the comparison, persists identically and keeps physical consistency', async ({
  page,
}) => {
  await evaluate(page, '1.30', true);
  await expect(page.locator('[data-comparison="meter-energis"]')).toContainText(
    'Elektroměr ↔ Energis: -1 %',
  );
  await expect(page.locator('[data-comparison="meter-energis"]')).not.toHaveClass(
    /comparison-warning/,
  );
  await expect(page.locator('[data-comparison="kyoritsu-energis"]')).toContainText(
    'Kyoritsu ↔ Energis: -5,797 %',
  );
  await expect(page.locator('[data-comparison="kyoritsu-energis"]')).toHaveClass(
    'comparison-warning',
  );
  await expect(
    page.getByRole('region', { name: 'Kontrola výkonu Kyoritsu', exact: true }),
  ).toContainText('U / I / PF ↔ výkon Kyoritsu: odpovídá');
  await page.getByRole('button', { name: 'ULOŽIT MĚŘENÍ', exact: true }).click();
  await page.getByRole('button', { name: /Výsledky měření/ }).click();
  await page.locator('.record-open').click();
  await expect(page.locator('[data-comparison="kyoritsu-energis"]')).toHaveClass(
    'comparison-warning',
  );
  await expect(
    page.getByRole('region', { name: 'Kontrola výkonu Kyoritsu', exact: true }),
  ).toContainText('U / I / PF ↔ výkon Kyoritsu: odpovídá');
  await expect(page.getByText('OVĚŘIT HODNOTY KYORITSU', { exact: true })).toHaveCount(0);
});
