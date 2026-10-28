# innogy elektřina Benefit 24 – 1.4.11

Výchozí main: 1.4.10, `635adc06edd2bbc6fb2686209bb3c3b1621abdb0`. Nová patch verze 1.4.11 přidává innogy pro firmy a domácnosti, bez změny cen a výpočtů stávajících dodavatelů nebo měřicí části.

## Zdroje a import

Oficiální uživatelské přílohy jsou uložené v `docs/sources/innogy-2026/`: `EE_CEN_BEN24_260401_MO_CEZ.pdf` a `EE_CEN_BEN24_260401_DOM_CEZ.pdf`. Oba ceníky platí od 1. 4. 2026 pouze pro ČEZ Distribuce. Fixace silové elektřiny trvá do konce 24. měsíce účinnosti smlouvy/dodatku. Regulace platí od 1. 1. 2026.

Dataset uchovává SHA-256, stranu, datum ověření, kategorii a konvenci DPH. Import podle pozic tištěných sloupců rozlišuje sloučené obchodní skupiny a jednotlivé distribuční sazby. `python scripts/import-innogy.py --check` porovnává dataset s PDF, obchodní skupiny i nezávislé souhrnné jednotkové řádky bez/s DPH. Jističové buňky, které se nepoužívají (např. domácí pevná pásma nad 63 A mimo D57d), zůstávají null a nahrazuje je výslovně publikovaná sazba za A. Nejde o odhad nečitelné buňky. Žádné nečitelné hodnoty nebyly importovány jako čísla.

## Rozsah

Firmy: C01d, C02d, C03d, C25d, C26d, C27d, C35d, C45d, C46d, C56d, C62d. VT 3240 Kč/MWh bez DPH, kromě C27d/C56d 3140; doložené NT stejné jako VT. C01d/C02d/C03d/C62d nemají NT. C55d není v ceníku a nedostává cenu innogy.

Domácnosti: D01d, D02d, D25d, D26d, D27d, D35d, D45d, D56d, D57d, D61d. VT 3240 Kč/MWh bez DPH, kromě D27d/D56d/D57d 3140. D01d/D02d nemají NT, ostatní mají NT stejné jako VT. Obě kategorie mají stálý obchodní plat 127 Kč/měsíc bez DPH.

Každá kategorie má vlastní distribuční i jističovou tabulku. Firmy mají pásma do 160 A, nad ně sazbu za A a samostatnou 1f sazbu. Domácnosti mimo D57d mají nad 63 A sazbu za A; D57d vlastní pásma do 160 A a sazbu nad nimi. Např. C02d 3×40 A = 577 Kč/měsíc; D02d = 409 Kč. D57d 3×80 A = 3093 Kč; nepřebírá se podnikatelská sazba.

Společné položky bez DPH: systémové služby 164,24 Kč/MWh, POZE A 0 Kč/A/měsíc, B 495 Kč/MWh, OTE 2,99 Kč/měsíc, datové centrum 5,88 Kč/měsíc, ERÚ 4 Kč/měsíc, daň 28,30 Kč/MWh. POZE se skutečně počítá jako min(12 × A × počet fází × sazba A, MWh × sazba B); obě varianty jsou zobrazeny. DPH 21 % se přičítá jednou k součtu ročních částek bez DPH.

Pro EG.D/PRE se nepublikuje cena innogy ani pořadí této nabídky. Chybějící skutečné VT/NT nebo neplatné vstupy nezískávají úplnou cenu. Neprobíhá extrapolace z ČEZ Distribuce.

## Porovnání a 30 MWh

Společné pořadí používá výhradně stejnou sazbu, oblast, jistič a roční VT/NT, řadí podle celé roční ceny včetně DPH. Firemní pořadí nadále určuje původní sazba v odhadu firmy nebo výběr společného porovnání E.ON v paušálním režimu; samostatné karty zřetelně uvádějí svou sazbu. Nová domácí karta a pořadí používají společné stávající vstupy ČEZ/E.ON. Původní párové ČEZ/E.ON porovnání zůstává zachované. ORLEN se do domácností nepřidává.

Limit nad 30 MWh je pouze podnikatelský. Přesně 30 000 kWh je bez upozornění; nad limit se zobrazuje výslovné upozornění i označení orientační nabídky v pořadí, úplná vypočtená nabídka se nevyřazuje. Text vysvětluje, že limit podle PDF zahrnuje kumulovanou spotřebu všech odběrných míst. Aplikace neznámou spotřebu dalších míst nevymýšlí. Do domácností se podnikatelská věta z levého sloupce PDF nepřenáší.

## Zachování předchozího chování

Baseline 80 původních zdrojových souborů odpovídá skutečnému HEAD 1.4.10. Přesné integrační změny jsou vymezené v `tests/fixtures/tariff-1411-integration.json`; původní SHA baseline starších verzí zůstávají zachované. Měřicí zdroje, ceníky a cenové funkce ORLEN, ČEZ a E.ON jsou beze změny. Nové zdroje nezasahují do IndexedDB, backupů, historie, odečtů ani UZEL vazeb.
