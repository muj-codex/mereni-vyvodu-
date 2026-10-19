import { test, expect, type Page } from '@playwright/test';
async function enterCurrent(page: Page, vn = false) {
  await page.getByRole('button', { name: 'Proudový režim NN / VN', exact: true }).click();
  if (vn) await page.getByRole('checkbox', { name: 'VN', exact: true }).check();
  await page
    .getByLabel('VÝROBNÍ ČÍSLO ELEKTROMĚRU', { exact: true })
    .fill(vn ? '00VN01' : '00NN01');
  await page.getByLabel('DATUM', { exact: true }).fill('2026-10-19');
  await page
    .getByLabel(vn ? 'ROZVODNA' : 'TRAFOSTANICE', { exact: true })
    .selectOption(vn ? 'R201' : 'TS 3831/257');
  await page.getByLabel('POLE / UMÍSTĚNÍ', { exact: true }).fill(vn ? 'kobka 4' : '8L');
  const options = await page
    .getByRole('combobox', { name: 'MTP', exact: true })
    .locator('option')
    .allTextContents();
  expect(options.every((s) => s.endsWith(vn ? '/1 A' : '/5 A'))).toBe(true);
  const locations = await page
    .getByLabel(vn ? 'ROZVODNA' : 'TRAFOSTANICE', { exact: true })
    .locator('option')
    .allTextContents();
  expect(locations.every((s) => s.startsWith(vn ? 'R' : 'TS '))).toBe(true);
  await expect(page.getByLabel(vn ? 'TRAFOSTANICE' : 'ROZVODNA', { exact: true })).toHaveCount(0);
  await page.getByRole('combobox', { name: 'MTP', exact: true }).selectOption('300');
  for (let i = 1; i <= 3; i++) {
    await page.getByLabel(`Primár L${i}${vn ? ' SCADA' : ''}`, { exact: true }).fill('20,0');
    await page.getByLabel(`Multimetr L${i}`, { exact: true }).fill(vn ? '0,0066' : '33,0');
    if (vn) await page.getByLabel(`Jednotka L${i}`, { exact: true }).selectOption('V');
  }
}
test('NN a VN proudy, volitelné napětí, historie, export, systémové sdílení a offline reload', async ({
  page,
  context,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/');
  await expect(page.getByText('Offline připraveno', { exact: true })).toBeVisible();
  await enterCurrent(page);
  await expect(page.getByLabel('Primární L1–L2', { exact: true })).toBeDisabled();
  await page.getByRole('button', { name: 'VYHODNOTIT PROUDY', exact: true }).click();
  await expect(page.locator('.current-values .main-percent')).toHaveText([
    '−1,0 %',
    '−1,0 %',
    '−1,0 %',
  ]);
  await expect(page.getByText('333,3 mA / 0,333 A', { exact: true })).toHaveCount(3);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({
    path: `test-results/${test.info().project.name}-proudy.png`,
    fullPage: true,
  });
  for (const [i, color] of ['rgb(207, 52, 60)', 'rgb(33, 131, 74)', 'rgb(242, 201, 76)'].entries())
    await expect(page.locator(`[data-phase="I${i + 1}"]`)).toHaveCSS('background-color', color);
  await page.getByRole('button', { name: 'ULOŽIT PROUDOVÉ MĚŘENÍ', exact: true }).click();
  // Wait for the transaction completion reflected by the reset, before any reload.
  await expect(page.getByLabel('VÝROBNÍ ČÍSLO ELEKTROMĚRU', { exact: true })).toHaveValue('');
  await page.getByRole('combobox', { name: 'MTP', exact: true }).selectOption('150');
  await page.getByRole('checkbox', { name: 'VN', exact: true }).check();
  await expect(page.getByRole('combobox', { name: 'MTP', exact: true })).toHaveValue('300');
  await enterCurrent(page, true);
  await page.getByRole('checkbox', { name: 'PŘIDAT MĚŘENÍ NAPĚTÍ', exact: true }).check();
  await page.getByLabel('Primární napětí SCADA', { exact: true }).selectOption('10.3');
  await page.getByLabel('Sekundární L1–L2', { exact: true }).fill('103,7');
  await page.getByRole('button', { name: 'VYHODNOTIT PROUDY', exact: true }).click();
  await expect(
    page.getByText('Napěťové zapojení nelze z naměřených hodnot jednoznačně určit.', {
      exact: true,
    }),
  ).toBeVisible();
  await expect(page.locator('.current-values .main-percent')).toHaveText([
    '−1,0 %',
    '−1,0 %',
    '−1,0 %',
  ]);
  await page.getByRole('button', { name: 'ULOŽIT PROUDOVÉ MĚŘENÍ', exact: true }).click();
  await expect(page.getByLabel('VÝROBNÍ ČÍSLO ELEKTROMĚRU', { exact: true })).toHaveValue('');
  await page.reload();
  await page.getByRole('button', { name: 'Výsledky měření', exact: false }).last().click();
  await expect(page.locator('.history-item')).toHaveCount(2);
  await context.setOffline(true);
  await page.reload();
  await page.getByRole('button', { name: 'Výsledky měření', exact: false }).last().click();
  await expect(page.locator('.history-item')).toHaveCount(2);
  await page.locator('.record-open').filter({ hasText: '00VN01' }).click();
  await expect(page.getByText('R201', { exact: false }).first()).toBeVisible();
  await expect(page.getByText('10 300,0 V', { exact: true }).first()).toBeVisible();
  await page.getByRole('button', { name: 'Zpět na výsledky měření' }).click();
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'ZÁLOHOVAT HISTORII' }).click();
  expect((await download).suggestedFilename()).toBe('mereni-zaloha.tsv');
  await page.evaluate(() => {
    Object.defineProperty(navigator, 'canShare', { configurable: true, value: () => false });
    Object.defineProperty(navigator, 'share', {
      configurable: true,
      value: async (data: ShareData) => {
        (window as unknown as { shared: ShareData }).shared = data;
      },
    });
  });
  await page.getByRole('button', { name: 'SDÍLET', exact: true }).click();
  await page.getByLabel('Vybrat všechna', { exact: true }).check();
  await page.getByRole('button', { name: 'SDÍLET SYSTÉMOVĚ', exact: true }).click();
  const shared = await page.evaluate(() => (window as unknown as { shared: ShareData }).shared);
  expect(shared.text).toContain('Rozvodna: R201');
  expect(shared.text).toContain('Pole / umístění: kobka 4');
  expect(shared.text).toContain('00NN01');
  await page.evaluate(() => {
    Object.defineProperty(navigator, 'canShare', { configurable: true, value: () => true });
  });
  await page.getByRole('button', { name: 'SDÍLET SYSTÉMOVĚ', exact: true }).click();
  expect(
    await page.evaluate(() => {
      const file = (window as unknown as { shared: ShareData }).shared.files?.[0];
      return file ? { name: file.name, size: file.size } : null;
    }),
  ).toMatchObject({ name: 'mereni.tsv', size: expect.any(Number) });

  await page.evaluate(() => {
    Object.defineProperty(navigator, 'share', { configurable: true, value: undefined });
  });
  await page.getByRole('button', { name: 'SDÍLET SYSTÉMOVĚ', exact: true }).click();
  await expect(page.getByLabel('Text pro ruční zkopírování')).toContainText('00VN01');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(errors).toEqual([]);
});
test('starý v1 záznam přežije DB upgrade i offline reload', async ({ page, context }) => {
  // Seed the actual previous schema before the application bundle opens IndexedDB.
  await page.route('**/assets/*.js', (route) => route.abort());
  await page.goto('/');
  await page.evaluate(async () => {
    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.open('mereni-vyvodu-v1', 1);
      request.onupgradeneeded = () => {
        const store = request.result.createObjectStore('measurements', { keyPath: 'id' });
        store.createIndex('by-time', 'savedAt');
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
              meterPulse: 0.1,
              energisPulse: 0.1,
            },
            phases: [
              { u: 230, i: 1, pf: 1, p: 0.23 },
              { u: 230, i: 1, pf: 1, p: 0.23 },
              { u: 230, i: 1, pf: 1, p: 0.23 },
            ],
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
    });
  });
  await page.unroute('**/assets/*.js');
  await page.reload();
  await expect(page.getByText('Offline připraveno', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Výsledky měření', exact: false }).last().click();
  await expect(page.locator('.history-item')).toHaveCount(1);
  await expect(page.locator('.main-percent')).toHaveText('+1,4 %');
  await context.setOffline(true);
  await page.reload();
  await page.getByRole('button', { name: 'Výsledky měření', exact: false }).last().click();
  await expect(page.locator('.history-item')).toHaveCount(1);
  await page.locator('.record-open').click();
  await page.getByRole('button', { name: 'Data / detail' }).click();
  await expect(page.getByText('0,70 kW', { exact: true })).toBeVisible();
});
