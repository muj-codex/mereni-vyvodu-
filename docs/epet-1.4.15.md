# EPET FIX 24 · GARANT 7_2026 – 1.4.15

Výchozí skutečný main: 1.4.14, `08023116407cf01cf6a6083ae3f82195f7be3c0c`. Verze zvýšena přesně o jeden patch na 1.4.15. Přidán dodavatel **epet energie, a.s.**, firmy i domácnosti, ČEZ Distribuce / EG.D / PREdistribuce. Závislosti, původní ceníky a měřicí zdroje jsou zachované.

## Oficiální zdroje

Všech šest původních uživatelských PDF je v `docs/sources/epet-2026/`: `EP-EE-FIX-24-GARANT-7_2026_{SPOL,DOM}_{CEZ,EGD,PRE}.pdf`. Metadata obsahují samostatné SHA-256 každého originálu, účinnost, délku fixace, oblast, kategorii, stránky a datum ověření.

Ceník účinný od **20. 7. 2026**, obchodní cena pevná **24 měsíců od skutečného zahájení dodávky**. Při prolongaci se další období řídí produktovou řadou STANDARD, varianta Elektřina. Fixace se nevztahuje na regulované ceny. Není zaměněna za pevné společné kalendářní datum konce.

`python scripts/import-epet.py --check` ověřuje **1590 dvojic cen bez/s DPH**, včetně nezávislé shody opakované obchodní tabulky na stranách 1 a 2, všech použitelných jističových buněk, regulovaných položek a jednotkových součtů z každého PDF. Žádná nečitelná hodnota ani zaokrouhlovací nesrovnalost. [Validační report](epet-validation-1.4.15.json). Běžné ceny jsou bez DPH, tučné ceny s DPH; obě skutečné zdrojové hodnoty se uchovávají. Roční součet používá net ceny a DPH 21 % se přičítá právě jednou.

Strana 3 obsahuje volitelné/mimořádné administrativní služby s jinou historickou účinností. Neurčuje účinnost energetického produktu a žádná její částka nevstupuje do standardní roční ceny.

## Obchodní ceny bez DPH

| Sazby | VT Kč/MWh | NT Kč/MWh |
|---|---:|---:|
| C01d/C02d/C03d | 2819 | — |
| C25d/C26d/C27d/C35d/C45d/C46d/C56d | 2849 | 2749 |
| C62d | 2699 | — |
| D01d/D02d | 2539 | — |
| D25d/D26d/D27d/D35d/D45d/D56d/D57d/D61d | 2599 | 2549 |

Stálý obchodní plat **130 Kč/OM/měsíc bez DPH**, obě kategorie a všechny oblasti. Podporováno 11 C a 10 D sazeb v každé oblasti. C55d ani C60d nemají v těchto EPET PDF doloženou cenu a nejsou doplňovány odhadem. EPET nepřebírá omezení MND/innogy na 30 MWh.

## Regulovaná část

Každá kategorie a oblast má vlastní tabulku z příslušného EPET PDF, bez přebírání ostatních dodavatelů. C02d při 3×40 A: ČEZ 577, EG.D 604, PRE 475 Kč/měsíc bez DPH. D02d: ČEZ 409, EG.D 400, PRE 347 Kč/měsíc. Zvláštní vysoká pásma D57d jsou pouze pro D57d:

| Oblast | do 3×80 A | do 3×100 A | do 3×125 A | do 3×160 A | nad 160 A Kč/A |
|---|---:|---:|---:|---:|---:|
| ČEZ | 3093 | 5335 | 10471 | 19598 | 122,49 |
| EG.D | 2631 | 4839 | 9074 | 17889 | 111,81 |
| PRE | 2494 | 4801 | 9841 | 20779 | 129,87 |

Ostatní D sazby nad 63 A používají vlastní sazbu za A. Samostatné sazby 1f nad 25 A a firem nad 160 A pocházejí z příslušné tabulky.

Systémové služby **164,24 Kč/MWh**, daň **28,30 Kč/MWh**, nesíťová infrastruktura **12,87 Kč/OM/měsíc**. Infrastruktura se účtuje jednou; složky 1,61 OTE + 1,38 administrace podpory + 4 ERÚ + 5,88 datové centrum zůstávají pouze informativní metadata.

POZE v období 2026 se podle výslovné poznámky neúčtuje. Zdrojová varianta A **0 Kč/A/měsíc**, maximální varianta B **495 Kč/MWh** jsou zachované. Výpočet bere minimum A/B, tedy nulu; 495 Kč/MWh se automaticky nepřičítá k ročnímu nákladu.

## Porovnání a regrese

Nové karty EPET ukazují jednotkové ceny, sazbu, oblast, jistič, roční VT/NT, všechny roční položky, obchodní a regulovanou část, net součet, DPH a gross součet. Firemní karta přidává rozdíly proti úplným nabídkám. Společná pořadí firem i domácností používají tutéž sazbu, oblast, jistič a VT/NT, řadí podle celé roční ceny včetně DPH. Domácnosti dál vylučují ORLEN. Neúplný rozpad VT/NT nebo nedoložená sazba nedostávají celkovou cenu ani pořadí.

Baseline **93 původních zdrojových souborů** odpovídá skutečnému main 1.4.14. Přesné povolené integrační změny ve čtyřech tarifních souborech jsou v `tests/fixtures/tariff-1415-integration.json`. Historické baseline zůstávají zachované. Původní datasety i cenové funkce ORLEN/ČEZ/E.ON/innogy/PRE/Centropol/MND jsou identické. Žádné změny MTP, diagnostiky, UZEL, odečtů, série, historie, Stylusu, backupu nebo IndexedDB. Úprava očekávané verze v testu backupu pouze sleduje povinný patch release, nemění jeho strukturu ani implementaci.
