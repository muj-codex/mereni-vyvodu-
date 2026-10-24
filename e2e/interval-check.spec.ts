import { seedLegacyIntervalFromDraft } from './legacyInterval';
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
  await page.getByLabel('Datum OD', { exact: true }).fill('2026-10-20');
  await page.getByLabel('Čas OD', { exact: true }).fill('08:00');
  await page.getByLabel('Datum DO', { exact: true }).fill('2026-10-20');
  await page.getByLabel('Čas DO', { exact: true }).fill('09:00');
  await page.getByLabel('Stav elektroměru OD', { exact: true }).fill('100');
  await page.getByLabel('Stav elektroměru DO', { exact: true }).fill('120');
  await page.getByLabel('Spotřeba Energis za interval', { exact: true }).fill(energy);
}
async function save(page: Page) {
  await seedLegacyIntervalFromDraft(page);
  await expect(page.getByLabel('Čas OD', { exact: true })).toHaveValue('');
  await expect(page.locator('.interval-result')).toHaveCount(0);
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
test('kontrola: korekce a archivovaný samostatný snapshot ve třech záložkách', async ({ page }) => {
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
  await expect(page.getByText(/Koeficient se použije při výpočtu/)).toBeVisible();
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
  await expect(page.locator('.record-open')).toHaveAttribute('data-type', 'Kontrola stavů');
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
  expect(Object.keys(data)).toEqual(['title', 'text']);
  expect(data.title).toBe('Kontrola stavů – elektroměr 000MAIL – TS 0425/259');
  expect(data.text).toContain('\t');
  expect(data.text).toContain('-0,33 %');
  expect(data.text).not.toMatch(/\d+[.,]\d{4}/);
  expect(data.text.split('\t')[4]).toBe('000MAIL');
});
test('historie: všechna místa, napětí a nejnovější nahoře', async ({ page }) => {
  await threeRecords(page);
  await expect(page.locator('.history-item')).toHaveCount(3);
  await expect(page.locator('.record-open').first()).toHaveAttribute('data-serial', '000VN');
  for (const value of ['TS 0425/259', 'TS 3308/250', 'R201'])
    expect(await page.locator('.history-list').innerText()).toContain(value);
});
test('filtr konkrétní TS a zrušení filtru vrací všechna data', async ({ page }) => {
  await threeRecords(page);
  await page.getByLabel('Hledat ve všech výsledcích a odečtech').fill('0425');
  await expect(page.locator('.history-item')).toHaveCount(1);
  await expect(page.locator('.record-open')).toHaveAttribute('data-serial', '000TS');
  await page.getByLabel('Hledat ve všech výsledcích a odečtech').fill('');
  await expect(page.locator('.history-item')).toHaveCount(3);
});
test('filtr VN 10,3 kV', async ({ page }) => {
  await threeRecords(page);
  await page.getByLabel('Hledat ve všech výsledcích a odečtech').fill('10,3');
  await expect(page.locator('.history-item')).toHaveCount(1);
  await expect(page.locator('.record-open')).toHaveAttribute('data-serial', '000VN');
});
test('kombinace umístění a napětí, včetně prázdného výsledku', async ({ page }) => {
  await threeRecords(page);
  await page.getByLabel('Hledat ve všech výsledcích a odečtech').fill('R20');
  await page.getByLabel('Hledat ve všech výsledcích a odečtech').fill('10,3');
  await expect(page.locator('.history-item')).toHaveCount(1);
  await page.getByLabel('Hledat ve všech výsledcích a odečtech').fill('nenalezeno');
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
  await page.locator('.record-open').locator('xpath=self::*[@data-serial="000LEGACY"]').click();
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
  await page.locator('.record-open').locator('xpath=self::*[@data-serial="000CHECK"]').click();
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
  expect(await page.locator('.interval-result .data-list').innerText()).not.toMatch(/\d+[.,]\d{4}/);
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

for (const [fromTime, toDate, toTime, label] of [
  ['14:45', '2026-10-22', '16:45', '22.10.2026 14:45 → 22.10.2026 16:45'],
  ['23:45', '2026-10-23', '00:30', '22.10.2026 23:45 → 23.10.2026 00:30'],
]) {
  test(`1.2.4 interval ${label}: share, history and saved detail`, async ({ page }) => {
    await page.goto('/');
    await check(page, '66666777', '400', 'TS 3308/250');
    await page.getByLabel('DATUM', { exact: true }).fill('2026-10-19');
    await page.getByLabel('Datum OD', { exact: true }).fill('2026-10-22');
    await page.getByLabel('Čas OD', { exact: true }).fill(fromTime);
    await page.getByLabel('Datum DO', { exact: true }).fill(toDate);
    await page.getByLabel('Čas DO', { exact: true }).fill(toTime);
    await expect(page.locator('.interval-result')).toContainText(`Interval: ${label}`);
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
    expect(data.title).toBe('Kontrola stavů – elektroměr 66666777 – TS 3308/250');
    expect(data.text.split('\t').slice(0, 2)).toEqual(['2026-10-22', fromTime]);
    expect(data.text).toContain(`2026-10-22T${fromTime}`);
    expect(data.text).toContain(`${toDate}T${toTime}`);
    expect(data.text).not.toContain('2026-10-19');
    await save(page);
    await page.reload();
    await history(page);
    await expect(page.locator('.record-open')).toContainText(
      `${toDate.split('-').reverse().join('.')} ${toTime}`,
    );
    await expect(page.locator('.record-open')).not.toContainText('2026-10-19');
    await page.locator('.record-open').click();
    await expect(page.locator('.identification-summary')).toContainText(`Interval: ${label}`);
    await expect(page.locator('.interval-result')).toContainText(`Interval: ${label}`);
    await page.getByRole('button', { name: 'Data / detail', exact: true }).click();
    await expect(page.locator('.interval-result')).toContainText(`Interval: ${label}`);
  });
}

test('1.2.4 legacy Kontrola stavů: původní interval i chybějící interval se otevřou', async ({
  page,
}) => {
  await page.goto('/');
  await check(page);
  await save(page);
  await page.evaluate(
    async () =>
      new Promise<void>((resolve, reject) => {
        const request = indexedDB.open('mereni-vyvodu-v1');
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          const db = request.result;
          const tx = db.transaction('measurements', 'readwrite');
          const store = tx.objectStore('measurements');
          const all = store.getAll();
          all.onsuccess = () => {
            const record = all.result[0];
            record.id = 'missing-interval';
            record.input.serial = '000MISSING';
            delete record.input.interval;
            store.add(record);
          };
          tx.oncomplete = () => {
            db.close();
            resolve();
          };
          tx.onerror = () => reject(tx.error);
        };
      }),
  );
  await page.reload();
  await history(page);
  await expect(page.locator('.history-item')).toHaveCount(2);
  await expect(
    page.locator('.record-open').locator('xpath=self::*[@data-serial="000CHECK"]'),
  ).toContainText('20.10.2026 09:00');
  await page.locator('.record-open').locator('xpath=self::*[@data-serial="000MISSING"]').click();
  await expect(page.locator('.interval-result')).toContainText('Interval: 2026-10-20');
  await page.getByRole('button', { name: 'Data / detail', exact: true }).click();
  await expect(page.locator('.interval-result')).toContainText('Interval: 2026-10-20');
});
