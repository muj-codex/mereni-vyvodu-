# E.ON / společné srovnání domácností – 1.4.8

Výchozí vydaná verze: 1.4.7, commit `68405ad4f2707e253853cef24db8669f04371949`. Další produkční změna proto dostává 1.4.8. Ověřeno 27. 10. 2026 proti čtyřem dodaným originálům E.ON PDF v `docs/sources/eon-2026/`. ČEZ podklady 1.4.7 zůstávají zachovány.

## Datové zdroje a DPH

- E.ON firmy: Elektřina spot pro podnikatele s průběhovým měřením, na dobu neurčitou bez fixace; obchodní účinnost 1. 7. 2024, regulovaná tabulka ČEZ Distribuce pro rok 2026. Měřené sazby C01d, C02d, C03d, C25d, C26d, C27d, C35d, C45d, C46d, C56d, C62d. C60d je v textu uvedena pouze jako neměřený odběr a nezískává běžnou SPOT cenu.
- E.ON domácnosti: Komplet elektřina MAX PRO s úsporou 3 roky 10/26, smlouva na 3 roky s fixací, obchodní účinnost 1. 10. 2026. Importovány pouze ceny pro rok 2026 z podrobné druhé strany, nikoliv zaokrouhlený přehled z první strany ani ceny 2027–2029. V obchodní ceně je již zahrnut Elektrikář MAX.
- Domácí sazby D01d, D02d, D25d, D26d, D27d, D35d, D45d, D56d, D57d, D61d na územích ČEZ Distribuce, EG.D a PREdistribuce. Každá oblast je přepsána ze svého PDF, nikoli extrapolována z jiné oblasti či sazby.
- Data obsahují skutečné zdrojové `priceWithoutVat` i `priceWithVat`. Hrubé hodnoty v PDF jsou někde zaokrouhlené na celé Kč: například E.ON firmy měsíčně 194 / 160 Kč, domácí podrobná tabulka 193,60 / 160 Kč. Varianty se uchovávají beze změny. Roční výpočet používá čisté ceny, plnou přesnost a jediné přičtení 21 % DPH k součtu.
- Metadata každého zdroje obsahují dodavatele, produkt, zákazníka, oblast, účinnost obchodní a regulované části, datum ověření, rok ceny, typ zdroje, název PDF, stranu tabulky, SHA-256 a konvenci DPH. ČEZ ESCO navíc dostává explicitní alias `effectiveFrom`; jeho cenové hodnoty se nemění.

## SPOT a regulované pokrytí

E.ON nedostává fiktivní obchodní jednotkovou ani celkovou roční cenu. Základem je intervalová OTE cena a skutečný průběh spotřeby, které aplikace nemá. Přesně se zobrazují zdrojové G = 350 Kč/MWh bez DPH, stálý plat 160 Kč/měsíc bez DPH a minimum 0,25 Kč/MWh bez DPH. Minimum ani G nejsou náhradou za chybějící tržní cenu. Pole `commodityPricePerMwh` a `referenceMonth` zůstávají null. Zdroj stanoví intervalový vážený průměr; tato verze se ho bez dat nepokouší simulovat.

Regulované ceny E.ON PDF jsou nezávislé na dodavateli a platí pouze pro ČEZ Distribuce. Používají se také pro rozšíření orientačního ČEZ ESCO výpočtu na doložené C sazby při známém VT/NT. C46d má vlastní odlišné hodnoty a C62d nepřebírá žádnou sousední sazbu. Na EG.D a PREdistribuce se tyto C ceny nepřenášejí. ČEZ ESCO zachovává září 2026 jako poslední zveřejněný měsíc, 95 Kč/měsíc a již zahrnutou přirážku 285 Kč/MWh; původní ověřené interní regulované podklady zůstávají dostupné pro dříve podporované kombinace.

Oba SPOT produkty mají `lastVerifiedAt = 2026-10-27`, `refreshAfterDays = 20`, doporučenou kontrolu od `2026-11-16`. Upozornění nemaže poslední ověřená data. Bez scraperu, automatického stahování či funkčního tlačítka aktualizace; značky jsou textové bez vzdálených log.

## Nejednoznačnosti a POZE

- Nečitelné číselné hodnoty: **0**. Jedno neověřené pravidlo použití: firemní E.ON řádek 17 píše „nad 3x63 A za A / nad 3x160 A za A pro D 57d“, ačkoli jde o C tabulku s explicitními intervaly až do 160 A. Všechny číselné hodnoty řádku jsou zachovány, ale u E.ON se pro 3f nad 160 A neaplikují bez ověření. Není odhadnuto, zda jde o chybu tisku. Explicitní pásma do 160 A a 1f řádky jsou použita přímo.
- V E.ON je sazba POZE podle spotřeby pomlčka, tedy `null`, nikoli 495 nebo domyšlená nula. Sazba podle jističe je výslovně 0 Kč a zdroj současně uvádí konečné POZE 0 Kč; výpočet používá tento doložený výsledný údaj. U ČEZ zůstává původní minimum dvou doložených variant (0 podle jističe a 495 Kč/MWh podle spotřeby).
- Volitelné poplatky za poštovní poukázky a Zelenou od E.ONu se bez informace o jejich sjednání automaticky nepřidávají; upozornění je v domácí kartě. Nejde o chybějící povinné položky základního produktu.

## Společné domácí vstupy a ochrana měření

ČEZ i E.ON používají tutéž oblast, sazbu, počet fází, jistič a roční VT/NT. Žádné dva nezávislé formuláře; vstupy původní karty ČEZ řídí i E.ON a srovnání. Prázdné, neplatné či neúplné údaje nezobrazí cenu ani levnější nabídku. Výsledek označí levnější nabídku a rozdíl včetně DPH, případně shodu cen. Cena nepotvrzuje technickou způsobilost pro distribuční sazbu.

Měřicí část, ORLEN, UZEL, odečty, série, Stylus, historie, backup a úložiště jsou bajtově stejné jako v 1.4.7. Výjimky jsou omezeny na tři tarifní soubory a přidání metadat ESCO, přesně auditované v `tests/fixtures/tariff-148-integration.json`. Historické SHA baseline nejsou přegenerovány; před porovnáním se odstraní jen přesně validované integrační změny. Samostatný SHA baseline chrání všechny původní soubory 1.4.7. Závislosti se nemění.

Kontrola originálů: `python scripts/validate-eon-pdf.py` (Poppler `pdftotext`), pouze čte a porovnává. [Strojový report](eon-validation-1.4.8.json): **1 290 ověřených zdrojových čísel**, nula nečitelných, jedno neověřené pravidlo. Historický ČEZ import je nadále kontrolovatelný přes `python scripts/validate-cez-pdf.py`.
