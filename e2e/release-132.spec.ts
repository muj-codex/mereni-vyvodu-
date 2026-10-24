import { test, expect, type Page } from '@playwright/test';
const scope = (p: Page) => p.getByRole('region', { name: 'Odečtové série' }).first();
const card = (p: Page, serial: string) =>
  scope(p)
    .locator('.series-meter')
    .filter({ has: p.getByRole('button', { name: `Historie EM ${serial}`, exact: true }) });
const roundCard = (p: Page, serial: string) =>
  scope(p)
    .locator('.series-meter')
    .filter({ has: p.getByRole('heading', { name: `EM ${serial}`, exact: true }) });
async function createSeries(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'SÉRIE ODEČTŮ', exact: true }).click();
  const s = scope(page);
  for (const [serial, placement, node, value] of [
    ['123', 'pole 21', '21210001', '1000'],
    ['234', 'pole 54', '21210002', '1800'],
  ]) {
    await s.getByLabel('TS / rozvodna', { exact: true }).selectOption('TS 4601/251');
    await s.getByLabel('Pole / kobka / umístění', { exact: true }).fill(placement);
    await s.getByLabel('UZEL (nepovinný)', { exact: true }).fill(node);
    await s.getByLabel('Číslo elektroměru', { exact: true }).fill(serial);
    await s.getByLabel('Datum odečtu', { exact: true }).fill('2026-10-23');
    await s.getByLabel('Čas odečtu (HH:MM)', { exact: true }).fill('17:33');
    await s
      .getByLabel('Datum kola', { exact: true })
      .fill((await s.getByLabel('Datum odečtu', { exact: true }).inputValue()) || '2026-10-22');
    await s.getByLabel('Čas kola', { exact: true }).fill('08:00');
    await s.getByLabel('Stav elektroměru [kWh]', { exact: true }).fill(value);
    await s.getByRole('button', { name: 'ULOŽIT DÍLČÍ ODEČET', exact: true }).click();
    await expect(s.locator('p[role=status]')).toContainText('uložen');
  }
  await page.getByRole('button', { name: /Výsledky měření/ }).click();
  await expect(page.locator('.record-open')).toHaveCount(1);
  await expect(page.locator('.record-open')).toHaveText(
    '23.10.2026 17:33TS 4601/251série 2 vývodů',
  );
  await page.locator('.record-open').click();
  await expect(
    scope(page).getByRole('checkbox', { name: 'Vybrat EM 123', exact: true }),
  ).toBeChecked();
  await expect(
    scope(page).getByRole('checkbox', { name: 'Vybrat EM 234', exact: true }),
  ).toBeChecked();
}
async function begin(page: Page, date = '2026-10-24') {
  const s = scope(page);
  await s.getByRole('button', { name: 'POKRAČOVAT DALŠÍM ODEČTEM', exact: true }).click();
  await expect(s.getByLabel('Nové datum', { exact: true })).toHaveCount(0);
  await expect(s.getByText('Hranice exportu', { exact: true })).toHaveCount(0);
  await s.getByLabel('Datum nového odečtu', { exact: true }).fill(date);
  await s.getByLabel('Čas kola', { exact: true }).fill('08:00');
  await expect(s.locator('.series-round-heading')).toHaveCSS('position', 'sticky');
}
async function saveStates(page: Page) {
  await begin(page);
  for (const [serial, value] of [
    ['123', '1020'],
    ['234', '1820'],
  ]) {
    const c = roundCard(page, serial);
    await expect(c.getByRole('checkbox', { name: 'ODEČÍST', exact: true })).toBeChecked();
    await c.getByRole('button', { name: 'TEĎ', exact: true }).click();
    await expect(c.getByLabel('Nový čas', { exact: true })).toHaveValue('08:37');
    await c.getByLabel('Nový stav [kWh]', { exact: true }).fill(value);
    await expect(c.getByLabel('SUMA ENERGIS [kWh]', { exact: true })).toHaveValue('');
  }
  await roundCard(page, '234').getByRole('button', { name: '+E', exact: true }).click();
  await expect(
    roundCard(page, '234').getByRole('button', { name: '+E', exact: true }),
  ).toHaveAttribute('aria-pressed', 'true');
  await expect(
    roundCard(page, '234').getByRole('button', { name: '-E', exact: true }),
  ).toHaveAttribute('aria-pressed', 'false');
  await scope(page).getByRole('button', { name: 'ULOŽIT VYPLNĚNÉ ODEČTY', exact: true }).click();
  await expect(scope(page).locator('p[role=status]').first()).toContainText('Uloženo 2');
}
test('one series, all active outlets, sticky common date, optional Energis and skipped visits retain last states', async ({
  page,
}) => {
  await page.clock.install({ time: new Date(2026, 9, 24, 8, 37) });
  await createSeries(page);
  await saveStates(page);
  await expect(card(page, '123').getByText(/Použit Energis do 2026-10-24 08:30/)).toBeVisible();
  await expect(card(page, '234').getByText(/Použit Energis do 2026-10-24 08:45/)).toBeVisible();
  await expect(card(page, '123').locator('.saved-energis')).toContainText('-7 min E');
  await expect(card(page, '234').locator('.saved-energis')).toContainText('+8 min E');
  await page.getByRole('button', { name: 'Zpět na výsledky měření', exact: true }).click();
  await expect(page.locator('.record-open')).toHaveCount(1);
  await expect(page.locator('.record-open')).toContainText('24.10.2026 08:37');
  await page.locator('.record-open').click();
  await begin(page, '2026-10-25');
  await expect(
    roundCard(page, '123').getByLabel('Předchozí stav [kWh]', { exact: true }),
  ).toHaveValue('1020');
  await expect(
    roundCard(page, '234').getByLabel('Předchozí stav [kWh]', { exact: true }),
  ).toHaveValue('1820');
  await roundCard(page, '234').getByRole('checkbox', { name: 'ODEČÍST', exact: true }).uncheck();
  await expect(roundCard(page, '234').getByLabel('Nový čas', { exact: true })).toBeDisabled();
  await roundCard(page, '123').getByRole('button', { name: 'TEĎ', exact: true }).click();
  await roundCard(page, '123').getByLabel('Nový stav [kWh]', { exact: true }).fill('1040');
  await scope(page).getByRole('button', { name: 'ULOŽIT VYPLNĚNÉ ODEČTY', exact: true }).click();
  await expect(scope(page).locator('p[role=status]').first()).toContainText('Uloženo 1');
  await expect(card(page, '234')).toContainText('Sledování: AKTIVNÍ');
  await begin(page, '2026-10-26');
  await expect(
    roundCard(page, '123').getByLabel('Předchozí stav [kWh]', { exact: true }),
  ).toHaveValue('1040');
  await expect(
    roundCard(page, '234').getByLabel('Předchozí stav [kWh]', { exact: true }),
  ).toHaveValue('1820');
  await expect(
    roundCard(page, '234').getByRole('checkbox', { name: 'ODEČÍST', exact: true }),
  ).toBeChecked();
  await scope(page).getByRole('button', { name: 'Zpět do historie', exact: true }).click();
  await scope(page).getByRole('button', { name: 'Historie EM 234', exact: true }).click();
  await expect(scope(page).getByText('2026-10-23 17:33 – 1800 kWh', { exact: true })).toBeVisible();
  await expect(scope(page).getByText('2026-10-24 08:37 – 1820 kWh', { exact: true })).toBeVisible();
});
for (const extension of ['txt', 'xlsx'])
  test(`late manual SUMA and ${extension} import stay scoped to one series and protect manual data`, async ({
    page,
  }) => {
    await page.clock.install({ time: new Date(2026, 9, 24, 8, 37) });
    await createSeries(page);
    await saveStates(page);
    const manual = card(page, '123');
    await manual.getByLabel('SUMA ENERGIS [kWh]', { exact: true }).fill('99');
    const grid = [
      ['Agregace 1/4 24.10.2026'],
      ['UZEL', 'Popis', 'Jednotka', '24.10.2026 08:00-15', '24.10.2026 08:15-30', 'SUMA'],
      ['99999999', 'foreign', 'kWh', 100, 100, 200],
      ['21210002', 'target', 'kWh', 10, 10, 20],
      ['21210001', 'manual', 'kWh', 10, 10, 20],
    ];
    let buffer: Buffer;
    if (extension === 'xlsx') {
      const { default: ExcelJS } = await import('exceljs');
      const book = new ExcelJS.Workbook();
      book.addWorksheet('Energis').addRows(grid);
      buffer = Buffer.from(await book.xlsx.writeBuffer());
    } else buffer = Buffer.from(grid.map((r) => r.join('\t')).join('\n'));
    await scope(page)
      .getByLabel('Import SUMA ENERGIS soubor', { exact: true })
      .setInputFiles({
        name: `energis.${extension}`,
        mimeType: 'application/octet-stream',
        buffer,
      });
    await expect(scope(page).locator('.saved-energis-import')).toContainText('Importováno 1');
    await expect(scope(page).locator('.saved-energis-import')).toContainText('nepřepsal');
    await expect(card(page, '123').getByLabel('SUMA ENERGIS [kWh]', { exact: true })).toHaveValue(
      '99',
    );
    await expect(card(page, '234').getByLabel('SUMA ENERGIS [kWh]', { exact: true })).toHaveValue(
      '20',
    );
    await expect(card(page, '234')).toContainText('rozdíl 0 kWh');
    await manual.getByRole('button', { name: 'ULOŽIT SUMA ENERGIS', exact: true }).click();
    await expect(manual.locator('p[role=status]')).toHaveText('Energis uložen.');
    await page.reload();
    await page.getByRole('button', { name: /Výsledky měření/ }).click();
    await expect(page.locator('.record-open')).toHaveCount(1);
    await page.locator('.record-open').click();
    await expect(card(page, '123').getByLabel('SUMA ENERGIS [kWh]', { exact: true })).toHaveValue(
      '99',
    );
    await expect(card(page, '234').getByLabel('SUMA ENERGIS [kWh]', { exact: true })).toHaveValue(
      '20',
    );
    await scope(page).getByRole('button', { name: 'Historie EM 234', exact: true }).click();
    await expect(scope(page).getByRole('heading', { level: 3 })).toHaveCount(2);
  });
