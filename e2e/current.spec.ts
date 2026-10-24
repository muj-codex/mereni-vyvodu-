import { test, expect, chromium, type Page } from '@playwright/test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
async function identify(page: Page, voltage = '400', serial = '000NN01') {
  await page.getByRole('button', { name: '3f měření', exact: true }).click();
  await page.getByLabel('VÝROBNÍ ČÍSLO ELEKTROMĚRU', { exact: true }).fill(serial);
  await page.getByLabel('DATUM', { exact: true }).fill('2026-10-19');
  await page.getByLabel('POLE / UMÍSTĚNÍ', { exact: true }).fill('pole 3L');
  await page.getByLabel('Režim sítě / napětí', { exact: true }).selectOption(voltage);
}
async function current(page: Page, voltage = '400', failure = false) {
  await page.getByRole('button', { name: '1f měření', exact: true }).click();
  await expect(page.getByLabel('VÝROBNÍ ČÍSLO ELEKTROMĚRU', { exact: true })).toHaveCount(0);
  await expect(page.getByLabel('DATUM', { exact: true })).toHaveCount(0);
  await expect(page.getByRole('checkbox', { name: 'VN', exact: true })).toHaveCount(0);
  await page.getByLabel('MTP', { exact: true }).selectOption('custom');
  await page.getByLabel('Vlastní primár MTP', { exact: true }).fill('408');
  for (const i of [1, 2, 3]) {
    if (voltage === '500' && i === 2) continue;
    await page
      .getByLabel(`Primár L${i}${Number(voltage) > 500 ? ' SCADA' : ''}`, { exact: true })
      .fill('40,8');
    await page
      .getByLabel(`Klešťový ampérmetr L${i} (mV / V)`, { exact: true })
      .fill(failure && i === 3 ? '0' : Number(voltage) > 500 ? '10' : '50');
  }
}
async function save(page: Page) {
  await page.getByRole('button', { name: 'VYHODNOTIT PROUDY', exact: true }).click();
  await page.getByRole('button', { name: 'ULOŽIT PROUDOVÉ MĚŘENÍ', exact: true }).click();
  await expect(
    page.getByRole('button', { name: 'ULOŽIT PROUDOVÉ MĚŘENÍ', exact: true }),
  ).toHaveCount(0);
}
async function history(page: Page) {
  await page.getByRole('button', { name: 'Výsledky měření', exact: false }).last().click();
}

test('NN 400 V: identifikace bez pulzů, vlastní MTP, uložení, tabs, share a TSV email', async ({
  page,
}) => {
  await page.goto('/');
  await identify(page);
  await current(page);
  await expect(page.getByText('MTP 408/5 A', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'VYHODNOTIT PROUDY', exact: true }).click();
  await expect(page.locator('.current-values .main-percent')).toHaveText([
    '0,0 %',
    '0,0 %',
    '0,0 %',
  ]);
  await save(page);
  await history(page);
  await expect(page.locator('.history-item')).toHaveCount(1);
  await page.locator('.record-open').click();
  const result = await page.locator('main').innerText();
  expect(result).not.toContain('Skutečný sekundár');
  await page.getByRole('button', { name: 'Prověřit', exact: true }).click();
  const inspection = await page.locator('main').innerText();
  expect(inspection).toContain('proudová větev odpovídají');
  expect(inspection).not.toBe(result);
  await page.getByRole('button', { name: 'Data / detail', exact: true }).click();
  const detail = await page.locator('main').innerText();
  expect(detail).toContain('Skutečný sekundár');
  expect(detail).not.toBe(inspection);
  await page.getByRole('button', { name: '← Zpět' }).click();
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'ZÁLOHOVAT DATA' }).click();
  expect((await download).suggestedFilename()).toBe('mereni-zaloha.json');
  await page.getByRole('button', { name: 'SDÍLET', exact: true }).click();
  await page.getByLabel('Vybrat všechna', { exact: true }).check();
  await page.evaluate(() => {
    Object.defineProperty(navigator, 'canShare', { configurable: true, value: () => false });
    Object.defineProperty(navigator, 'share', {
      configurable: true,
      value: async (data: ShareData) => {
        (window as any).shared = data;
      },
    });
  });
  await page.getByRole('button', { name: 'SDÍLET SYSTÉMOVĚ', exact: true }).click();
  expect((await page.evaluate(() => (window as any).shared)).text).toContain('\t');
  await page.evaluate(() => {
    Object.defineProperty(navigator, 'canShare', { configurable: true, value: () => true });
  });
  await page.getByRole('button', { name: 'SDÍLET SYSTÉMOVĚ', exact: true }).click();
  expect(await page.evaluate(() => (window as any).shared.files[0].name)).toBe('mereni.tsv');
  await page.getByRole('button', { name: 'E-mail se neotevřel?', exact: false }).click();
  const body = await page.getByLabel('Text pro ruční zkopírování').inputValue();
  expect(body).toContain('\t');
  expect(body).toContain('000NN01');
  expect(body).not.toContain('Měření 1');
  const href = await page
    .getByRole('link', { name: 'Otevřít e-mailovou aplikaci' })
    .getAttribute('href');
  const url = new URL(href!);
  expect(url.searchParams.get('body')).toBe(body);
  expect([...url.searchParams.keys()]).toEqual(['subject', 'body']);
  await page.getByRole('button', { name: '← Zpět', exact: true }).click();
  // Observe the actual button's navigation URL before the browser delegates mailto to an OS handler.
  await page.evaluate(() => {
    (window as any).mailNavigation = '';
    const original = (window as any).navigation;
    original?.addEventListener('navigate', (event: any) => {
      if (event.destination.url.startsWith('mailto:')) {
        (window as any).mailNavigation = event.destination.url;
        event.preventDefault();
      }
    });
  });
  await page.getByRole('button', { name: 'ODESLAT E-MAILEM', exact: true }).click();
  const actual = await page.evaluate(() => (window as any).mailNavigation);
  expect(new URL(actual).searchParams.get('body')).toBe(body);
});

test('NN 500 V ARON: bez IL2, závada IL3 7–9, volitelné napětí a snapshot', async ({
  page,
  context,
}) => {
  await page.goto('/');
  await expect(page.getByText('Offline připraveno', { exact: true })).toBeVisible();
  await identify(page, '500', '000ARON');
  await current(page, '500', true);
  await expect(page.getByLabel('Klešťový ampérmetr L2 (mV / V)', { exact: true })).toHaveCount(0);
  await expect(page.getByText('ARON – IL2 se nepoužívá', { exact: true })).toBeVisible();
  await page.getByRole('checkbox', { name: 'PŘIDAT MĚŘENÍ NAPĚTÍ', exact: true }).check();
  for (const pair of ['UL1-L2', 'UL1-L3', 'UL2-L3'])
    await page.getByLabel(`Primární ${pair}`, { exact: true }).fill('500');
  await page.getByLabel('Sekundární UL1-L3', { exact: true }).fill('');
  await page.getByRole('button', { name: 'VYHODNOTIT PROUDY', exact: true }).click();
  await expect(page.getByText(/Prověř IL3 – proudový obvod elektroměru 7–9/)).toBeVisible();
  expect(await page.locator('main').innerText()).not.toContain('4–6');
  await expect(page.getByText(/ponechané zkratování/)).toBeVisible();
  await save(page);
  await page.getByRole('button', { name: '3f měření', exact: true }).click();
  await page.getByLabel('POLE / UMÍSTĚNÍ', { exact: true }).fill('new location');
  await history(page);
  await page.locator('.record-open').click();
  await page.getByRole('button', { name: 'Data / detail', exact: true }).click();
  expect(await page.locator('main').innerText()).toContain('pole 3L');
  expect(await page.locator('main').innerText()).not.toContain('new location');
  await context.setOffline(true);
  await page.reload();
  await history(page);
  await expect(page.locator('.history-item')).toHaveCount(1);
});

test('VN 6,3 a 10,3 kV dědí režim, SCADA a vlastní MTP /1 A', async ({ page }) => {
  await page.goto('/');
  for (const voltage of ['6300', '10300']) {
    await identify(page, voltage, `00VN${voltage}`);
    await expect(page.getByLabel('ROZVODNA', { exact: true })).toBeVisible();
    expect(
      await page
        .getByLabel('Režim sítě / napětí', { exact: true })
        .locator('option')
        .allTextContents(),
    ).toEqual(['NN 400 V', 'NN 500 V – ARON', 'VN 6 kV', 'VN 6,3 kV', 'VN 10 kV', 'VN 10,3 kV']);
    await current(page, voltage);
    await expect(page.getByText('MTP 408/1 A', { exact: true })).toBeVisible();
    await page.getByRole('checkbox', { name: 'PŘIDAT MĚŘENÍ NAPĚTÍ', exact: true }).check();
    for (const pair of ['UL1-L2', 'UL1-L3', 'UL2-L3'])
      await page.getByLabel(`Sekundární ${pair}`, { exact: true }).fill('100');
    await save(page);
  }
  await history(page);
  await expect(page.locator('.history-item')).toHaveCount(2);
});

test('změna rozsahu vyčistí odečty a upozorní na očekávaný sekundár', async ({ page }) => {
  await page.goto('/');
  await identify(page);
  await current(page);
  await page.getByLabel('Rozsah Kyoritsu 8112', { exact: true }).selectOption('200 mA');
  await expect(
    page.getByText('Rozsah změněn – znovu odečtěte a zadejte hodnoty.', { exact: true }),
  ).toBeVisible();
  for (const i of [1, 2, 3])
    await expect(page.getByLabel(`Klešťový ampérmetr L${i} (mV / V)`, { exact: true })).toHaveValue(
      '',
    );
  await expect(page.getByText(/Pro IL1 je očekáváno přibližně 500 mA/)).toBeVisible();
  await page.getByRole('button', { name: 'VYHODNOTIT PROUDY', exact: true }).click();
  await expect(page.getByRole('alert')).toBeVisible();
});

test('hlavní navigace i přepínání karet zachovají rozepsané hodnoty', async ({ page }) => {
  await page.goto('/');
  await identify(page);
  await current(page);
  await page.getByRole('button', { name: 'VÝPOČET SPOTŘEBY A SAZEB', exact: true }).click();
  await expect(page.getByText('Připravuje se', { exact: true })).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'VYHODNOTIT PROUDY', exact: true }),
  ).not.toBeVisible();
  await page
    .getByRole('button', { name: 'MĚŘENÍ + ODEČET ELEKTROMĚRU / ENERGIS', exact: true })
    .click();
  await expect(page.getByLabel('Klešťový ampérmetr L1 (mV / V)', { exact: true })).toHaveValue(
    '50',
  );
  await page.getByRole('button', { name: '3f měření', exact: true }).click();
  await expect(page.getByLabel('VÝROBNÍ ČÍSLO ELEKTROMĚRU', { exact: true })).toHaveValue(
    '000NN01',
  );
  await page.getByRole('button', { name: '1f měření', exact: true }).click();
  await expect(page.getByLabel('Klešťový ampérmetr L1 (mV / V)', { exact: true })).toHaveValue(
    '50',
  );
});

test('persistentní context D1 → další den D2 zachová oba záznamy', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'mereni-history-'));
  let ctx = await chromium.launchPersistentContext(dir, {
    executablePath: '/usr/bin/chromium',
    args: ['--no-sandbox'],
    baseURL: 'http://127.0.0.1:4173',
  });
  try {
    let page = ctx.pages()[0];
    await page.clock.setFixedTime(new Date('2026-10-19T12:00:00Z'));
    await page.goto('/');
    await identify(page, '400', '000D1');
    await current(page);
    await save(page);
    await ctx.close();
    ctx = await chromium.launchPersistentContext(dir, {
      executablePath: '/usr/bin/chromium',
      args: ['--no-sandbox'],
      baseURL: 'http://127.0.0.1:4173',
    });
    page = ctx.pages()[0];
    await page.clock.setFixedTime(new Date('2026-10-20T12:00:00Z'));
    await page.goto('/');
    await history(page);
    await expect(page.locator('.history-item')).toHaveCount(1);
    await page.getByRole('button', { name: 'Nové měření', exact: true }).click();
    await identify(page, '400', '000D2');
    await page.getByLabel('DATUM', { exact: true }).fill('2026-10-20');
    await current(page);
    await save(page);
    await history(page);
    await expect(page.locator('.history-item')).toHaveCount(2);
    await expect(page.locator('.record-open').first()).toHaveAttribute('data-serial', '000D2');
  } finally {
    await ctx.close();
    await rm(dir, { recursive: true, force: true });
  }
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
  await expect(page.locator('.history-list .main-percent')).toHaveCount(0);
  await context.setOffline(true);
  await page.reload();
  await page.getByRole('button', { name: 'Výsledky měření', exact: false }).last().click();
  await expect(page.locator('.history-item')).toHaveCount(1);
  await page.locator('.record-open').click();
  await page.getByRole('button', { name: 'Data / detail' }).click();
  await expect(page.getByText('0,7 kW', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Nové měření', exact: true }).click();
  await identify(page, '400', '000NEW');
  await current(page);
  await save(page);
  await history(page);
  await expect(page.locator('.history-item')).toHaveCount(2);
  await page.reload();
  await history(page);
  await expect(page.locator('.history-item')).toHaveCount(2);
});
