# Kontrola měření elektroměrů a vývodů

Česká mobile-first aplikace v Reactu a TypeScriptu. Samostatná PWA pro iPhone na výšku a iPad: výpočty, rozpracovaný formulář a historie jsou lokální. Nevyžaduje backend, účet ani API klíče.

## Spuštění

Node.js 24 a npm (verze je připnutá v `.nvmrc`; závislosti v `package-lock.json`).

```sh
npm ci
npm run dev
```

Vývojový server vypíše adresu. Pro produkční aplikaci včetně offline režimu:

```sh
npm run build
npm run preview
```

Vývojový režim záměrně neregistruje service worker. `build` provede TypeScript kontrolu, vytvoří `dist/` a vygeneruje service worker s úplným seznamem souborů. Ke spuštění lze použít kterýkoli statický HTTPS server; není potřeba serverová aplikace. Cesty podporují i podadresář repozitáře na GitHub Pages.

## Otevření a instalace na iPhone / iPad

1. Publikujte obsah `dist/` na statický **HTTPS** hosting. Pro GitHub Pages je připraven ručně spouštěný workflow `.github/workflows/pages.yml`: po nahrání změn zapněte v repozitáři **Settings → Pages → Source: GitHub Actions** a v **Actions → Publish PWA to GitHub Pages → Run workflow** spusťte publikaci. Výslednou adresu poskytne GitHub v dokončeném workflow.
2. Otevřete publikovanou HTTPS adresu v Safari. Při prvním připojení počkejte na „Offline připraveno“.
3. V nabídce sdílení **Safari** zvolte **Přidat na plochu**. Spusťte aplikaci z ikony. Nabídka Safari je potřeba jen k instalaci; sdílení naměřených dat v aplikaci používá výhradně e-mail.
4. Vyzkoušejte opětovné otevření v režimu letadlo před odjezdem do terénu.

HTTP adresa počítače v místní síti umožní prohlédnout rozhraní, ale Safari na ní nepovolí plnohodnotné PWA/offline funkce. Pro provoz na telefonu je nutné HTTPS. Lokální `localhost` na vývojovém počítači je výjimka pro testy. Aplikace zatím nebyla z této pracovní kopie veřejně nasazena ani otestována na fyzickém iOS zařízení.

## Pracovní tok

1. **Základ / pulz:** povinné výrobní číslo jako řetězec, převody MTP, napětí, váhy pulzu; volitelná kontrola stavů se shodným intervalem Energis.
2. **Napětí a proudy:** U1–U3 a I1–I3, každá fyzická fáze vlastní pevnou barvou.
3. **PF a výkony:** znaménkové PF a P po fázích, celkové Kyoritsu a trend Energis. Tlačítka ± pomáhají na číselné klávesnici iPhonu.
4. **Vizuální výsledek:** při 400 V původní tříproudový model (48 scénářů); při 500 V automaticky ARON (8 scénářů dvou wattmetrových členů). Přímá tolerance ±15 %, mimo toleranci hlavní model a nejvýše jedna alternativa do 5 procentních bodů shody. Čísla modelu zůstávají v detailu.
5. **Co prověřit:** interní pokyny na elektroměru, terminologie k/l.
6. **Detail:** skutečná data, model, všech 48 scénářů a předpoklady.
7. **Výsledky měření:** samostatná hlavní záložka s historií, plným uloženým záznamem, výběrem, e-mailem a TSV.

**ULOŽIT MĚŘENÍ** nejprve dokončí transakci IndexedDB, poté vyčistí údaje konkrétního měření a připraví nový elektroměr. Zachovává provozní nastavení MTP/napětí/pulzů. Při selhání zápisu vstupy zůstanou. Historie obsahuje nezávislé kopie vstupů i tehdejší diagnostiky s verzí modelu; nová měření stará nepřepočítávají.

## Export a ochrana dat

E-mail a TSV obsahují pouze 16 povolených sloupců naměřených dat; nikdy diagnostiku, modelové skóre ani pracovní pokyny. Sloupce jsou centrálně v `src/data/export.ts`. TSV nemá hlavičku, používá skutečné tabulátory a jeden řádek na měření. Pro zachování počátečních nul předformátujte první sloupec Excelu jako **Text**; aplikace číslo nikdy nepřevádí na číslo.

`mailto:` otevře výchozí poštu bez příjemce. U delších výběrů (URL nad 1800 znaků) aplikace nabídne naměřený text ke zkopírování a otevření pošty. Ruční fallback je dostupný i při chybějícím klientovi nebo schránce. Aplikace neodesílá e-mail sama, negarantuje doručení, nepoužívá obecný iOS share sheet ani vlastní mailserver.

Data jsou v IndexedDB pouze v daném prohlížeči/originu. Rozpracované vstupy se průběžně ukládají do localStorage. Vymazání webových dat, odinstalace, soukromé prohlížení nebo zásah správy úložiště iOS mohou lokální data odstranit. Aplikace žádá o persistentní úložiště, pokud jej prohlížeč podporuje; pravidelný export je přesto nutný. Změna domény znamená jiné úložiště. Mazání jednotlivého záznamu vyžaduje potvrzení; celá historie navíc opsání **SMAZAT**.

## Fyzika a hranice modelu

Podrobná konvence, předpoklady registru, nulové vstupy a místa pro budoucí rozšíření jsou v [docs/physics.md](docs/physics.md). Při 400 V zůstává původní vyzkratování větve jako 0 kW; k/l se v tomto modelu nezaměňuje s negací výkonu. Samostatný ARON při 500 V naopak fyzikálně obrací znaménko příslušného wattmetrového členu při opačné polaritě k/l. Ani jeden model nepředpokládá stejné zatížení fází. Bluetooth se bez potvrzeného protokolu KEW 6305 neimplementuje.

## Testy

```sh
npm test
npm run build
npx playwright install chromium
npm run test:e2e
```

Na Linuxu s existujícím `/usr/bin/chromium` jej testy použijí přímo. Jinak použijí prohlížeč nainstalovaný Playwrightem. Lze nastavit `PLAYWRIGHT_CHROMIUM_EXECUTABLE` na vlastní cestu. Pro instalaci závislostí prohlížeče na čistém Linuxu použijte `npx playwright install --with-deps chromium`.

Unit testy ověřují fyziku, hranice tolerance, 6 × 8 scénářů, kombinované chyby, znaménka PF/P, barvy C1, MTP, pulzy, výrobní číslo, čas na sekundy, nezávislou historii IndexedDB, reset až po úspěšném zápisu a povolený export. Prohlížečové testy ověřují pracovní tok, rozměry iPhone/iPad, historii po reloadu, výběr/export, potvrzení mazání a nové měření po offline reloadu. Mobilní emulace v Chromium neprokazuje chování fyzického iPhonu; nativní instalaci a předání do iOS pošty je třeba ověřit na zařízení.

## Struktura

```text
src/core/       typy, konfigurace, čisté výpočty a diagnostika
src/data/       IndexedDB a výslovný seznam polí pro export/e-mail
src/ui/         vstupy, výsledky, historie a sdílení
src/App.tsx     průchod obrazovkami a stav rozpracovaného měření
public/         manifest a lokální PNG ikony
scripts/        generování offline cache z produkčního sestavení
tests/          unit testy a testy úložiště
e2e/            reálné prohlížečové scénáře
```

Informační **Korekční koeficient** na úvodní kartě zobrazuje `MTP primár / MTP elektroměr` na tři desetinná místa. Je pouze vizuální, nepřidává se do záznamu a neškáluje diagnostiku nebo export. Existující volitelná intervalová korekce MTP zůstává beze změny.

Režim se pro nové měření vybírá pouze napětím: **400 V → tříproudový**, **500 V → ARON**. Kyoritsu stále zadává a ukládá všechny tři U/I/PF/P. Výsledková ARON tabulka má prostřední šedé pole pouze „ARON“; nejde o chybějící ani vyzkratovanou L2. Nové záznamy nesou režim a verzi modelu 1.1.0. Staré záznamy bez režimu zůstávají ve své původní interpretaci, včetně dříve uložených 500 V měření; historie se zpětně nepřepočítává.

Centrální konstanty: `CONFIG.alternativeMaxScoreGap`, `CONFIG.tolerancePercent`, `PHASE_COLORS`, `PULSE_OPTIONS`. Fyzické barvy nejsou nikdy odvozené z cílové napěťové pozice. Připravený volitelný `currentAngleDegrees` umožňuje budoucí skutečný úhel z přístroje. Další importní adaptér, PDF nebo typ měřáku lze přidat bez přesunu matematiky do UI.
