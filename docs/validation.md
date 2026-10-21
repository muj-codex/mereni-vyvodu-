# Ověření verze 1.2.2

- `npm test`: **163 prošlých testů**; unit/regresní testy matematiky, vstupů, ARON, rozsahů, vlastní MTP, VN, diagnostiky, TSV a IndexedDB.
- `npm run test:e2e`: **42 prošlých scénářů** (21 pro každý viewport); scénáře v Chromium s viewporty iPhone 13 a iPad 7. generace. Běžné 3f, ARON bez IL2, závada IL3, napětí u 500 V, VN, historie tabs, navigace, změna rozsahu, systémové sdílení a mailto s TSV tělem.
- Nová Kontrola stavů: korekce 300/600 = 0,500 a 20 kWh → 10 kWh; samostatný snapshot a uložení bez Kyoritsu, bez vah pulzu i odhadu. Konzervativní vyhodnocení 15/25 %, tři rozdílné záložky detailu.
- Export: nejvýše tři desetinná místa v UI i TSV, procenta TSV přesně dvě, PF zachovává až tři. Systémové sdílení samostatné kontroly obsahuje pouze čistý TSV text bez souborů; fallback funguje i při nedostupné schránce.
- Filtry: TS, rozvodna, všechna napětí, kombinace i zrušení filtru. Žádný implicitní filtr na dnešek; filtry nepřepisují objekty.
- Dlouhodobá historie: skutečné uzavření persistentního browser contextu D1 a znovuotevření stejného profilu D2, oba záznamy od nejnovějšího.
- Migrace: starý záznam ve schématu DB v1 přežije upgrade, přidání nového 1f záznamu / samostatné Kontroly stavů a offline reload. Unit test navíc reprodukuje neviditelnost starého záznamu bez indexovaného `savedAt` a ověřuje opravené čtení všech objektů.
- Uložení se potvrzuje až po `tx.done`, selhání neruší rozepsané vstupy. Název DB/store ani verze 2 se nemění. Žádný reset historie při startu či migraci. Hromadné mazání pouze výslovným potvrzením uživatele.
- `npm run build`: TypeScript, Vite a kompletní precache offline aplikace. Verze a aktuální datum buildu jsou v nápovědě.

Podrobné zjištění příčiny a omezení jsou v [PROMPT_1_1.md](PROMPT_1_1.md).
Mobilní emulace Chromium není nativní Safari. Test předání `mailto` ověřuje
neprázdné TSV tělo v URL skutečně vyvolané tlačítkem; neověřuje doručení e-mailu
nebo chování externího poštovního klienta. Historie na konkrétním dotčeném
zařízení nebyla dostupná, proto příčina jeho incidentu zůstává nepotvrzená.

Ověřeno 21. 10. 2026. Snímky iPhone/iPad ověřují původní pracovní tok i novou kartu Kontroly stavů. Filtry na úzké obrazovce přecházejí do jednoho sloupce. Původní pulzní pole starého v1 objektu se po uložení nového typu ani reloadu nemění. Databázový kód nebyl pro verzi 1.2.2 změněn.
