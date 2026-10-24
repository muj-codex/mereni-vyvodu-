# Ověření verze 1.2.4

- `npm run test:e2e`: **62 prošlých scénářů** (31 pro iPhone 13 a 31 pro iPad 7. generace v Chromium), včetně nových intervalů ve stejný den / přes půlnoc, sdílení a legacy Kontroly stavů bez intervalových dat.

- `npm test`: **180 prošlých testů**. Nové regrese ověřují stejný den, přechod přes půlnoc, interval v historii / výsledku / detailu, TSV a e-mail bez starého data hlavičky, zachovaný předmět, legacy intervaly i chybějící interval a nezměněné datum 1f/3f.
- `npm run build`: úspěšný TypeScript, produkční Vite build a offline precache verze 1.2.4.
- Interval se čte přímo z existujících uložených `input.interval.from` a `to`, bez převodu časového pásma a bez změny IndexedDB. Při chybějícím intervalu se použije původní identifikace nebo lokální timestamp.

# Ověření verze 1.2.3

- `npm test`: **176 prošlých testů**; unit/regresní testy matematiky, vstupů, ARON, rozsahů, vlastní MTP, VN, diagnostiky, TSV a IndexedDB.
- `npm run test:e2e`: **56 prošlých scénářů** (28 pro každý viewport); scénáře v Chromium s viewporty iPhone 13 a iPad 7. generace. Běžné 3f, ARON bez IL2, závada IL3, napětí u 500 V, VN, historie tabs, navigace, změna rozsahu, systémové sdílení a mailto s TSV tělem.
- Nový pracovní tok: checkbox přenosu ON/OFF pro 1f i 3f, přenos pouze hlavičky/configurace a MTP, viditelný souhrn, vlastní identifikace při OFF, žádný přenos odečtů ani vyhodnocení kontroly.
- OD/DO: samostatně editovatelné datum a čas, vícedenní interval 22.–25. 10. 2026, odmítnutí DO před OD. Po uložení zůstávají datumy, časy a pracovní hodnoty jsou prázdné i po reloadu; pokračování do 3f a samostatný snapshot v historii.
- Ukládání: simulované odmítnutí readwrite transakce v prohlížeči zachová celou kontrolu i 1f výsledek a vstupy; po opakovaném úspěšném zápisu se vyčistí. Unit testy ověřují totéž pro 3f a také zachování konfigurace/checkboxu, čisté proudy a napětí u NN/VN.
- Kontrola stavů: korekce 300/600 = 0,500 a 20 kWh → 10 kWh; samostatný snapshot a uložení bez Kyoritsu, bez vah pulzu i odhadu. Konzervativní vyhodnocení 15/25 %, tři rozdílné záložky detailu.
- Export: nejvýše tři desetinná místa v UI i TSV, procenta TSV přesně dvě, PF zachovává až tři. Systémové sdílení samostatné kontroly obsahuje automatický title s výrobním číslem a TS/rozvodnou a čistý TSV text bez souborů; fallback funguje i při nedostupné schránce.
- Filtry: TS, rozvodna, všechna napětí, kombinace i zrušení filtru. Žádný implicitní filtr na dnešek; filtry nepřepisují objekty.
- Dlouhodobá historie: skutečné uzavření persistentního browser contextu D1 a znovuotevření stejného profilu D2, oba záznamy od nejnovějšího.
- Migrace: starý záznam ve schématu DB v1 přežije upgrade, přidání nového 1f záznamu / samostatné Kontroly stavů a offline reload. Unit test navíc reprodukuje neviditelnost starého záznamu bez indexovaného `savedAt` a ověřuje opravené čtení všech objektů.
- Uložení se potvrzuje až po `tx.done`, selhání neruší rozepsané vstupy. Název DB/store ani verze 2 se nemění. Žádný reset historie při startu či migraci. Hromadné mazání pouze výslovným potvrzením uživatele.
- `npm run build`: TypeScript, Vite a kompletní precache offline aplikace. Verze a aktuální datum buildu jsou v nápovědě.

Podrobné zjištění příčiny a omezení jsou v [PROMPT_1_1.md](PROMPT_1_1.md).
Mobilní emulace Chromium není nativní Safari. Test předání `mailto` ověřuje
neprázdné TSV tělo v URL skutečně vyvolané tlačítkem; neověřuje doručení e-mailu
nebo chování externího poštovního klienta. Web Share test ověřuje předaný `title`; jeho využití jako předmětu je třeba ověřit v cílové iOS poštovní aplikaci. Historie na konkrétním dotčeném
zařízení nebyla dostupná, proto příčina jeho incidentu zůstává nepotvrzená.

Ověřeno 22. 10. 2026. Snímky iPhone/iPad ověřují původní pracovní tok i novou kartu Kontroly stavů. Filtry na úzké obrazovce přecházejí do jednoho sloupce. Původní pulzní pole starého v1 objektu se po uložení nového typu ani reloadu nemění. Databázový kód nebyl pro verzi 1.2.3 změněn.

## Stabilizační vydání 1.2.5

Ověření balíku: `npm test` – **203/203**, `npm run test:e2e` – **72/72** (36 scénářů na každém z profilů iPhone/iPad v Chromium), `npm run build` – úspěšný TypeScript, Vite i generování PWA precache. Manifest zachovává identitu instalace; všech 7 precachovaných souborů existuje a vygenerovaný service worker nepřistupuje k IndexedDB.

Nové testy zahrnují explicitní propojení Kontrola stavů → Kyoritsu → uložený výsledek → reload, přímé Kyoritsu bez kontroly, všechny tři položky porovnání včetně věcně nedostupného elektroměr ↔ Kyoritsu (kWh versus kW), úplný JSON export a obnovu do čisté DB, opakovaný a souběžný import bez duplicit, částečné sloučení, fallback bez ID, kompatibilitu diagnostických scénářů 400/500 V, odmítnutí neplatné zálohy a atomický rollback při chybě zápisu. Skutečná výměna service workeru a buildové cache zachovala původní v1 záznam, následný upgrade DB i offline otevření historie.

Test souborového Web Share používá mock systémového rozhraní. Fyzický iPhone/iPad a nativní dialog **Uložit do Souborů** nebyly v tomto prostředí dostupné.

## Ověření 1.2.7 – konzistence výkonu Kyoritsu

- `npm test`: **228/228** testů, všech 10 souborů úspěšných. Nových 25 kontrol pokrývá ARON A–D, nezávislé větve i celkový výkon, skutečné napětí každé větve, hranice ±15/±25 %, znaménka PF/P, nuly, chybějící a neplatné vstupy, NN 400 V podle typu napětí, IndexedDB, JSON a exportní procenta na dvě desetinná místa.
- `npm run build`: úspěšný TypeScript, Vite produkční build a offline precache verze **1.2.7**. Závislosti ani verze databáze se nemění.
- `npm run test:e2e`: **78/78** scénářů (39 iPhone + 39 iPad, Chromium), celý suite nad finálním produkčním buildem. Zahrnuje NN 400 V, ARON IL1/IL3 bez IL2, VN/1f, kontrolu stavů, obě zachovaná porovnání, historii, zálohu/import JSON, IndexedDB, skutečný update service workeru, offline režim a export/share.
- Nové E2E: 24,14 kW vypočteno proti 4 kW Kyoritsu i Energis znamená varování bez zeleného výsledku, také po uložení a otevření detailu. Správných 18 kW projde; fyzikálně správných 18 kW proti Energis 10 kW rozliší interní kontrolu od externího nesouladu.
- Sdružená napětí v NN 400 V vyžadují výslovně deklarovanou symetrickou soustavu; bez určení typu napětí se kontrola označí neutrálně jako neověřitelná. Starší záznamy bez nové diagnostiky se otevírají beze změny uloženého výsledku.

## Ověření 1.3.0 – odečtové série (23. 10. 2026)

- `npm test`: **255/255** testů, všech 13 souborů úspěšných. Původní numerické regression testy zůstaly zachovány; nový SHA-256 test ověřuje přesnou shodu všech 13 souborů `src/core` s produkčním commitem 1.2.7 `09f736eb9b005fca83e6da25194f4a66e05028a8`. Matematika původních měření se nemění.
- `npm run build`: TypeScript, Vite produkční build i generování PWA service workeru prošly. Všech 8 precachovaných souborů existuje, včetně odděleného XLSX chunku. Service worker nepřistupuje k IndexedDB. Vite pouze upozorňuje na velikost lazy ExcelJS chunku (937 kB, přibližně 271 kB gzip).
- `npm run test:e2e`: **94/94** scénářů nad finálním produkčním buildem, **47 iPhone + 47 iPad**, Chromium. Zahrnuje celou původní sadu a nové scénáře prvních odečtů, čištění polí, společného balíku, vybraných pokračování, zamčených dat, nevyplněného řádku, ukončení a opětovného pokračování bez ztráty historie, importu TXT/XLSX, exportu TXT/XLSX, STYLUS náhledu, obnovy JSON v čisté DB a opakované obnovy bez duplicit. Samostatný scénář ověřuje výběr **48 ze 70** a zobrazení právě 48 karet.
- IndexedDB **v1/v2 → v3** zachovává původní objekty `measurements` beze změny. Přidává stores `series`, `meters`, `readings` a indexy pro balík, EM, UZEL a historii elektroměru. Unit testy ověřují souběžné pokračování i atomické odmítnutí zastaralého předchozího odečtu. Nové zápisy aktualizují vlastní UI přírůstkově; již otevřená historie dostává informaci o změně.
- JSON formát **2** uchovává všechny staré typy měření i série, stabilní ID, návaznost odečtů, UZLY, MTP a metadata Energisu. Formát **1** z 1.2.5+ se stále načítá. Restore validuje všechny entity před zápisem, přidává je v jedné transakci a při konfliktu neprovádí částečný zápis. Starší záloha nevrací novější historii zpět. Ověřena obnova po ukončení sledování i další import bez duplicit.
- Importní testy používají **syntetická data**, nikoliv fotografie nebo nepřiložený skutečný Energis export. Ověřují sumy 940 / 816 / 1028, identitu výsledku XLSX/TXT, posunuté řádky, 100 intervalů, velký export s nevybranými UZLY, chybějící a duplicitní uzly, nesoulad SUMA, různé agregace, půlnoc, oddělené tabulky metadat/dat a posuny −7 / +8 min E. Hodnoty kW se skrytě nekonvertují.

Mobilní profily jsou emulace v Chromiu, nikoli fyzické iPadOS/Safari. Apple Pencil/Scribble a neznámé varianty skutečných Energis exportů vyžadují ověření na cílovém zařízení a souboru; nejednoznačný import se označí k ruční kontrole. STYLUS používá standardní HTML pole bez vlastního OCR a nikdy sám nezapisuje rozpoznaný text do databáze.

## Ověření 1.3.1 – terénní workflow (24. 10. 2026)

- `npm test`: 14 sad, 269 testů prošlo.
- `npm run test:e2e -- --workers=2`: všech 100 scénářů prošlo na Chromium profilech iPhone 13 / iPad (gen 7).
- `npm run build`: TypeScript, produkční Vite build a PWA/service worker prošly; offline precache obsahuje všech 8 souborů včetně lazy XLSX modulu.
- Matematická regrese: ARON, 1f, 3f, VN, U/I/PF ↔ Kyoritsu, Kyoritsu ↔ Energis, Kontrola stavů a MTP v celé unit/E2E sadě. Přesné otisky všech souborů `src/core` odpovídají produkci 1.3.0. Parser Energisu a STYLUS jsou rovněž beze změn.
- IndexedDB zůstává ve verzi 3 bez potřeby změny schématu; testy migrace v1/v2 → v3 zachovávají staré záznamy. Volitelná metadata stavu sledování a hranice Energisu se ukládají do stávajících objektů.
- JSON backup/restore: staré zálohy, úplná historie, doplněné UZLY, ukončené/reaktivované sledování, Energis, opakovaný import bez duplicit a transakční rollback prošly.
- Nové scénáře pokrývají NN/VN dropdowny, MTP a koeficient, explicitní lokální TEĎ, normalizaci 8:32, společné/individuální datum, přeskočenou návštěvu bez posunu historie, reaktivaci z posledního odečtu, společnou historii jednotlivého/sériového odečtu, částečné live hledání, chronologické řazení, kompaktní řádky, UZEL první v detailu a skrytou horní navigaci ve výsledcích.
- Reálný Apple Pencil / Scribble nebyl k dispozici; standardní input/textarea a automatické testy parseru zůstaly zachované.

## Ověření 1.3.2 – seskupení a kancelářské doplnění Energisu (24. 10. 2026)

- `npm test`: všech 278 testů v 15 sadách prošlo.
- `npm run test:e2e -- --workers=2`: všech 106 scénářů prošlo na Chromium profilech iPhone 13 / iPad (gen 7).
- `npm run build`: TypeScript, produkční Vite build i PWA/service worker prošly; offline precache obsahuje všech 8 souborů včetně XLSX modulu.
- Celá matematická regrese ARON, 1f, 3f, VN, U/I/PF ↔ Kyoritsu, Kyoritsu ↔ Energis, Kontrola stavů a MTP prošla. Přesné otisky všech souborů `src/core` odpovídají 1.3.1. Parsery Energisu a STYLUS jsou beze změn.
- IndexedDB migrace v1/v2 → v3 i načtení existujících dat prošly v celé unit/E2E sadě. Verze schématu zůstává 3; nové volitelné údaje využívají existující object stores a nevyžadují destruktivní migraci.
- Seskupení starších dat používá výhradně existující `batchId`; test ověřuje jednu položku pro dva členy a oddělené položky pro různá ID se stejným TS/R.
- E2E scénář TS 4601/251, pole 21 / EM123 a pole 54 / EM234 ověřuje jednu hlavní položku, automatický výběr aktivních vývodů, sticky společné datum, chybějící individuální Nové datum, TEĎ, uložení bez SUMA, správné předchozí stavy a přeskočenou návštěvu bez změny sledování.
- TXT i XLSX import ověřuje UZEL bez závislosti na pořadí řádků, ignorování cizích UZLŮ, přeskočení chybějícího/nejednoznačného UZLU a ochranu uložených i dosud neuložených ručních hodnot.
- Pozdější ruční doplnění SUMA nevytváří odečet, nemění stav, datum/čas, sledování ani vazby A → B → C. Historie EM nadále obsahuje kompletní řetězec.
- Testy času 08:37 ověřují -E → 08:30 → -7 min E a +E → 08:45 → +8 min E, uložení volby k intervalu a její zachování v JSON záloze.
- Backup/restore ověřuje obnovu starší i nové zálohy do prázdné i existující DB, opakovaný import bez duplicit a zachování novější úpravy Energisu při následném importu staré zálohy. Pokus o editaci zastaralého snapshotu je odmítnut.

## Ověření 1.3.3 – kompaktní termíny série (24. 10. 2026)

- `npm test`: všech 279 testů v 16 souborech prošlo.
- `npm run test:e2e`: všech 108 scénářů prošlo na profilech iPhone 13 / iPad (gen 7), proti aktuálnímu produkčnímu buildu.
- `npm run build`: TypeScript, produkční Vite build i PWA/service worker prošly. Všech 8 souborů offline precache existuje; výsledný UI bundle obsahuje verzi 1.3.3. Offline scénáře prošly na obou profilech.
- Nový E2E scénář vytvoří sérii dvou elektroměrů, uloží dvě kola s rozdílnými individuálními časy, obnoví stránku a otevře detail. Ověřuje nepřítomnost vyhledávání a přesný text `23.10.2026 17:33; 26.10.2026 08:36`.
- Unit test přehledu ověřuje chronologii, nejčasnější skutečný čas dne, izolaci série, přeskočené vývody, nezávislost na pořadí záznamů a zachování vstupních dat.
- Všech 27 existujících souborů v `src/core`, `src/data` a podpůrné logice `src/series` (mimo UI komponentu `Series.tsx`) je bajtově shodných s produkční 1.3.2, commit `7e700bb3419c54987b79aff2de2a540d2554ac40`. UI komponenta mění pouze zobrazení vyhledávání/termínů. Matematické a datové regresní testy zůstaly zachovány; očekávaná verze v testu zálohy je aktualizována na 1.3.3.
- Model nemá identifikátor ani timestamp kola. Přehled proto deterministicky používá nejčasnější uložený odečet za každý den série; více kol ve stejný den nelze spolehlivě rozlišit. Nevzniká nový timestamp, schéma ani zápis dat při otevření detailu.

## Ověření 1.3.4 – samostatná odečtová kola (24. 10. 2026)

- `npm test`: 288 testů v 17 souborech prošlo. Nové testy pokrývají samostatná ID dvou kol stejného dne i dvou kol se shodným časem, přeskočený vývod v B a návaznost C na skutečný A, kolo bez nových odečtů a jeho řazení, neplatné vazby a rollback celého kola při zastaralém odečtu.
- IndexedDB 3 → 4 je ověřena přes `createSeriesStore` i `createHistory`. Migrace zachová všechny historické hodnoty, individuální časy, vazby a nesouvisející měření. Starší denní přehled je výslovně označen jako kompatibilní fallback; nevymýšlí návštěvy, které původní data neuměla rozlišit.
- JSON backup/restore verze 3 ověřuje kola, časy, přeskočení a vazby odečtů přes oba persistence adaptéry, opakovaný import bez duplicit, obnovu staré verze 2 a oba směry následného importu staré/nové zálohy. Existující testy zachovávají také podporu verze 1 a ochranu pozdějších úprav Energisu.
- Čas kola 11:00 je uložen odděleně od skutečného 11:19. Testy uloženého intervalu ověřují -E → 11:15 → -4 min E a +E → 11:30 → +11 min E.
- `npm run build`: TypeScript, produkční Vite build a generování PWA/service worker prošly. Ověřena existence všech 8 souborů precache i verze 1.3.4 v UI bundle. Existující upozornění na velikost ExcelJS chunku zůstává.
- Všech 13 souborů `src/core` a 6 chráněných souborů série (`energis.ts`, `energisDisplay.ts`, `stylus.ts`, `EnergisBoundary.tsx`, `SavedEnergis.tsx`, `energisImport.ts`) je bajtově shodných s produkční 1.3.3, SHA `0f7c5db96ed5e58bf7bc95963885066461dcc3be`. Funkce `nextReading` a `intervalValues` jsou také bajtově nezměněné. Stávající numerické regresní testy a kontrola SHA výpočetního jádra prošly.
- Celý `npm run test:e2e -- --workers=2` provedl 114 scénářů pro iPhone 13 / iPad (gen 7): 113 prošlo, jeden starší testovací seed 70 elektroměrů otevřel již upgradovanou DB s pevnou verzí 3 (`VersionError`). Fixture nyní otevírá aktuální DB bez natvrdo zadané verze; její samostatný opakovaný běh na iPhonu prošel (1/1), na iPadu prošla již v celém běhu. Celkem je úspěšně ověřeno všech 114 scénářů. Nové E2E ověřují dvě kola stejného dne, jejich samostatné otevření po reloadu, skutečné časy a hodnoty, SUMA/+E, přeskočené B a návaznost C, nezávislé TEĎ a reálnou migraci IndexedDB v prohlížeči. Offline/PWA, obnova záloh a numerické UI regrese prošly na obou profilech.

## Ověření 1.3.5 – oddělení sérií a samostatných odečtů (24. 10. 2026)

- `npm test`: všech 293 testů v 18 souborech prošlo. Nové testy ověřují dvě série (2 + 4 členové) a jeden skutečně samostatný elektroměr, nezávislé založení jednotlivých odečtů při stejném TS/R a datu, autoritu existujícího `batchId`, neduplikované výsledky a globální vyhledávání.
- Odečet pouze 1 ze 3 členů série zachovává členství, poslední skutečné odečty ostatních a aktivní sledování. JSON záloha zachovává kola, individuální časy, Energis a hranici +E/-E.
- Přidání samostatného elektroměru do série zachovává přesně stejné objekty odečtů, A/B vazby, původní kola, Energis a tracking. Backup/restore je ověřen oběma adaptéry do čisté i existující DB, v obou směrech starší/novější zálohy a při opakovaném importu. Starší záloha nepřepíše novější členství.
- Schéma IndexedDB zůstává ve verzi 4 a backup ve verzi 3. Stávající migrační testy a kompatibilita starších záloh prošly bez přidání migrace. Nová metadata se ukládají do existujících object stores.
- `npm run build` prošel včetně TypeScriptu, produkčního Vite buildu a PWA/service workeru. Ověřena existence všech 8 souborů offline precache a verze 1.3.5 v UI bundle.
- Všech 19 chráněných souborů (13 souborů `src/core` a 6 podpůrných souborů Energisu/STYLUS) je bajtově shodných s 1.3.4 (`fff2428eebf75a4ff71902c0eb9f625ce215c80b`). Funkce `nextReading`, `intervalValues`, `updateEnergis`, `withRounds`, `roundsFor` a `roundLabel` jsou rovněž bajtově nezměněné. Změna validace historického členství nezměnila čas ani výpočet kola. Numerické regrese a test SHA výpočetního jádra prošly.
- Celý `npm run test:e2e -- --workers=2` proti aktuálnímu produkčnímu buildu: **120/120 scénářů prošlo** na profilech iPhone 13 a iPad (gen 7). Nové scénáře ověřují oba oddělené přehledy pro dvě série a jeden samostatný elektroměr, globální vyhledávání, Historie EM z obou sérií, jeden odečet ze tří s opětovnou nabídkou všech aktivních členů, přidání samostatného elektroměru bez změny ID/odečtů a jeho obnovu ze zálohy. Prošly také dřívější scénáře časů kol, reálné migrace IndexedDB, offline/PWA, backup/restore a matematických UI regresí.

## Ověření 1.3.6 – měřicí workflow a ← Zpět (24. 10. 2026)

- `npm test`: všech 295 testů v 19 souborech prošlo. Nové unit testy ověřují nezapisující vloženou Kontrolu stavů a jednotné lokální tlačítko typu `button`.
- `npm run build`: TypeScript, produkční Vite build a PWA/service worker prošly. Ověřena existence všech 8 souborů offline precache a verze 1.3.6 v UI bundle.
- 26 souborů výpočetního jádra, datové vrstvy a podpůrné odečtové logiky je bajtově shodných s produkční 1.3.5 (`b319446635705c48951cb3687df57dbf351bd39c`). Výstupní funkce `IntervalResult`, `usedEnergisBoundary`, `renderResult` a adaptér `validateInterval` jsou rovněž beze změny. Přenos `startKyoritsu`, výpočty a tolerance nebyly upraveny; koordinátor pouze obnovuje rozpracovaný krok při lokálním návratu.
- IndexedDB zůstává ve verzi 4, JSON backup ve verzi 3. Stávající unit testy migrace a obou adaptérů backup/restore prošly. Staré samostatné Kontroly stavů jsou v kompatibilitních E2E testech výslovně vytvářeny jako archivní fixture přes nezměněný produkční výpočet; nová hlavní karta je již nevytváří. Původní testy čitelnosti, výstupní přesnosti, archivních intervalů, offline obnovy a záloh tak zůstávají zachované.
- Celý `npm run test:e2e -- --workers=2` proti aktuálnímu produkčnímu buildu: **128/128 scénářů prošlo** na profilech iPhone 13 a iPad (gen 7). Nové scénáře ověřují jedinou návaznost kontroly na Kyoritsu, zachování přeneseného výsledku a identifikace, žádný zápis nedokončeného hlavního workflow, jediný společný záznam v MĚŘENÍ po dokončení, povolené ukládání jednotlivých/sériových odečtů, lokální návraty z výsledku/EM/kola/pokračování, obnovení rozepsaného kola a SUMA/+E, návrat ze STYLUS náhledu a 1f výsledku. Ověřen je i návrat do vlastního Kyoritsu formuláře při vypnutém přenosu identifikace. V celé sadě prošly numerické regrese, starší i nové zálohy, reálná IndexedDB migrace a offline/PWA scénáře.

## Ověření 1.3.7 – prezentační varování Kyoritsu ↔ Energis (24. 10. 2026)

- `npm test`: 303/303 testů ve 20 souborech prošlo. Nové prezentační testy pokrývají 4,9 %, přesně +5 % a −5 %, 5,01 %, −5,8 % a interní 5,0001 %, které se zobrazí jako 5 %, ale správně varuje. Render nemění vstupní záznam. Test odstraněného banneru nadále ověřuje původní fyzikální nesoulad a jeho číselné hodnoty.
- `npm run build`: TypeScript, produkční Vite build a PWA/service worker prošly. Ověřeno všech 8 souborů offline precache a verze 1.3.7 v UI bundle.
- Cílený E2E běh pro novou prezentaci a existující fyzikální ARON regrese: 20/20 scénářů prošlo na profilech iPhone 13 / iPad (gen 7). Nové testy kontrolují skutečnou barvu a šířku rámečku, tučnost, vykřičník, hraniční hodnoty a nezávislý výsledek fyzikální kontroly. Příklad 1,38 kW / 1,30 kW je ověřen i po uložení do historie; formátování zachovává −5,797 %.
- Všech 43 TypeScript souborů mimo dvě změněné prezentační komponenty je bajtově shodných s produkční 1.3.6 (`eebd183b8965d6d33f05537bf1b0b11e15145893`). To zahrnuje celé výpočetní jádro, Kyoritsu ↔ Energis procenta, U/I/PF, MTP, 1f/3f, ARON, VN, Kontrolu stavů, diagnostiku, tolerance, datovou vrstvu a odečtovou logiku. Funkce `PowerConsistencyResult` a následující výstupní komponenty jsou rovněž bajtově nezměněné. Pravidlo ±5 % je pouze styl řádku, nikoli změna výpočtu nebo diagnostického pásma.
- Celý `npm run test:e2e -- --workers=2` proti aktuálnímu produkčnímu buildu: **142/142 scénářů prošlo** na profilech iPhone 13 / iPad (gen 7). Ověřeny jsou všechny požadované hraniční případy, nepřítomnost starého banneru v živém i uloženém výsledku, současná fyzikální shoda a červený řádek Kyoritsu ↔ Energis, příklad Elektroměr ↔ Energis −1 % bez tohoto zvýraznění, stejně jako stávající numerické, offline/PWA, migrační a backup/restore regrese.

## Ověření 1.3.8 – jednotná navigace odečtů (24. 10. 2026)

- `npm test`: 303/303 testů ve 20 souborech prošlo, včetně numerických regresí, zmrazeného výpočetního jádra, migrací, odečtových kol a backup/restore.
- `npm run build`: TypeScript, produkční Vite build i PWA/service worker prošly. Ověřeno všech 8 souborů offline precache a verze 1.3.8 v UI bundle.
- 43 ostatních TypeScript souborů je bajtově shodných s produkční 1.3.7 (`3a033d04213c1452909930b3f75ca2414042b31e`). `Series.tsx` je mimo import a JSX navigace rovněž bajtově shodný. Výpočty měření, MTP, 1f/3f, ARON, VN, Kyoritsu, Kontrola stavů, Energis, +E/-E, odečtová logika, kola, historie, Stylus parser, IndexedDB a backup/restore nebyly změněny. V `App.tsx` se mění pouze navigace a možnost otevřít její čtvrtou položku historie.
- Nový E2E scénář postupně ověřuje všechny čtyři položky, právě jednu navigační řadu, právě jednu aktivní položku s `aria-pressed`, otevření příslušných obrazovek, zachování rozepsaného odečtu, nezměněnou adresu, dostupné ← Zpět, rozložení bez přetékání a skrytí pracovní navigace ve Výsledcích měření při zachování globální spodní navigace. Existující testy používají sjednocené popisky, jejich původní kontroly zůstávají zachované.
- Celý `npm run test:e2e -- --workers=2` proti aktuálnímu produkčnímu buildu: **144/144 scénářů prošlo** na profilech iPhone 13 / iPad (gen 7). Prošel nový navigační scénář na obou šířkách i všechny stávající matematické, odečtové, historické, import/export, backup/restore a offline/PWA regrese.
