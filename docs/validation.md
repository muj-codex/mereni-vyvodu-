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
