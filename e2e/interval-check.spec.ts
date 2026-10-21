import { test, expect, type Page } from '@playwright/test';
async function check(
  page: Page,
  serial = '000CHECK',
  voltage = '400',
  location = 'TS 0425/259',
  energy = '10',
) {
  await page.getByLabel('VÝROBNÍ ČÍSLO ELEKTROMĚRU', { exact: true }).fill(serial);
  await page.getByLabel('DATUM', { exact: true }).fill('2026-10-20');
  await page.getByLabel('POLE / UMÍSTĚNÍ', { exact: true }).fill('pole 54');
  await page.getByLabel('Režim sítě / napětí', { exact: true }).selectOption(voltage);
  await page
    .getByLabel(Number(voltage) > 500 ? 'ROZVODNA' : 'TRAFOSTANICE', { exact: true })
    .selectOption(location);
  await page.getByLabel('MTP primár', { exact: true }).selectOption('300');
  await page.getByLabel('MTP elektroměr', { exact: true }).selectOption('600');
  await page.getByRole('checkbox', { name: 'Porovnat stavy s Energis' }).check();
  await page.getByLabel('Datum a čas OD', { exact: true }).fill('2026-10-20T08:00');
  await page.getByLabel('Datum a čas DO', { exact: true }).fill('2026-10-20T09:00');
  await page.getByLabel('Stav elektroměru OD', { exact: true }).fill('100');
  await page.getByLabel('Stav elektroměru DO', { exact: true }).fill('120');
  await page.getByLabel('Spotřeba Energis za interval', { exact: true }).fill(energy);
}
async function save(page: Page) {
  await page.getByRole('button', { name: 'ULOŽIT KONTROLU STAVŮ', exact: true }).click();
  await expect(
    page.getByRole('button', { name: 'KONTROLA STAVŮ ULOŽENA', exact: true }),
  ).toBeDisabled();
}
async function history(page: Page) {
  await page.getByRole('button', { name: 'Výsledky měření', exact: false }).last().click();
}
async function threeRecords(page: Page) {
  await page.goto('/');
  for (const [serial, voltage, location] of [
    ['000TS', '500', 'TS 0425/259'],
    ['000OTHER', '400', 'TS 3308/250'],
    ['000VN', '10300', 'R201'],
  ]) {
    await check(page, serial, voltage, location);
    await save(page);
  }
  await history(page);
}
test('samostatná kontrola: korekce, uložení bez Kyoritsu a tři různé záložky snapshotu', async ({
  page,
}) => {
  await page.goto('/');
  await check(page);
  await expect(page.getByLabel('Korekční koeficient', { exact: true })).toHaveText('× 0,500');
  await expect(page.locator('.interval-result')).toContainText('10 kWh');
  await expect(
    page.getByText('Spotřeba elektroměru a Energis odpovídá.', { exact: true }),
  ).toBeVisible();
  await expect(page.getByLabel('Váha pulzu elektroměru', { exact: true })).toHaveCount(0);
  await page
    .getByRole('button', { name: 'Informace o korekčním koeficientu', exact: true })
    .click();
  await expect(page.getByText(/Korekční koeficient se používá při porovnání/)).toBeVisible();
  await save(page);
  await page.getByLabel('POLE / UMÍSTĚNÍ', { exact: true }).fill('pozdější změna');
  await history(page);
  await expect(page.locator('.history-item')).toHaveCount(1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await page.screenshot({
    path: `test-results/${test.info().project.name}-interval-history.png`,
    fullPage: true,
  });
  await expect(page.locator('.record-open')).toContainText('Kontrola stavů');
  await page.locator('.record-open').click();
  const result = await page.locator('main').innerText();
  await page.getByRole('button', { name: 'Prověřit', exact: true }).click();
  const inspection = await page.locator('main').innerText();
  expect(inspection).not.toBe(result);
  await page.getByRole('button', { name: 'Data / detail', exact: true }).click();
  const detail = await page.locator('main').innerText();
  expect(detail).not.toBe(inspection);
  expect(detail).toContain('pole 54');
  expect(detail).not.toContain('pozdější změna');
  expect(detail).not.toContain('Kyoritsu');
  expect(detail).toContain('Stav elektroměru OD');
});
test('odeslání aktuální kontroly obsahuje čisté TSV a žádné files/přílohy', async ({ page }) => {
  await page.goto('/');
  await check(page, '000MAIL', '400', 'TS 0425/259', '9.967391304347827');
  await page.evaluate(() =>
    Object.defineProperty(navigator, 'share', {
      configurable: true,
      value: async (data: ShareData) => {
        (window as any).shared = data;
      },
    }),
  );
  await page.getByRole('button', { name: 'ODESLAT TUTO KONTROLU', exact: true }).click();
  const data = await page.evaluate(() => (window as any).shared);
  expect(Object.keys(data)).toEqual(['text']);
  expect(data.text).toContain('\t');
  expect(data.text).toContain('-0,33 %');
  expect(data.text).not.toMatch(/\d+[.,]\d{4}/);
  expect(data.text.split('\t')[4]).toBe('000MAIL');
});
test('historie: všechna místa, napětí a nejnovější nahoře', async ({ page }) => {
  await threeRecords(page);
  await expect(page.locator('.history-item')).toHaveCount(3);
  await expect(page.locator('.record-open').first()).toContainText('000VN');
  for (const value of ['TS 0425/259', 'TS 3308/250', 'R201', 'VN 10,3 kV', 'NN 500 V – ARON'])
    expect(await page.locator('.history-list').innerText()).toContain(value);
});
test('filtr konkrétní TS a zrušení filtru vrací všechna data', async ({ page }) => {
  await threeRecords(page);
  await page.getByLabel('Filtr umístění', { exact: true }).selectOption('TS 0425/259');
  await expect(page.locator('.history-item')).toHaveCount(1);
  await expect(page.locator('.record-open')).toContainText('000TS');
  await page.getByRole('button', { name: 'Zrušit filtry', exact: true }).click();
  await expect(page.locator('.history-item')).toHaveCount(3);
});
test('filtr VN 10,3 kV', async ({ page }) => {
  await threeRecords(page);
  await page.getByLabel('Filtr režim / napětí', { exact: true }).selectOption('10300');
  await expect(page.locator('.history-item')).toHaveCount(1);
  await expect(page.locator('.record-open')).toContainText('000VN');
});
test('kombinace umístění a napětí, včetně prázdného výsledku', async ({ page }) => {
  await threeRecords(page);
  await page.getByLabel('Filtr umístění', { exact: true }).selectOption('R201');
  await page.getByLabel('Filtr režim / napětí', { exact: true }).selectOption('10300');
  await expect(page.locator('.history-item')).toHaveCount(1);
  await page.getByLabel('Filtr režim / napětí', { exact: true }).selectOption('400');
  await expect(page.locator('.history-item')).toHaveCount(0);
  await expect(
    page.getByText('Žádné záznamy neodpovídají filtrům.', { exact: true }),
  ).toBeVisible();
});
async function seedLegacy(page: Page) {
  await page.route('**/assets/*.js', (route) => route.abort());
  await page.goto('/');
  await page.evaluate(
    async () =>
      new Promise<void>((resolve, reject) => {
        const request = indexedDB.open('mereni-vyvodu-v1', 1);
        request.onupgradeneeded = () => {
          const s = request.result.createObjectStore('measurements', { keyPath: 'id' });
          s.createIndex('by-time', 'savedAt');
        };
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          const db = request.result;
          const tx = db.transaction('measurements', 'readwrite');
          tx.objectStore('measurements').add({
            id: 'old-v1',
            savedAt: '2026-10-17T08:00:00Z',
            localTimestamp: '17.10.2026 10:00:00',
            input: {
              serial: '000LEGACY',
              config: {
                actualMtp: 100,
                meterMtp: 100,
                voltage: 400,
                meterPulse: 0.2,
                energisPulse: 'X',
              },
              phases: [0, 1, 2].map(() => ({ u: 230, i: 1, pf: 1, p: 0.23 })),
              kyoritsu: 0.69,
              energis: 0.7,
            },
            diagnosis: {
              status: 'ok',
              differencePercent: 1.4492753623,
              scenarios: [],
              warnings: [],
              modelVersion: '1.0.0',
            },
          });
          tx.oncomplete = () => {
            db.close();
            resolve();
          };
          tx.onerror = () => reject(tx.error);
        };
      }),
  );
  await page.unroute('**/assets/*.js');
  await page.reload();
}
test('legacy v1 zůstane beze změny vedle nové kontroly po reloadu', async ({ page }) => {
  await seedLegacy(page);
  await check(page);
  await save(page);
  await page.reload();
  await history(page);
  await expect(page.locator('.history-item')).toHaveCount(2);
  await page.locator('.record-open').filter({ hasText: '000LEGACY' }).click();
  await page.getByRole('button', { name: 'Data / detail', exact: true }).click();
  await expect(page.getByText('0,2 kWh', { exact: true })).toBeVisible();
  const legacy = await page.evaluate(
    async () =>
      new Promise<any>((resolve) => {
        const req = indexedDB.open('mereni-vyvodu-v1');
        req.onsuccess = () => {
          const db = req.result;
          const tx = db.transaction('measurements');
          const r = tx.objectStore('measurements').get('old-v1');
          r.onsuccess = () => {
            resolve(r.result);
            db.close();
          };
        };
      }),
  );
  expect(legacy.input.config.energisPulse).toBe('X');
  expect(legacy.kind).toBeUndefined();
});
test('offline reload zachová starší měření i novou kontrolu stavů', async ({ page, context }) => {
  await seedLegacy(page);
  await expect(page.getByText('Offline připraveno', { exact: true })).toBeVisible();
  await check(page);
  await save(page);
  await context.setOffline(true);
  await page.reload();
  await history(page);
  await expect(page.locator('.history-item')).toHaveCount(2);
  await page.locator('.record-open').filter({ hasText: '000CHECK' }).click();
  await expect(
    page.getByText('Spotřeba elektroměru a Energis odpovídá.', { exact: true }),
  ).toBeVisible();
});
test('1f ARON: bez IL2, dobrý výsledek bez Energis a závada IL3 používá 7–9', async ({ page }) => {
  await page.goto('/');
  await check(page, '000ARON', '500');
  await page.getByRole('button', { name: '1f měření', exact: true }).click();
  await page.getByLabel('MTP', { exact: true }).selectOption('300');
  for (const i of [1, 3]) {
    await page.getByLabel(`Primár L${i}`, { exact: true }).fill('30');
    await page.getByLabel(`Klešťový ampérmetr L${i} (mV / V)`, { exact: true }).fill('50');
  }
  await page.getByRole('button', { name: 'VYHODNOTIT PROUDY', exact: true }).click();
  expect(await page.locator('main').innerText()).not.toMatch(/Energis|4–6/);
  expect(await page.locator('main').innerText()).not.toMatch(/Energis|4–6/);
  await page.getByLabel('Klešťový ampérmetr L3 (mV / V)', { exact: true }).fill('0');
  await page.getByRole('button', { name: 'VYHODNOTIT PROUDY', exact: true }).click();
  expect(await page.locator('main').innerText()).toContain('7–9');
  expect(await page.locator('main').innerText()).not.toContain('4–6');
});
test('číselný výstup UI/TSV a fallback bez systémového sdílení', async ({ page }) => {
  await page.goto('/');
  await check(page, '000PREC', '400', 'TS 0425/259', '9.967391304347827');
  expect(await page.locator('.interval-result').innerText()).not.toMatch(/\d+[.,]\d{4}/);
  await page.evaluate(() => {
    Object.defineProperty(navigator, 'share', { configurable: true, value: undefined });
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        writeText: async () => {
          throw Error('unavailable');
        },
      },
    });
  });
  await page.getByRole('button', { name: 'ODESLAT TUTO KONTROLU', exact: true }).click();
  const text = await page
    .getByLabel('TSV kontroly pro ruční zkopírování', { exact: true })
    .inputValue();
  expect(text).toContain('\t');
  expect(text).toContain('-0,33 %');
  expect(text).not.toMatch(/\d+[.,]\d{4}/);
});
