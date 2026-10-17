# Ověření této pracovní kopie

- `npm test`: 75 testů, fyzikální a exportní jádro včetně 23 nových kontrol ARON a informačního koeficientu, barvy v renderovaném UI všech 48 scénářů, úložiště IndexedDB a nezávislost záznamů.
- `npm run build`: TypeScript, Vite, precache úplné aplikace (HTML, JS, CSS, manifest a PNG ikony). Bez vzdálených fontů nebo knihoven načítaných při provozu.
- `npm run test:e2e`: 8 testů (4 pracovní scénáře na každém ze dvou zařízení). Chromium, emulace iPhone 13 a iPad 7. generace. Kontrola vodorovného přetékání hlavních obrazovek.
- Offline test skutečně vypne síť v kontextu prohlížeče, znovu načte stránku, otevře uloženou historii a provede a uloží nové měření.
- Referenční vstup 9,20 / 9,17 kW: rozdíl −0,3260869 %, MĚŘENÍ V POŘÁDKU, žádné chybové varianty.
- `npm audit --omit=dev --audit-level=high`: žádná nalezená zranitelnost produkčních závislostí v době kontroly.

WebKit nebyl spuštěn: stažení enginu blokuje síťová politika odpovědí 403 „Domain forbidden“ pro `cdn.playwright.dev` a `playwright.download.prss.microsoft.com`. Chromium emulace nenahrazuje fyzický iOS test. Nativní instalace z HTTPS a přímé otevření výchozí iOS poštovní aplikace zatím nebyly ověřeny na zařízení. Testy ověřují obsah mailto a ruční fallback; skutečné doručení zprávy aplikace neřídí.

Workflow GitHub Pages je připraven, ale nebyl v této relaci spuštěn. Publikace webu je oddělená od commitu/pushe zdrojových souborů; tato kontrola nepotvrzuje veřejné nasazení. Fyzikální předpoklady a konkrétní informaci, kterou je nutné potvrdit pro typ elektroměru, uvádí `docs/physics.md`.
