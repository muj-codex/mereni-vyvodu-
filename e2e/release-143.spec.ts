import { test, expect, type Page } from '@playwright/test';
import { fillCompany, rates, back, tariffLayout } from './tariffs';
async function finish(page: Page, area = 'ČEZ Distribuce') {
  const s = rates(page);
  await s.getByRole('button', { name: 'POKRAČOVAT K OBLASTI', exact: true }).click();
  await s.getByLabel('Distribuční oblast', { exact: true }).selectOption(area);
  await s.getByRole('button', { name: 'VYHODNOTIT', exact: true }).click();
}
const readings = (page: Page) =>
  ['První odečet', 'Druhý odečet'].map((name) =>
    rates(page).getByRole('region', { name, exact: true }),
  );
const pricePanel = (page: Page) =>
  rates(page).getByRole('region', { name: 'Ověřené cenové položky ORLEN', exact: true });
function row(page: Page, label: string) {
  return pricePanel(page)
    .locator('dl')
    .first()
    .locator('div')
    .filter({ has: page.getByText(label, { exact: true }) });
}

test('NT activates only for 2T, shares timestamps and stale NT never affects a single-tariff result; C02d verified source', async ({
  page,
  context,
}) => {
  await page.goto('/');
  await fillCompany(page);
  const s = rates(page);
  for (const reading of readings(page)) {
    const nt = reading.getByLabel('Stav NT [kWh]', { exact: true });
    await expect(nt).toBeDisabled();
    await expect(nt).not.toHaveAttribute('required', '');
    expect(await nt.evaluate((el) => getComputedStyle(el).opacity)).toBe('0.65');
  }
  const select = s.getByLabel('Původní sazba', { exact: true });
  await expect(select.locator('option[value=C25d]')).toHaveText('C25d · 2T');
  await expect(select.locator('option[value=C45d]')).toHaveText('C45d · 2T');
  await select.selectOption('C25d');
  for (const reading of readings(page)) {
    await expect(reading.getByLabel('Stav NT [kWh]', { exact: true })).toBeEnabled();
    await expect(reading.getByLabel('Stav NT [kWh]', { exact: true })).toHaveAttribute(
      'required',
      '',
    );
  }
  await readings(page)[0].getByLabel('Stav NT [kWh]', { exact: true }).fill('2000');
  await readings(page)[1].getByLabel('Stav NT [kWh]', { exact: true }).fill('9999');
  await select.selectOption('C45d');
  for (const reading of readings(page))
    await expect(reading.getByLabel('Stav NT [kWh]', { exact: true })).toBeEnabled();
  await expect(s.locator('input[type=date]')).toHaveCount(2);
  await expect(s.locator('input[type=time]')).toHaveCount(2);
  await expect(s.getByRole('button', { name: 'TEĎ', exact: true })).toHaveCount(0);
  await select.selectOption('C02d');
  for (const reading of readings(page))
    await expect(reading.getByLabel('Stav NT [kWh]', { exact: true })).toBeDisabled();
  await finish(page);
  const summary = s.getByRole('region', { name: 'Shrnutí vstupů', exact: true });
  await expect(summary).toContainText(/Skutečná spotřeba za období\s*1\s250 kWh/);
  await expect(summary).toContainText(/Přepočtená roční spotřeba\s*45\s625 kWh\/rok/);
  await expect(row(page, 'Silová elektřina')).toContainText(/2\s599 Kč\/MWh/);
  await expect(row(page, 'Distribuce')).toContainText(/2\s263,19 Kč\/MWh/);
  await expect(row(page, 'Systémové služby')).toContainText('164,24 Kč/MWh');
  await expect(row(page, 'OTE / provoz nesíťové infrastruktury')).toContainText(
    '12,87 Kč/OM/měsíc',
  );
  await expect(row(page, 'Cena jističe')).toContainText('577 Kč/měsíc');
  await expect(pricePanel(page)).toContainText(
    'Výpočet nelze dokončit – chybí ověřené cenové položky.',
  );
  await expect(s).toContainText('Pro úplné porovnání zatím chybí ověřená cenová data.');
  const card = s.locator('[data-supplier-id=orlen]');
  await expect(card).toContainText('1. 1. 2026');
  await expect(card).toContainText('25. 10. 2026');
  await expect(card).toHaveAttribute('data-source-status', 'partial-verified');
  await expect(
    card.getByRole('button', { name: 'AKTUALIZOVAT CENÍK', exact: true }),
  ).toBeDisabled();
  await expect(card).toContainText(
    'Automatická aktualizace bude aktivována po doplnění zdroje ceníku.',
  );
  await context.setOffline(true);
  await tariffLayout(page);
  await page.screenshot({
    path: `/workspace/work/tariffs143-C02d-${test.info().project.name}.png`,
    fullPage: true,
  });
});

test('C25d separates consumption, annual VT/NT and real distribution rates without a final price', async ({
  page,
}) => {
  await page.goto('/');
  await fillCompany(page);
  const s = rates(page);
  await s.getByLabel('Původní sazba', { exact: true }).selectOption('C25d');
  await s.getByLabel('Původní hlavní jistič', { exact: true }).selectOption('3×63 A');
  const [first, second] = readings(page);
  await second.getByLabel('Stav VT [kWh]', { exact: true }).fill('1100');
  await first.getByLabel('Stav NT [kWh]', { exact: true }).fill('2000');
  await second.getByLabel('Stav NT [kWh]', { exact: true }).fill('1999');
  await s.getByRole('button', { name: 'POKRAČOVAT K OBLASTI', exact: true }).click();
  await expect(s.getByRole('alert')).toContainText('Druhý stav NT');
  await expect(s.getByLabel('Distribuční oblast', { exact: true })).toHaveCount(0);
  await second.getByLabel('Stav NT [kWh]', { exact: true }).fill('2200');
  await tariffLayout(page);
  await finish(page);
  const summary = s.getByRole('region', { name: 'Shrnutí vstupů', exact: true });
  for (const text of [
    /Spotřeba VT za období\s*100 kWh/,
    /Spotřeba NT za období\s*200 kWh/,
    /Roční VT\s*3\s650 kWh\/rok/,
    /Roční NT\s*7\s300 kWh\/rok/,
    /Přepočtená roční spotřeba\s*10\s950 kWh\/rok/,
  ])
    await expect(summary).toContainText(text);
  await expect(row(page, 'Distribuce VT')).toContainText(/2\s208,39 Kč\/MWh/);
  await expect(row(page, 'Distribuce NT')).toContainText('116,5 Kč/MWh');
  await expect(row(page, 'Cena jističe')).toContainText(/1\s329 Kč\/měsíc/);
  await expect(pricePanel(page).locator('[data-cost-key=distributionVT]')).toContainText(
    /8\s060,62 Kč\/rok/,
  );
  await expect(pricePanel(page).locator('[data-cost-key=distributionNT]')).toContainText(
    '850,45 Kč/rok',
  );
  await expect(s.locator('.tariff-supplier')).toHaveCount(1);
  await expect(s.locator('.tariff-supplier')).toHaveAttribute('data-supplier-id', 'orlen');
  await expect(pricePanel(page)).toContainText('chybí ověřené cenové položky');
  await tariffLayout(page);
  await page.screenshot({
    path: `/workspace/work/tariffs143-C25d-${test.info().project.name}.png`,
    fullPage: true,
  });
});

test('unverified lower breaker and other areas stay unknown instead of copying ČEZ prices', async ({
  page,
}) => {
  await page.goto('/');
  await fillCompany(page);
  const s = rates(page);
  await s.getByLabel('Původní sazba', { exact: true }).selectOption('C25d');
  for (const reading of readings(page))
    await reading.getByLabel('Stav NT [kWh]', { exact: true }).fill('0');
  await finish(page);
  await expect(row(page, 'Cena jističe')).toContainText('Cena jističe zatím není ověřena.');
  await back(page).click();
  await s.getByLabel('Distribuční oblast', { exact: true }).selectOption('EG.D');
  await s.getByRole('button', { name: 'VYHODNOTIT', exact: true }).click();
  await expect(row(page, 'Distribuce VT')).toContainText('Data pro tuto oblast nejsou ověřena.');
  await expect(row(page, 'Distribuce NT')).toContainText('Data pro tuto oblast nejsou ověřena.');
  await expect(pricePanel(page)).not.toContainText(/2\s208,39|116,5 Kč\/MWh/);
});

test('C60d remains selectable as 2T but the ambiguous fee never becomes an energy price', async ({
  page,
}) => {
  await page.goto('/');
  await fillCompany(page);
  const s = rates(page);
  await s.getByLabel('Původní sazba', { exact: true }).selectOption('C60d');
  for (const reading of readings(page))
    await reading.getByLabel('Stav NT [kWh]', { exact: true }).fill('0');
  await finish(page);
  await expect(pricePanel(page)).toContainText('Cenová data ORLEN zatím nejsou ověřena.');
  await expect(pricePanel(page)).not.toContainText(/2\s599/);
  await expect(pricePanel(page)).toContainText('Výpočet nelze dokončit');
  await expect(s).not.toContainText(/Doporučená sazba ORLEN:|Původní sazba C60d odpovídá/);
});
