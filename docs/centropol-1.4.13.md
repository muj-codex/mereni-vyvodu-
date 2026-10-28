# Centropol pro firmy i domácnosti – 1.4.13

Výchozí skutečný main 1.4.12: `08d8d9d479c495b24c8dbbffba08d58e171c9229`. Verze 1.4.13 přidává Centropol ve všech třech oblastech. Původní ceníky, cenové funkce a měřicí část se nemění.

## Zdroje a import

Šest originálů uživatelských PDF je v `docs/sources/centropol-2026/`: tři `c-fixne-pro-podnikatele-na-2-roky-21092026-c-{cez,egd,pre}-01012026.pdf` a tři `d-fixne-online-pro-zacatek-na-2-roky-24092026-d-{cez,egd,pre}-01012026.pdf`.

Firmy: **FIXNĚ PRO PODNIKATELE na 2 roky**, od 21. 9. 2026. Domácnosti: **FIXNĚ ONLINE PRO ZAČÁTEK na 2 roky**, od 24. 9. 2026. Regulované položky od 1. 1. 2026. Metadata každého ze šesti samostatných datasetů uchovávají oblast, SHA-256, stránku, datum ověření a konvenci DPH.

`python scripts/import-centropol.py --check` rekonciluje 1443 skutečných tištěných dvojic cen bez/s DPH, všechny použitelné buňky a jednotkové součty úplných sazeb. Ceny ze závorek jsou vždy základ výpočtu. Obě skutečné zdrojové varianty jsou zachované, nečitelné hodnoty se neodhadují. Obchodní shoda mezi oblastmi je ověřena ze všech PDF; regulované hodnoty se nikdy nekopírují mezi oblastmi.

[Validační report](centropol-validation-1.4.13.json) eviduje 56 haléřových rozdílů tištěných souhrnných cen s DPH proti násobku jejich net souhrnu. Jde pouze o souhrnné řádky, nikoli základní položky. Tyto tištěné hodnoty zůstávají beze změny v referenčních datech; roční výpočet používá základní jednotlivé položky bez DPH a DPH přičítá jednou k výslednému základu. Žádná cena se „neopravuje“ podle jiného dodavatele.

Tištěný souhrn C62d v NT obsahuje systémové služby a daň, přestože obchodní a distribuční řádek NT jsou pomlčky. Není použit jako NT cena ani jako důvod zavést NT. C62d má pouze VT. Tištěné souhrny jsou uloženy odděleně od účtovaných jednotkových cen.

## Obchodní ceny bez DPH

| Kategorie / sazby | VT Kč/MWh | NT Kč/MWh |
|---|---:|---:|
| C01d/C02d/C03d | 2868 | — |
| C25d/C26d/C27d | 2987 | 2702 |
| C35d | 2998 | 2802 |
| C45d/C46d/C55d/C56d | 2996 | 2854 |
| C62d | 2878 | — |
| D01d/D02d | 2718 | — |
| D25d/D26d/D27d | 2854 | 2583 |
| D35d | 2881 | 2773 |
| D45d/D56d/D57d | 2854 | 2800 |
| D61d | 2854 | 2610 |

Stálý obchodní plat firmy 130 Kč/měsíc, domácnosti 135 Kč/měsíc bez DPH.

## Regulace a neúplnost C55d

Každá kategorie/oblast má vlastní přesnou tabulku jističů, distribuce VT/NT a dalších položek. Například podnikatelský C02d při 3×40 A: ČEZ 577 Kč, EG.D 604 Kč, PRE 475 Kč měsíčně bez DPH. Domácí D02d: ČEZ 409 Kč, EG.D 400 Kč, PRE 347 Kč. D57d má své výslovně označené vyšší intervaly až do 160 A a sazbu nad 160 A; ostatní D sazby používají nad 63 A sazbu za A. Zachována samostatná 1f tabulka. U ČEZ C45d je skutečná distribuční cena 635,80 Kč/MWh, nikoli 635,38 převzatých od jiných dodavatelů.

Systémové služby 164,24 Kč/MWh, infrastruktura 12,87 Kč/měsíc a daň 28,30 Kč/MWh jsou doložené ve všech šesti podkladech. POZE má publikovanou cenu dle jističe 0 Kč/A/měsíc. Druhá spotřební sazba zde není uvedena a nepřebírá se z jiných ceníků; zůstává null.

C55d má ve všech oblastech ověřenou obchodní cenu, ale pomlčky v distribuci a jističových platbách. Zůstává jen obchodní cenou (při doloženém VT/NT i dílčí roční obchodní částí), bez celkové roční ceny a bez zařazení do úplného pořadí. Žádné hodnoty C56d se nedoplňují. Z 66 kombinací sazba/oblast je 63 úplných a 3 obchodní C55d neúplné.

## Integrace a regresní ochrana

Společné pořadí používá shodnou sazbu, oblast, jistič a skutečné roční VT/NT, řadí celé roční ceny včetně DPH. Karta Centropol ukazuje rozpad a rozdíly proti ostatním úplným nabídkám. Domácnosti obsahují ČEZ, E.ON, innogy/PRE tam, kde jsou doložené, a Centropol ve všech oblastech; ORLEN se do domácností nepřidává.

V EG.D/PRE je Centropol první úplný firemní ceník. Společné pořadí proto nově zobrazí i jednu úplnou nabídku (1. místo), ostatní nabídky zůstávají neúplné a bez falešné roční ceny. Cenové funkce a podmínky ostatních dodavatelů se nemění. Stejně jako dosud určuje firemní společnou sazbu v odhadu původní sazba a v paušálním režimu výběr u společného porovnání E.ON; samostatné karty zřetelně uvádějí svůj rozsah.

Baseline všech 87 původních zdrojových souborů odpovídá skutečnému HEAD 1.4.12. Přesné integrační změny v pěti tarifních souborech jsou vymezené v `tests/fixtures/tariff-1413-integration.json`; ostatní zdroje včetně původních cenových funkcí, datasetů a měření zůstávají identické. Historické baseline se neregenerují. Žádné změny MTP, diagnostiky, odečtů, UZEL, úložiště, historie nebo backupů.
