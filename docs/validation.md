# Ověření Promptu 1

- `npm test`: 103 testů v pěti souborech. Zachované 400 V / ARON modely a C1 barvy; nové převody 8112 všech rozsahů, mV/V, čárka/tečka, příklady MTP 300/5 a 300/1, podepsaná procenta, hranice 15/25 %, oddělené NN/VN nabídky, validace a doplňkové napětí.
- `npm run build`: TypeScript, Vite a precache kompletní offline aplikace. Verze 1.2.0 a datum buildu jsou dostupné v nápovědě.
- `npm run test:e2e`: 12 scénářů, šest na každém zařízení (Chromium emulace iPhone 13 a iPad 7. generace). Původní 3f pracovní tok, automatický ARON, informační MTP, historie, intervaly, mazání, NN/VN proudy, napětí, export, Web Share API a fallback, reload a offline reload.
- Migrační testy vytvoří skutečnou v1 IndexedDB, uloží starý záznam, zavřou spojení a nechají aplikaci otevřít v2. Původní objekt zůstane beze změny. E2E kontroluje starý záznam i po offline reloadu. Další unit test ověřuje reprodukci proudového záznamu z uložených původních vstupů.
- Offline E2E čeká na potvrzené dokončení zápisu (vyčištění čísla elektroměru po `tx.done`), nikoli jen dokončení kliknutí. Odstraňuje závod původního iPhone testu, který mohl obnovit stránku během asynchronní transakce. Databáze se při upgradu nemaže; `clear()` se používá výhradně pro explicitní uživatelské mazání historie.
- Systémové sdílení se ověřuje přes stub Web Share API pro soubor i text a přes nepodporovaný fallback. Stažení TSV zálohy je skutečná browser download událost. Smíšená záloha má stejný počet sloupců na všech řádcích, identifikace lokality a umístění je oddělená.

Mobilní emulace Chromium neověřuje nativní Safari ani fyzický iPhone/iPad. Dostupné aplikace v share sheetu určuje operační systém. Testy ověřují předaná data a fallback, nikoli doručení e-mailu, AirDrop přenos nebo fyzické zapojení měřidel.

Energetická kalkulačka a veřejné ceníky nejsou součástí Promptu 1. Dosavadní intervalová kontrola měřidla zůstává zachovaná.
