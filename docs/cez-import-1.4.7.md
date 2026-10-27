# ČEZ / ČEZ ESCO – import 1.4.7

Ověřeno 27. 10. 2026 výhradně proti čtyřem uživatelem dodaným PDF. Originály jsou v `docs/sources/cez-2026/`; metadata statických datasetů obsahují název, SHA-256, stranu tabulky, produkt, zákazníka, distribuční oblast, účinnost a konvenci DPH. Účinnost všech ceníků je 1. 1. 2026.

## Rozsah a ověření

- ČEZ domácnosti: 10 sazeb × 3 oblasti (ČEZ Distribuce, EG.D, PREdistribuce). Zachovány řádky 1–27 tabulky včetně všech jističových intervalů, násobků za A a samostatných vyšších intervalů D57d. Pomlčky ve zdroji zůstávají `null`; nejsou nahrazovány nulou. Neimportované či nečitelné požadované hodnoty: **0**.
- ČEZ ESCO SPOT: 11 sazeb (C01d, C02d, C03d, C25d, C26d, C27d, C35d, C45d, C46d, C56d, C62d), 9 zveřejněných měsíců leden–září 2026, 99 měsíčních cen. C60d nemá cenu. Říjen–prosinec nejsou zveřejněny a nejsou doplněny.
- Podnikatelská tabulka na straně 3 SPOT PDF se sazbami D není domácím produktem; do domácností se neimportuje.
- SPOT tabulka obsahuje u některých měsíčních řádků popisek Kč/měsíc. Jednotka dodávky Kč/MWh vychází z definice produktu v témže PDF a zářijových hodnot výslovně potvrzených zadáním; stálá platba je samostatných 95 Kč/měsíc. Toto není další měsíční paušál. Přirážka 285 Kč/MWh je již v ceně a znovu se nepřičítá.
- Kontrola proti originálům: `python scripts/validate-cez-pdf.py` (vyžaduje Poppler `pdftotext`). Skript pouze porovnává statická data se zdroji, žádné ceny negeneruje. Výsledek v `docs/cez-validation-1.4.7.json`.

## Výpočet a omezení

Interně se používají výhradně ceny bez DPH. U domácností jsou to hodnoty v závorkách, u SPOT hlavní hodnoty. DPH 21 % se přičítá jednou k celkovému výsledku; uvnitř výpočtu se nezaokrouhluje.

POZE domácností = minimum z roční platby podle jističe (12 × řádek 24 × A × počet fází) a podle spotřeby ((VT + NT) / 1000 × řádek 25). Zdrojové sazby jsou 0 Kč/A/počet fází a 495 Kč/MWh, tedy výsledkem je 0 Kč. Zůstávají uloženy obě sazby i obě vypočtené varianty.

Domácí 2T vyžaduje skutečný roční NT; VT je rozdíl proti celkové roční spotřebě. Prázdný NT, záporný rozdíl, neplatný jistič či neznámá sazba nezobrazí úplnou roční cenu. Dostupné jsou 1f i 3f jističe.

SPOT používá poslední zveřejněný měsíc z importovaných dat, nyní září 2026; má stejnou obchodní cenu VT i NT. Zobrazuje se jako orientační roční scénář, nikoli garantovaná roční cena. Obchodní pokrytí je republikové, regulované pokrytí zůstává pouze ověřená ČEZ Distribuce pro C01d/C02d/C03d/C25d/C45d. Pro jiné kombinace, případně chybějící rozpad VT/NT, se zobrazí jen obchodní část a výslovné upozornění na nedostupný úplný výpočet. Domácí distribuční ceny D se nepřenášejí do sazeb C.

`lastVerifiedAt = 2026-10-27`, `refreshAfterDays = 20`, doporučená kontrola `2026-11-16`. Od tohoto dne se zobrazí doporučení aktualizace; poslední ověřený dataset zůstává platným základem zobrazení. Neprovádí se automatické stahování ani přepis při neúspěšné aktualizaci. Použité názvy dodavatelů jsou textové, bez vzdálených log.

## Ochrana před regresí

Výchozí commit 1.4.6: `7bab1dff2d5ff851ae7d3dbe168f9e0934efb01e`.

Všechny existující soubory v `src/` kromě čtyř přesných integračních úprav v `TariffCalculator.tsx` zůstávají bajtově stejné jako v 1.4.6. Změny integračního souboru jsou explicitně uloženy v `tests/fixtures/tariff-147-integration.json`; původní SHA test zůstává zachován a před porovnáním odstraňuje pouze tyto přesně ověřené úpravy. Nový SHA test `frozen-146.json` chrání i veškeré měřicí UI, UZEL, sérii, Stylus, historii, backup a všechny existující ORLEN soubory. Historické SHA baseline se nemění.
