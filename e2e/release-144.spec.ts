import { test, expect, type Page } from '@playwright/test';
import { fillCompany, rates } from './tariffs';
const scope = (page: Page) => page.getByRole('region', { name: 'Odečtové série' }).first();
async function start(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Jednotlivý odečet', exact: true }).click();
  return scope(page);
}
test('UZEL prefills existing reading fields, preserves manual meter MTP and supports custom primary values', async ({
  page,
}) => {
  const s = await start(page);
  await s.getByLabel('MTP elektroměr', { exact: true }).selectOption('150');
  await s.getByLabel('UZEL (nepovinný)', { exact: true }).fill('21111020');
  await expect(s.getByLabel('TS / rozvodna', { exact: true })).toHaveValue('TS 3308/250');
  await expect(s.getByLabel('Pole / kobka / umístění', { exact: true })).toHaveValue('3');
  await expect(s.getByLabel('MTP primár', { exact: true })).toHaveValue('400');
  await expect(s.getByLabel('MTP elektroměr', { exact: true })).toHaveValue('150');
  await s.getByLabel('MTP primár', { exact: true }).selectOption('300');
  await expect(s.getByLabel('MTP primár', { exact: true })).toHaveValue('300');
  await expect(s.getByLabel('Napětí', { exact: true })).toHaveValue('NN');
  await s.getByLabel('Napětí', { exact: true }).selectOption('VN');
  await s.getByLabel('UZEL (nepovinný)', { exact: true }).fill('22101114');
  await expect(s.getByLabel('TS / rozvodna', { exact: true })).toHaveValue('RPCH');
  await expect(s.getByLabel('Pole / kobka / umístění', { exact: true })).toHaveValue('RWPC2.10');
  await expect(s.getByLabel('MTP primár – vlastní primár (A)', { exact: true })).toHaveValue('450');
  await expect(s.getByLabel('MTP elektroměr – vlastní primár (A)', { exact: true })).toHaveValue(
    '150',
  );
  await s.getByLabel('MTP elektroměr – vlastní primár (A)', { exact: true }).fill('125');
  await expect(s.getByLabel('MTP primár – vlastní primár (A)', { exact: true })).toHaveValue('450');
  await expect(s.getByLabel('MTP elektroměr – vlastní primár (A)', { exact: true })).toHaveValue(
    '125',
  );
});
test('reverse lookup distinguishes letter case, works offline and does not infer an unknown key', async ({
  page,
  context,
}) => {
  const s = await start(page);
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await context.setOffline(true);
  await s.getByLabel('TS / rozvodna', { exact: true }).selectOption('TS 1613/CHEZA');
  await s.getByLabel('Pole / kobka / umístění', { exact: true }).fill('10a');
  await expect(s.getByLabel('UZEL (nepovinný)', { exact: true })).toHaveValue('21207027');
  await s.getByLabel('Pole / kobka / umístění', { exact: true }).fill('10A');
  await expect(s.getByLabel('UZEL (nepovinný)', { exact: true })).toHaveValue('21207051');
  await s.getByLabel('UZEL (nepovinný)', { exact: true }).fill('000123456789012345');
  await expect(s.getByLabel('UZEL (nepovinný)', { exact: true })).toHaveValue('000123456789012345');
  await expect(s.getByLabel('Pole / kobka / umístění', { exact: true })).toHaveValue('10A');
});
test('conflicting and incomplete photo cells never overwrite unverified values', async ({
  page,
}) => {
  const s = await start(page);
  await s.getByLabel('MTP primár', { exact: true }).selectOption('75');
  await s.getByLabel('UZEL (nepovinný)', { exact: true }).fill('21201042');
  await expect(s.getByText(/Vazba UZEL ↔ TS\/R ↔ pole ↔ MTP není ověřena/)).toBeVisible();
  await expect(s.getByLabel('Pole / kobka / umístění', { exact: true })).toHaveValue('');
  await expect(s.getByLabel('MTP primár', { exact: true })).toHaveValue('75');
  await s.getByLabel('UZEL (nepovinný)', { exact: true }).fill('');
  await s.getByLabel('TS / rozvodna', { exact: true }).selectOption('TS 4601/251');
  await s.getByLabel('Pole / kobka / umístění', { exact: true }).fill('4P');
  await expect(s.getByLabel('UZEL (nepovinný)', { exact: true })).toHaveValue('');
  await expect(s.getByLabel('MTP primár', { exact: true })).toHaveValue('75');
  await s.getByLabel('UZEL (nepovinný)', { exact: true }).fill('10105018');
  await expect(s.getByLabel('Pole / kobka / umístění', { exact: true })).toHaveValue('RM3.37L');
  await expect(s.getByLabel('MTP primár', { exact: true })).toHaveValue('75');
  await expect(s.getByText(/Vazba UZEL ↔ TS\/R ↔ pole ↔ MTP není ověřena/)).toBeVisible();
});
test('verified ORLEN total includes tax and VAT and current economical tariff is acknowledged', async ({
  page,
}) => {
  await page.goto('/');
  await fillCompany(page);
  const s = rates(page);
  // Ten days and 328.7671232876712 kWh correspond to a 12,000 kWh annual equivalent.
  await s
    .getByRole('region', { name: 'Druhý odečet', exact: true })
    .getByLabel('Stav elektroměru VT / hlavní registr', { exact: true })
    .fill('1328.7671232876712');
  await s.getByRole('button', { name: 'POKRAČOVAT K OBLASTI', exact: true }).click();
  await s.getByLabel('Distribuční oblast', { exact: true }).selectOption('ČEZ Distribuce');
  await s.getByRole('button', { name: 'VYHODNOTIT', exact: true }).click();
  await expect(s).toContainText('SAZBA ODPOVÍDÁ – C02d');
  const total = s
    .getByRole('region', { name: 'Ověřené cenové položky ORLEN', exact: true })
    .getByLabel('Konečná roční cena ORLEN', { exact: true });
  await expect(total).toContainText(/67\s735,2 Kč\/rok/);
  await expect(total).toContainText(/81\s959,59 Kč\/rok/);
  await expect(s.locator('[data-cost-key=taxes]')).toContainText('339,6 Kč/rok');
});
