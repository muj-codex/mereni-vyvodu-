import expectedOrders from '../tests/fixtures/business-orders-1414';
import { test, expect } from '@playwright/test';
import { fillCompany, fillFlat, rates, tariffLayout } from './tariffs';
const fmt = (n: number) => new Intl.NumberFormat('cs-CZ', { maximumFractionDigits: 2 }).format(n);
for (const [code, net, vtPrice, ntPrice, delta] of [
  ['C02d', 74203.2, 2999, null, 7826.28],
  ['C25d', 59130.48, 3124, 2826, 6756.64],
  ['C45d', 72138.44, 3133, 2984, 8329.64],
  ['C62d', 53409.84, 3009, null, null],
] as const) {
  test(`fixed ${code}: full annual E.ON price, comparable ranking, differences and no main SPOT card`, async ({
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
    const card = s.getByRole('region', { name: 'E.ON firmy Variant', exact: true });
    await expect(card).toContainText('Variant na 2 roky 10/26 Profi');
    await expect(card).toContainText('Fixace 2 roky');
    await expect(card.getByLabel('Jednotkové ceny E.ON Variant', { exact: true })).toContainText(
      `${fmt(vtPrice)} Kč/MWh bez DPH`,
    );
    await expect(card.getByLabel('Jednotkové ceny E.ON Variant', { exact: true })).toContainText(
      '139 Kč/měsíc bez DPH',
    );
    if (ntPrice !== null)
      await expect(card.getByLabel('Jednotkové ceny E.ON Variant', { exact: true })).toContainText(
        `${fmt(ntPrice)} Kč/MWh bez DPH`,
      );
    const total = card.getByLabel('Roční cena E.ON Variant', { exact: true });
    await expect(total).toContainText(`${fmt(net)} Kč/rok`);
    await expect(total).toContainText(`${fmt(net * 1.21)} Kč/rok`);
    const offers = card.getByLabel('Pořadí firemních nabídek', { exact: true }).locator('li');
    const expected =
      expectedOrders[code as keyof typeof expectedOrders];
    await expect(offers).toHaveCount(expected.length);
    for (let i = 0; i < expected.length; i++)
      await expect(offers.nth(i)).toContainText(expected[i]);
    await expect(card).toContainText('Elektřina 24 · Fixace 24 měsíců');
    if (delta !== null)
      await expect(
        card.getByLabel('Rozdíly E.ON Variant proti dodavatelům', { exact: true }),
      ).toContainText(`${fmt(delta)} Kč/rok dražší`);
    await expect(s.getByRole('region', { name: 'E.ON firmy SPOT', exact: true })).toHaveCount(0);
    await expect(card).not.toContainText('Přesné porovnání vyžaduje průběhová SPOT data.');
    await tariffLayout(page);
  });
}
test('flat unsupported tariff, missing split and unverified areas never receive invented fixed totals or ranking', async ({
  page,
}) => {
  await page.goto('/');
  await fillFlat(page);
  const s = rates(page);
  await s.getByRole('button', { name: 'POKRAČOVAT K POROVNÁNÍ', exact: true }).click();
  const card = s.getByRole('region', { name: 'E.ON firmy Variant', exact: true });
  const select = card.getByLabel('Sazba E.ON Variant a společného porovnání', { exact: true });
  await select.selectOption('C25d');
  await expect(card).toContainText('Chybí ověřený rozpad roční spotřeby VT/NT.');
  await expect(card.getByLabel('Roční cena E.ON Variant', { exact: true })).toHaveCount(0);
  await expect(card.getByLabel('Pořadí firemních nabídek', { exact: true })).toHaveCount(0);
  await select.selectOption('C60d');
  await expect(card).toContainText('Pro tuto sazbu nemáme ověřený cenový podklad.');
  await expect(card.getByLabel('Roční cena E.ON Variant', { exact: true })).toHaveCount(0);
  await s.getByRole('button', { name: '← Zpět', exact: true }).click();
  await s.getByLabel('Distribuční oblast', { exact: true }).selectOption('EG.D');
  await s.getByRole('button', { name: 'POKRAČOVAT K POROVNÁNÍ', exact: true }).click();
  await expect(card).toContainText('Pro tuto distribuční oblast nemáme kompletní ověřený podklad.');
  await expect(card.getByLabel('Roční cena E.ON Variant', { exact: true })).toHaveCount(0);
  await expect(card.getByLabel('Pořadí firemních nabídek', { exact: true }).locator('li')).toHaveCount(2);
  await expect(card.getByLabel('Pořadí firemních nabídek', { exact: true })).toContainText('Centropol');
});
test('explicit 200A fixed tariff stays complete and does not inherit the old SPOT applicability warning', async ({
  page,
}) => {
  await page.goto('/');
  await fillFlat(page);
  const s = rates(page);
  await s.getByLabel('Použitý jistič', { exact: true }).selectOption('custom');
  await s.getByLabel('Vlastní jistič [A]', { exact: true }).fill('200');
  await s.getByRole('button', { name: 'POKRAČOVAT K POROVNÁNÍ', exact: true }).click();
  const card = s.getByRole('region', { name: 'E.ON firmy Variant', exact: true });
  await expect(card.getByLabel('Jednotkové ceny E.ON Variant', { exact: true })).toContainText(
    '2 886 Kč/měsíc bez DPH',
  );
  await expect(card.getByLabel('Roční cena E.ON Variant', { exact: true })).toBeVisible();
  await expect(card).not.toContainText('není jednoznačná platnost sazby');
});
