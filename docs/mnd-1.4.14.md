# MND Proud – Ceník Prosinec 28 – 1.4.14

Výchozí skutečný main 1.4.13: `5a3f85bd11f2935ded941c75e0bdc6b7a09b7189`. Nová patch verze 1.4.14 přidává MND pro firmy i domácnosti ve třech distribučních oblastech. Ostatní ceníky, cenové funkce a měřicí část jsou zachované.

## Zdroje a výběr produktu

Šest původních uživatelských PDF je uložených v `docs/sources/mnd-2026/`: `2026_10_01_MND_Proud_Cenik_Prosinec_28_{CEZ,EGD,PRE}.pdf` a příslušné podnikatelské varianty `_MO.pdf`.

Autoritou je skutečný obsah, nikoli datum v názvu souboru: ceníky jsou účinné od **7. 10. 2026**, pevná obchodní cena do **31. 12. 2028**, přechod na aktuální základní Proud od **1. 1. 2029**. Jde o dodatkový balíček. Sankce za předčasné ukončení se automaticky nepočítají a nevstupují do běžného ročního nákladu.

První strana uvádí vedle sebe Prosinec 28 a základní Proud. Import záměrně používá přílohu na straně 2, která obsahuje jen vybraný produkt. Cena základního Proudu, například 3464,46 Kč/MWh a 99,17 Kč měsíčně pro C02d, se nepoužívá místo balíčku. Metadata uchovávají název, účinnost, konec pevné ceny, přechod na základní ceník, limit, oblast, stránky, SHA-256 a datum ověření.

`python scripts/import-mnd.py --check` rekonciluje oba druhy skutečných cen (první s DPH, hranaté závorky bez DPH), všechny použitelné jističové buňky a kontrolní net součty. Celkem 1101 dvojic, 11 C a 10 D sazeb v každé oblasti, žádné nečitelné hodnoty doplněné odhadem. Obchodní shoda je ověřena ze všech PDF; regulovaná část se čte z každého zvlášť. [Validační report](mnd-validation-1.4.14.json) zachovává i 51 odchylek tištěných zaokrouhlených cen proti přepočtu net základu; obě zdrojové varianty zůstávají uložené. Výpočet používá jednotlivé ceny bez DPH a 21 % DPH přidává jednou k ročnímu součtu.

## Obchodní ceny bez DPH

| Sazby | VT Kč/MWh | NT Kč/MWh |
|---|---:|---:|
| C01d/C02d/C03d | 2899,17 | — |
| C25d/C26d/C27d | 2930,57 | 2757,85 |
| C35d | 2947,93 | 2839,66 |
| C45d/C46d/C56d | 2935,53 | 2908,26 |
| C62d | 2771,90 | — |
| D01d/D02d | 2698,34 | — |
| D25d/D26d/D27d | 2860,33 | 2603,30 |
| D35d | 2904,13 | 2761,15 |
| D45d/D56d/D57d | 2894,21 | 2776,03 |
| D61d | 2698,34 | 2698,34 |

Obě kategorie a všechny oblasti: stálý obchodní plat **138,84 Kč/měsíc bez DPH** (tištěná cena s DPH 168 Kč). C55d není doložena a nedostává cenu MND.

## Regulace a 30 MWh

Každá kategorie a oblast má vlastní zdrojovou tabulku jističů a distribuce. C02d při 3×40 A: ČEZ 577 Kč, EG.D 604 Kč, PRE 475 Kč měsíčně bez DPH. D02d: ČEZ 409 Kč, EG.D 400 Kč, PRE 347 Kč. D57d má výhradní vyšší pásma: při 3×80 A ČEZ 3093 Kč, EG.D 2631 Kč, PRE 2494 Kč. Ostatní D sazby nad 63 A používají vlastní cenu za A, nikoli tato pásma. Samostatně se používají 1f ceny nad 25 A a podnikatelské ceny nad 160 A.

Systémové služby 164,24 Kč/MWh, POZE 0 Kč/MWh, daň 28,30 Kč/MWh. Nesíťová infrastruktura 12,87 Kč měsíčně se účtuje **pouze jednou**. Informativní složky jsou 5,88 datové centrum + 4,00 ERÚ + 1,61 OTE zúčtování + 1,38 administrace podporovaných zdrojů. Nepřičítají se navíc k agregátu.

Limit platí podle všech šesti PDF pro jednotlivé odběrné místo **v obou kategoriích**. Přesně 30 000 kWh/rok je bez varování. Nad limit se úplná cena stále vypočítá a MND zůstává v pořadí; výrazné upozornění na kartě a označení v pořadí uvádí, že nabídka je pouze orientační/podmíněná a MND může smlouvu odmítnout nebo od ní odstoupit. Nejde o součet všech míst zákazníka ani o podnikatelské omezení innogy, které zůstává nezměněné.

## Porovnání a ochrana původního stavu

Úplné nabídky se řadí podle celé roční ceny včetně DPH při shodné oblasti, sazbě, jističi a skutečném VT/NT. Samostatná karta MND ukazuje obchodní i regulovanou část, jednotkové ceny, roční položky, DPH, celkovou cenu a rozdíly proti dostupným úplným nabídkám. Domácnosti obsahují ČEZ/E.ON/innogy/PRE/Centropol/MND podle dostupnosti; ORLEN do domácností nevstupuje. Chybějící VT/NT nebo nepodporované sazby nedostávají domyšlenou celkovou cenu.

Baseline všech 90 původních zdrojových souborů odpovídá skutečnému HEAD 1.4.13. Přesné integrační změny ve čtyřech tarifních souborech jsou vymezené v `tests/fixtures/tariff-1414-integration.json`. Původní cenové datasety a funkce ORLEN/ČEZ/E.ON/innogy/PRE/Centropol i měřicí zdroje zůstávají identické. Historické SHA baseline nejsou přepsané. Žádné změny diagnostiky, MTP, UZEL, jednotlivých ani sériových odečtů, úložiště, historie nebo backupů.
