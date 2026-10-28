import { test, expect, type Page } from '@playwright/test';
import { fillMainCheck, finishPower } from './measurement';
import {
  rates,
  back,
  fillFlat,
  fillCompany,
  companyResult,
  tariffLayout,
  openTariffs,
} from './tariffs';
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

test('C flat connection: 26 A, 32 A recommendation, manual 64 A, annualisation and independent offline cards', async ({
  page,
  context,
}) => {
  await page.goto('/');
  await expect(page.getByText('Offline připraveno', { exact: true })).toBeVisible();
  const before = await storage(page);
  await fillFlat(page);
  const s = rates(page);
  await expect(s.getByLabel('Odhadovaná roční spotřeba [kWh/rok]', { exact: true })).toHaveCount(0);
  await expect(s.getByLabel('Výkon spotřebičů [kW]', { exact: true })).toHaveCount(0);
  await expect(s.getByLabel('Délka období', { exact: true })).toHaveValue('1');
  await expect(s.getByLabel('Návrh jističe')).toContainText('Proud po soudobosti: 26 A');
  await expect(s.getByLabel('Návrh jističe')).toContainText('Doporučený jistič: 3×32 A');
  await expect(s.getByLabel('Návrh jističe')).not.toContainText('3×25 A');
  await tariffLayout(page);
  await s.getByRole('button', { name: 'POKRAČOVAT K POROVNÁNÍ', exact: true }).click();
  const summary = s.getByRole('region', { name: 'Shrnutí vstupů', exact: true });
  await expect(summary).toContainText(/Předpokládaná roční spotřeba\s*12\s*000 kWh\/rok/);
  await expect(summary).toContainText('Použitý jistič3×32 A');
  const cards = s.locator('.tariff-supplier');
  await expect(cards).toHaveCount(3);
  await expect(s.getByRole('region', { name: 'ČEZ ESCO Elektřina 24', exact: true })).toBeVisible();
  await expect(cards.first()).toHaveAttribute('aria-label', 'ORLEN Unipetrol');
  await context.setOffline(true);
  const requests: string[] = [];
  page.on('request', (r) => requests.push(r.url()));
  for (const card of await cards.all())
    await expect(
      card.getByRole('button', { name: 'AKTUALIZOVAT CENÍK', exact: true }),
    ).toBeDisabled();
  await expect(cards.getByRole('status')).toHaveCount(0);
  expect(requests).toEqual([]);
  await back(page).click();
  await s.getByLabel('Použitý jistič', { exact: true }).selectOption('custom');
  await s.getByLabel('Vlastní jistič [A]', { exact: true }).fill('64');
  await s.getByLabel('Proudové zatížení [A]', { exact: true }).fill('41');
  await expect(s.getByLabel('Vlastní jistič [A]', { exact: true })).toHaveValue('64');
  await s.getByRole('button', { name: 'POKRAČOVAT K POROVNÁNÍ', exact: true }).click();
  await expect(summary).toContainText('Použitý jistič3×64 A');
  await expect(summary).not.toContainText('3×63 A');
  await tariffLayout(page);
  await page.screenshot({
    path: test.info().outputPath('tariffs142-C.png'),
    fullPage: true,
  });
  expect(await storage(page)).toEqual(before);
});

test('D offers only flat connection, seven suppliers and no ORLEN; all local back levels preserve inputs', async ({
  page,
}) => {
  await page.goto('/');
  await fillFlat(page, 'D');
  const s = rates(page);
  await s.getByLabel('Délka období', { exact: true }).selectOption('custom');
  await s.getByLabel('Vlastní počet měsíců', { exact: true }).fill('5');
  await s.getByRole('button', { name: 'POKRAČOVAT K POROVNÁNÍ', exact: true }).click();
  await expect(s.locator('.tariff-supplier')).toHaveCount(2);
  await expect(s.getByRole('region', { name: 'ČEZ domácnosti', exact: true })).toBeVisible();
  await expect(page.getByText(/ORLEN/i)).toHaveCount(0);
  await expect(s.getByRole('region', { name: 'Shrnutí vstupů', exact: true })).toContainText(
    '2 400 kWh/rok',
  );
  await tariffLayout(page);
  await back(page).click();
  await expect(s.getByLabel('Vlastní počet měsíců', { exact: true })).toHaveValue('5');
  await back(page).click();
  await expect(s.getByRole('heading', { name: 'Výpočet', exact: true })).toBeVisible();
  await expect(s.getByRole('button', { name: 'ODHAD / FIRMY', exact: true })).toHaveCount(0);
  await back(page).click();
  await expect(s.getByRole('heading', { name: 'Typ odběru', exact: true })).toBeVisible();
  await expect(s.getByRole('button', { name: '← Zpět', exact: true })).toHaveCount(0);
});

test('company readings compute consumption and annual equivalent with unchanged installed breaker and ORLEN only', async ({
  page,
}) => {
  await page.goto('/');
  const before = await storage(page);
  await fillCompany(page);
  const s = rates(page);
  await expect(s.getByLabel('Distribuční oblast', { exact: true })).toHaveCount(0);
  await expect(s.getByRole('button', { name: 'TEĎ', exact: true })).toHaveCount(0);
  await expect(s.getByText('Soudobost', { exact: true })).toHaveCount(0);
  await expect(s.getByLabel('Původní nastavení').locator('select')).toHaveCount(2);
  await companyResult(page);
  const summary = s.getByRole('region', { name: 'Shrnutí vstupů', exact: true });
  await expect(summary).toContainText(/Skutečná spotřeba za období\s*1\s*250 kWh/);
  await expect(summary).toContainText(/Přepočtená roční spotřeba\s*45\s*625 kWh\/rok/);
  await expect(summary).toContainText('Původní hlavní jistič3×40 A');
  await expect(summary).toContainText('Původní sazbaC02d');
  await expect(s.locator('.tariff-supplier')).toHaveCount(1);
  await expect(s.locator('.tariff-supplier')).toHaveAttribute('data-supplier-id', 'orlen');
  await expect(
    s.getByRole('heading', { name: 'Výsledek kontroly sazby', exact: true }),
  ).toBeVisible();
  await expect(s).not.toContainText(/Doporučená sazba ORLEN: C|Původní sazba C02d odpovídá/);
  await expect(s.getByLabel('Návrh jističe')).toHaveCount(0);
  await tariffLayout(page);
  await page.screenshot({
    path: test.info().outputPath('tariffs142-company.png'),
    fullPage: true,
  });
  await back(page).click();
  await back(page).click();
  await expect(s.getByLabel('Původní hlavní jistič', { exact: true })).toHaveValue('3×40 A');
  await expect(s.getByLabel('Datum druhého odečtu', { exact: true })).toHaveValue('2026-01-11');
  expect(await storage(page)).toEqual(before);
});

test('switching tariff workflows preserves measurement draft, completed history and database', async ({
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
  await openTariffs(page, 'D', 'flat');
  await rates(page).getByLabel('Proudové zatížení [A]', { exact: true }).fill('99');
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
