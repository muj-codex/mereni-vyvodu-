import { test, expect, type Page } from '@playwright/test';
const carryLabel = 'Použít tuto identifikaci i pro následující měření';
async function setup(page: Page, vn = false) {
  await page.goto('/');
  await page.getByLabel('VÝROBNÍ ČÍSLO ELEKTROMĚRU', { exact: true }).fill('66666777');
  await page.getByLabel('DATUM', { exact: true }).fill('2026-10-22');
  await page.getByLabel('POLE / UMÍSTĚNÍ', { exact: true }).fill('pole 25');
  await page.getByLabel('Režim sítě / napětí', { exact: true }).selectOption(vn ? '6300' : '500');
  await page
    .getByLabel(vn ? 'ROZVODNA' : 'TRAFOSTANICE', { exact: true })
    .selectOption(vn ? 'R201' : 'TS 3308/250');
  await page.getByLabel('MTP primár', { exact: true }).selectOption('300');
  await page.getByLabel('MTP elektroměr', { exact: true }).selectOption('600');
  await page.getByRole('checkbox', { name: 'Porovnat stavy s Energis' }).check();
  await page.getByLabel('Datum OD', { exact: true }).fill('2026-10-22');
  await page.getByLabel('Čas OD', { exact: true }).fill('09:45');
  await page.getByLabel('Datum DO', { exact: true }).fill('2026-10-25');
  await page.getByLabel('Čas DO', { exact: true }).fill('11:15');
  await page.getByLabel('Stav elektroměru OD', { exact: true }).fill('100');
  await page.getByLabel('Stav elektroměru DO', { exact: true }).fill('120');
  await page.getByLabel('Spotřeba Energis za interval', { exact: true }).fill('10');
}
async function failWrites(page: Page) {
  await page.evaluate(() => {
    const original = IDBDatabase.prototype.transaction;
    IDBDatabase.prototype.transaction = function (...args: Parameters<IDBDatabase['transaction']>) {
      if (args[1] === 'readwrite')
        throw new DOMException('Test quota failure', 'QuotaExceededError');
      return original.apply(this, args);
    };
    (window as any).restoreTransactions = () => {
      IDBDatabase.prototype.transaction = original;
    };
  });
}
async function history(page: Page) {
  await page.getByRole('button', { name: 'Výsledky měření', exact: false }).last().click();
}
test('uložení kontroly zachová hlavičku/datumy, vyčistí časy a pokračuje s čistou 3f hlavičkou', async ({
  page,
}) => {
  await setup(page);
  await expect(page.getByRole('checkbox', { name: carryLabel, exact: true })).toBeChecked();
  await page.getByRole('button', { name: 'Informace: přenos identifikace', exact: true }).click();
  await expect(page.getByRole('note')).toContainText('Nepřenáší naměřené hodnoty');
  await page.getByRole('button', { name: 'Informace: přenos identifikace', exact: true }).click();
  await page.getByRole('button', { name: 'ULOŽIT KONTROLU STAVŮ', exact: true }).click();
  for (const label of [
    'Čas OD',
    'Čas DO',
    'Stav elektroměru OD',
    'Stav elektroměru DO',
    'Spotřeba Energis za interval',
  ])
    await expect(page.getByLabel(label, { exact: true })).toHaveValue('');
  await expect(page.getByLabel('Datum OD', { exact: true })).toHaveValue('2026-10-22');
  await expect(page.getByLabel('Datum DO', { exact: true })).toHaveValue('2026-10-25');
  await expect(page.getByLabel('DATUM', { exact: true })).toHaveValue('2026-10-22');
  await expect(page.locator('.interval-result')).toHaveCount(0);
  await expect(page.getByLabel('MTP elektroměr', { exact: true })).toHaveValue('600');
  await expect(page.getByLabel('VÝROBNÍ ČÍSLO ELEKTROMĚRU', { exact: true })).toHaveValue(
    '66666777',
  );
  await page.reload();
  await expect(page.getByLabel('Čas OD', { exact: true })).toHaveValue('');
  await expect(page.getByLabel('Datum DO', { exact: true })).toHaveValue('2026-10-25');
  await page.getByRole('button', { name: 'PŘESKOČIT → KYORITSU' }).click();
  await expect(page.locator('.identification-summary')).toContainText('66666777');
  await expect(page.locator('.identification-summary')).toContainText('TS 3308/250');
  await expect(page.locator('.identification-summary')).toContainText('NN 500 V – ARON');
  await expect(page.getByLabel('U1', { exact: true })).toHaveValue('');
  await expect(page.getByLabel('IL1', { exact: true })).toHaveValue('');
  await history(page);
  await expect(page.locator('.history-item')).toHaveCount(1);
  await page.locator('.record-open').click();
  await page.getByRole('button', { name: 'Data / detail', exact: true }).click();
  await expect(page.locator('main')).toContainText('22.10.2026 09:45');
  await expect(page.locator('main')).toContainText('25.10.2026 11:15');
});
test('ON přenese VN identifikaci a MTP do 1f bez pracovních hodnot', async ({ page }) => {
  await setup(page, true);
  await page.getByRole('button', { name: '1f měření', exact: true }).click();
  await expect(page.locator('.identification-summary')).toContainText('R201');
  await expect(page.locator('.identification-summary')).toContainText('VN 6,3 kV');
  await expect(page.getByLabel('MTP', { exact: true })).toHaveValue('300');
  for (const i of [1, 2, 3]) {
    await expect(page.getByLabel(`Primár L${i} SCADA`, { exact: true })).toHaveValue('');
    await expect(page.getByLabel(`Klešťový ampérmetr L${i} (mV / V)`, { exact: true })).toHaveValue(
      '',
    );
  }
  expect(await page.locator('main').innerText()).not.toContain(
    'Spotřeba elektroměru a Energis odpovídá.',
  );
});
test('OFF nepřenese hlavičku ani konfiguraci do 1f a umožní vlastní identifikaci', async ({
  page,
}) => {
  await setup(page, true);
  await page.getByRole('checkbox', { name: carryLabel, exact: true }).uncheck();
  await page.getByRole('button', { name: '1f měření', exact: true }).click();
  await expect(page.getByLabel('VÝROBNÍ ČÍSLO ELEKTROMĚRU', { exact: true })).toHaveValue('');
  await expect(page.getByLabel('POLE / UMÍSTĚNÍ', { exact: true })).toHaveValue('');
  await expect(page.getByLabel('Režim sítě / napětí', { exact: true })).toHaveValue('400');
  await expect(page.locator('.identification-summary')).toHaveCount(0);
  await page.getByLabel('VÝROBNÍ ČÍSLO ELEKTROMĚRU', { exact: true }).fill('OWN');
  await page.getByRole('button', { name: '3f měření', exact: true }).click();
  await expect(page.getByLabel('VÝROBNÍ ČÍSLO ELEKTROMĚRU', { exact: true })).toHaveValue(
    '66666777',
  );
  await page.getByRole('button', { name: '1f měření', exact: true }).click();
  await expect(page.getByLabel('VÝROBNÍ ČÍSLO ELEKTROMĚRU', { exact: true })).toHaveValue('OWN');
});
test('OFF nepřenese hlavičku ani MTP do 3f', async ({ page }) => {
  await setup(page);
  await page.getByRole('checkbox', { name: carryLabel, exact: true }).uncheck();
  await page.getByRole('button', { name: 'PŘESKOČIT → KYORITSU' }).click();
  await expect(page.getByLabel('VÝROBNÍ ČÍSLO ELEKTROMĚRU', { exact: true })).toHaveValue('');
  await expect(page.getByLabel('POLE / UMÍSTĚNÍ', { exact: true })).toHaveValue('');
  await expect(page.getByLabel('MTP primár', { exact: true })).toHaveValue('100');
  await expect(page.getByLabel('Režim sítě / napětí', { exact: true })).toHaveValue('400');
});
test('obrácený interval odmítne uložení, datum i čas jsou nezávisle editovatelné', async ({
  page,
}) => {
  await setup(page);
  await page.getByLabel('Datum DO', { exact: true }).fill('2026-10-21');
  await expect(page.getByRole('alert')).toContainText('Čas DO musí být později než OD');
  await expect(
    page.getByRole('button', { name: 'ULOŽIT KONTROLU STAVŮ', exact: true }),
  ).toHaveCount(0);
  await expect(page.getByLabel('Čas DO', { exact: true })).toHaveValue('11:15');
  await expect(page.getByLabel('Stav elektroměru DO', { exact: true })).toHaveValue('120');
  await page.getByLabel('Datum DO', { exact: true }).fill('2026-10-25');
  await expect(
    page.getByRole('button', { name: 'ULOŽIT KONTROLU STAVŮ', exact: true }),
  ).toBeVisible();
});
test('chyba zápisu kontroly nesmaže vstupy; opakování uloží a vyčistí až po úspěchu', async ({
  page,
}) => {
  await setup(page);
  await failWrites(page);
  await page.getByRole('button', { name: 'ULOŽIT KONTROLU STAVŮ', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Formulář zůstává zachován');
  await expect(page.getByLabel('Čas OD', { exact: true })).toHaveValue('09:45');
  await expect(page.getByLabel('Čas DO', { exact: true })).toHaveValue('11:15');
  await expect(page.getByLabel('Stav elektroměru OD', { exact: true })).toHaveValue('100');
  await expect(page.getByLabel('Spotřeba Energis za interval', { exact: true })).toHaveValue('10');
  await page.evaluate(() => (window as any).restoreTransactions());
  await page.getByRole('button', { name: 'ULOŽIT KONTROLU STAVŮ', exact: true }).click();
  await expect(page.getByLabel('Čas OD', { exact: true })).toHaveValue('');
  await history(page);
  await expect(page.locator('.history-item')).toHaveCount(1);
});
test('1f chyba uchová hodnoty a výsledek, úspěch zachová konfiguraci a vyčistí celé měření', async ({
  page,
}) => {
  await setup(page);
  await page.getByRole('button', { name: '1f měření', exact: true }).click();
  await page.getByLabel('MTP', { exact: true }).selectOption('600');
  for (const i of [1, 3]) {
    await page.getByLabel(`Primár L${i}`, { exact: true }).fill('60');
    await page.getByLabel(`Klešťový ampérmetr L${i} (mV / V)`, { exact: true }).fill('50');
  }
  await page.getByRole('checkbox', { name: 'PŘIDAT MĚŘENÍ NAPĚTÍ', exact: true }).check();
  for (const pair of ['UL1-L2', 'UL1-L3', 'UL2-L3']) {
    await page.getByLabel(`Primární ${pair}`, { exact: true }).fill('500');
    await page.getByLabel(`Sekundární ${pair}`, { exact: true }).fill('100');
  }
  await page.getByRole('button', { name: 'VYHODNOTIT PROUDY', exact: true }).click();
  await failWrites(page);
  await page.getByRole('button', { name: 'ULOŽIT PROUDOVÉ MĚŘENÍ', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Měření nebylo uloženo');
  await expect(page.getByLabel('Primár L1', { exact: true })).toHaveValue('60');
  await expect(page.getByLabel('Klešťový ampérmetr L1 (mV / V)', { exact: true })).toHaveValue(
    '50',
  );
  await expect(page.getByLabel('Sekundární UL1-L2', { exact: true })).toHaveValue('100');
  await page.evaluate(() => (window as any).restoreTransactions());
  await page.getByRole('button', { name: 'ULOŽIT PROUDOVÉ MĚŘENÍ', exact: true }).click();
  await expect(
    page.getByRole('button', { name: 'ULOŽIT PROUDOVÉ MĚŘENÍ', exact: true }),
  ).toHaveCount(0);
  for (const label of [
    'Primár L1',
    'Klešťový ampérmetr L1 (mV / V)',
    'Primární UL1-L2',
    'Sekundární UL1-L2',
  ])
    await expect(page.getByLabel(label, { exact: true })).toHaveValue('');
  await expect(page.getByLabel('MTP', { exact: true })).toHaveValue('600');
  await expect(
    page.getByRole('checkbox', { name: 'PŘIDAT MĚŘENÍ NAPĚTÍ', exact: true }),
  ).toBeChecked();
  await expect(page.locator('.identification-summary')).toContainText('66666777');
  await expect(page.locator('.current-values')).toHaveCount(0);
  await history(page);
  await expect(page.locator('.history-item')).toHaveCount(1);
});
