import { test, expect, type Page } from '@playwright/test';
const verified = 'Vazba ověřena podle referenčních dat.';
const unverified = 'Vazba UZEL ↔ TS/R ↔ pole ↔ MTP není ověřena. Zkontrolujte zadané hodnoty.';
type Mode = 'main' | 'single' | 'series';
async function open(page: Page, mode: Mode) {
  await page.goto('/');
  if (mode !== 'main')
    await page
      .getByRole('button', {
        name: mode === 'single' ? 'Jednotlivý odečet' : 'Série odečtů',
        exact: true,
      })
      .click();
  const s =
    mode === 'main'
      ? page.locator('body')
      : page.getByRole('region', { name: 'Odečtové série', exact: true }).first();
  return {
    s,
    node: s.getByLabel(mode === 'main' ? 'UZEL' : 'UZEL (nepovinný)', { exact: true }),
    location: s.getByLabel(mode === 'main' ? 'TRAFOSTANICE' : 'TS / rozvodna', { exact: true }),
    placement: s.getByLabel(mode === 'main' ? 'POLE / UMÍSTĚNÍ' : 'Pole / kobka / umístění', {
      exact: true,
    }),
    primary: s.getByLabel('MTP primár', { exact: true }),
    meter: s.getByLabel('MTP elektroměr', { exact: true }),
    status: s.locator('.reference-binding'),
  };
}
for (const mode of ['main', 'single', 'series'] as const) {
  test(`${mode}: known UZEL verifies all fields, meter CT stays independent and an invalid placement clears the bound identity`, async ({
    page,
  }) => {
    const f = await open(page, mode);
    await expect(f.status).toHaveCount(0);
    await f.meter.selectOption('100');
    await f.node.fill('21201066');
    await expect(f.location).toHaveValue('TS 4601/251');
    await expect(f.placement).toHaveValue('25');
    await expect(f.primary).toHaveValue('300');
    await expect(f.meter).toHaveValue('100');
    await expect(f.status).toHaveText(verified);
    await expect(f.s.getByLabel('Korekční koeficient', { exact: true })).toHaveText('× 3,000');
    await f.placement.fill('unlisted field');
    await expect(f.node).toHaveValue('');
    await expect(f.primary).toHaveValue('');
    await expect(f.placement).toHaveValue('unlisted field');
    await expect(f.meter).toHaveValue('100');
    await expect(f.status).toHaveText(unverified);
    await expect(f.status).toHaveCSS('color', 'rgb(179, 38, 30)');
  });
  test(`${mode}: changing TS clears obsolete automatic identifiers and primary CT only`, async ({
    page,
  }) => {
    const f = await open(page, mode);
    await f.node.fill('21111020');
    await f.location.selectOption('TS 6910');
    await expect(f.node).toHaveValue('');
    await expect(f.placement).toHaveValue('');
    await expect(f.primary).toHaveValue('');
    await expect(f.location).toHaveValue('TS 6910');
    await expect(f.status).toHaveText(unverified);
  });
  test(`${mode}: unknown UZEL clears old automatic fields, without inventing replacements`, async ({
    page,
  }) => {
    const f = await open(page, mode);
    await f.node.fill('21111020');
    await expect(f.status).toHaveText(verified);
    await f.node.fill('000123456789012345');
    await expect(f.node).toHaveValue('000123456789012345');
    await expect(f.location).toHaveValue('');
    await expect(f.placement).toHaveValue('');
    await expect(f.primary).toHaveValue('');
    await expect(f.status).toHaveText(unverified);
  });
  test(`${mode}: reverse lookup and subsequent manual CT overrides never retain a stale verified state`, async ({
    page,
  }) => {
    const f = await open(page, mode);
    await f.location.selectOption('TS 3308/250');
    await f.placement.fill('3');
    await expect(f.node).toHaveValue('21111020');
    await expect(f.primary).toHaveValue('400');
    await expect(f.status).toHaveText(verified);
    await f.primary.selectOption('200');
    await expect(f.status).toHaveText(unverified);
    await f.node.fill('99999999');
    await expect(f.location).toHaveValue('TS 3308/250');
    await expect(f.placement).toHaveValue('3');
    await expect(f.primary).toHaveValue('200');
    await expect(f.status).toHaveText(unverified);
  });
  test(`${mode}: manual values without a reference and without UZEL remain usable`, async ({
    page,
  }) => {
    const f = await open(page, mode);
    await f.location.selectOption('TS 6910');
    await f.placement.fill('ručně zadané pole');
    await f.primary.selectOption('150');
    await f.node.fill('99999999');
    await f.node.fill('');
    await expect(f.location).toHaveValue('TS 6910');
    await expect(f.placement).toHaveValue('ručně zadané pole');
    await expect(f.primary).toHaveValue('150');
    await expect(f.status).toHaveText(unverified);
    if (mode === 'main') {
      await page.getByLabel('VÝROBNÍ ČÍSLO ELEKTROMĚRU', { exact: true }).fill('145001');
      await page.getByRole('button', { name: 'MĚŘENÍ KYORITSU', exact: true }).click();
      await expect(page.getByLabel('U1', { exact: true })).toBeVisible();
    } else {
      await f.s.getByLabel('Číslo elektroměru', { exact: true }).fill('145002');
      for (const label of ['Datum kola', 'Datum odečtu'])
        await f.s.getByLabel(label, { exact: true }).fill('2026-10-26');
      for (const label of ['Čas kola', 'Čas odečtu (HH:MM)'])
        await f.s.getByLabel(label, { exact: true }).fill('10:00');
      await f.s.getByLabel('Stav elektroměru [kWh]', { exact: true }).fill('1000');
      await f.s.getByRole('button', { name: 'ULOŽIT DÍLČÍ ODEČET', exact: true }).click();
      await expect(
        f.s.getByRole('status').filter({ hasText: 'Dílčí odečet uložen' }),
      ).toBeVisible();
    }
  });
  test(`${mode}: conflicting and incomplete source data cannot be shown as a verified binding`, async ({
    page,
  }) => {
    const f = await open(page, mode);
    await f.node.fill('21111020');
    await f.node.fill('21201042');
    await expect(f.location).toHaveValue('');
    await expect(f.placement).toHaveValue('');
    await expect(f.primary).toHaveValue('');
    await expect(f.status).toHaveText(unverified);
    await f.node.fill('10105018');
    await expect(f.location).toHaveValue('TS 2535/254');
    await expect(f.placement).toHaveValue('RM3.37L');
    await expect(f.primary).toHaveValue('');
    await expect(f.status).toHaveText(unverified);
  });
}
test('main: provenance survives draft reload and clearing never restores a hidden default MTP', async ({
  page,
}) => {
  let f = await open(page, 'main');
  await f.node.fill('21111020');
  await page.reload();
  f = {
    ...f,
    s: page.locator('body'),
  };
  await expect(f.status).toHaveText(verified);
  await f.placement.fill('unknown');
  await expect(f.node).toHaveValue('');
  await expect(f.primary).toHaveValue('');
  await page.reload();
  await expect(f.primary).toHaveValue('');
  await expect(f.placement).toHaveValue('unknown');
  await expect(f.status).toHaveText(unverified);
  await f.primary.selectOption('300');
  await expect(f.primary).toHaveValue('300');
});
test('series: changing the next outlet leaves the saved outlet exactly unchanged', async ({
  page,
}) => {
  const f = await open(page, 'series');
  await f.node.fill('21201066');
  await f.meter.selectOption('100');
  await f.s.getByLabel('Číslo elektroměru', { exact: true }).fill('145111');
  for (const label of ['Datum kola', 'Datum odečtu'])
    await f.s.getByLabel(label, { exact: true }).fill('2026-10-26');
  for (const label of ['Čas kola', 'Čas odečtu (HH:MM)'])
    await f.s.getByLabel(label, { exact: true }).fill('10:00');
  await f.s.getByLabel('Stav elektroměru [kWh]', { exact: true }).fill('1000');
  await f.s.getByRole('button', { name: 'ULOŽIT DÍLČÍ ODEČET', exact: true }).click();
  const saved = () =>
    page.evaluate(
      () =>
        new Promise<unknown[]>((resolve, reject) => {
          const request = indexedDB.open('mereni-vyvodu-v1');
          request.onerror = () => reject(request.error);
          request.onsuccess = () => {
            const db = request.result;
            const read = db.transaction('meters', 'readonly').objectStore('meters').getAll();
            read.onerror = () => reject(read.error);
            read.onsuccess = () => {
              resolve(read.result);
              db.close();
            };
          };
        }),
    );
  const before = await saved();
  expect(before).toHaveLength(1);
  expect(before[0]).toMatchObject({
    node: '21201066',
    location: 'TS 4601/251',
    placement: '25',
    actualMtp: 300,
    meterMtp: 100,
  });
  await f.node.fill('21111020');
  await f.placement.fill('unknown second outlet');
  await expect(f.node).toHaveValue('');
  await expect(f.primary).toHaveValue('');
  expect(await saved()).toEqual(before);
});
