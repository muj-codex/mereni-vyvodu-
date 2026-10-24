import { test, expect, type Page } from '@playwright/test';
import { fillMainCheck, finishPower } from './measurement';
const back = (p: Page) => p.getByRole('button', { name: '← Zpět', exact: true }).first();
const scope = (p: Page) => p.getByRole('region', { name: 'Odečtové série', exact: true }).first();
const meter = (p: Page, serial: string) =>
  scope(p)
    .locator('.series-meter')
    .filter({ has: p.getByRole('heading', { name: `EM ${serial}`, exact: true }) });
async function reading(p: Page, serial: string) {
  const s = scope(p);
  await s.getByLabel('TS / rozvodna', { exact: true }).selectOption('TS 4601/251');
  for (const [label, value] of [
    ['Pole / kobka / umístění', `pole ${serial}`],
    ['Číslo elektroměru', serial],
    ['Datum odečtu', '2026-10-24'],
    ['Čas odečtu (HH:MM)', '11:19'],
    ['Datum kola', '2026-10-24'],
    ['Čas kola', '11:00'],
    ['Stav elektroměru [kWh]', '100'],
  ])
    await s.getByLabel(label, { exact: true }).fill(value);
  await s.getByRole('button', { name: 'ULOŽIT DÍLČÍ ODEČET', exact: true }).click();
  await expect(s.locator('p[role=status]').first()).toContainText('uložen');
}
async function counts(p: Page) {
  return p.evaluate(
    async () =>
      new Promise<Record<string, number>>((resolve, reject) => {
        const r = indexedDB.open('mereni-vyvodu-v1');
        r.onerror = () => reject(r.error);
        r.onsuccess = () => {
          const db = r.result,
            names = ['measurements', 'series', 'meters', 'readings'];
          const tx = db.transaction(names);
          const out: Record<string, number> = {};
          for (const n of names) {
            const q = tx.objectStore(n).count();
            q.onsuccess = () => {
              out[n] = q.result;
            };
          }
          tx.oncomplete = () => {
            db.close();
            resolve(out);
          };
          tx.onerror = () => reject(tx.error);
        };
      }),
  );
}
test('main check has one continuation, local back preserves check and Kyoritsu; only completed measurement is stored', async ({
  page,
}) => {
  await page.goto('/');
  await fillMainCheck(page);
  await expect(page.getByRole('button', { name: 'MĚŘENÍ KYORITSU', exact: true })).toHaveCount(0);
  await expect(
    page.getByRole('button', { name: 'ULOŽIT KONTROLU STAVŮ', exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole('button', { name: 'POUŽÍT KONTROLU STAVŮ A POKRAČOVAT', exact: true }),
  ).toHaveCount(1);
  await page
    .getByRole('region', { name: 'Kontrola stavů', exact: true })
    .getByRole('button', { name: '← Zpět', exact: true })
    .click();
  await page.getByRole('button', { name: 'Otevřít kontrolu stavů', exact: true }).click();
  await expect(page.getByLabel('Stav elektroměru OD', { exact: true })).toHaveValue('100');
  await page
    .getByRole('button', { name: 'POUŽÍT KONTROLU STAVŮ A POKRAČOVAT', exact: true })
    .click();
  await expect(page.getByLabel('Přenesená kontrola stavů')).toContainText('10 kWh');
  await page.getByLabel('U1', { exact: true }).fill('231');
  await page.getByLabel('IL1', { exact: true }).fill('12');
  await back(page).click();
  await expect(page.getByLabel('Čas OD', { exact: true })).toHaveValue('11:00');
  await page
    .getByRole('button', { name: 'POUŽÍT KONTROLU STAVŮ A POKRAČOVAT', exact: true })
    .click();
  await expect(page.getByLabel('U1', { exact: true })).toHaveValue('231');
  await expect(page.getByLabel('IL1', { exact: true })).toHaveValue('12');
  await finishPower(page);
  await back(page).click();
  await expect(page.getByLabel('PF1', { exact: true })).toHaveValue('1');
  await page.getByRole('button', { name: 'VYHODNOTIT MĚŘENÍ', exact: true }).click();
  await page.getByRole('button', { name: 'ULOŽIT MĚŘENÍ', exact: true }).click();
  await page.getByRole('button', { name: /Výsledky měření/ }).click();
  await expect(
    page.getByRole('region', { name: 'MĚŘENÍ', exact: true }).locator('.record-open'),
  ).toHaveCount(1);
  await expect(
    page.getByRole('region', { name: 'SAMOSTATNÉ ODEČTY', exact: true }).locator('.record-open'),
  ).toHaveCount(0);
  expect(await counts(page)).toEqual({ measurements: 1, series: 0, meters: 0, readings: 0 });
  await page.locator('.record-open').click();
  await expect(page.getByRole('button', { name: 'Série odečtů', exact: true })).toHaveCount(0);
  await expect(page.getByLabel('Porovnání', { exact: true })).toContainText('EM 10 kWh');
  await back(page).click();
  await expect(page.locator('.record-open')).toHaveCount(1);
});
test('leaving an unfinished main check creates no independent reading and preserves the draft', async ({
  page,
}) => {
  await page.goto('/');
  await fillMainCheck(page);
  await page.getByRole('button', { name: /Výsledky měření/ }).click();
  expect(await counts(page)).toEqual({ measurements: 0, series: 0, meters: 0, readings: 0 });
  await page.getByRole('button', { name: /Nové měření/ }).click();
  await expect(page.getByLabel('Stav elektroměru DO', { exact: true })).toHaveValue('110');
  await page.getByRole('checkbox', { name: 'Porovnat stavy s Energis' }).uncheck();
  await page
    .getByRole('checkbox', {
      name: 'Použít tuto identifikaci i pro následující měření',
      exact: true,
    })
    .uncheck();
  await page.getByRole('button', { name: 'MĚŘENÍ KYORITSU', exact: true }).click();
  await page.getByLabel('VÝROBNÍ ČÍSLO ELEKTROMĚRU', { exact: true }).fill('OWN136');
  await page.getByLabel('POLE / UMÍSTĚNÍ', { exact: true }).fill('vlastní pole');
  await page.getByLabel('U1', { exact: true }).fill('242');
  await back(page).click();
  await page.getByRole('button', { name: 'MĚŘENÍ KYORITSU', exact: true }).click();
  await expect(page.getByLabel('VÝROBNÍ ČÍSLO ELEKTROMĚRU', { exact: true })).toHaveValue('OWN136');
  await expect(page.getByLabel('U1', { exact: true })).toHaveValue('242');
});
test('allowed reading entry points, member/round/continuation back and SUMA edit retain shared data', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Série odečtů', exact: true }).click();
  await reading(page, '21');
  await page.getByRole('button', { name: 'Jednotlivý odečet', exact: true }).click();
  await reading(page, '777');
  await page.getByRole('button', { name: /Výsledky měření/ }).click();
  await expect(
    page.getByRole('region', { name: 'SAMOSTATNÉ ODEČTY', exact: true }).locator('.record-open'),
  ).toHaveCount(1);
  const series = page.getByRole('region', { name: 'ODEČTOVÉ SÉRIE', exact: true });
  await series.locator('.record-open').click();
  const s = scope(page);
  await s.getByRole('button', { name: 'Historie EM 21', exact: true }).click();
  await back(page).click();
  await expect(s.getByRole('navigation', { name: 'Odečtová kola' })).toBeVisible();
  await s.getByRole('button', { name: '24.10.2026 11:00', exact: true }).click();
  await back(page).click();
  await expect(s.getByRole('button', { name: 'Aktuální stavy', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await s.getByRole('button', { name: 'POKRAČOVAT DALŠÍM ODEČTEM', exact: true }).click();
  await s.getByLabel('Datum nového odečtu', { exact: true }).fill('2026-10-25');
  await s.getByLabel('Čas kola', { exact: true }).fill('12:00');
  await meter(page, '21').getByLabel('Nový čas', { exact: true }).fill('12:19');
  await meter(page, '21').getByLabel('Nový stav [kWh]', { exact: true }).fill('110');
  await back(page).click();
  await back(page).click();
  await series.locator('.record-open').click();
  await s.getByRole('button', { name: 'Pokračovat v rozepsaném kole', exact: true }).click();
  await expect(s.getByLabel('Čas kola', { exact: true })).toHaveValue('12:00');
  await expect(s.getByLabel('Nový stav [kWh]', { exact: true })).toHaveValue('110');
  await s.getByRole('button', { name: 'ULOŽIT VYPLNĚNÉ ODEČTY', exact: true }).click();
  await expect(s.locator('p[role=status]').first()).toContainText('Uloženo 1');
  const editor = s.locator('.saved-energis');
  await editor.getByLabel('SUMA ENERGIS [kWh]', { exact: true }).fill('10');
  await editor.getByRole('button', { name: '+E', exact: true }).click();
  await editor.getByRole('button', { name: '← Zpět', exact: true }).click();
  await editor.getByRole('button', { name: 'Upravit SUMA ENERGIS', exact: true }).click();
  await expect(editor.getByLabel('SUMA ENERGIS [kWh]', { exact: true })).toHaveValue('10');
  await back(page).click();
  await back(page).click();
  await series.locator('.record-open').click();
  await expect(editor.getByLabel('SUMA ENERGIS [kWh]', { exact: true })).toHaveValue('10');
  await expect(editor.getByRole('button', { name: '+E', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await editor.getByRole('button', { name: 'ULOŽIT SUMA ENERGIS', exact: true }).click();
  await expect(editor.getByRole('status')).toContainText('uložen');
});
test('stylus preview and current result return locally without clearing working values', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Stylus', exact: true }).first().click();
  const s = scope(page);
  const text = 'TS3831/257 11P U21208142 EM12345678 22.10.2026 8:37 stav 23456';
  await s.getByLabel('Volný zápis STYLUS').fill(text);
  await s.getByRole('button', { name: 'ROZPOZNAT ÚDAJE', exact: true }).click();
  await back(page).click();
  await expect(s.getByLabel('Volný zápis STYLUS')).toHaveValue(text);
  await page
    .getByRole('button', { name: 'MĚŘENÍ + ODEČET ELEKTROMĚRU / ENERGIS', exact: true })
    .click();
  await page.getByLabel('VÝROBNÍ ČÍSLO ELEKTROMĚRU', { exact: true }).fill('136888');
  await page.getByLabel('POLE / UMÍSTĚNÍ', { exact: true }).fill('pole 54');
  await page.getByRole('button', { name: '1f měření', exact: true }).click();
  for (const i of [1, 2, 3]) {
    await page.getByLabel(`Primár L${i}`, { exact: true }).fill('30');
    await page.getByLabel(`Klešťový ampérmetr L${i} (mV / V)`, { exact: true }).fill('50');
  }
  await page.getByRole('button', { name: 'VYHODNOTIT PROUDY', exact: true }).click();
  await expect(
    page.getByRole('button', { name: 'ULOŽIT PROUDOVÉ MĚŘENÍ', exact: true }),
  ).toBeVisible();
  await back(page).click();
  await expect(page.getByLabel('Primár L1', { exact: true })).toHaveValue('30');
  await expect(
    page.getByRole('button', { name: 'ULOŽIT PROUDOVÉ MĚŘENÍ', exact: true }),
  ).toHaveCount(0);
});
