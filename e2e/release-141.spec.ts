import { test, expect, type Page } from '@playwright/test';
const codes = {
  C: [
    'C01d',
    'C02d',
    'C03d',
    'C25d',
    'C26d',
    'C27d',
    'C35d',
    'C45d',
    'C46d',
    'C56d',
    'C60d',
    'C62d',
  ],
  D: ['D01d', 'D02d', 'D25d', 'D26d', 'D27d', 'D35d', 'D45d', 'D56d', 'D57d', 'D61d'],
};
const module = (page: Page) =>
  page.getByRole('main', { name: 'Výpočet spotřeby a sazeb', exact: true });
for (const customer of ['C', 'D'] as const) {
  test(`${customer}: complete catalog, tariff details, summary and independent supplier placeholders`, async ({
    page,
    context,
  }) => {
    await page.goto('/');
    await expect(page.getByText('Offline připraveno', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'VÝPOČET SPOTŘEBY A SAZEB', exact: true }).click();
    const s = module(page);
    await s
      .getByRole('button', {
        name: customer === 'C' ? 'C – PODNIKATEL / FIRMA' : 'D – DOMÁCNOST',
        exact: true,
      })
      .click();
    await s.getByRole('button', { name: 'KONTROLA PODLE SKUTEČNÉ SPOTŘEBY', exact: true }).click();
    const select = s.getByLabel('Současná sazba', { exact: true });
    await expect(select.locator('option')).toHaveText([
      `Vyberte sazbu ${customer}`,
      ...codes[customer],
    ]);
    expect(
      await select
        .locator('option')
        .evaluateAll((options) =>
          options.map((o) => (o as HTMLOptionElement).value).filter(Boolean),
        ),
    ).toEqual(codes[customer]);
    const examples = customer === 'C' ? ['C02d', 'C25d'] : ['D02d', 'D57d'];
    for (const code of examples) {
      await select.selectOption(code);
      const info = s.getByRole('button', { name: `Informace: sazba ${code}`, exact: true });
      await expect(s.getByRole('note')).toHaveCount(0);
      await info.click();
      const note = s.getByRole('note');
      await expect(note).toContainText(`Kód sazby: ${code}`);
      await expect(note).toContainText(`Kategorie: ${customer}`);
      await expect(note).toContainText('VT: ano');
      await expect(note).toContainText(code.endsWith('02d') ? 'Jednotarifní' : 'Dvoutarifní');
      await expect(note).toContainText(code.endsWith('02d') ? 'NT: ne' : 'NT: ano');
      await expect(note).not.toContainText(/Kč|doporučen/i);
      if (customer === 'D') await expect(page.getByText(/ORLEN/i)).toHaveCount(0);
    }
    await s
      .getByLabel('Distribuční oblast', { exact: true })
      .selectOption(customer === 'C' ? 'PREdistribuce' : 'EG.D');
    await s.getByLabel('Současný hlavní jistič', { exact: true }).selectOption('3×32 A');
    await s.getByLabel('Spotřeba za období [kWh]', { exact: true }).fill('987,65');
    await s.getByLabel('Délka období', { exact: true }).selectOption('6');
    await s.getByRole('button', { name: 'POKRAČOVAT K POROVNÁNÍ', exact: true }).click();
    const summary = s.getByRole('region', { name: 'Shrnutí vstupů', exact: true });
    await expect(summary).toContainText(examples[1]);
    await expect(summary).toContainText('987,65 kWh');
    await expect(summary).toContainText(
      'Výpočet cen a doporučení sazby bude doplněn v další etapě.',
    );
    const cards = s.locator('.tariff-supplier');
    await expect(cards).toHaveCount(customer === 'C' ? 5 : 4);
    const expectedIds =
      customer === 'C' ? ['orlen', 'cez', 'eon', 'pre', 'innogy'] : ['cez', 'eon', 'pre', 'innogy'];
    expect(
      await cards.evaluateAll((nodes) => nodes.map((n) => n.getAttribute('data-supplier-id'))),
    ).toEqual(expectedIds);
    if (customer === 'C') {
      await expect(cards.first()).toContainText('ORLEN UNIPETROL');
      await expect(cards.first()).toContainText('Pracovní reference pro firmy');
    } else await expect(page.getByText(/ORLEN/i)).toHaveCount(0);
    for (const card of await cards.all()) {
      await expect(card).toHaveAttribute('data-update-state', 'idle');
      await expect(card).toHaveAttribute('data-source-status', 'not-loaded');
      await expect(
        card
          .locator('dl > div')
          .filter({ has: page.locator('dt', { hasText: 'Ceník platný od:' }) }),
      ).toContainText('zatím nenahrán');
      await expect(
        card
          .locator('dl > div')
          .filter({ has: page.locator('dt', { hasText: 'Naposledy ověřeno:' }) }),
      ).toContainText('zatím neověřeno');
    }
    await page.screenshot({
      path: `/workspace/work/tariffs141-${customer}-${test.info().project.name}.png`,
      fullPage: true,
    });
    await context.setOffline(true);
    const requests: string[] = [];
    page.on('request', (r) => requests.push(r.url()));
    const eon = s.locator('[data-supplier-id=eon]');
    await eon.getByRole('button', { name: 'AKTUALIZOVAT CENÍK', exact: true }).click();
    await expect(eon.getByRole('status')).toHaveText(
      'Aktualizace ceníku bude doplněna v další etapě.',
    );
    for (const id of expectedIds.filter((id) => id !== 'eon'))
      await expect(s.locator(`[data-supplier-id=${id}]`).getByRole('status')).toHaveCount(0);
    for (const card of await cards.all()) {
      await expect(card).toHaveAttribute('data-update-state', 'idle');
      await expect(card).toHaveAttribute('data-source-status', 'not-loaded');
    }
    // Every card owns its own message; no global loading, dates or error is fabricated.
    for (const card of await cards.all())
      await card.getByRole('button', { name: 'AKTUALIZOVAT CENÍK', exact: true }).click();
    await expect(cards.getByRole('status')).toHaveCount(expectedIds.length);
    expect(requests).toEqual([]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await s.getByRole('button', { name: '← Zpět', exact: true }).click();
    await expect(select).toHaveValue(examples[1]);
  });
}
