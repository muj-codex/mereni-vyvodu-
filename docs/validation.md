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
