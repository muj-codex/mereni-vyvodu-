import { test, expect, type Page } from '@playwright/test';
import { fillMainCheck, finishPower } from './measurement';
const rates = (p: Page) => p.getByRole('main', { name: 'Výpočet spotřeby a sazeb', exact: true });
const back = (p: Page) => rates(p).getByRole('button', { name: '← Zpět', exact: true });
const next = (p: Page) =>
  rates(p).getByRole('button', { name: 'POKRAČOVAT K POROVNÁNÍ', exact: true });
async function open(p: Page) {
  await p.getByRole('button', { name: 'VÝPOČET SPOTŘEBY A SAZEB', exact: true }).click();
  await expect(rates(p).getByRole('heading', { name: 'Typ odběru', exact: true })).toBeVisible();
  await expect(rates(p).getByRole('button')).toHaveCount(2);
  await expect(p.getByRole('navigation', { name: 'Odečty', exact: true })).toHaveCount(0);
}
async function layout(p: Page) {
  const s = rates(p);
  expect(await p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  const width = p.viewportSize()!.width;
  for (const el of await s.locator('input, select, .button').all()) {
    const box = await el.boundingBox();
    if (box) {
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(width);
    }
  }
}
async function storage(p: Page) {
  return p.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const q = indexedDB.open('mereni-vyvodu-v1');
      q.onsuccess = () => resolve(q.result);
      q.onerror = () => reject(q.error);
    });
    const names = Array.from(db.objectStoreNames);
    const tx = db.transaction(names, 'readonly');
    const entries = await Promise.all(
      names.map(
        (name) =>
          new Promise<[string, unknown[]]>((resolve, reject) => {
            const q = tx.objectStore(name).getAll();
            q.onsuccess = () => resolve([name, q.result]);
            q.onerror = () => reject(q.error);
          }),
      ),
    );
    db.close();
    return {
      version: db.version,
      data: Object.fromEntries(entries),
      local: { ...localStorage },
      session: { ...sessionStorage },
    };
  });
}

test('C estimate: raw inputs, custom breaker, local back and independent offline supplier placeholders', async ({
  page,
  context,
}) => {
  await page.goto('/');
  await expect(page.getByText('Offline připraveno', { exact: true })).toBeVisible();
  const before = await storage(page);
  await open(page);
  const s = rates(page);
  await s.getByRole('button', { name: 'C – PODNIKATEL / FIRMA', exact: true }).click();
  await s.getByRole('button', { name: 'ODHAD PŘED PŘIPOJENÍM', exact: true }).click();
  await s.getByLabel('Distribuční oblast', { exact: true }).selectOption('EG.D');
  await s.getByLabel('Výkon spotřebičů [kW]', { exact: true }).fill('17,35');
  await expect(s.getByLabel('Proudové zatížení [A]', { exact: true })).toHaveValue('');
  await s.getByLabel('Proudové zatížení [A]', { exact: true }).fill('42,7');
  await s.getByLabel('Soudobost', { exact: true }).fill('0,65');
  await s.getByRole('button', { name: 'Informace: Soudobost', exact: true }).click();
  await expect(s.getByRole('note')).toContainText('Hodnota zůstává ručně editovatelná.');
  await s.getByLabel('Navržený hlavní jistič', { exact: true }).selectOption('custom');
  await s.getByLabel('Vlastní hodnota jističe', { exact: true }).fill('1×40 A');
  await s.getByLabel('Odhadovaná roční spotřeba [kWh/rok]', { exact: true }).fill('12345,67');
  await layout(page);
  await next(page).click();
  const summary = s.getByRole('region', { name: 'Shrnutí vstupů', exact: true });
  for (const text of [
    'C – PODNIKATEL / FIRMA',
    'EG.D',
    '17,35 kW',
    '42,7 A',
    '0,65',
    '1×40 A',
    '12345,67 kWh/rok',
  ])
    await expect(summary).toContainText(text);
  await expect(summary).toContainText(
    'Výpočet sazeb a porovnání dodavatelů bude doplněn v dalším kroku.',
  );
  const cards = s.locator('.tariff-supplier');
  await expect(cards).toHaveCount(5);
  await expect(cards.first()).toHaveAttribute('aria-label', 'ORLEN Unipetrol');
  await expect(cards.first()).toContainText('Pracovní reference pro firmy');
  await page.screenshot({
    path: `/workspace/work/tariff-C-${test.info().project.name}.png`,
    fullPage: true,
  });
  await context.setOffline(true);
  const requests: string[] = [];
  page.on('request', (r) => requests.push(r.url()));
  await cards.first().getByRole('button', { name: 'AKTUALIZOVAT CENÍK', exact: true }).click();
  await expect(cards.first().getByRole('status')).toHaveText(
    'Aktualizace ceníků bude doplněna v dalším kroku.',
  );
  await expect(cards.nth(1).getByRole('status')).toHaveCount(0);
  await cards.nth(1).getByRole('button', { name: 'AKTUALIZOVAT CENÍK', exact: true }).click();
  await expect(cards.nth(1).getByRole('status')).toBeVisible();
  expect(requests).toEqual([]);
  await layout(page);
  await back(page).click();
  await expect(s.getByLabel('Výkon spotřebičů [kW]', { exact: true })).toHaveValue('17,35');
  await expect(s.getByLabel('Vlastní hodnota jističe', { exact: true })).toHaveValue('1×40 A');
  await s.getByLabel('Distribuční oblast', { exact: true }).selectOption('PREdistribuce');
  await next(page).click();
  await expect(summary).toContainText('PREdistribuce');
  await expect(s.getByRole('region', { name: 'Ceníky dodavatelů', exact: true })).not.toContainText(
    'EG.D',
  );
  await expect(cards.getByRole('status')).toHaveCount(0);
  expect(await storage(page)).toEqual(before);
});

test('D actual consumption: household tariffs, custom months and no ORLEN anywhere', async ({
  page,
}) => {
  await page.goto('/');
  await open(page);
  const s = rates(page);
  await s.getByRole('button', { name: 'D – DOMÁCNOST', exact: true }).click();
  await s.getByRole('button', { name: 'KONTROLA PODLE SKUTEČNÉ SPOTŘEBY', exact: true }).click();
  await expect(
    s.getByLabel('Současná sazba', { exact: true }).locator('option').first(),
  ).toHaveText('Vyberte sazbu D');
  await expect(s.getByLabel('Současná sazba', { exact: true }).locator('option')).not.toContainText(
    ['C01d'],
  );
  await s.getByLabel('Současná sazba', { exact: true }).selectOption('D02d');
  await s.getByLabel('Distribuční oblast', { exact: true }).selectOption('ČEZ Distribuce');
  await s.getByLabel('Současný hlavní jistič', { exact: true }).selectOption('3×25 A');
  await s.getByLabel('Spotřeba za období [kWh]', { exact: true }).fill('456,78');
  await s.getByLabel('Délka období', { exact: true }).selectOption('custom');
  await s.getByLabel('Vlastní počet měsíců', { exact: true }).fill('5');
  await layout(page);
  await next(page).click();
  const summary = s.getByRole('region', { name: 'Shrnutí vstupů', exact: true });
  for (const text of [
    'D – DOMÁCNOST',
    'ČEZ Distribuce',
    'D02d',
    '3×25 A',
    '456,78 kWh',
    '5 měsíců',
  ])
    await expect(summary).toContainText(text);
  await expect(s.locator('.tariff-supplier')).toHaveCount(4);
  await expect(page.getByText(/ORLEN/i)).toHaveCount(0);
  await page.screenshot({
    path: `/workspace/work/tariff-D-${test.info().project.name}.png`,
    fullPage: true,
  });
  await layout(page);
  await back(page).click();
  await expect(s.getByLabel('Spotřeba za období [kWh]', { exact: true })).toHaveValue('456,78');
  await back(page).click();
  await expect(s.getByRole('heading', { name: 'Způsob výpočtu', exact: true })).toBeVisible();
  await back(page).click();
  await expect(s.getByRole('heading', { name: 'Typ odběru', exact: true })).toBeVisible();
  await expect(s.getByRole('button', { name: '← Zpět', exact: true })).toHaveCount(0);
});

test('changing C to D clears the company tariff without introducing a company supplier', async ({
  page,
}) => {
  await page.goto('/');
  await open(page);
  const s = rates(page);
  await s.getByRole('button', { name: 'C – PODNIKATEL / FIRMA', exact: true }).click();
  await s.getByRole('button', { name: 'KONTROLA PODLE SKUTEČNÉ SPOTŘEBY', exact: true }).click();
  await expect(
    s.getByLabel('Současná sazba', { exact: true }).locator('option').first(),
  ).toHaveText('Vyberte sazbu C');
  await s.getByLabel('Současná sazba', { exact: true }).selectOption('C02d');
  await back(page).click();
  await back(page).click();
  await s.getByRole('button', { name: 'D – DOMÁCNOST', exact: true }).click();
  await s.getByRole('button', { name: 'KONTROLA PODLE SKUTEČNÉ SPOTŘEBY', exact: true }).click();
  await expect(s.getByLabel('Současná sazba', { exact: true })).toHaveValue('');
  await expect(page.getByText(/ORLEN/i)).toHaveCount(0);
  await back(page).click();
  await s.getByRole('button', { name: 'ODHAD PŘED PŘIPOJENÍM', exact: true }).click();
  await expect(s.getByLabel('Výkon spotřebičů [kW]', { exact: true })).toHaveValue('');
  await expect(page.getByText(/ORLEN/i)).toHaveCount(0);
});

test('switching the new module preserves existing measurement draft, completed history and database', async ({
  page,
}) => {
  await page.goto('/');
  await fillMainCheck(page);
  await page
    .getByRole('button', { name: 'POUŽÍT KONTROLU STAVŮ A POKRAČOVAT', exact: true })
    .click();
  await finishPower(page);
  await page.getByRole('button', { name: 'ULOŽIT MĚŘENÍ', exact: true }).click();
  await expect(page.getByLabel('VÝROBNÍ ČÍSLO ELEKTROMĚRU', { exact: true })).toHaveValue('136777');
  await fillMainCheck(page);
  const before = await storage(page);
  await open(page);
  const s = rates(page);
  await s.getByRole('button', { name: 'D – DOMÁCNOST', exact: true }).click();
  await s.getByRole('button', { name: 'ODHAD PŘED PŘIPOJENÍM', exact: true }).click();
  await s.getByLabel('Výkon spotřebičů [kW]', { exact: true }).fill('99');
  await page
    .getByRole('button', { name: 'MĚŘENÍ + ODEČET ELEKTROMĚRU / ENERGIS', exact: true })
    .click();
  await expect(page.getByLabel('Stav elektroměru DO', { exact: true })).toHaveValue('110');
  await expect(page.getByLabel('Spotřeba Energis za interval', { exact: true })).toHaveValue('10');
  expect(await storage(page)).toEqual(before);
  await page.getByRole('button', { name: /Výsledky měření/ }).click();
  await expect(
    page.getByRole('region', { name: 'MĚŘENÍ', exact: true }).locator('.record-open'),
  ).toHaveCount(1);
  await page.locator('.record-open').click();
  await expect(page.getByLabel('Porovnání', { exact: true })).toContainText('EM 10 kWh');
});
