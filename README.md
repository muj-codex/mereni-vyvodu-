# Kontrola měření elektroměrů a vývodů

Česká mobile-first aplikace v Reactu a TypeScriptu. Samostatná PWA pro iPhone na výšku a iPad: výpočty, rozpracovaný formulář a historie jsou lokální. Nevyžaduje backend, účet ani API klíče.

## Verze 1.2.7 – fyzikální kontrola výkonu Kyoritsu

Před celkovým verdiktem se nezávisle kontroluje výkon z U/I/|PF| proti zadaným kW každé aktivní větve i celku. ARON používá pouze větve 1 a 3: `P1 = U1 × I1 × |PF1| / 1000`, `P3 = U3 × I3 × |PF3| / 1000`. U1/U3 a PF1/PF3 musí patřit odpovídajícím Aronovým výkonovým větvím. Znaménko PF zůstává nezávislé na znaménku P; směr při součtu určuje P.

NN 400 V vyžaduje výslovnou volbu typu zadaných napětí: skutečná fázová napětí se použijí přímo, sdružená napětí pouze pro symetrickou soustavu s dělením √3. Neurčená topologie ani neplatné vstupy nevytvoří zelený verdikt. Stávající 1f/VN workflow měří proudy a případně napětí; bez PF a činného výkonu se tato kontrola nepřidává.

Rozdíl do 15 % odpovídá, nad 15 % do 25 % vyžaduje ověření, nad 25 % znamená významný nesoulad. Při nesouladu se zobrazí **OVĚŘIT HODNOTY KYORITSU**, výpočet, zadání, procenta a doporučení zkontrolovat hodnoty bez určování konkrétní závady zapojení. Kontrolují se i větve, jejichž chyby se mohou v součtu vyrušit.

Výsledek je součástí uložené diagnostiky, IndexedDB a JSON zálohy/importu; starší záznamy se otevírají s původními uloženými výsledky. Export/share přidává stav, výpočet, zadání a odchylky s procenty na dvě desetinná místa. Porovnání Kyoritsu ↔ Energis i Elektroměr ↔ Energis zůstává zachováno; odstraněný řádek Elektroměr ↔ Kyoritsu se do UI nevrací.

## Verze 1.2.6 – zjednodušení porovnání

Sekce **Porovnání** zobrazuje pouze Elektroměr ↔ Energis a Kyoritsu ↔ Energis. Řádek Elektroměr ↔ Kyoritsu a jeho vysvětlení byly odstraněny z UI; výpočty, přenesená Kontrola stavů, export a starší uložené záznamy zůstávají beze změny.

## Verze 1.2.5 – stabilizace měření a obnovitelná historie

**MĚŘENÍ KYORITSU** pokračuje bez kontroly stavů. **Použít kontrolu stavů a pokračovat** připojí neměnný snapshot kontroly včetně intervalu, korekce MTP, obou spotřeb, rozdílu a vyhodnocení. Souhrn je na kartách Kyoritsu; oba zdroje se společně uloží a otevřou z historie. Detail obsahuje také původní stavy a převody.

Sekce **Porovnání** uvádí elektroměr ↔ Energis (spotřeby za shodný interval, původní znaménko) a Kyoritsu ↔ Energis (existující okamžité výkony). Elektroměr ↔ Kyoritsu uvádí nedostupnost: intervalové kWh nelze korektně porovnat s okamžitými kW bez souběžných dat. Nevytváříme odhad výkonu ani nový verdikt o chybě. UI používá nejvýše tři desetinná místa, procentní export dvě; JSON zachovává plnou přesnost.

**ZÁLOHOVAT DATA** vytvoří `mereni-zaloha.json` s celou historií všech typů, vstupy, výsledky, vazbami a metadaty `backupVersion`, `appVersion`, `exportedAt` i verzí DB schématu. Na podporovaném iOS/iPadOS otevře systémové sdílení souboru, kde lze zvolit **Uložit do Souborů** a libovolné dostupné umístění (například iCloud Drive). Jinak nabídne běžné stažení. Nejde o TSV pro Excel; sdílení naměřených hodnot a kopírování TSV zůstává samostatně dostupné.

**IMPORTOVAT / OBNOVIT DATA** otevře výběr JSON souboru. Nejdříve proběhne validace a náhled počtu nových a již existujících záznamů. Teprve po **IMPORTOVAT** proběhne atomické doplnění chybějících dat. Existující ID se nepřepisují; starší záznamy bez ID se porovnávají podle úplného obsahu měření včetně času, vstupů a výsledku. Více měření jednoho elektroměru zůstane zachováno. Neplatný JSON, neznámý `backupVersion` nebo nepodporovaný záznam se odmítnou před zápisem. TSV není obnovitelná JSON záloha.

Běžná aktualizace stejné HTTPS adresy zachovává manifest `id`, `scope`, `start_url`, databázi **mereni-vyvodu-v1**, store **measurements** a schéma **2**. Verze aplikace není verzí databáze. Existující migrace 1 → 2 nic nemaže; nový balík změnu schématu nepotřebuje. Service worker kontroluje aktualizaci při spuštění i návratu do aplikace a mění pouze vlastní buildovou cache. **Při aktualizaci použijte stávající ikonu; nová instalace ani import historie nejsou potřeba.**

Regresní testy pokrývají migraci, všechny typy historie, opakovaný i souběžný import, částečné sloučení a poškozené zálohy. E2E scénáře ověřují propojené měření po reloadu, přenos zálohy do čistého prohlížečového kontextu a skutečnou výměnu service workeru/cache se zachováním IndexedDB. iPhone/iPad jsou emulované v Chromium; ověření nativního dialogu Souborů na fyzickém iOS zařízení je nadále ruční.

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
3. V nabídce sdílení **Safari** zvolte **Přidat na plochu**. Spusťte aplikaci z ikony. Nabídka Safari je potřeba jen k instalaci; sdílení naměřených dat v aplikaci používá systémové Web Share API s textovým/e-mailovým fallbackem.
4. Vyzkoušejte opětovné otevření v režimu letadlo před odjezdem do terénu.

HTTP adresa počítače v místní síti umožní prohlédnout rozhraní, ale Safari na ní nepovolí plnohodnotné PWA/offline funkce. Pro provoz na telefonu je nutné HTTPS. Lokální `localhost` na vývojovém počítači je výjimka pro testy. Aplikace zatím nebyla z této pracovní kopie veřejně nasazena ani otestována na fyzickém iOS zařízení.

## Pracovní tok

1. **Základ / kontrola stavů:** společná identifikace, převody MTP a napětí; volitelná samostatná kontrola spotřeby za shodný interval Energis bez vah pulzu.
2. **Napětí a proudy:** U1–U3 a I1–I3, každá fyzická fáze vlastní pevnou barvou.
3. **PF a výkony:** znaménkové PF a P po fázích, celkové Kyoritsu a trend Energis. Tlačítka ± pomáhají na číselné klávesnici iPhonu.
4. **Vizuální výsledek:** při 400 V původní tříproudový model (48 scénářů); při 500 V automaticky ARON (8 scénářů dvou wattmetrových členů). Přímá tolerance ±15 %, mimo toleranci upozornění na souběžnost a možné příčiny, bez jistého verdiktu o zapojení. Čísla modelu zůstávají v detailu.
5. **Co prověřit:** interní pokyny na elektroměru, terminologie k/l.
6. **Detail:** skutečná data, model, všech 48 scénářů a předpoklady.
7. **Výsledky měření:** samostatná hlavní záložka s historií, plným uloženým záznamem, výběrem, e-mailem a TSV.

**ULOŽIT MĚŘENÍ** nejprve dokončí transakci IndexedDB, poté vyčistí údaje konkrétního měření a připraví nový elektroměr. Zachovává provozní nastavení MTP/napětí. Při selhání zápisu vstupy zůstanou. Historie obsahuje nezávislé kopie vstupů i tehdejší diagnostiky s verzí modelu; nová měření stará nepřepočítávají.

## Export a ochrana dat

E-mail a TSV obsahují naměřené hodnoty, společnou identifikaci a podepsané procentní rozdíly; neobsahují modelové scénáře, skóre ani pracovní pokyny. Sloupce jsou centrálně v `src/data/export.ts`. TSV nemá hlavičku, používá skutečné tabulátory a jeden řádek na měření. Pro zachování počátečních nul předformátujte sloupec čísla elektroměru v Excelu jako **Text**; aplikace číslo nikdy nepřevádí na číslo.

`mailto:` otevře výchozí poštu bez příjemce. Tělo tvoří pouze čisté TSV, bez úvodu a bez přílohy; i fallback odkaz obsahuje stejné neprázdné tělo. Ruční fallback je dostupný i při chybějícím klientovi nebo schránce. Aplikace neodesílá e-mail sama, negarantuje doručení, používá systémové sdílení tam, kde ho prohlížeč podporuje, a nemá vlastní mailserver.

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

Informační **Korekční koeficient** na úvodní kartě zobrazuje `MTP primár / MTP elektroměr` na tři desetinná místa. V kontrole stavů skutečně násobí rozdíl registru; ukládá se do jejího snapshotu a TSV. Okamžité 3f/1f měření tímto koeficientem neškálujeme.

Režim se pro nové měření vybírá pouze napětím: **400 V → tříproudový**, **500 V → ARON**. U 500 V se proudová IL2 nezadává ani nevyhodnocuje; primární napětí zůstává dostupné. Výsledková ARON tabulka má prostřední šedé pole pouze „ARON“; nejde o chybějící ani vyzkratovanou L2. Nové záznamy nesou režim a verzi modelu 1.1.1. Staré záznamy bez režimu zůstávají ve své původní interpretaci, včetně dříve uložených 500 V měření; historie se zpětně nepřepočítává.

Centrální konstanty: `CONFIG.alternativeMaxScoreGap`, `CONFIG.tolerancePercent`, `PHASE_COLORS`, `PULSE_OPTIONS`. Fyzické barvy nejsou nikdy odvozené z cílové napěťové pozice. Připravený volitelný `currentAngleDegrees` umožňuje budoucí skutečný úhel z přístroje. Další importní adaptér, PDF nebo typ měřáku lze přidat bez přesunu matematiky do UI.

## Prompt 1.1 – proudová diagnostika NN / VN (aplikace 1.2.1)

Hlavní přepínač nabízí **MĚŘENÍ** a připravovaný **VÝPOČET SPOTŘEBY A SAZEB**, zatím bez kalkulačky. V měření jsou karty **3f měření** a **1f měření**. Společná identifikace na 3f kartě obsahuje datum, textové číslo elektroměru, lokalitu, pole/umístění a režim sítě. Na 1f je pouze její needitovatelný souhrn, nezávislý na vyplnění pulzů nebo dokončení 3f výpočtu. Čas vyhodnocení se ukládá na sekundy. NN nabízí jen trafostanice a MTP /5 A, VN jen rozvodny a MTP /1 A; proudová reference VN pochází ze SCADA.

Kyoritsu MODEL 8112 má pevné rozsahy 200 mA, 2 A a 20 A (1, 10 a 100 mA na mV). Multimetr přijímá mV i V, čárku i tečku. Výsledek každé fáze obsahuje očekávaný a skutečný sekundár v mA/A, přepočtený primár a podepsaný rozdíl. Nulová reference vrací neurčené procento. Proudový režim nikdy nepočítá činný výkon.

Volitelné napětí pracuje mezi fázemi. Sekundár má editovatelný výchozí stav 100 V a zaznamenává ruční změny. VN primár je ze SCADA (6 / 6,3 / 10 / 10,3 kV, pouze podle společné identifikace). Při podobných hodnotách aplikace neurčuje pořadí větví. Návrh přiřazení vyžaduje rozlišené normalizované hodnoty, malou chybu a odstup od další varianty; nezaručuje fyzické zapojení.

3f procento je `(Energis − Kyoritsu) / Kyoritsu × 100`. Pracovní karta rozlišuje ≤15 %, mezizónu do 25 % a větší odchylky; historie má jako hlavní výsledek skutečná procenta. Informační koeficient MTP zůstává mimo tyto výpočty i export.

IndexedDB používá stejný název a store jako původní aplikace. Upgrade z v1 na v2 ponechá všechny existující objekty beze změny. Nový proudový typ ukládá původní vstupy, jednotky, rozsah, zdroj a odvozené hodnoty; staré 3f záznamy zůstávají čitelné i bez nové identifikace.

**ZÁLOHOVAT HISTORII** stáhne TSV s hlavičkou a jednotnými sloupci pro smíšenou historii. **KOPÍROVAT PRO EXCEL** kopíruje řádky podle typu měření bez hlavičky. Centrální definice sloupců jsou v `src/data/export.ts`. TS/R a umístění jsou vždy samostatné buňky. Systémové sdílení nabídne soubor TSV, pokud ho prohlížeč podporuje, jinak text; při nepodporovaném sdílení zůstává ruční kopírování a e-mail. Verze aplikace a čas buildu jsou v nápovědě.

Offline E2E čeká po kliknutí na uložení na potvrzený reset: u 3f návrat na kartu identifikace, u 1f odstranění tlačítka uložení po dokončení IndexedDB transakce. Samotné dokončení kliknutí nečeká na asynchronní handler a dříve dovolovalo reload během zápisu. Testy neobsahují pevná časová čekání.

Podrobnosti oprav persistence a meze určení příčiny terénního incidentu jsou v [docs/PROMPT_1_1.md](docs/PROMPT_1_1.md).

## Verze 1.2.2 – samostatná Kontrola stavů

Na první straně lze kontrolu stavů uložit bez pokračování ke Kyoritsu nebo odeslat pouze tuto kontrolu jako čisté TSV v těle systémového sdílení, bez přílohy. Bez sdílení se TSV zkopíruje; při nedostupné schránce se zobrazí text pro ruční kopírování. Výpočet používá `(stav DO − stav OD) × MTP skutečný / MTP elektroměr`. Například 20 kWh × 300/600 = 10 kWh. Váhy ani odhad pulzů se nezadávají a nejsou součástí nového typu záznamu.

Historie zobrazuje všechny dny od nejnovějších a rozlišuje 3f, 1f a Kontrolu stavů. Filtry umístění a napětí lze kombinovat a zrušit; pouze mění zobrazení. Výsledek / Prověřit / Data-detail mají vlastní obsah. DB zůstává ve schématu v2 bez přepisu uložených objektů, včetně starých pulzních polí.

Výstupy používají centrální formátování s nejvýše třemi desetinnými místy, procenta TSV/e-mailu přesně dvě. Interní výpočty a uložená čísla se nezaokrouhlují. 1f diagnostika nezmiňuje Energis; ARON používá pouze IL1 (1–3) a IL3 (7–9). Sazby zůstávají připravený placeholder.

## Verze 1.2.3 – navazující měření

Na první kartě je standardně zapnuté „Použít tuto identifikaci i pro následující měření“. Do 1f/3f se přenáší pouze výrobní číslo, identifikační datum, TS/rozvodna, umístění, režim sítě a odpovídající MTP. Převzatou hlavičku ukazuje informační souhrn. Při vypnutí lze navazující měření identifikovat samostatně.

Kontrola stavů má samostatné editovatelné datum a čas OD/DO; podporuje vícedenní interval a odmítá DO před OD. Časy se nikdy nevyplňují aktuálním časem. Po potvrzeném uložení zůstávají identifikace a oba datumy, časy a pracovní hodnoty se vyčistí. Stejně se po uložení 1f/3f zachovají hlavička a konfigurace a vyčistí odečty i výsledky. Při neúspěšné validaci nebo zápisu zůstávají vstupy zachované. Krátké informace ⓘ vysvětlují přenos i ukládání.

Sdílení aktuální nebo jedné uložené kontroly předává `title` s výrobním číslem a TS/rozvodnou, bez přílohy, se stávajícím TSV v těle. Předání tohoto pole do předmětu závisí na cílové iOS aplikaci; ruční kopírování funguje i bez Web Share. E-mailový fallback historie obsahuje i `subject`.

IndexedDB schéma ani historická data se nemění. Výpočty zůstávají v plné přesnosti, výsledky UI mají nejvýše tři desetinná místa, exportovaná procenta přesně dvě. Každý další produkční balík musí zvýšit verzi aplikace; viz `AGENTS.md`.

## Verze 1.2.4 – interval kontroly stavů

Historie, výsledek a sdílení Kontroly stavů používají uložený interval OD → DO. Starší záznamy bez intervalu zobrazí dostupné původní datum; databáze ani výpočty se nemění.

## Verze 1.3.0 – odečtové série

Na úvodní obrazovce jsou volby **JEDNOTLIVÝ ODEČET**, **SÉRIE ODEČTŮ** a **STYLUS**.
První dílčí odečet nevyžaduje druhý stav. TS/R a datum zůstávají po uložení,
pole, EM, nepovinný UZEL, ručně zadaný čas a stav se vyčistí. Balíky vznikají
podle TS/R a data prvního odečtu. UZEL je řetězec číslic, včetně dlouhých ID a úvodních nul.

V historii odečtů nebo ve Výsledcích měření vyberte elektroměry (hledání podle UZLU,
pole, čísla EM), potom **POKRAČOVAT DALŠÍM ODEČTEM**. Všechny vybrané elektroměry
se otevřou na jedné stránce s velkými kartami. Předchozí data jsou zamčená.
Čas nového odečtu se nikdy nedoplňuje automaticky. Společné datum lze upravit i individuálně.
Uloží se validní vyplněné řádky; prázdné se přeskočí a chybné zůstanou rozepsané.
Vypnutí pokračování ponechá úplnou historii; nové pokračování elektroměr znovu aktivuje.
Volitelné MTP používá výhradně existující matematiku Kontroly stavů; výchozí převody 1/1
znamenají žádnou korekci. Výsledky série jsou konzervativní bez automatického procentního verdiktu.

**IMPORT ENERGIS** podporuje XLSX a oddělený TXT/TSV/CSV se společným parserem.
Hledá hlavičky UZEL, Měřák, Popis uzlu, Jednotka a časové intervaly dynamicky;
podporuje řádkové i oddělené metadata/datové struktury. Importuje jen vybrané UZLY.
Zobrazí skutečné OD/DO a časový rozdíl vůči novému odečtu. Volba předchozí/následující
hranice zaznamenává zvolený kontext exportu; nemění časové údaje souboru ani je nezaokrouhluje.
SUMA se porovnává s vlastním součtem. Konflikty, chybějící hodnoty či nejednoznačné
časové intervaly se nedoplňují naslepo. Již vyplněná ruční SUMA se importem nepřepisuje.
Hodnoty označené kW se bez jednoznačných metadat nenásobí 0,25.
Nerozpoznanou strukturu je nutné zkontrolovat a hodnoty případně zadat ručně.

STYLUS používá běžné HTML textarea/input a systémový Apple Scribble. Rozpoznání
textu pouze připraví opravitelný náhled; následuje převod do běžného formuláře a výslovné
uložení. Existující EM/UZEL otevře pokračování posledního odečtu. Vlastní OCR není součástí.
Automatické testy emulují iPhone/iPad v Chromiu; fyzický Pencil/Scribble je třeba ověřit na iPadOS.

**EXPORTOVAT VYBRANÉ XLSX/TXT** exportuje celou historii vybraných elektroměrů,
intervaly, MTP korigovanou spotřebu, Energis, rozdíly, časový posun a pokračování.
**ZÁLOHOVAT DATA** ve Výsledcích měření zahrnuje také všechny série a jejich vazby.
Nový JSON formát 2 podporuje obnovu formátu 1 z verzí 1.2.5+. Obnova je atomická
přes všechny stores, opakovatelná bez duplicit a konfliktní ID nepřepisuje.

IndexedDB zůstává `mereni-vyvodu-v1`, schéma se bezpečně zvýšilo na 3 s novými stores
`series`, `meters`, `readings`. Původní `measurements` se nemaže ani nepřepočítává.
Nové zápisy aktualizují UI přírůstkově; párování a čtení historie elektroměru používá indexy.
ExcelJS se načítá odděleně a PWA jej zahrnuje do offline precache.
