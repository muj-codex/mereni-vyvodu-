# ČEZ ESCO Elektřina 24 – 1.4.10

Navazuje na vydanou 1.4.9 (`7ad834c38eeab2217044e7ac7e9eaf2b9bd4407c`). Při navazující kontrole nebyla změna Elektřina 24 ještě commitnuta; dokončuje se proto jako 1.4.10, bez dalšího navýšení verze za samotnou kontrolu.

Zdroj: uživatelem dodaný `20260630-esco_cenik_elektrina_mop-12_24_36.pdf`, strana 1, prostřední blok Elektřina 24. Originál je v `docs/sources/cez-2026/`; dataset uchovává SHA-256 i obě zdrojové varianty DPH. Velká čísla PDF zahrnují DPH, závorky jsou bez DPH. Import zahrnuje 12 sazeb a 64 ověřených čísel, žádné nečitelné hodnoty. Reprodukce: `python scripts/validate-esco24-pdf.py`.

| Sazby | VT bez DPH Kč/MWh | NT bez DPH Kč/MWh |
|---|---:|---:|
| C01d/C02d/C03d/C62d | 2860 | — |
| C25d/C26d/C27d/C35d | 2839 | 2839 |
| C45d/C46d/C55d/C56d | 2887 | 2887 |

Stálý obchodní plat 95 Kč/měsíc bez DPH. Fixace 24 měsíců, dodávky zahájené od 1. 6. 2026. Obchodní cena platí pro všechna distribuční území. Hlavní firemní karta používá pouze tento produkt; historický SPOT není aktivní a žádná přirážka 285 Kč se nepřičítá.

Regulovaná část používá již ověřený výpočet pro ČEZ Distribuce. Pro EG.D/PRE nebo chybějící VT/NT nevzniká neověřená úplná cena. C55d je v globálním katalogu a má pouze ověřenou obchodní cenu ČEZ ESCO; nemá ověřenou regulaci, úplnou cenu ani pořadí a není přidána do nabídky E.ON nebo ORLEN.

Pořadí a rozdíly používají shodnou sazbu, distribuční oblast, jistič a spotřebu VT/NT. Řadí se pouze úplné roční ceny včetně DPH, DPH se přičítá jednou. Příklad C02d, ČEZ Distribuce, 3×40 A, 12 000 kWh/rok: ORLEN 81 959,592 Kč, ČEZ ESCO 87 128,712 Kč, E.ON Variant 89 785,872 Kč včetně DPH. ČEZ má obchodní část 35 460 Kč a regulovanou 36 547,20 Kč bez DPH.

Čtyři stávající zdrojové soubory obsahují pouze přesně vymezené integrace: nová firemní větev ČEZ, zdroj a popis pořadí, katalog C55d a vyloučení C55d z E.ON výběru. Ostatní původní zdrojové soubory chrání SHA-256 baseline 1.4.9; starší baseline se nemění. Domácnosti zůstávají ČEZ/E.ON, ORLEN a E.ON ceny i výpočty a celá měřicí část včetně úložišť jsou zachovány.
