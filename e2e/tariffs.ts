import { expect, type Page } from '@playwright/test';
export const rates = (p: Page) =>
  p.getByRole('main', { name: 'Výpočet spotřeby a sazeb', exact: true });
export const back = (p: Page) => rates(p).getByRole('button', { name: '← Zpět', exact: true });
export async function openTariffs(p: Page, customer: 'C' | 'D', method: 'flat' | 'company') {
  await p.getByRole('button', { name: 'VÝPOČET SPOTŘEBY A SAZEB', exact: true }).click();
  await rates(p)
    .getByRole('button', {
      name: customer === 'C' ? 'C – PODNIKATEL / FIRMA' : 'D – DOMÁCNOST',
      exact: true,
    })
    .click();
  await rates(p)
    .getByRole('button', {
      name: method === 'flat' ? 'PAUŠÁLNÍ PŘIPOJENÍ' : 'ODHAD / FIRMY',
      exact: true,
    })
    .click();
}
export async function fillFlat(p: Page, customer: 'C' | 'D' = 'C') {
  await openTariffs(p, customer, 'flat');
  const s = rates(p);
  await s.getByLabel('Distribuční oblast', { exact: true }).selectOption('ČEZ Distribuce');
  await s.getByLabel('Proudové zatížení [A]', { exact: true }).fill('40');
  await s.getByLabel('Soudobost', { exact: true }).fill('0,65');
  await s.getByLabel('Spotřeba za období [kWh]', { exact: true }).fill('1000');
}
export async function fillCompany(p: Page) {
  await openTariffs(p, 'C', 'company');
  const s = rates(p);
  await s.getByLabel('Původní hlavní jistič', { exact: true }).selectOption('3×40 A');
  await s.getByLabel('Původní sazba', { exact: true }).selectOption('C02d');
  await s.getByLabel('Datum prvního odečtu', { exact: true }).fill('2026-01-01');
  await s.getByLabel('Čas prvního odečtu', { exact: true }).fill('10:00');
  await s
    .getByRole('region', { name: 'První odečet', exact: true })
    .getByLabel('Stav elektroměru [kWh]', { exact: true })
    .fill('1000');
  await s.getByLabel('Datum druhého odečtu', { exact: true }).fill('2026-01-11');
  await s.getByLabel('Čas druhého odečtu', { exact: true }).fill('10:00');
  await s
    .getByRole('region', { name: 'Druhý odečet', exact: true })
    .getByLabel('Stav elektroměru [kWh]', { exact: true })
    .fill('2250');
}
export async function companyResult(p: Page) {
  const s = rates(p);
  await s.getByRole('button', { name: 'POKRAČOVAT K OBLASTI', exact: true }).click();
  await s.getByLabel('Distribuční oblast', { exact: true }).selectOption('EG.D');
  await s.getByRole('button', { name: 'VYHODNOTIT', exact: true }).click();
}
export async function tariffLayout(p: Page) {
  expect(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  for (const field of await rates(p).locator('input, select, .button').all()) {
    const box = await field.boundingBox();
    if (box) {
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(p.viewportSize()!.width);
    }
  }
}
