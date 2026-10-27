import { test, expect } from '@playwright/test';
import { fillFlat, fillCompany, rates, tariffLayout } from './tariffs';
const fmt = (n: number) => new Intl.NumberFormat('cs-CZ', { maximumFractionDigits: 2 }).format(n);
for (const [area, dist02, breaker02, dist25, ntPrice, dist57, breaker57, breaker25] of [
  ['ČEZ Distribuce', 2078.58, 409, 2252.45, 116.5, 754.77, 3093, 430],
  ['EG.D', 2295.34, 400, 2243.88, 224.3, 749.87, 2631, 392],
  ['PREdistribuce', 1516.53, 347, 1656.49, 175.2, 421.52, 2494, 320],
] as const) {
  test(`ČEZ vs E.ON ${area}: shared D02d/D25d/D57d, annual totals, high breaker, no ORLEN`, async ({
    page,
  }) => {
    await page.goto('/');
    await fillFlat(page, 'D');
    const s = rates(page);
    await s.getByLabel('Distribuční oblast', { exact: true }).selectOption(area);
    await s.getByLabel('Použitý jistič', { exact: true }).selectOption('3×40 A');
    await s.getByRole('button', { name: 'POKRAČOVAT K POROVNÁNÍ', exact: true }).click();
    const eon = s.getByRole('region', { name: 'E.ON domácnosti', exact: true });
    const comparison = eon.getByRole('region', {
      name: 'Porovnání domácností ČEZ a E.ON',
      exact: true,
    });
    await expect(s).not.toContainText(/ORLEN/i);
    await expect(eon).toContainText(area);
    await expect(eon).toContainText('3 roky s fixací ceny');
    await expect(eon.getByLabel('Roční cena E.ON', { exact: true })).toContainText(
      `${fmt((12 * (2899 + dist02 + 28.3 + 164.24) + 12 * (160 + breaker02 + 12.87)) * 1.21)} Kč/rok`,
    );
    await expect(comparison).toContainText('Levnější nabídka: E.ON. Rozdíl 3 863,48 Kč/rok');
    await s.getByLabel('Sazba domácnosti ČEZ', { exact: true }).selectOption('D25d');
    await expect(eon.getByLabel('Roční cena E.ON', { exact: true })).toHaveCount(0);
    await expect(comparison).toHaveCount(0);
    await s.getByLabel('Roční spotřeba NT ČEZ [kWh]', { exact: true }).fill('8000');
    await expect(eon).toContainText('společná sazba D25d · 2T · 3×40 A');
    await expect(eon).toContainText('VT 4 000 kWh/rok · NT 8 000 kWh/rok');
    await expect(eon.getByLabel('Roční cena E.ON', { exact: true })).toContainText(
      `${fmt((4 * (3029 + dist25 + 28.3 + 164.24) + 8 * (2726 + ntPrice + 28.3 + 164.24) + 12 * (160 + breaker25 + 12.87)) * 1.21)} Kč/rok`,
    );
    await expect(comparison).toContainText('Rozdíl 3 825,68 Kč/rok');
    await s.getByLabel('Sazba domácnosti ČEZ', { exact: true }).selectOption('D57d');
    await s.getByLabel('Jistič ČEZ [A]', { exact: true }).fill('80');
    await expect(eon).toContainText('společná sazba D57d · 2T · 3×80 A');
    await expect(eon.getByLabel('Roční cena E.ON', { exact: true })).toContainText(
      `${fmt((4 * (3045 + dist57 + 28.3 + 164.24) + 8 * (2884 + ntPrice + 28.3 + 164.24) + 12 * (160 + breaker57 + 12.87)) * 1.21)} Kč/rok`,
    );
    await expect(comparison).toContainText('Rozdíl 5 498,77 Kč/rok');
    await expect(comparison).toContainText('Cena není potvrzením nároku na distribuční sazbu.');
    await expect(eon).toContainText('POZE 0 Kč');
    await s.getByLabel('Roční spotřeba NT ČEZ [kWh]', { exact: true }).fill('12001');
    await expect(comparison).toHaveCount(0);
    await expect(eon.getByLabel('Roční cena E.ON', { exact: true })).toHaveCount(0);
    await s.getByLabel('Roční spotřeba NT ČEZ [kWh]', { exact: true }).fill('8000');
    await s.getByLabel('Počet fází pro cenu ČEZ', { exact: true }).selectOption('1');
    await s.getByLabel('Jistič ČEZ [A]', { exact: true }).fill('25');
    await expect(eon).toContainText('1×25 A');
    await expect(eon.getByLabel('Roční cena E.ON', { exact: true })).toBeVisible();
    await tariffLayout(page);
  });
}
test('low consumption can make ČEZ cheaper; comparison follows the common inputs rather than a fixed supplier recommendation', async ({
  page,
}) => {
  await page.goto('/');
  await fillFlat(page, 'D');
  const s = rates(page);
  await s.getByLabel('Délka období', { exact: true }).selectOption('12');
  await s.getByLabel('Použitý jistič', { exact: true }).selectOption('3×40 A');
  await s.getByRole('button', { name: 'POKRAČOVAT K POROVNÁNÍ', exact: true }).click();
  await expect(
    s.getByRole('region', { name: 'Porovnání domácností ČEZ a E.ON', exact: true }),
  ).toContainText('Levnější nabídka: ČEZ. Rozdíl 10,79 Kč/rok');
});
test('E.ON company Variant shows fixed prices and C coverage while the historical SPOT card is inactive', async ({
  page,
}) => {
  await page.goto('/');
  await fillFlat(page);
  const s = rates(page);
  await s.getByLabel('Použitý jistič', { exact: true }).selectOption('3×40 A');
  await s.getByRole('button', { name: 'POKRAČOVAT K POROVNÁNÍ', exact: true }).click();
  const card = s.getByRole('region', { name: 'E.ON firmy Variant', exact: true });
  await expect(card).toContainText('Variant na 2 roky 10/26 Profi');
  await expect(card).toContainText('Fixace 2 roky');
  await expect(card.getByLabel('Jednotkové ceny E.ON Variant', { exact: true })).toContainText(
    '139 Kč/měsíc bez DPH',
  );
  await expect(card.getByLabel('Roční cena E.ON Variant', { exact: true })).toContainText(
    '89 785,87 Kč/rok',
  );
  await expect(s.getByRole('region', { name: 'E.ON firmy SPOT', exact: true })).toHaveCount(0);
  for (const code of [
    'C01d',
    'C02d',
    'C03d',
    'C25d',
    'C26d',
    'C27d',
    'C35d',
    'C45d',
    'C46d',
    'C56d',
    'C62d',
  ]) {
    await card
      .getByLabel('Sazba E.ON Variant a společného porovnání', { exact: true })
      .selectOption(code);
    await expect(card).not.toContainText('Pro tuto sazbu nemáme ověřený cenový podklad.');
  }
  await card
    .getByLabel('Sazba E.ON Variant a společného porovnání', { exact: true })
    .selectOption('C60d');
  await expect(card).toContainText('Pro tuto sazbu nemáme ověřený cenový podklad.');
  await expect(card.getByLabel('Roční cena E.ON Variant', { exact: true })).toHaveCount(0);
  await expect(s.getByLabel('Konečná roční cena ORLEN', { exact: true })).toContainText(
    '81 959,59 Kč/rok',
  );
  await tariffLayout(page);
});
test('expanded C46d distribution is shared with ESCO only for the verified area and measured VT/NT', async ({
  page,
}) => {
  await page.goto('/');
  await fillCompany(page);
  const s = rates(page);
  await s.getByLabel('Původní sazba', { exact: true }).selectOption('C46d');
  const first = s.getByRole('region', { name: 'První odečet', exact: true });
  const second = s.getByRole('region', { name: 'Druhý odečet', exact: true });
  await second.getByLabel('Stav VT [kWh]', { exact: true }).fill('1100');
  await first.getByLabel('Stav NT [kWh]', { exact: true }).fill('2000');
  await second.getByLabel('Stav NT [kWh]', { exact: true }).fill('2200');
  await s.getByRole('button', { name: 'POKRAČOVAT K OBLASTI', exact: true }).click();
  await s.getByLabel('Distribuční oblast', { exact: true }).selectOption('ČEZ Distribuce');
  await s.getByRole('button', { name: 'VYHODNOTIT', exact: true }).click();
  const eon = s.getByRole('region', { name: 'E.ON firmy Variant', exact: true });
  const esco = s.getByRole('region', { name: 'ČEZ ESCO Elektřina 24', exact: true });
  const net =
    10.95 * (2887 + 28.3 + 164.24) + 3.65 * 3124.85 + 7.3 * 116.5 + 12 * (95 + 2368 + 12.87);
  await expect(esco.getByLabel('Roční cena Elektřina 24', { exact: true })).toContainText(
    `${fmt(net * 1.21)} Kč/rok`,
  );
  await expect(eon.getByLabel('Roční položky E.ON Variant', { exact: true })).toContainText(
    '28 416 Kč/rok',
  );
  await expect(eon.getByLabel('Roční cena E.ON Variant', { exact: true })).toBeVisible();
  await s.getByRole('button', { name: '← Zpět', exact: true }).click();
  await s.getByLabel('Distribuční oblast', { exact: true }).selectOption('EG.D');
  await s.getByRole('button', { name: 'VYHODNOTIT', exact: true }).click();
  await expect(esco.getByLabel('Roční cena Elektřina 24', { exact: true })).toHaveCount(0);
  await expect(eon.getByLabel('Roční cena E.ON Variant', { exact: true })).toHaveCount(0);
});
test('both main business alternatives remain fixed after the former SPOT review date', async ({
  page,
}) => {
  await page.clock.setFixedTime(new Date('2026-11-16T12:00:00Z'));
  await page.goto('/');
  await fillFlat(page);
  const s = rates(page);
  await s.getByRole('button', { name: 'POKRAČOVAT K POROVNÁNÍ', exact: true }).click();
  const esco = s.getByRole('region', { name: 'ČEZ ESCO Elektřina 24', exact: true });
  await expect(esco).toContainText('Fixace 24 měsíců');
  await expect(esco).toContainText('2 860 Kč/MWh');
  await expect(esco).not.toContainText('Doporučena kontrola ceníku.');
  const variant = s.getByRole('region', { name: 'E.ON firmy Variant', exact: true });
  await expect(variant).toContainText('Fixace 2 roky');
  await expect(variant.getByLabel('Roční cena E.ON Variant', { exact: true })).toBeVisible();
  await expect(s).not.toContainText(/SPOT(?![\p{L}])|září 2026/u);
  await expect(
    variant.getByRole('button', { name: 'AKTUALIZOVAT CENÍK', exact: true }),
  ).toHaveCount(0);
});
