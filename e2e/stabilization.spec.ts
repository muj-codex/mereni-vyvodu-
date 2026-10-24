import { test, expect, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { resolve, extname } from 'node:path';
async function base(page: Page, serial = '000125') {
  await page.getByLabel('VÝROBNÍ ČÍSLO ELEKTROMĚRU', { exact: true }).fill(serial);
  await page.getByLabel('DATUM', { exact: true }).fill('2026-10-22');
  await page.getByLabel('POLE / UMÍSTĚNÍ', { exact: true }).fill('pole 25');
  await page.getByLabel('MTP primár', { exact: true }).selectOption('300');
  await page.getByLabel('MTP elektroměr', { exact: true }).selectOption('600');
  await page.getByRole('checkbox', { name: 'Porovnat stavy s Energis' }).check();
  for (const [label, value] of [
    ['Datum OD', '2026-10-22'],
    ['Čas OD', '14:45'],
    ['Datum DO', '2026-10-22'],
    ['Čas DO', '16:45'],
    ['Stav elektroměru OD', '100'],
    ['Stav elektroměru DO', '300'],
    ['Spotřeba Energis za interval', '98.5'],
  ])
    await page.getByLabel(label, { exact: true }).fill(value);
}
async function power(page: Page) {
  await page.getByLabel('Typ zadaného napětí U1–U3').selectOption('phase-neutral');
  for (const i of [1, 2, 3]) {
    await page.getByLabel(`U${i}`, { exact: true }).fill('230');
    await page.getByLabel(`IL${i}`, { exact: true }).fill('10');
  }
  await page.getByRole('button', { name: 'POKRAČOVAT NA PF A VÝKONY' }).click();
  for (const i of [1, 2, 3]) {
    await page.getByLabel(`PF${i}`, { exact: true }).fill('1');
    await page.getByLabel(`P${i}`, { exact: true }).fill('2.3');
  }
  await page.getByLabel('Celkový výkon Kyoritsu', { exact: true }).fill('6.9');
  await page.getByLabel('Trend Energis', { exact: true }).fill('6.8');
  await page.getByRole('button', { name: 'VYHODNOTIT MĚŘENÍ', exact: true }).click();
}
async function history(page: Page) {
  await page.getByRole('button', { name: 'Výsledky měření' }).last().click();
}
async function snapshot(page: Page): Promise<any[]> {
  return page.evaluate(
    () =>
      new Promise((resolve, reject) => {
        const req = indexedDB.open('mereni-vyvodu-v1');
        req.onerror = () => reject(req.error);
        req.onsuccess = () => {
          const db = req.result,
            tx = db.transaction('measurements'),
            r = tx.objectStore('measurements').getAll();
          r.onsuccess = () => {
            resolve(r.result);
            db.close();
          };
          r.onerror = () => reject(r.error);
        };
      }),
  );
}
async function comparisons(page: Page) {
  const c = page.getByRole('region', { name: 'Porovnání', exact: true });
  await expect(c).toContainText('Elektroměr ↔ Energis: -1,5 %');
  await expect(c).toContainText('Kyoritsu ↔ Energis: -1,449 %');
  await expect(c).not.toContainText('Elektroměr ↔ Kyoritsu');
  await expect(c).not.toContainText('Porovnání není dostupné');
  await expect(c).toContainText('EM 100 kWh');
  await expect(c).toContainText('Energis 98,5 kWh');
}
test('kontrola → Kyoritsu → výsledek → historie → reload zachová společný snapshot', async ({
  page,
}) => {
  await page.goto('/');
  await base(page);
  await page
    .getByRole('button', { name: 'Použít kontrolu stavů a pokračovat', exact: true })
    .click();
  await expect(page.getByLabel('Přenesená kontrola stavů')).toContainText('22.10.2026 14:45');
  await expect(page.getByLabel('Přenesená kontrola stavů')).toContainText('16:45');
  await power(page);
  await comparisons(page);
  await page.getByRole('button', { name: 'ULOŽIT MĚŘENÍ', exact: true }).click();
  await history(page);
  await page.locator('.record-open').click();
  await comparisons(page);
  const before = await snapshot(page);
  expect(before[0].input.stateCheck.result.percent).toBe(-1.5);
  await page.reload();
  await history(page);
  await page.locator('.record-open').click();
  await comparisons(page);
  expect(await snapshot(page)).toEqual(before);
});
test('MĚŘENÍ KYORITSU nepřipojí vyplněnou kontrolu stavů', async ({ page }) => {
  await page.goto('/');
  await base(page);
  await page.getByRole('button', { name: 'MĚŘENÍ KYORITSU', exact: true }).click();
  await expect(page.getByLabel('Přenesená kontrola stavů')).toHaveCount(0);
  await power(page);
  await expect(page.locator('.comparisons')).toContainText('chybí kontrola stavů');
  await page.getByRole('button', { name: 'ULOŽIT MĚŘENÍ', exact: true }).click();
  expect((await snapshot(page))[0].input.stateCheck).toBeUndefined();
});
test('JSON záloha → čistá DB → kompletní historie → opakovaný import bez duplicit', async ({
  page,
  browser,
}) => {
  await page.goto('/');
  await base(page, '000CHECK');
  await page.getByRole('button', { name: 'ULOŽIT KONTROLU STAVŮ', exact: true }).click();
  await expect(page.getByLabel('Čas OD', { exact: true })).toHaveValue('');
  await base(page, '000LINKED');
  await page
    .getByRole('button', { name: 'Použít kontrolu stavů a pokračovat', exact: true })
    .click();
  await power(page);
  await page.getByRole('button', { name: 'ULOŽIT MĚŘENÍ', exact: true }).click();
  await page.getByRole('button', { name: '1f měření', exact: true }).click();
  for (const i of [1, 2, 3]) {
    await page.getByLabel(`Primár L${i}`, { exact: true }).fill('30');
    await page.getByLabel(`Klešťový ampérmetr L${i} (mV / V)`, { exact: true }).fill('50');
  }
  await page.getByRole('button', { name: 'VYHODNOTIT PROUDY', exact: true }).click();
  await page.getByRole('button', { name: 'ULOŽIT PROUDOVÉ MĚŘENÍ', exact: true }).click();
  await history(page);
  const before = await snapshot(page);
  expect(before).toHaveLength(3);
  // Download fallback is used when file sharing is unavailable.
  await page.evaluate(() =>
    Object.defineProperty(navigator, 'share', { configurable: true, value: undefined }),
  );
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'ZÁLOHOVAT DATA', exact: true }).click();
  const file = await download;
  expect(file.suggestedFilename()).toBe('mereni-zaloha.json');
  const bytes = await readFile((await file.path())!);
  expect(
    JSON.parse(bytes.toString()).records.sort((a: any, b: any) => a.id.localeCompare(b.id)),
  ).toEqual(before);
  const context = await browser.newContext({ ...test.info().project.use, serviceWorkers: 'allow' });
  try {
    const clean = await context.newPage();
    await clean.goto('http://127.0.0.1:4173/');
    await history(clean);
    const upload = () =>
      clean
        .getByLabel('IMPORTOVAT / OBNOVIT DATA', { exact: true })
        .setInputFiles({ name: 'backup.json', mimeType: 'application/json', buffer: bytes });
    await upload();
    await expect(clean.getByRole('dialog')).toContainText('Nové: 3');
    expect(await snapshot(clean)).toHaveLength(0);
    await clean.getByRole('button', { name: 'ZRUŠIT', exact: true }).click();
    expect(await snapshot(clean)).toHaveLength(0);
    await upload();
    await clean.getByRole('button', { name: 'IMPORTOVAT', exact: true }).click();
    await expect(clean.locator('.history-item')).toHaveCount(3);
    expect(await snapshot(clean)).toEqual(before);
    await upload();
    await expect(clean.getByRole('dialog')).toContainText('Nové: 0');
    await expect(clean.getByRole('dialog')).toContainText('Již existující: 3');
    await clean.getByRole('button', { name: 'IMPORTOVAT', exact: true }).click();
    await expect(clean.locator('.history-item')).toHaveCount(3);
    await clean.reload();
    await history(clean);
    expect(await snapshot(clean)).toEqual(before);
    await clean
      .locator('.record-open')
      .locator('xpath=self::*[@data-serial="000LINKED"]')
      .locator('xpath=self::*[@data-type="3f měření"]')
      .click();
    await comparisons(clean);
  } finally {
    await context.close();
  }
});
test('iOS souborová záloha používá systémové sdílení a neplatný import nic nezapíše', async ({
  page,
}) => {
  await page.goto('/');
  await base(page);
  await page.getByRole('button', { name: 'ULOŽIT KONTROLU STAVŮ', exact: true }).click();
  await history(page);
  const before = await snapshot(page);
  await page.evaluate(() => {
    Object.defineProperty(navigator, 'canShare', { configurable: true, value: () => true });
    Object.defineProperty(navigator, 'share', {
      configurable: true,
      value: async (data: ShareData) => {
        (window as any).backupShare = {
          name: data.files![0].name,
          text: await data.files![0].text(),
        };
      },
    });
  });
  await page.getByRole('button', { name: 'ZÁLOHOVAT DATA', exact: true }).click();
  await expect
    .poll(() => page.evaluate(() => (window as any).backupShare?.name))
    .toBe('mereni-zaloha.json');
  const shared = await page.evaluate(() => JSON.parse((window as any).backupShare.text));
  expect(shared.records).toEqual(before);
  for (const text of ['broken JSON', '{"backupVersion":99}']) {
    await page.getByLabel('IMPORTOVAT / OBNOVIT DATA', { exact: true }).setInputFiles({
      name: 'broken.json',
      mimeType: 'application/json',
      buffer: Buffer.from(text),
    });
    await expect(page.getByRole('alert')).toBeVisible();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    expect(await snapshot(page)).toEqual(before);
  }
});

test('skutečný update service worker/cache zachová stejnou instalaci a IndexedDB v1 historii', async ({
  page,
  context,
}) => {
  let current = false;
  const oldWorker = `self.addEventListener('install', e => e.waitUntil(caches.open('mereni-shell-previous').then(c => c.put('./old-marker',new Response('1.2.4'))).then(() => self.skipWaiting())));self.addEventListener('activate',e => e.waitUntil(self.clients.claim()));`;
  const server = createServer(async (req, res) => {
    const path = new URL(req.url!, 'http://localhost').pathname;
    res.setHeader('Cache-Control', 'no-store');
    if (!current && path === '/sw.js') {
      res.setHeader('Content-Type', 'application/javascript');
      res.end(oldWorker);
      return;
    }
    if (!current && path === '/') {
      res.setHeader('Content-Type', 'text/html');
      res.end('<html><body>1.2.4 installation</body></html>');
      return;
    }
    try {
      const file = resolve('dist', '.' + (path === '/' ? '/index.html' : path));
      if (!file.startsWith(resolve('dist') + '/')) throw Error('invalid path');
      const mime: Record<string, string> = {
        '.js': 'application/javascript',
        '.html': 'text/html',
        '.css': 'text/css',
        '.webmanifest': 'application/manifest+json',
        '.png': 'image/png',
      };
      res.setHeader('Content-Type', mime[extname(file)] ?? 'text/plain');
      res.end(await readFile(file));
    } catch {
      res.statusCode = 404;
      res.end();
    }
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw Error('server');
  try {
    await page.goto(`http://127.0.0.1:${address.port}/`);
    await page.evaluate(async () => {
      await navigator.serviceWorker.register('./sw.js');
      await navigator.serviceWorker.ready;
    });
    await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
    const old = {
      id: 'legacy-124',
      savedAt: '2026-10-22T14:45:00Z',
      localTimestamp: '22.10.2026 14:45:00',
      input: {
        serial: '000LEGACY',
        config: { actualMtp: 100, meterMtp: 100, voltage: 400, meterPulse: 0.1, energisPulse: 0.1 },
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
    };
    await page.evaluate(
      (record) =>
        new Promise<void>((resolve, reject) => {
          const req = indexedDB.open('mereni-vyvodu-v1', 1);
          req.onupgradeneeded = () => {
            const s = req.result.createObjectStore('measurements', { keyPath: 'id' });
            s.createIndex('by-time', 'savedAt');
          };
          req.onerror = () => reject(req.error);
          req.onsuccess = () => {
            const db = req.result,
              tx = db.transaction('measurements', 'readwrite');
            tx.objectStore('measurements').add(record);
            tx.oncomplete = () => {
              db.close();
              resolve();
            };
          };
        }),
      old,
    );
    expect(await page.evaluate(() => caches.keys())).toContain('mereni-shell-previous');
    current = true;
    await page.evaluate(async () => {
      const changed = new Promise<void>((resolve) =>
        navigator.serviceWorker.addEventListener('controllerchange', () => resolve(), {
          once: true,
        }),
      );
      const reg = await navigator.serviceWorker.getRegistration();
      await reg!.update();
      await changed;
    });
    await expect
      .poll(() => page.evaluate(() => caches.keys()))
      .not.toContain('mereni-shell-previous');
    const keys = await page.evaluate(() => caches.keys());
    expect(keys.some((k) => k.startsWith('mereni-shell-'))).toBe(true);
    await page.reload();
    await history(page);
    await expect(page.locator('.history-item')).toHaveCount(1);
    expect(await snapshot(page)).toEqual([old]);
    await page.locator('.record-open').click();
    const comparison = page.getByRole('region', { name: 'Porovnání', exact: true });
    await expect(comparison).toContainText('Elektroměr ↔ Energis');
    await expect(comparison).toContainText('Kyoritsu ↔ Energis');
    await expect(comparison).not.toContainText('Elektroměr ↔ Kyoritsu');
    await page.getByRole('button', { name: 'Zpět na výsledky měření' }).click();
    const manifest = await page.evaluate(async () =>
      (await fetch('./manifest.webmanifest')).json(),
    );
    expect(manifest).toMatchObject({ id: './', scope: './', start_url: './' });
    await context.setOffline(true);
    await page.reload();
    await history(page);
    await page.locator('.record-open').click();
    await expect(page.locator('main')).toContainText('000LEGACY');
    expect(await snapshot(page)).toEqual([old]);
  } finally {
    await context.setOffline(false);
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});
