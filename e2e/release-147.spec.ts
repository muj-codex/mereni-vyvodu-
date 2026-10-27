import { test, expect } from '@playwright/test';
import { fillFlat, fillCompany, rates, tariffLayout } from './tariffs';

for (const [area, dist02, breaker02, dist25, nt25, breaker25, high57] of [
  ['ČEZ Distribuce', 2078.58, 409, 2252.45, 116.5, 677, 3093],
  ['EG.D', 2295.34, 400, 2243.88, 224.3, 618, 2631],
  ['PREdistribuce', 1516.53, 347, 1656.49, 175.2, 505, 2494],
] as const) {
  test(`household ${area}: D02d, D25d, high D57d, VAT, POZE and no ORLEN`, async ({ page }) => {
    await page.goto('/');
    await fillFlat(page, 'D');
    const s = rates(page);
    await s.getByLabel('Distribuční oblast', { exact: true }).selectOption(area);
    await s.getByLabel('Použitý jistič', { exact: true }).selectOption('3×40 A');
    await s.getByRole('button', { name: 'POKRAČOVAT K POROVNÁNÍ', exact: true }).click();
    const card = s.getByRole('region', { name: 'ČEZ domácnosti', exact: true });
    const fmt = (n: number) =>
      new Intl.NumberFormat('cs-CZ', { maximumFractionDigits: 2 }).format(n);
    await expect(card).toContainText(`Distribuční oblast: ${area}`);
    await expect(s).not.toContainText(/ORLEN/i);
    const amount02 =
      (12 * (3190.08 + dist02 + 28.3 + 164.24) + 12 * (135 + breaker02 + 12.87)) * 1.21;
    await expect(card.getByLabel('Roční cena ČEZ', { exact: true })).toContainText(
      `${fmt(amount02)} Kč/rok`,
    );
    await expect(card.getByLabel('Jednotkové ceny ČEZ', { exact: true })).toContainText(
      `${fmt(dist02)} Kč/MWh bez DPH`,
    );
    await card.getByLabel('Sazba domácnosti ČEZ', { exact: true }).selectOption('D25d');
    await expect(card.getByLabel('Roční cena ČEZ', { exact: true })).toHaveCount(0);
    await expect(card).toContainText('zadejte roční spotřebu NT');
    await card.getByLabel('Roční spotřeba NT ČEZ [kWh]', { exact: true }).fill('8000');
    await card.getByLabel('Jistič ČEZ [A]', { exact: true }).fill('63');
    const amount25 =
      (4 * (3272.73 + dist25 + 28.3 + 164.24) +
        8 * (3057.85 + nt25 + 28.3 + 164.24) +
        12 * (121 + breaker25 + 12.87)) *
      1.21;
    await expect(card).toContainText('D25d · 2T · 3×63 A · VT 4 000 kWh/rok · NT 8 000 kWh/rok');
    await expect(card.getByLabel('Roční cena ČEZ', { exact: true })).toContainText(
      `${fmt(amount25)} Kč/rok`,
    );
    await expect(card).toContainText('POZE: minimum');
    await card.getByLabel('Roční spotřeba NT ČEZ [kWh]', { exact: true }).fill('12001');
    await expect(card.getByLabel('Roční cena ČEZ', { exact: true })).toHaveCount(0);
    await card.getByLabel('Roční spotřeba NT ČEZ [kWh]', { exact: true }).fill('8000');
    await card.getByLabel('Sazba domácnosti ČEZ', { exact: true }).selectOption('D57d');
    await card.getByLabel('Jistič ČEZ [A]', { exact: true }).fill('80');
    await expect(card.getByLabel('Jednotkové ceny ČEZ', { exact: true })).toContainText(
      `${fmt(high57)} Kč/měsíc bez DPH`,
    );
    await card.getByLabel('Počet fází pro cenu ČEZ', { exact: true }).selectOption('1');
    await card.getByLabel('Jistič ČEZ [A]', { exact: true }).fill('25');
    await expect(card).toContainText('1×25 A');
    await tariffLayout(page);
  });
}
test('business fixed Electricity 24 replaces the old SPOT reference and preserves verified ORLEN', async ({
  page,
}) => {
  await page.goto('/');
  await fillFlat(page);
  const s = rates(page);
  await s.getByLabel('Použitý jistič', { exact: true }).selectOption('3×40 A');
  await s.getByRole('button', { name: 'POKRAČOVAT K POROVNÁNÍ', exact: true }).click();
  const card = s.getByRole('region', { name: 'ČEZ ESCO Elektřina 24', exact: true });
  await expect(card).toContainText('Fixace 24 měsíců');
  await expect(card).toContainText('všechna distribuční území');
  await expect(card).toContainText('2 860 Kč/MWh bez DPH');
  await expect(card).toContainText('95 Kč/měsíc bez DPH');
  await expect(card.getByLabel('Roční cena Elektřina 24', { exact: true })).toContainText(
    '87 128,71 Kč/rok',
  );
  await expect(s.getByLabel('Konečná roční cena ORLEN', { exact: true })).toContainText(
    '81 959,59 Kč/rok',
  );
  for (const [code, price] of [
    ['C25d', '2 839'],
    ['C45d', '2 887'],
    ['C62d', '2 860'],
  ]) {
    await card.getByLabel('Sazba ČEZ ESCO Elektřina 24', { exact: true }).selectOption(code);
    await expect(card).toContainText(`${price} Kč/MWh bez DPH`);
    if (code === 'C62d')
      await expect(card.getByLabel('Roční cena Elektřina 24', { exact: true })).toBeVisible();
    else await expect(card.getByLabel('Roční cena Elektřina 24', { exact: true })).toHaveCount(0);
  }
  await card.getByLabel('Sazba ČEZ ESCO Elektřina 24', { exact: true }).selectOption('C55d');
  await expect(card).toContainText('ověřenou pouze obchodní cenu');
  await expect(card.getByLabel('Roční cena Elektřina 24', { exact: true })).toHaveCount(0);
  await tariffLayout(page);
});
test('company fixed ESCO retains explicit unavailable distribution rather than guessing other areas', async ({
  page,
}) => {
  await page.goto('/');
  await fillCompany(page);
  const s = rates(page);
  await s.getByRole('button', { name: 'POKRAČOVAT K OBLASTI', exact: true }).click();
  await s.getByLabel('Distribuční oblast', { exact: true }).selectOption('EG.D');
  await s.getByRole('button', { name: 'VYHODNOTIT', exact: true }).click();
  const card = s.getByRole('region', { name: 'ČEZ ESCO Elektřina 24', exact: true });
  await expect(card).toContainText('Pro tuto distribuční oblast nemáme ověřenou regulovanou část.');
  await expect(card).toContainText('Distribuční oblast odběrného místa: EG.D');
  await expect(card.getByLabel('Roční cena Elektřina 24', { exact: true })).toHaveCount(0);
  await expect(s.getByRole('region', { name: 'ČEZ domácnosti', exact: true })).toHaveCount(0);
});
test('fixed Electricity 24 keeps its fixed data after the old SPOT refresh window', async ({
  page,
}) => {
  await page.clock.setFixedTime(new Date('2026-11-16T12:00:00Z'));
  await page.goto('/');
  await fillFlat(page);
  const s = rates(page);
  await s.getByRole('button', { name: 'POKRAČOVAT K POROVNÁNÍ', exact: true }).click();
  const card = s.getByRole('region', { name: 'ČEZ ESCO Elektřina 24', exact: true });
  await expect(card).not.toContainText('Doporučena kontrola ceníku.');
  await expect(s).not.toContainText(/SPOT(?![\p{L}])|září 2026/u);
  await expect(card.getByLabel('Roční cena Elektřina 24', { exact: true })).toBeVisible();
});
test('C25d company comparison uses actual annual VT/NT with fixed equal commodity prices', async ({
  page,
}) => {
  await page.goto('/');
  await fillCompany(page);
  const s = rates(page);
  await s.getByLabel('Původní sazba', { exact: true }).selectOption('C25d');
  const first = s.getByRole('region', { name: 'První odečet', exact: true });
  const second = s.getByRole('region', { name: 'Druhý odečet', exact: true });
  await second.getByLabel('Stav VT [kWh]', { exact: true }).fill('1100');
  await first.getByLabel('Stav NT [kWh]', { exact: true }).fill('2000');
  await second.getByLabel('Stav NT [kWh]', { exact: true }).fill('2200');
  await s.getByRole('button', { name: 'POKRAČOVAT K OBLASTI', exact: true }).click();
  await s.getByLabel('Distribuční oblast', { exact: true }).selectOption('ČEZ Distribuce');
  await s.getByRole('button', { name: 'VYHODNOTIT', exact: true }).click();
  const card = s.getByRole('region', { name: 'ČEZ ESCO Elektřina 24', exact: true });
  const net =
    10.95 * (2839 + 164.24 + 28.3) + 3.65 * 2208.39 + 7.3 * 116.5 + 12 * (95 + 844 + 12.87);
  const expected = new Intl.NumberFormat('cs-CZ', { maximumFractionDigits: 2 }).format(net * 1.21);
  await expect(card.getByLabel('Roční cena Elektřina 24', { exact: true })).toContainText(
    `${expected} Kč/rok`,
  );
  await expect(s.getByLabel('Konečná roční cena ORLEN', { exact: true })).toBeVisible();
});
