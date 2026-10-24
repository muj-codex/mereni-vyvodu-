import { test, expect, type Page } from '@playwright/test';
const scope = (page: Page) => page.getByRole('region', { name: 'Odečtové série' }).first();
async function start(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Série odečtů', exact: true }).click();
}
async function first(page: Page, serial = '12345678', node = '21208142') {
  const s = scope(page);
  await s.getByLabel('TS / rozvodna', { exact: true }).selectOption('TS 3831/257');
  await s.getByLabel('Pole / kobka / umístění', { exact: true }).fill('11P');
  await s.getByLabel('Číslo elektroměru', { exact: true }).fill(serial);
  await s.getByLabel('UZEL (nepovinný)', { exact: true }).fill(node);
  await s.getByLabel('Datum odečtu', { exact: true }).fill('2026-10-22');
  await s.getByLabel('Čas odečtu (HH:MM)', { exact: true }).fill('08:37');
  await s
    .getByLabel('Datum kola', { exact: true })
    .fill((await s.getByLabel('Datum odečtu', { exact: true }).inputValue()) || '2026-10-22');
  await s.getByLabel('Čas kola', { exact: true }).fill('08:00');
  await s.getByLabel('Stav elektroměru [kWh]', { exact: true }).fill('23456');
  await s.getByRole('button', { name: 'ULOŽIT DÍLČÍ ODEČET', exact: true }).click();
  await expect(s.getByRole('status')).toContainText('uložen');
}
async function history(page: Page, open = true) {
  await scope(page).getByRole('button', { name: 'Historie odečtů', exact: true }).click();
  if (open)
    await scope(page)
      .getByRole('button', { name: /Odečtová série · TS/ })
      .first()
      .click();
}
async function select(page: Page, serial = '12345678') {
  await scope(page)
    .getByRole('checkbox', { name: `Vybrat EM ${serial}`, exact: true })
    .check();
}
async function begin(page: Page) {
  await scope(page).getByRole('button', { name: 'POKRAČOVAT DALŠÍM ODEČTEM', exact: true }).click();
}
const meterCard = (page: Page, serial = '12345678') =>
  scope(page)
    .locator('article')
    .filter({ has: page.getByRole('heading', { name: `EM ${serial}`, exact: true }) });
async function fillRound(page: Page) {
  const s = scope(page);
  const card = meterCard(page);
  await s.getByLabel('Datum nového odečtu', { exact: true }).fill('2026-10-29');
  await s.getByLabel('Čas kola', { exact: true }).fill('08:00');
  await card.getByLabel('Nový čas', { exact: true }).fill('09:12');
  await card.getByLabel('Nový stav [kWh]', { exact: true }).fill('24110');
  await card.getByLabel('SUMA ENERGIS [kWh]', { exact: true }).fill('654');
}
test('první kolo: zachová TS a datum, vyčistí pracovní pole a seskupí historii', async ({
  page,
}) => {
  await start(page);
  await first(page);
  const s = scope(page);
  await expect(s.getByLabel('TS / rozvodna', { exact: true })).toHaveValue('TS 3831/257');
  await expect(s.getByLabel('Datum odečtu', { exact: true })).toHaveValue('2026-10-22');
  for (const name of [
    'Pole / kobka / umístění',
    'Číslo elektroměru',
    'UZEL (nepovinný)',
    'Čas odečtu (HH:MM)',
    'Stav elektroměru [kWh]',
  ])
    await expect(s.getByLabel(name, { exact: true })).toHaveValue('');
  await first(page, '222', '21208020');
  await history(page, false);
  await expect(s.getByRole('button', { name: /Odečtová série · TS/ })).toHaveCount(1);
  await expect(s.getByRole('button', { name: /Odečtová série · TS/ })).toContainText(
    '2 elektroměrů',
  );
  await s.getByRole('button', { name: /Odečtová série · TS/ }).click();
  await expect(s.getByRole('checkbox', { name: 'Vybrat EM 12345678', exact: true })).toBeVisible();
});
test('další kolo: výběr, zamčené údaje, přeskočení a ukončení uchová historii', async ({
  page,
}) => {
  await start(page);
  await first(page);
  await first(page, '222', '21208020');
  await history(page);
  const s = scope(page);
  await s.getByRole('button', { name: 'Vybrat vše', exact: true }).click();
  await begin(page);
  await expect(s.getByLabel('Předchozí datum', { exact: true }).first()).toHaveValue('2026-10-22');
  await expect(s.getByLabel('Předchozí čas', { exact: true }).first()).toHaveValue('08:37');
  await expect(s.getByLabel('Předchozí stav [kWh]', { exact: true }).first()).toBeDisabled();
  await expect(s.getByLabel('Nový čas', { exact: true }).first()).toHaveValue('');
  await fillRound(page);
  await meterCard(page, '222').getByRole('checkbox', { name: 'ODEČÍST', exact: true }).uncheck();
  await meterCard(page)
    .getByRole('checkbox', { name: 'Pokračovat dalším odečtem', exact: true })
    .uncheck();
  await s.getByRole('button', { name: 'ULOŽIT VYPLNĚNÉ ODEČTY', exact: true }).click();
  await expect(s.getByRole('status')).toContainText('Uloženo 1');
  await s.getByRole('button', { name: 'Historie EM 12345678', exact: true }).click();
  await expect(s.getByText('2026-10-22 08:37 – 23456 kWh', { exact: true })).toBeVisible();
  await expect(s.getByText('2026-10-29 09:12 – 24110 kWh', { exact: true })).toBeVisible();
  await expect(s.getByText('Sledování: UKONČENO', { exact: true })).toBeVisible();
  await expect(
    s.getByRole('button', { name: 'POKRAČOVAT DALŠÍM ODEČTEM', exact: true }),
  ).toHaveCount(0);
  await s.getByRole('button', { name: 'ZNOVU AKTIVOVAT SLEDOVÁNÍ', exact: true }).click();
  await begin(page);
  await expect(s.getByLabel('Předchozí stav [kWh]', { exact: true })).toHaveValue('24110');
});
test('import TXT doplní jen vybrané UZLY a označí nenalezený', async ({ page }) => {
  await start(page);
  await first(page);
  await first(page, '222', '999');
  await history(page);
  const s = scope(page);
  await s.getByRole('button', { name: 'Vybrat vše', exact: true }).click();
  await begin(page);
  await s.locator('input[type=file]').setInputFiles({
    name: 'energis.txt',
    mimeType: 'text/plain',
    buffer: Buffer.from(
      'Agregace 1/4 29.10.2026\nUZEL\tPopis\tJednotka\t29.10.2026 08:45-00\t29.10.2026 09:00-15\tSUMA\n21208142\t11P\tkW\t300\t354\t654\n21208020\t12P\tkW\t10\t10\t20',
    ),
  });
  await expect(meterCard(page).getByLabel('SUMA ENERGIS [kWh]', { exact: true })).toHaveValue(
    '654',
  );
  await expect(s.getByText('UZEL v importu nenalezen', { exact: true })).toBeVisible();
  await expect(
    meterCard(page, '222').getByLabel('SUMA ENERGIS [kWh]', { exact: true }),
  ).toHaveValue('');
  await fillRound(page);
  await meterCard(page, '222').getByRole('checkbox', { name: 'ODEČÍST', exact: true }).uncheck();
  await s.getByRole('button', { name: 'ULOŽIT VYPLNĚNÉ ODEČTY', exact: true }).click();
  await expect(s.getByRole('status')).toContainText('Uloženo 1');
});
test('STYLUS vyžaduje náhled a následné standardní uložení, pokračování najde EM', async ({
  page,
}) => {
  await start(page);
  await page.getByRole('button', { name: 'Stylus', exact: true }).first().click();
  const s = scope(page);
  await s
    .getByLabel('Volný zápis STYLUS')
    .fill('TS3831/257 11P U21208142 EM12345678 22.10.2026 8:37 stav 23456');
  await s.getByRole('button', { name: 'ROZPOZNAT ÚDAJE', exact: true }).click();
  await expect(s.getByText(/Nový elektroměr – první/)).toBeVisible();
  await s.getByRole('button', { name: 'PŘEVÉST DO ODEČTU', exact: true }).click();
  await s.getByLabel('Datum kola', { exact: true }).fill('2026-10-22');
  await s.getByLabel('Čas kola', { exact: true }).fill('08:00');
  await s.getByRole('button', { name: 'ULOŽIT DÍLČÍ ODEČET', exact: true }).click();
  await expect(s.getByRole('status')).toContainText('uložen');
  await s.getByRole('button', { name: 'Stylus', exact: true }).click();
  await s.getByLabel('Volný zápis STYLUS').fill('U21208142 EM12345678 29.10.2026 9:12 stav 24110');
  await s.getByRole('button', { name: 'ROZPOZNAT ÚDAJE', exact: true }).click();
  await expect(s.getByText(/Nalezen existující elektroměr/)).toBeVisible();
  await s.getByRole('button', { name: 'PŘEVÉST DO ODEČTU', exact: true }).click();
  await expect(s.getByLabel('Předchozí stav [kWh]', { exact: true })).toHaveValue('23456');
  await expect(s.getByLabel('Nový stav [kWh]', { exact: true })).toHaveValue('24110');
});
test('JSON záloha obnoví série v čisté DB a podruhé nevytvoří duplicity', async ({
  page,
  browser,
}) => {
  await start(page);
  await first(page);
  await history(page);
  await select(page);
  await begin(page);
  await fillRound(page);
  await scope(page).getByRole('button', { name: 'ULOŽIT VYPLNĚNÉ ODEČTY', exact: true }).click();
  await page
    .getByRole('button', { name: 'MĚŘENÍ + ODEČET ELEKTROMĚRU / ENERGIS', exact: true })
    .click();
  await page.getByRole('button', { name: /Výsledky měření/ }).click();
  await page.evaluate(() => {
    Object.defineProperty(navigator, 'share', { value: undefined, configurable: true });
  });
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'ZÁLOHOVAT DATA', exact: true }).click();
  const path = await (await download).path();
  const context = await browser.newContext();
  const clean = await context.newPage();
  await clean.goto('/');
  await clean.getByRole('button', { name: /Výsledky měření/ }).click();
  for (let i = 0; i < 2; i++) {
    await clean.getByLabel('IMPORTOVAT / OBNOVIT DATA', { exact: true }).setInputFiles(path!);
    await clean.getByRole('button', { name: 'IMPORTOVAT', exact: true }).click();
    await expect(clean.getByRole('dialog')).toHaveCount(0);
  }
  await clean.getByRole('button', { name: /Historie odečtů · výběr/ }).click();
  const s = scope(clean);
  await expect(s.getByRole('button', { name: /Odečtová série · TS/ })).toHaveCount(1);
  await s.getByRole('button', { name: /Odečtová série · TS/ }).click();
  await s.getByRole('button', { name: 'Historie EM 12345678', exact: true }).click();
  await expect(s.getByText('2026-10-29 09:12 – 24110 kWh', { exact: true })).toBeVisible();
  await context.close();
});
test('70 elektroměrů, výběr 48 a společná stránka pouze pro vybrané', async ({ page }) => {
  await start(page);
  await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const r = indexedDB.open('mereni-vyvodu-v1');
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => reject(r.error);
    });
    const tx = db.transaction(['series', 'meters', 'readings'], 'readwrite');
    tx.objectStore('series').add({ id: 'batch70', location: 'TS 3831/257', date: '2026-10-22' });
    for (let i = 0; i < 70; i++) {
      const id = `m${i}`;
      tx.objectStore('meters').add({
        id,
        batchId: 'batch70',
        location: 'TS 3831/257',
        placement: `${i}P`,
        serial: `EM${i}`,
        node: `2120${i}`,
        active: true,
        actualMtp: 1,
        meterMtp: 1,
      });
      tx.objectStore('readings').add({
        id: `r${i}`,
        meterId: id,
        date: '2026-10-22',
        time: '08:37',
        value: 23456,
        active: true,
      });
    }
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
    window.dispatchEvent(new Event('series-updated'));
  });
  await history(page);
  const s = scope(page);
  await expect(s.getByRole('checkbox')).toHaveCount(70);
  await s.getByRole('button', { name: 'Zrušit výběr', exact: true }).click();
  for (let i = 0; i < 48; i++)
    await s.getByRole('checkbox', { name: `Vybrat EM EM${i}`, exact: true }).check();
  await expect(s.getByText('Vybráno 48 z 70', { exact: true })).toBeVisible();
  await begin(page);
  await expect(s.getByLabel('Nový stav [kWh]', { exact: true })).toHaveCount(48);
  await expect(s.getByRole('heading', { name: 'EM EM48', exact: true })).toHaveCount(0);
});
test('XLSX import a export XLSX/TXT zachová UZEL a hodnoty', async ({ page }) => {
  const { default: ExcelJS } = await import('exceljs');
  const { readFile } = await import('node:fs/promises');
  await start(page);
  await first(page);
  await history(page);
  await select(page);
  const s = scope(page);
  for (const format of ['XLSX', 'TXT']) {
    const pending = page.waitForEvent('download');
    await s.getByRole('button', { name: `EXPORTOVAT VYBRANÉ ${format}`, exact: true }).click();
    const file = await pending;
    const buffer = await readFile((await file.path())!);
    if (format === 'XLSX') {
      const book = new ExcelJS.Workbook();
      await book.xlsx.load(buffer as any);
      expect(book.worksheets[0].getCell('D2').text).toBe('21208142');
    } else expect(buffer.toString()).toContain('21208142');
  }
  await begin(page);
  const book = new ExcelJS.Workbook();
  book
    .addWorksheet('Energis')
    .addRows([
      ['Agregace 1/4 29.10.2026'],
      ['UZEL', 'Popis', 'Jednotka', '29.10.2026 08:45-00', '29.10.2026 09:00-15', 'SUMA'],
      ['21208142', '11P', 'kW', 300, 354, 654],
      ['unselected', 'x', 'kW', 5, 5, 10],
    ]);
  await s.locator('input[type=file]').setInputFiles({
    name: 'energis.xlsx',
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    buffer: Buffer.from(await book.xlsx.writeBuffer()),
  });
  await expect(s.getByLabel('SUMA ENERGIS [kWh]', { exact: true })).toHaveValue('654');
  await expect(s.getByText(/Energis: 2026-10-29 08:45/)).toBeVisible();
});
test('historie zobrazí odečet přidaný v jiné části aplikace', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /Výsledky měření/ }).click();
  await expect(page.getByRole('button', { name: 'Série odečtů', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Nové měření', exact: false }).click();
  await page.getByRole('button', { name: 'Série odečtů', exact: true }).click();
  await first(page);
  await page.getByRole('button', { name: /Výsledky měření/ }).click();
  await expect(page.locator('.record-open')).toContainText('série 1 vývodů');
});
