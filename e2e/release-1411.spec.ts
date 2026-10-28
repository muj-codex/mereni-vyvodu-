import { test, expect } from '@playwright/test';
import { fillFlat, rates, tariffLayout } from './tariffs';
async function sortedPrices(locator: import('@playwright/test').Locator) {
  const texts = await locator.locator('li').allTextContents();
  const prices = texts.map((t) =>
    Number(
      t
        .match(/([\d\s\u00a0]+(?:,\d+)?) Kč\/rok/)![1]
        .replace(/\s/g, '')
        .replace(',', '.'),
    ),
  );
  expect(prices.every((p, i) => Number.isFinite(p) && (i === 0 || p >= prices[i - 1]))).toBe(true);
}
const fmt = (n: number) => new Intl.NumberFormat('cs-CZ', { maximumFractionDigits: 2 }).format(n);
for (const [code, price, dist, breaker, nt] of [
  ['C02d', 3240, 2263.19, 577, false],
  ['C25d', 3240, 2208.39, 844, true],
  ['C26d', 3240, 1302.61, 2028, true],
  ['C27d', 3140, 2208.39, 802, true],
  ['C45d', 3240, 635.38, 2344, true],
  ['C56d', 3140, 635.38, 2344, true],
  ['C62d', 3240, 297.41, 800, false],
] as const) {
  test(`innogy business ${code}: exact commodity and complete same-input ranking`, async ({
    page,
  }) => {
    await page.goto('/');
    // Company mode makes the original tariff and VT/NT common to all four suppliers.
    const { fillCompany } = await import('./tariffs');
    await fillCompany(page);
    const s = rates(page);
    await s.getByLabel('Původní sazba', { exact: true }).selectOption(code);
    await s.getByLabel('Datum druhého odečtu', { exact: true }).fill('2027-01-01');
    const first = s.getByRole('region', { name: 'První odečet', exact: true });
    const second = s.getByRole('region', { name: 'Druhý odečet', exact: true });
    if (code === 'C02d')
      await second
        .getByLabel('Stav elektroměru VT / hlavní registr', { exact: true })
        .fill('13000');
    else {
      await second.getByLabel('Stav VT [kWh]', { exact: true }).fill(nt ? '5000' : '13000');
      await first.getByLabel('Stav NT [kWh]', { exact: true }).fill(nt ? '2000' : '0');
      await second.getByLabel('Stav NT [kWh]', { exact: true }).fill(nt ? '10000' : '0');
    }
    await s.getByRole('button', { name: 'POKRAČOVAT K OBLASTI', exact: true }).click();
    await s.getByLabel('Distribuční oblast', { exact: true }).selectOption('ČEZ Distribuce');
    await s.getByRole('button', { name: 'VYHODNOTIT', exact: true }).click();
    const card = s.getByRole('region', { name: 'innogy firmy', exact: true });
    await expect(card.getByLabel('Jednotkové ceny innogy', { exact: true })).toContainText(
      `${fmt(price)} Kč/MWh bez DPH`,
    );
    const net =
      12 * price +
      12 * 127 +
      (nt ? 4 : 12) * dist +
      (nt ? 8 * 116.5 : 0) +
      12 * breaker +
      12 * (164.24 + 28.3) +
      154.44;
    await expect(card.getByLabel('Roční cena innogy', { exact: true })).toContainText(
      `${fmt(net * 1.21)} Kč/rok`,
    );
    await expect(card).toContainText('127 Kč/měsíc bez DPH');
    await expect(card).not.toContainText('Spotřeba nad 30 MWh');
    const order = s.getByLabel('Pořadí firemních nabídek', { exact: true });
    await expect(order).toContainText('innogy');
    await sortedPrices(order);
    await expect(order).toContainText('ČEZ ESCO');
    await expect(order).toContainText('E.ON Variant');
    await tariffLayout(page);
  });
}
for (const [code, price, dist, breaker, nt] of [
  ['D02d', 3240, 2078.58, 409, false],
  ['D25d', 3240, 2252.45, 430, true],
  ['D27d', 3140, 2252.45, 408, true],
  ['D45d', 3240, 754.77, 888, true],
  ['D56d', 3140, 754.77, 888, true],
  ['D57d', 3140, 754.77, 896, true],
  ['D61d', 3240, 3306.67, 358, true],
] as const) {
  test(`innogy household ${code}: own regulation, shared inputs, ranking and no business warning`, async ({
    page,
  }) => {
    await page.goto('/');
    await fillFlat(page, 'D');
    const s = rates(page);
    await s.getByLabel('Použitý jistič', { exact: true }).selectOption('3×40 A');
    await s.getByRole('button', { name: 'POKRAČOVAT K POROVNÁNÍ', exact: true }).click();
    await s.getByLabel('Sazba domácnosti ČEZ', { exact: true }).selectOption(code);
    const card = s.getByRole('region', { name: 'innogy domácnosti', exact: true });
    if (nt) {
      await expect(card.getByLabel('Roční cena innogy', { exact: true })).toHaveCount(0);
      await expect(card).not.toContainText('NaN');
      await s.getByLabel('Roční spotřeba NT ČEZ [kWh]', { exact: true }).fill('8000');
    }
    const net =
      12 * price +
      12 * 127 +
      (nt ? 4 : 12) * dist +
      (nt ? 8 * 116.5 : 0) +
      12 * breaker +
      12 * (164.24 + 28.3) +
      154.44;
    await expect(card.getByLabel('Roční cena innogy', { exact: true })).toContainText(
      `${fmt(net * 1.21)} Kč/rok`,
    );
    await expect(card.getByLabel('Jednotkové ceny innogy', { exact: true })).toContainText(
      `${fmt(price)} Kč/MWh bez DPH`,
    );
    await expect(
      s.getByLabel('Pořadí domácích nabídek', { exact: true }).locator('li'),
    ).toHaveCount(3);
    await expect(s).not.toContainText(/ORLEN|Spotřeba nad 30 MWh/);
    await sortedPrices(s.getByLabel('Pořadí domácích nabídek', { exact: true }));
    await s.getByLabel('Počet fází pro cenu ČEZ', { exact: true }).selectOption('1');
    await s.getByLabel('Jistič ČEZ [A]', { exact: true }).fill('32');
    await expect(card).toContainText('1×32 A');
    await expect(card.getByLabel('Roční cena innogy', { exact: true })).toBeVisible();
    await tariffLayout(page);
  });
}
test('30 MWh boundary only warns businesses; households have no limit, other areas are unavailable', async ({
  page,
}) => {
  await page.goto('/');
  await fillFlat(page);
  const s = rates(page);
  await s.getByLabel('Spotřeba za období [kWh]', { exact: true }).fill('2500');
  await s.getByRole('button', { name: 'POKRAČOVAT K POROVNÁNÍ', exact: true }).click();
  const card = s.getByRole('region', { name: 'innogy firmy', exact: true });
  await expect(card).not.toContainText('Spotřeba nad 30 MWh');
  await s.getByRole('button', { name: '← Zpět', exact: true }).click();
  await s.getByLabel('Spotřeba za období [kWh]', { exact: true }).fill('2501');
  await s.getByRole('button', { name: 'POKRAČOVAT K POROVNÁNÍ', exact: true }).click();
  await expect(card).toContainText('Spotřeba nad 30 MWh');
  await expect(card.getByLabel('Roční cena innogy', { exact: true })).toBeVisible();
  await expect(s.getByLabel('Pořadí firemních nabídek', { exact: true })).toContainText('innogy');
  for (const area of ['EG.D', 'PREdistribuce']) {
    await s.getByRole('button', { name: '← Zpět', exact: true }).click();
    await s.getByLabel('Distribuční oblast', { exact: true }).selectOption(area);
    await s.getByRole('button', { name: 'POKRAČOVAT K POROVNÁNÍ', exact: true }).click();
    await expect(card).toContainText(
      'Pro tuto distribuční oblast zatím nemáme ověřený ceník innogy',
    );
    await expect(card.getByLabel('Roční cena innogy', { exact: true })).toHaveCount(0);
  }
  await page.goto('/');
  await fillFlat(page, 'D');
  await s.getByLabel('Spotřeba za období [kWh]', { exact: true }).fill('3000');
  await s.getByRole('button', { name: 'POKRAČOVAT K POROVNÁNÍ', exact: true }).click();
  const home = s.getByRole('region', { name: 'innogy domácnosti', exact: true });
  await expect(home.getByLabel('Roční cena innogy', { exact: true })).toBeVisible();
  await expect(s).not.toContainText(/ORLEN|Spotřeba nad 30 MWh/);
  for (const area of ['EG.D', 'PREdistribuce']) {
    await s.getByRole('button', { name: '← Zpět', exact: true }).click();
    await s.getByLabel('Distribuční oblast', { exact: true }).selectOption(area);
    await s.getByRole('button', { name: 'POKRAČOVAT K POROVNÁNÍ', exact: true }).click();
    await expect(home).toContainText(
      'Pro tuto distribuční oblast zatím nemáme ověřený ceník innogy',
    );
    await expect(
      s.getByLabel('Pořadí domácích nabídek', { exact: true }).locator('li'),
    ).toHaveCount(2);
  }
});
