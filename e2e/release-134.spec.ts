import { test, expect, type Page } from '@playwright/test';
const scope = (p: Page) => p.getByRole('region', { name: 'Odečtové série' }).first();
const card = (p: Page, serial: string) =>
  scope(p)
    .locator('.series-meter')
    .filter({ has: p.getByRole('heading', { name: `EM ${serial}`, exact: true }) });
const saved = (p: Page, serial: string) =>
  scope(p)
    .locator('.series-meter')
    .filter({ has: p.getByRole('button', { name: `Historie EM ${serial}`, exact: true }) });
async function create(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Série odečtů', exact: true }).click();
  const s = scope(page);
  await expect(s.getByLabel('Čas kola', { exact: true })).toHaveValue('');
  await s.getByLabel('Datum kola', { exact: true }).fill('2026-10-24');
  await s.getByLabel('Čas kola', { exact: true }).fill('11:00');
  for (const [serial, time, value] of [
    ['21', '11:07', '100'],
    ['54', '11:19', '200'],
  ]) {
    await s.getByLabel('TS / rozvodna', { exact: true }).selectOption('TS 4601/251');
    await s.getByLabel('Pole / kobka / umístění', { exact: true }).fill(`pole ${serial}`);
    await s.getByLabel('Číslo elektroměru', { exact: true }).fill(serial);
    await s.getByLabel('Datum odečtu', { exact: true }).fill('2026-10-24');
    await s.getByLabel('Čas odečtu (HH:MM)', { exact: true }).fill(time);
    await s.getByLabel('Stav elektroměru [kWh]', { exact: true }).fill(value);
    await s.getByRole('button', { name: 'ULOŽIT DÍLČÍ ODEČET', exact: true }).click();
    await expect(s.locator('p[role=status]')).toContainText('uložen');
  }
  await page.getByRole('button', { name: /Výsledky měření/ }).click();
  await expect(page.locator('.record-open')).toHaveCount(1);
  await page.locator('.record-open').click();
}
async function begin(page: Page, date: string, time: string) {
  const s = scope(page);
  await s.getByRole('button', { name: 'POKRAČOVAT DALŠÍM ODEČTEM', exact: true }).click();
  await expect(s.getByLabel('Čas kola', { exact: true })).toHaveValue('');
  await s.getByLabel('Datum nového odečtu', { exact: true }).fill(date);
  await s.getByLabel('Čas kola', { exact: true }).fill(time);
}
async function fill(page: Page, serial: string, time: string, value: string) {
  const c = card(page, serial);
  await c.getByLabel('Nový čas', { exact: true }).fill(time);
  await c.getByLabel('Nový stav [kWh]', { exact: true }).fill(value);
}
async function save(page: Page, count: number) {
  const s = scope(page);
  await s.getByRole('button', { name: 'ULOŽIT VYPLNĚNÉ ODEČTY', exact: true }).click();
  await expect(s.locator('p[role=status]').first()).toContainText(`Uloženo ${count}`);
}
test('two visits on same day remain separate after reload and show actual states, times and Energis', async ({
  page,
}) => {
  await create(page);
  const s = scope(page);
  await begin(page, '2026-10-24', '15:30');
  await fill(page, '21', '15:36', '110');
  await fill(page, '54', '15:44', '220');
  await card(page, '54').getByLabel('SUMA ENERGIS [kWh]', { exact: true }).fill('20');
  await card(page, '54').getByRole('button', { name: '+E', exact: true }).click();
  await save(page, 2);
  await page.reload();
  await page.getByRole('button', { name: /Výsledky měření/ }).click();
  await expect(page.locator('.record-open')).toHaveCount(1);
  await page.locator('.record-open').click();
  const nav = s.getByRole('navigation', { name: 'Odečtová kola' });
  await expect(nav.getByRole('button', { name: '24.10.2026 11:00', exact: true })).toBeVisible();
  await expect(nav.getByRole('button', { name: '24.10.2026 15:30', exact: true })).toBeVisible();
  await nav.getByRole('button', { name: '24.10.2026 11:00', exact: true }).click();
  await expect(saved(page, '21')).toContainText('11:07 · 100 kWh');
  await expect(saved(page, '54')).toContainText('11:19 · 200 kWh');
  await nav.getByRole('button', { name: '24.10.2026 15:30', exact: true }).click();
  await expect(saved(page, '21')).toContainText('15:36 · 110 kWh');
  await expect(saved(page, '54')).toContainText('15:44 · 220 kWh');
  await expect(saved(page, '54')).toContainText('SUMA ENERGIS: 20 kWh');
  await expect(saved(page, '54').getByRole('button', { name: '+E', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect(saved(page, '54')).toContainText('Rozdíl elektroměru: 20 kWh');
});
test('skipped B creates no reading; C continues from A and visit TEĎ preserves individual times', async ({
  page,
}) => {
  await create(page);
  const s = scope(page);
  await begin(page, '2026-10-24', '15:30');
  await fill(page, '21', '15:36', '110');
  await card(page, '54').getByRole('checkbox', { name: 'ODEČÍST', exact: true }).uncheck();
  await save(page, 1);
  await expect(saved(page, '54')).toContainText('Přeskočeno');
  await expect(saved(page, '54')).toContainText('11:19 · 200 kWh');
  await begin(page, '2026-10-31', '08:00');
  await expect(card(page, '54').getByLabel('Předchozí čas', { exact: true })).toHaveValue('11:19');
  await expect(card(page, '54').getByLabel('Předchozí stav [kWh]', { exact: true })).toHaveValue(
    '200',
  );
  await fill(page, '21', '08:07', '120');
  await fill(page, '54', '08:19', '230');
  await s
    .getByLabel('Čas kola', { exact: true })
    .locator('..')
    .getByRole('button', { name: 'TEĎ', exact: true })
    .click();
  await expect(s.getByLabel('Čas kola', { exact: true })).toHaveValue(/\d{2}:\d{2}/);
  await expect(card(page, '54').getByLabel('Nový čas', { exact: true })).toHaveValue('08:19');
  await s.getByLabel('Čas kola', { exact: true }).fill('08:00');
  await save(page, 2);
  await saved(page, '54').getByRole('button', { name: 'Historie EM 54', exact: true }).click();
  await expect(
    s.getByRole('heading', { name: '2026-10-24 11:19 – 200 kWh', exact: true }),
  ).toBeVisible();
  await expect(
    s.getByRole('heading', { name: '2026-10-31 08:19 – 230 kWh', exact: true }),
  ).toBeVisible();
  await expect(s.getByRole('heading', { level: 3 })).toHaveCount(2);
});

test('real IndexedDB v3 migration retains all legacy same-day readings and can continue a new explicit visit', async ({
  page,
}) => {
  await page.goto('/manifest.webmanifest');
  await page.evaluate(async () => {
    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.open('mereni-vyvodu-v1', 3);
      request.onupgradeneeded = () => {
        const db = request.result;
        db.createObjectStore('measurements', { keyPath: 'id' }).createIndex('by-time', 'savedAt');
        db.createObjectStore('series', { keyPath: 'id' }).createIndex('by-location-date', [
          'location',
          'date',
        ]);
        const meters = db.createObjectStore('meters', { keyPath: 'id' });
        meters.createIndex('by-batch', 'batchId');
        meters.createIndex('by-serial', 'serial');
        meters.createIndex('by-node', 'node');
        db.createObjectStore('readings', { keyPath: 'id' }).createIndex('by-meter', 'meterId');
      };
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const db = request.result;
        const tx = db.transaction(['series', 'meters', 'readings'], 'readwrite');
        tx.objectStore('series').add({
          id: 'legacy-series',
          location: 'TS 4601/251',
          date: '2026-10-24',
        });
        tx.objectStore('meters').add({
          id: 'legacy-meter',
          batchId: 'legacy-series',
          location: 'TS 4601/251',
          placement: 'pole 54',
          serial: '54',
          node: '',
          active: true,
          actualMtp: 1,
          meterMtp: 1,
        });
        tx.objectStore('readings').add({
          id: 'legacy-a',
          meterId: 'legacy-meter',
          date: '2026-10-24',
          time: '11:19',
          value: 100,
          active: true,
        });
        tx.objectStore('readings').add({
          id: 'legacy-b',
          meterId: 'legacy-meter',
          previousId: 'legacy-a',
          date: '2026-10-24',
          time: '15:44',
          value: 110,
          active: true,
        });
        tx.oncomplete = () => {
          db.close();
          resolve();
        };
        tx.onerror = () => reject(tx.error);
      };
    });
  });
  await page.goto('/');
  await page.getByRole('button', { name: /Výsledky měření/ }).click();
  await expect(page.locator('.record-open')).toHaveCount(1);
  await page.locator('.record-open').click();
  const s = scope(page);
  await s.getByRole('button', { name: '24.10.2026 11:19', exact: true }).click();
  await expect(saved(page, '54')).toContainText('11:19 · 100 kWh');
  await expect(saved(page, '54')).toContainText('15:44 · 110 kWh');
  await expect(s.getByText(/Starší data:/)).toBeVisible();
  await begin(page, '2026-10-31', '08:00');
  await expect(card(page, '54').getByLabel('Předchozí čas', { exact: true })).toHaveValue('15:44');
  await fill(page, '54', '08:19', '120');
  await save(page, 1);
  await expect(s.getByRole('button', { name: '31.10.2026 08:00', exact: true })).toBeVisible();
});
