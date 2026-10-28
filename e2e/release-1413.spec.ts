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
  ['C02d', 2868, 2263.19, 577, null],
  ['C25d', 2987, 2208.39, 844, 2702],
  ['C35d', 2998, 635.38, 2344, 2802],
  ['C45d', 2996, 635.8, 2344, 2854],
  ['C56d', 2996, 635.38, 2344, 2854],
  ['C62d', 2878, 297.41, 800, null],
] as const) {
  test(`Centropol business ${code}: exact commodity and complete same-input ranking`, async ({
    page,
  }) => {
    await page.goto('/');
    // Company mode makes the original tariff and VT/NT common to all five suppliers.
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
    const card = s.getByRole('region', { name: 'Centropol firmy', exact: true });
    await expect(card.getByLabel('Jednotkové ceny Centropol', { exact: true })).toContainText(
      `${fmt(price)} Kč/MWh bez DPH`,
    );
    const net =
      (nt ? 4 * price + 8 * nt : 12 * price) +
      12 * 130 +
      (nt ? 4 : 12) * dist +
      (nt ? 8 * 116.5 : 0) +
      12 * breaker +
      12 * (164.24 + 28.3) +
      154.44;
    await expect(card.getByLabel('Roční cena Centropol', { exact: true })).toContainText(
      `${fmt(net * 1.21)} Kč/rok`,
    );
    await expect(card).toContainText('130 Kč/měsíc bez DPH');
    await expect(card).not.toContainText('Spotřeba nad 30 MWh');
    await expect(card).toContainText('Ceník účinný od 21. 9. 2026');
    await expect(
      s.getByLabel('Rozdíly Centropol proti dodavatelům', { exact: true }),
    ).toContainText('ČEZ ESCO');
    const order = s.getByLabel('Pořadí firemních nabídek', { exact: true });
    await expect(order).toContainText('Centropol');
    await sortedPrices(order);
    await expect(order).toContainText('ČEZ ESCO');
    await expect(order).toContainText('E.ON Variant');
    await tariffLayout(page);
  });
}
for (const [code, price, dist, breaker, nt] of [
  ['D02d', 2718, 2078.58, 409, null],
  ['D25d', 2854, 2252.45, 430, 2583],
  ['D35d', 2881, 754.77, 888, 2773],
  ['D45d', 2854, 754.77, 888, 2800],
  ['D57d', 2854, 754.77, 896, 2800],
  ['D61d', 2854, 3306.67, 358, 2610],
] as const) {
  test(`Centropol household ${code}: own regulation, shared inputs, ranking and no business warning`, async ({
    page,
  }) => {
    await page.goto('/');
    await fillFlat(page, 'D');
    const s = rates(page);
    await s.getByLabel('Použitý jistič', { exact: true }).selectOption('3×40 A');
    await s.getByRole('button', { name: 'POKRAČOVAT K POROVNÁNÍ', exact: true }).click();
    await s.getByLabel('Sazba domácnosti ČEZ', { exact: true }).selectOption(code);
    const card = s.getByRole('region', { name: 'Centropol domácnosti', exact: true });
    if (nt) {
      await expect(card.getByLabel('Roční cena Centropol', { exact: true })).toHaveCount(0);
      await expect(card).not.toContainText('NaN');
      await s.getByLabel('Roční spotřeba NT ČEZ [kWh]', { exact: true }).fill('8000');
    }
    const net =
      (nt ? 4 * price + 8 * nt : 12 * price) +
      12 * 135 +
      (nt ? 4 : 12) * dist +
      (nt ? 8 * 116.5 : 0) +
      12 * breaker +
      12 * (164.24 + 28.3) +
      154.44;
    await expect(card.getByLabel('Roční cena Centropol', { exact: true })).toContainText(
      `${fmt(net * 1.21)} Kč/rok`,
    );
    await expect(card.getByLabel('Jednotkové ceny Centropol', { exact: true })).toContainText(
      `${fmt(price)} Kč/MWh bez DPH`,
    );
    await expect(
      s.getByLabel('Pořadí domácích nabídek', { exact: true }).locator('li'),
    ).toHaveCount(6);
    await expect(s).not.toContainText(/ORLEN|Spotřeba nad 30 MWh/);
    await sortedPrices(s.getByLabel('Pořadí domácích nabídek', { exact: true }));
    await s.getByLabel('Počet fází pro cenu ČEZ', { exact: true }).selectOption('1');
    await s.getByLabel('Jistič ČEZ [A]', { exact: true }).fill('32');
    await expect(card).toContainText('1×32 A');
    await expect(card.getByLabel('Roční cena Centropol', { exact: true })).toBeVisible();
    await tariffLayout(page);
  });
}

for (const [area, cDist, cBreaker, dDist, dBreaker] of [
  ['EG.D', 3185.49, 604, 2295.34, 400],
  ['PREdistribuce', 2593.88, 475, 1516.53, 347],
] as const) {
  for (const customer of ['C', 'D'] as const) {
    test(`Centropol ${customer} ${area}: full own regulated annual cost and correct common ranking`, async ({
      page,
    }) => {
      await page.goto('/');
      await fillFlat(page, customer);
      const s = rates(page);
      await s.getByLabel('Distribuční oblast', { exact: true }).selectOption(area);
      await s.getByLabel('Použitý jistič', { exact: true }).selectOption('3×40 A');
      await s.getByRole('button', { name: 'POKRAČOVAT K POROVNÁNÍ', exact: true }).click();
      const card = s.getByRole('region', {
        name: customer === 'C' ? 'Centropol firmy' : 'Centropol domácnosti',
        exact: true,
      });
      const net =
        12 *
          ((customer === 'C' ? 2868 : 2718) + (customer === 'C' ? cDist : dDist) + 164.24 + 28.3) +
        12 * ((customer === 'C' ? 130 : 135) + (customer === 'C' ? cBreaker : dBreaker) + 12.87);
      await expect(card.getByLabel('Roční cena Centropol', { exact: true })).toContainText(
        `${fmt(net * 1.21)} Kč/rok`,
      );
      await expect(card).toContainText(area);
      const order = s.getByLabel(
        customer === 'C' ? 'Pořadí firemních nabídek' : 'Pořadí domácích nabídek',
        { exact: true },
      );
      await expect(order).toContainText('Centropol');
      await expect(order.locator('li')).toHaveCount(customer === 'C' ? 2 : 4);
      await sortedPrices(order);
      if (customer === 'D') {
        await expect(s).not.toContainText(/ORLEN/);
        await s.getByLabel('Sazba domácnosti ČEZ', { exact: true }).selectOption('D57d');
        await s.getByLabel('Roční spotřeba NT ČEZ [kWh]', { exact: true }).fill('8000');
        await s.getByLabel('Jistič ČEZ [A]', { exact: true }).fill('80');
        await expect(card.getByLabel('Roční cena Centropol', { exact: true })).toBeVisible();
      }
      await tariffLayout(page);
    });
  }
}
test('Centropol C55d is verified commodity only in all areas and never gets a complete annual rank', async ({
  page,
}) => {
  await page.goto('/');
  const { fillCompany } = await import('./tariffs');
  await fillCompany(page);
  const s = rates(page);
  await s.getByLabel('Původní sazba', { exact: true }).selectOption('C55d');
  const first = s.getByRole('region', { name: 'První odečet', exact: true });
  const second = s.getByRole('region', { name: 'Druhý odečet', exact: true });
  await first.getByLabel('Stav NT [kWh]', { exact: true }).fill('0');
  await second.getByLabel('Stav NT [kWh]', { exact: true }).fill('1000');
  await s.getByRole('button', { name: 'POKRAČOVAT K OBLASTI', exact: true }).click();
  for (const area of ['ČEZ Distribuce', 'EG.D', 'PREdistribuce']) {
    await s.getByLabel('Distribuční oblast', { exact: true }).selectOption(area);
    await s.getByRole('button', { name: 'VYHODNOTIT', exact: true }).click();
    const card = s.getByRole('region', { name: 'Centropol firmy', exact: true });
    await expect(card).toContainText('2 996 Kč/MWh bez DPH');
    await expect(card).toContainText('2 854 Kč/MWh bez DPH');
    await expect(card).toContainText('chybí kompletní regulovaná data pro C55d');
    await expect(card.getByLabel('Roční cena Centropol', { exact: true })).toHaveCount(0);
    await expect(s.getByLabel('Pořadí firemních nabídek', { exact: true })).toHaveCount(0);
    await s.getByRole('button', { name: '← Zpět', exact: true }).click();
  }
});
