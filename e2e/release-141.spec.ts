import { test, expect } from '@playwright/test';
import { fillCompany, fillFlat, companyResult, rates } from './tariffs';
test('company workflow keeps the complete C catalog and single/dual tariff information', async ({
  page,
}) => {
  await page.goto('/');
  await fillCompany(page);
  const s = rates(page);
  const select = s.getByLabel('Původní sazba', { exact: true });
  await expect(select.locator('option')).toHaveText([
    'Vyberte sazbu C',
    'C01d',
    'C02d',
    'C03d',
    'C25d · 2T',
    'C26d · 2T',
    'C27d · 2T',
    'C35d · 2T',
    'C45d · 2T',
    'C46d · 2T',
    'C55d · 2T',
    'C56d · 2T',
    'C60d · 2T',
    'C62d · 2T',
  ]);
  for (const code of ['C02d', 'C25d']) {
    await select.selectOption(code);
    await s.getByRole('button', { name: `Informace: sazba ${code}`, exact: true }).click();
    const note = s.getByRole('note');
    await expect(note).toContainText(`Kód sazby: ${code}`);
    await expect(note).toContainText(code === 'C02d' ? 'Jednotarifní' : 'Dvoutarifní');
    await expect(note).toContainText(code === 'C02d' ? 'NT: ne' : 'NT: ano');
  }
  for (const nt of await s.getByLabel('Stav NT [kWh]', { exact: true }).all()) await nt.fill('0');
  await companyResult(page);
  await expect(s.getByRole('region', { name: 'Shrnutí vstupů', exact: true })).toContainText(
    'C25d',
  );
  await expect(s.locator('.tariff-supplier')).toHaveCount(1);
});
test('D flat connection has verified ČEZ plus three unloaded suppliers, disabled update buttons and no ORLEN', async ({
  page,
  context,
}) => {
  await page.goto('/');
  await fillFlat(page, 'D');
  const s = rates(page);
  await s.getByRole('button', { name: 'POKRAČOVAT K POROVNÁNÍ', exact: true }).click();
  const cards = s.locator('.tariff-supplier');
  expect(
    await cards.evaluateAll((nodes) => nodes.map((n) => n.getAttribute('data-supplier-id'))),
  ).toEqual(['mnd', 'centropol', 'epet']);
  await expect(s.getByRole('region', { name: 'ČEZ domácnosti', exact: true })).toContainText(
    'Elektřina na dobu neurčitou',
  );
  await expect(page.getByText(/ORLEN/i)).toHaveCount(0);
  await context.setOffline(true);
  const requests: string[] = [];
  page.on('request', (r) => requests.push(r.url()));
  for (const card of await cards.all()) {
    await expect(card).toHaveAttribute('data-update-state', 'idle');
    await expect(card).toHaveAttribute('data-source-status', 'not-loaded');
    await expect(card).toContainText('zatím nenahrán');
    await expect(card).toContainText('zatím neověřeno');
    await expect(
      card.getByRole('button', { name: 'AKTUALIZOVAT CENÍK', exact: true }),
    ).toBeDisabled();
  }
  await expect(cards.getByRole('status')).toHaveCount(0);
  expect(requests).toEqual([]);
});
