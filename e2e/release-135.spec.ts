import { test, expect, type Page } from '@playwright/test';
const scope = (p: Page) => p.getByRole('region', { name: 'Odečtové série', exact: true }).first();
const card = (p: Page, serial: string) =>
  scope(p)
    .locator('.series-meter')
    .filter({ has: p.getByRole('heading', { name: `EM ${serial}`, exact: true }) });
async function add(p: Page, serial: string, location = 'TS 4601/251') {
  const s = scope(p);
  await s.getByLabel('TS / rozvodna', { exact: true }).selectOption(location);
  await s.getByLabel('Pole / kobka / umístění', { exact: true }).fill(`pole ${serial}`);
  await s.getByLabel('Číslo elektroměru', { exact: true }).fill(serial);
  await s.getByLabel('UZEL (nepovinný)', { exact: true }).fill(`2120${serial}`);
  await s.getByLabel('Datum odečtu', { exact: true }).fill('2026-10-24');
  await s.getByLabel('Čas odečtu (HH:MM)', { exact: true }).fill('11:19');
  await s.getByLabel('Datum kola', { exact: true }).fill('2026-10-24');
  await s.getByLabel('Čas kola', { exact: true }).fill('11:00');
  await s.getByLabel('Stav elektroměru [kWh]', { exact: true }).fill('100');
  await s.getByRole('button', { name: 'ULOŽIT DÍLČÍ ODEČET', exact: true }).click();
  await expect(s.locator('p[role=status]').first()).toContainText('uložen');
}
async function results(p: Page) {
  await p.getByRole('button', { name: /Výsledky měření/ }).click();
}
async function create(p: Page, serials: string[]) {
  await p.goto('/');
  await p.getByRole('button', { name: 'SÉRIE ODEČTŮ', exact: true }).click();
  for (const serial of serials) await add(p, serial);
}
test('two series plus one standalone are separate in both overviews; search and member history stay available', async ({
  page,
}) => {
  await create(page, ['21', '54']);
  for (const serial of ['31', '32', '35', '48']) await add(page, serial, 'TS 3831/257');
  await page.getByRole('button', { name: 'JEDNOTLIVÝ ODEČET', exact: true }).click();
  await add(page, '777');
  await results(page);
  const groups = page.getByRole('region', { name: 'ODEČTOVÉ SÉRIE', exact: true });
  const singles = page.getByRole('region', { name: 'SAMOSTATNÉ ODEČTY', exact: true });
  await expect(groups.locator('.record-open')).toHaveCount(2);
  await expect(singles.locator('.record-open')).toHaveCount(1);
  await expect(singles).toContainText('EM 777');
  await expect(singles).not.toContainText('EM 21');
  await expect(page.locator('.record-open')).toHaveCount(3);
  await expect(page.getByText('2 série · 1 samostatný odečet', { exact: true })).toBeVisible();
  for (const query of ['212021', 'pole 54', 'TS 3831/257', '777']) {
    await page.getByLabel('Hledat ve všech výsledcích a odečtech').fill(query);
    await expect(page.locator('.record-open')).toHaveCount(1);
  }
  await page.getByLabel('Hledat ve všech výsledcích a odečtech').fill('');
  await page.getByRole('button', { name: /Historie odečtů · výběr/ }).click();
  const s = scope(page);
  await expect(s.locator('.series-batch')).toHaveCount(2);
  await expect(s.locator('.series-meter')).toHaveCount(1);
  await expect(s.getByRole('button', { name: 'Historie EM 777', exact: true })).toBeVisible();
  await expect(s.getByRole('button', { name: 'Historie EM 21', exact: true })).toHaveCount(0);
  for (const [location, serial] of [
    ['TS 4601/251', '21'],
    ['TS 3831/257', '31'],
  ]) {
    await s.getByRole('button', { name: new RegExp(`Odečtová série · ${location}`) }).click();
    await s.getByRole('button', { name: `Historie EM ${serial}`, exact: true }).click();
    await expect(s.getByRole('heading', { name: `UZEL 2120${serial}`, exact: true })).toBeVisible();
    await s.getByRole('button', { name: '← Zpět', exact: true }).click();
    await s.getByRole('button', { name: '← Zpět', exact: true }).click();
  }
});
test('reading just one of three keeps the series, shared history and all active outlets for the next round', async ({
  page,
}) => {
  await create(page, ['1', '2', '3']);
  await results(page);
  await page.locator('.record-open').click();
  const s = scope(page);
  await s.getByRole('button', { name: 'POKRAČOVAT DALŠÍM ODEČTEM', exact: true }).click();
  await s.getByLabel('Datum nového odečtu', { exact: true }).fill('2026-10-25');
  await s.getByLabel('Čas kola', { exact: true }).fill('11:00');
  await card(page, '1').getByLabel('Nový čas', { exact: true }).fill('11:19');
  await card(page, '1').getByLabel('Nový stav [kWh]', { exact: true }).fill('110');
  for (const serial of ['2', '3'])
    await card(page, serial).getByRole('checkbox', { name: 'ODEČÍST', exact: true }).uncheck();
  await s.getByRole('button', { name: 'ULOŽIT VYPLNĚNÉ ODEČTY', exact: true }).click();
  await expect(s.locator('p[role=status]').first()).toContainText('Uloženo 1');
  await expect(s.locator('.series-meter')).toHaveCount(3);
  for (const serial of ['2', '3']) {
    await s.getByRole('button', { name: `Historie EM ${serial}`, exact: true }).click();
    await expect(s.getByRole('heading', { level: 3 })).toHaveCount(1);
    await expect(
      s.getByRole('heading', { name: '2026-10-24 11:19 – 100 kWh', exact: true }),
    ).toBeVisible();
    await s.getByRole('button', { name: '← Zpět', exact: true }).click();
  }
  await s.getByRole('button', { name: 'POKRAČOVAT DALŠÍM ODEČTEM', exact: true }).click();
  for (const serial of ['1', '2', '3'])
    await expect(
      card(page, serial).getByRole('checkbox', { name: 'ODEČÍST', exact: true }),
    ).toBeChecked();
  await expect(card(page, '2').getByLabel('Předchozí stav [kWh]', { exact: true })).toHaveValue(
    '100',
  );
  await expect(card(page, '1').getByLabel('Předchozí stav [kWh]', { exact: true })).toHaveValue(
    '110',
  );
});
test('a standalone can join a series using the same meter and reading IDs; backup restores the membership', async ({
  page,
  browser,
}) => {
  await create(page, ['21']);
  await page.getByRole('button', { name: 'JEDNOTLIVÝ ODEČET', exact: true }).click();
  await add(page, '777');
  await results(page);
  const before = await page.evaluate(
    async () =>
      new Promise<any[]>((resolve, reject) => {
        const request = indexedDB.open('mereni-vyvodu-v1');
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          const db = request.result;
          const tx = db.transaction('readings');
          const r = tx.objectStore('readings').getAll();
          r.onsuccess = () => {
            resolve(r.result);
            db.close();
          };
        };
      }),
  );
  await page
    .getByRole('region', { name: 'ODEČTOVÉ SÉRIE', exact: true })
    .locator('.record-open')
    .click();
  const s = scope(page);
  await s
    .getByLabel('Samostatný elektroměr', { exact: true })
    .selectOption({ label: 'TS 4601/251 · pole 777 · EM 777' });
  await s.getByRole('button', { name: 'PŘIDAT DO SÉRIE', exact: true }).click();
  await expect(s.locator('p[role=status]').first()).toContainText('přidán');
  await s.getByRole('button', { name: 'Historie EM 777', exact: true }).click();
  await expect(s.getByRole('heading', { level: 3 })).toHaveCount(1);
  await page.getByRole('button', { name: '← Zpět', exact: true }).first().click();
  await page.getByRole('button', { name: '← Zpět', exact: true }).first().click();
  await expect(page.locator('.record-open')).toHaveCount(1);
  await expect(
    page.getByRole('region', { name: 'SAMOSTATNÉ ODEČTY', exact: true }).locator('.record-open'),
  ).toHaveCount(0);
  const after = await page.evaluate(
    async () =>
      new Promise<any[]>((resolve, reject) => {
        const r = indexedDB.open('mereni-vyvodu-v1');
        r.onerror = () => reject(r.error);
        r.onsuccess = () => {
          const db = r.result;
          const req = db.transaction('readings').objectStore('readings').getAll();
          req.onsuccess = () => {
            resolve(req.result);
            db.close();
          };
        };
      }),
  );
  expect(after).toEqual(before);
  await page.evaluate(() =>
    Object.defineProperty(navigator, 'share', { value: undefined, configurable: true }),
  );
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'ZÁLOHOVAT DATA', exact: true }).click();
  const path = await (await download).path();
  const context = await browser.newContext();
  const restored = await context.newPage();
  await restored.goto('/');
  await results(restored);
  await restored.getByLabel('IMPORTOVAT / OBNOVIT DATA', { exact: true }).setInputFiles(path!);
  await restored.getByRole('button', { name: 'IMPORTOVAT', exact: true }).click();
  await expect(restored.getByRole('dialog')).toHaveCount(0);
  await expect(restored.locator('.record-open')).toHaveCount(1);
  await restored.locator('.record-open').click();
  await expect(
    scope(restored).getByRole('button', { name: 'Historie EM 777', exact: true }),
  ).toBeVisible();
  await context.close();
});
