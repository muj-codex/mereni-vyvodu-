import expectedOrders from '../tests/fixtures/business-orders-1413';
import { test, expect } from '@playwright/test';
import { fillCompany, fillFlat, rates, tariffLayout } from './tariffs';
const fmt = (n: number) => new Intl.NumberFormat('cs-CZ', { maximumFractionDigits: 2 }).format(n);
for (const [code, price, net] of [
  ['C02d', 2860, 72007.2],
  ['C25d', 2839, 57566.48],
  ['C45d', 2887, 69850.44],
  ['C55d', 2887, null],
  ['C62d', 2860, 51093.84],
] as const) {
  test(`Electricity 24 ${code}: verified fixed commodity, correct annual price and fixed-only ranking`, async ({
    page,
  }) => {
    await page.goto('/');
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
      await second
        .getByLabel('Stav VT [kWh]', { exact: true })
        .fill(code === 'C62d' ? '13000' : '5000');
      await first.getByLabel('Stav NT [kWh]', { exact: true }).fill(code === 'C62d' ? '0' : '2000');
      await second
        .getByLabel('Stav NT [kWh]', { exact: true })
        .fill(code === 'C62d' ? '0' : '10000');
    }
    await s.getByRole('button', { name: 'POKRAČOVAT K OBLASTI', exact: true }).click();
    await s.getByLabel('Distribuční oblast', { exact: true }).selectOption('ČEZ Distribuce');
    await s.getByRole('button', { name: 'VYHODNOTIT', exact: true }).click();
    const card = s.getByRole('region', { name: 'ČEZ ESCO Elektřina 24', exact: true });
    const unit = card.getByLabel('Jednotkové ceny Elektřina 24', { exact: true });
    await expect(unit).toContainText(`${fmt(price)} Kč/MWh bez DPH`);
    await expect(unit).toContainText('95 Kč/měsíc bez DPH');
    await expect(card).toContainText('Fixace 24 měsíců');
    await expect(s).not.toContainText(/SPOT(?![\p{L}])|září 2026|285 Kč/u);
    if (net === null) {
      await expect(card).toContainText('Pro C55d máme ověřenou pouze obchodní cenu');
      await expect(card).toContainText('35 784 Kč/rok bez DPH');
      await expect(card.getByLabel('Roční cena Elektřina 24', { exact: true })).toHaveCount(0);
      await expect(s.getByLabel('Pořadí firemních nabídek', { exact: true })).toHaveCount(0);
      await expect(
        s.getByRole('region', { name: 'E.ON firmy Variant', exact: true }),
      ).toContainText('Pro tuto sazbu nemáme ověřený cenový podklad.');
    } else {
      await expect(card.getByLabel('Roční cena Elektřina 24', { exact: true })).toContainText(
        `${fmt(net)} Kč/rok`,
      );
      await expect(card.getByLabel('Roční cena Elektřina 24', { exact: true })).toContainText(
        `${fmt(net * 1.21)} Kč/rok`,
      );
      const order = s.getByLabel('Pořadí firemních nabídek', { exact: true }).locator('li');
      const names =
        expectedOrders[code as keyof typeof expectedOrders];
      await expect(order).toHaveCount(names.length);
      for (let i = 0; i < names.length; i++) await expect(order.nth(i)).toContainText(names[i]);
      for (const entry of await order.all()) await expect(entry).not.toContainText('SPOT');
      await expect(
        card.getByLabel('Rozdíly Elektřina 24 proti dodavatelům', { exact: true }),
      ).toContainText('E.ON Variant');
    }
    await tariffLayout(page);
  });
}
test('C55d is an ESCO-only commodity choice and other areas never get guessed regulated totals', async ({
  page,
}) => {
  await page.clock.setFixedTime(new Date('2027-01-01T12:00:00Z'));
  await page.goto('/');
  await fillFlat(page);
  const s = rates(page);
  await s.getByLabel('Použitý jistič', { exact: true }).selectOption('3×40 A');
  await s.getByRole('button', { name: 'POKRAČOVAT K POROVNÁNÍ', exact: true }).click();
  const card = s.getByRole('region', { name: 'ČEZ ESCO Elektřina 24', exact: true });
  await expect(card.getByLabel('Roční cena Elektřina 24', { exact: true })).toContainText(
    '87 128,71 Kč/rok',
  );
  await expect(s).not.toContainText(/SPOT(?![\p{L}])|září 2026|Doporučena kontrola/u);
  await expect(
    s
      .getByLabel('Sazba E.ON Variant a společného porovnání', { exact: true })
      .locator('option[value="C55d"]'),
  ).toHaveCount(0);
  await expect(
    s.getByLabel('Cenové položky ORLEN pro sazbu', { exact: true }).locator('option[value="C55d"]'),
  ).toHaveCount(0);
  await card.getByLabel('Sazba ČEZ ESCO Elektřina 24', { exact: true }).selectOption('C55d');
  await expect(card).toContainText('2 887 Kč/MWh bez DPH');
  await expect(card.getByLabel('Roční cena Elektřina 24', { exact: true })).toHaveCount(0);
  await s.getByRole('button', { name: '← Zpět', exact: true }).click();
  await s.getByLabel('Distribuční oblast', { exact: true }).selectOption('PREdistribuce');
  await s.getByRole('button', { name: 'POKRAČOVAT K POROVNÁNÍ', exact: true }).click();
  await expect(card).toContainText('Pro tuto distribuční oblast nemáme ověřenou regulovanou část.');
  await expect(card.getByLabel('Roční cena Elektřina 24', { exact: true })).toHaveCount(0);
});
