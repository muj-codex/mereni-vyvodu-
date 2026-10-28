# PRE PROUD FAVORIT 2 10/2026 – 1.4.12

Výchozí main 1.4.11: `528eabf3dfe76e0b414edb87f8d801a4f0c148dd`. Nová verze 1.4.12 přidává PRE do firemního i domácího porovnání bez změny cen nebo výpočtů stávajících dodavatelů a měřicí části.

## Zdroje a validace

Použity výhradně dvě uživatelské oficiální přílohy uložené v `docs/sources/pre-2026/`: `pre-proud-favorit-2.pdf` (firmy) a `pre-proud-favorit-2 2.pdf` (domácnosti). Obě mají 2 strany, platí od 1. 10. 2026 pro ČEZ Distribuce a garantují obchodní cenu do 30. 9. 2028.

Dataset uchovává obě skutečné zdrojové varianty cen: `priceWithoutVat` ze závorek, `priceWithVat` z tučného řádku. SHA-256, stránky, platnost, garance, oblast a datum ověření jsou v metadatech. `python scripts/import-pre.py --check` rekonciluje 371 dvojic net/gross, všechny použitelné jističové buňky, sloučené obchodní skupiny a nezávislé celkové jednotkové řádky. Nepoužitelné buňky zůstávají null, žádná nečitelná cena se nenahrazuje odhadem.

## Obchodní ceny bez DPH

| Kategorie / sazby | VT Kč/MWh | NT Kč/MWh |
|---|---:|---:|
| C01d/C02d/C03d | 3640 | — |
| C25d/C26d/C27d | 3540 | 3340 |
| C35d | 3640 | 3440 |
| C45d/C46d/C56d | 3840 | 3540 |
| C62d | 3540 | — |
| D01d/D02d | 3290 | — |
| D25d/D26d/D27d | 3190 | 2990 |
| D35d | 3290 | 3090 |
| D45d/D56d/D57d | 3490 | 3190 |
| D61d | 3190 | 2990 |

Obchodní měsíční plat 129 Kč bez DPH (156,09 Kč s DPH). C55d není v podkladu PRE a nedostává cenu.

## Regulovaná část a výpočet

PRE používá vlastní kompletní tabulky z PRE PDF; nic se nepřebírá od jiného dodavatele. Firmy mají 12 jističových pásem do 160 A, sazbu nad 160 A a vlastní sazbu nad 1×25 A. Domácnosti mimo D57d mají nad 63 A sazbu za A, D57d samostatná pásma do 160 A a pak sazbu za A. Např. C02d 3×40 A je 577 Kč/měsíc; D02d 409 Kč. D57d 3×80 A je 3093 Kč/měsíc; nad 160 A 122,49 Kč/A. Domácí a firemní tabulky se nesdílejí.

Daň 28,30 Kč/MWh, systémové služby 164,24 Kč/MWh, nesíťová infrastruktura 12,87 Kč/měsíc. POZE se vypočítá oběma způsoby: A = 12 × A jističe × počet fází × 0 Kč, B = MWh × 495 Kč; účtuje se nižší výsledek. DPH 21 % se přičítá jednou k celé roční ceně bez DPH, bez mezizaokrouhlování.

C02d, ČEZ Distribuce, 3×40 A, 12 000 kWh/rok: PRE obchodní část 45 228 Kč, regulovaná 36 547,20 Kč, celkem 81 775,20 Kč bez DPH a 98 947,992 Kč s DPH. Porovnání všech pěti úplných nabídek používá shodnou sazbu, oblast, jistič a roční VT/NT. PRE karta ukazuje rozdíly proti ostatním úplným nabídkám. Domácí pořadí obsahuje ČEZ/E.ON/innogy/PRE a rozdíly proti nejlevnější nabídce. ORLEN není v domácnostech.

Pro EG.D i PREdistribuci jsou tyto konkrétní ceníky PRE nedostupné. Neúplné nabídky nebo chybějící skutečný VT/NT rozpad nemají celkovou cenu a nevstupují do pořadí. PRE nepřebírá omezení innogy nad 30 MWh. Garance je konkrétní datum, nikoli odhadovaná pohyblivá fixace.

## Zachování předchozího stavu

Baseline všech 84 původních zdrojových souborů odpovídá skutečnému HEAD 1.4.11. Přesné integrační změny ve čtyřech souborech jsou v `tests/fixtures/tariff-1412-integration.json`. Původní cenové datasety, cenové funkce ORLEN/ČEZ/E.ON/innogy a měřicí část jsou beze změny. U domácího innogy komponentu se pouze doplňuje PRE karta a položka společného pořadí. Historické SHA baseline zůstávají zachované. Žádné nové měřicí pole, změna úložiště, odečtů, historie nebo backupů.
