# E.ON Variant – hlavní firemní produkt 1.4.9

Výchozí vydaná verze 1.4.8: `420665e6d9d9b99532db1dcda5d357377db141ac`. Další produkční změna navazuje verzí 1.4.9. Zdroj: uživatelem přiložený `cenik--variant--na--2--roky--10_26--profi-----distribucni--uzemi--cez.pdf`, jehož originál je uložen v `docs/sources/eon-2026/`. Dataset obsahuje název, SHA-256, stranu 2, datum ověření 27. 10. 2026, dodavatele, produkt, obchodní a regulovanou účinnost a konvenci DPH.

## Produkt a import

E.ON **Variant na 2 roky 10/26 Profi**, produktová řada Variant, pro podnikatele, fixace 2 roky, obchodní cena od 1. 10. 2026, regulované ceny ČEZ Distribuce pro rok 2026. `pricingType: fixed`; žádná SPOT reference ani 20denní expirace.

| Sazby | VT Kč/MWh bez DPH | NT Kč/MWh bez DPH | Stálý plat Kč/měsíc bez DPH |
|---|---:|---:|---:|
| C01d, C02d, C03d | 2999 | — | 139 |
| C25d, C26d, C27d | 3124 | 2826 | 139 |
| C35d | 3135 | 2930 | 139 |
| C45d, C46d, C56d | 3133 | 2984 | 139 |
| C62d | 3009 | — | 139 |

Importované ceny pocházejí z podrobné druhé strany. Obě skutečné zdrojové varianty `priceWithoutVat` / `priceWithVat` jsou zachovány, například 139 / 168,19 Kč. Zaokrouhlený přehled první strany se nepoužívá místo přesné tabulky. Zachovány všechny jističové intervaly a 1f/3f sazby za A, jednotlivé distribuce VT/NT i společné regulované položky. Doplňkové řádky 25/26 slouží pro nezávislé ověření součtu jednotkových cen. C60d se nemění na běžnou měřenou sazbu.

Nový zdroj výslovně uvádí **nad 3×160 A za A**, bez chyby popisku historického SPOT PDF. Proto jsou u Variant ověřené i jističe nad 160 A. Například C02d: 14,43 Kč/A/měsíc, C46d: 139,99 Kč/A/měsíc bez DPH. Žádná sazba se nepřebírá ze sousedního sloupce.

POZE podle jističe je 0 Kč; spotřební buňka je pomlčka (`null`) a konečný řádek uvádí výslovně 0 Kč. Výpočet používá doloženou konečnou nulu, nevymýšlí chybějící spotřební sazbu. Daň 28,30 Kč/MWh, systémové služby 164,24 Kč/MWh a nesíťová infrastruktura 12,87 Kč/OM/měsíc jsou přepsány ze zdroje. Roční částky se počítají z cen bez DPH s jediným přičtením 21 % DPH, bez předčasného zaokrouhlování.

## Zapojení a srovnání

Hlavní firemní E.ON karta používá Variant, ukazuje jednotkové ceny, obchodní část, regulovanou část, celkovou roční cenu bez/s DPH, rozdíly proti úplným nabídkám ORLEN a ČEZ ESCO a pořadí dostupných úplných nabídek.

Srovnání používá pro všechny dodavatele stejnou sazbu, oblast, jistič, celkovou roční spotřebu a skutečný rozpad VT/NT. V odhadu firmy je to původní sazba; v paušálním režimu určuje sazbu pro společné pořadí výběr v kartě Variant a tento rozsah je u pořadí výslovně uveden. Původní samostatné karty ORLEN a ESCO zachovávají své ovládání. Neúplné nabídky nejsou řazeny; při méně než dvou úplných nabídkách se neukazuje cenové pořadí. Chybějící NT se neodhaduje. EG.D a PREdistribuce nemají pro Variant kompletní ověřený C podklad a nedostávají falešnou celkovou cenu.

ČEZ ESCO zachovává září 2026, republikovou obchodní oblast, 95 Kč/měsíc a již zahrnutou přirážku 285 Kč/MWh. Je výslovně SPOT / orientační scénář, nikoli garantovaná roční cena. Jeho regulované ceny pro ČEZ Distribuce nyní používají kompletní ověřenou tabulku Variant včetně jasného pásma nad 160 A. Kontrola stáří ESCO po 20 dnech zůstává zachována a nemaže data.

Původní E.ON SPOT zůstává v historických datech a testech, ale není aktivní hlavní kartou, neúčastní se hlavního pořadí a neblokuje cenu Variant. Žádné intervalové OTE údaje nejsou pro Variant potřebné. Volitelné poplatky za poukázky či Zelenou od E.ONu se bez údaje o sjednání automaticky nepřidávají. Cenové pořadí nepotvrzuje technický nárok na distribuční sazbu. Bez vzdálených log nebo automatického scraperu.

## Ochrana a validace

ORLEN, měřicí matematika i UI, UZEL, jednotlivé odečty/série, Stylus, historie, backup a veškeré domácí ceny a výpočty jsou beze změny. Ze všech 73 původních zdrojových souborů 1.4.8 jsou pouze tři tarifní integrace změněny: výběr hlavní E.ON karty, zdroj regulovaných cen ESCO a jeho přesný text provenience. Jejich původní SHA se ověřují po odstranění pouze přesně auditovaných změn (`tariff-149-integration.json`); ostatních 70 souborů je chráněno přímým SHA. Historické SHA baseline se nepřegenerovávají. Závislosti beze změny.

`python scripts/validate-eon-variant-pdf.py` (Poppler) pouze čte a porovnává dataset s originálem: **448 ověřených číselných hodnot**, 11 tarifů, přímá shoda součtů s řádky 25/26, **0 nečitelných hodnot / 0 neověřených pravidel**. [Strojový report](eon-variant-validation-1.4.9.json). Historický SPOT report z 1.4.8 se zachovává, jeho tehdejší nejistota se nepřenáší na nový fixovaný zdroj.
