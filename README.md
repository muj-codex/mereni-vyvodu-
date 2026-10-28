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

## Verze 1.3.1 – terénní odečty (24. 10. 2026)

- Jednotlivý a sériový odečet sdílejí historii. Výběr série zahrnuje elektroměry stejné TS/R i z jiného dne.
- Přednastavené TS/R a MTP pro NN /5 A a VN /1 A, vlastní MTP a viditelný korekční koeficient.
- UZEL je první údaj, nepovinný řetězec číslic nezávislý na čísle elektroměru; připravený typ a lookup pro budoucí adresář vývodů.
- TEĎ vyplní lokální HH:MM až po kliknutí; zápis 8:32 se normalizuje na 08:32.
- Společné datum kola, individuální úpravy a ODEČÍST pro přeskočení návštěvy bez změny historie či sledování.
- Ukončení a výslovná reaktivace sledování zachovávají poslední skutečný odečet i celou historii.
- Dokončení dílčího odečtu přejde do historie bez vytvoření záznamu.
- Jedno live vyhledávání nad výsledky a odečty, kompaktní řádky a řazení podle skutečného času odečtu.
- Energis XLSX/TXT pouze podle UZLU aktivních řádků; doplněný UZEL se uloží. Výsledek ukazuje podepsaný počet minut E pro importovanou i ruční hranici.
- IndexedDB zůstává ve verzi 3: přidaná volitelná metadata nevyžadují změnu object stores. Starší data a JSON zálohy zůstávají podporované.
- Výpočetní jádro `src/core` a parser Energisu zůstávají beze změn; matematické regrese i kontrola otisků chrání výsledky verze 1.3.0.

## Verze 1.3.2 – série a pozdější doplnění Energisu (24. 10. 2026)

- Jedna uložená série (`batchId`) má v hlavní historii jednu položku. Čas položky je nejnovější skutečný odečet kteréhokoli vývodu; vyhledávání nadále zahrnuje všechny členy a jejich historii.
- Otevření série předvybere všechny aktivně sledované vývody. Pokračování zobrazí všechny vybrané vývody na jedné stránce s výchozím ODEČÍST zapnuto. Přeskočení nemění sledování ani poslední skutečný stav.
- Sticky společné datum zůstává. Pole „Nové datum“ v jednotlivých řádcích je odstraněné; všechny nové odečty kola používají společné datum. TEĎ a ruční editace času zůstávají.
- SUMA ENERGIS je nepovinná při terénním odečtu. Později ji lze upravit samostatně u posledního intervalu v sérii nebo u libovolného staršího intervalu v historii EM, bez vytváření nového odečtu.
- Každá série má vlastní IMPORT SUMA ENERGIS pro poslední uložené intervaly. XLSX/TXT používá původní parser, páruje pouze UZLY konkrétní série, ignoruje cizí UZLY a označuje chybějící či nejednoznačné vazby. Import zachovává uložené i rozepsané ruční hodnoty.
- Malá tlačítka -E / +E nahrazují globální select. Volba patří ke konkrétnímu intervalu, má viditelný aktivní stav a společnou nápovědu. Výsledek uvádí časový posun i konkrétní použitou hranici.
- Starší série se zobrazují podle existujícího `batchId`. Samotná shoda TS/R neslučuje odlišná ID; záznamy bez doložené vazby se neseskupují odhadem.
- IndexedDB zůstává ve verzi 3, bez resetu nebo změny object stores. JSON záloha zachovává série, historie, SUMA, import, volbu hranice, sledování a revizi pozdější úpravy Energisu. Starší záloha nevrací nově doplněný Energis zpět.
- Matematické jádro, MTP korekce a parsery Energisu/STYLUS jsou proti 1.3.1 nezměněné.

## Verze 1.3.3 – časový přehled série (24. 10. 2026)

V detailu série nahrazuje vyhledávací pole kompaktní chronologický seznam uložených termínů. Globální hledání zůstává zachováno. Model nemá identifikátor ani timestamp kola: přehled používá nejčasnější skutečný odečet každého dne série. Více kol ve stejný den nelze z uložených dat spolehlivě odlišit a zobrazí se jedním termínem. Výpočty, data a pokračování série zůstávají beze změny.

## Verze 1.3.4 – samostatná odečtová kola (24. 10. 2026)

- Série obsahuje samostatná kola s unikátním `roundId`, společným `roundDate` a `roundTime`. Dvě návštěvy stejného dne zůstávají dvěma událostmi, i při shodném společném čase.
- Datum i čas kola jsou ručně editovatelné. Čas začíná prázdný; TEĎ vloží lokální HH:MM. Skutečné časy jednotlivých vývodů zůstávají samostatné a mají vlastní TEĎ.
- Kompaktní tlačítka v detailu přepínají všechna kola a aktuální stavy. Kolo uchovává odkazy na skutečné odečty a explicitně přeskočené vývody; přeskočení nevytvoří odečet ani neukončí sledování. Další interval navazuje na poslední skutečný odečet.
- Jedna série zůstává jednou kartou výsledků. Řazení používá poslední skutečný čas vývodu v nejnovějším kole; kolo bez odečtů používá společný čas.
- IndexedDB přechází z verze 3 na 4 přidáním store `rounds`, bez resetu. U starých dat není možné spolehlivě rekonstruovat návštěvy téhož dne: označený kompatibilní denní přehled zachová všechny skutečné odečty, jejich časy, vazby a výsledky. Nová kola se ukládají explicitně.
- JSON záloha verze 3 zahrnuje kola, jejich časy, vazby a přeskočení. Obnova přijímá také verze 1 a 2; starší záloha nepřepíše známé nové vazby kol ani novější SUMA ENERGIS.
- Výpočetní jádro, MTP, 1f/3f, ARON, VN, Kyoritsu, U/I/PF, Kontrola stavů, tolerance, diagnostika a matematika/parsery Energisu zůstávají nezměněné. Energis i historie elektroměru nadále používají skutečné individuální datum a čas odečtu.

## Verze 1.3.5 – série a samostatné odečty (24. 10. 2026)

- Výsledky i Historie odečtů mají oddělené sekce **ODEČTOVÉ SÉRIE** a **SAMOSTATNÉ ODEČTY**. Členové série se zobrazují v její kartě a detailu, bez dalších hlavních karet. Samostatný elektroměr má vlastní položku; oba přehledy používají stejné pravidlo členství a přesný souhrn počtů.
- Nový JEDNOTLIVÝ ODEČET ukládá výslovný druh `standalone` do svého existujícího datového kontextu. Neslučuje se se sérií ani jiným samostatným elektroměrem podle shodného TS/R a data. Existující vazby `batchId` z 1.3.4 nadále znamenají členství v sérii; původní způsob založení u nich neodhadujeme. Záznamy bez platné vazby na sérii zůstávají jednotlivě dostupné.
- Vyhledávání nadále prochází TS/R, pole, EM, UZEL i historii. Výsledek člena série otevře sérii; jeho kompletní A → B → C je dostupné přes Historie EM. Ruční SUMA, import, +E/-E, volba ODEČÍST a dlouhodobé sledování zůstávají zachované.
- V detailu série lze přidat existující samostatný elektroměr. Mění se pouze členství stejného `meterId`; skutečné odečty se nekopírují ani nepřepisují. Historická kola zachovávají původní kontext. Revize členství při obnově zálohy brání vrácení elektroměru do původního samostatného přehledu starší zálohou. Odebrání ze série tato verze nepřidává.
- IndexedDB zůstává ve verzi 4 a JSON backup ve verzi 3, bez další migrace nebo resetu. Matematické jádro, Energis a +E/-E, skutečné časy odečtů i datum/čas kol zůstávají nezměněné.

## Verze 1.3.6 – oddělení měření a lokální návraty (24. 10. 2026)

- Zapnutá Kontrola stavů v hlavní měřicí kartě nabízí jedinou cestu do Kyoritsu: **POUŽÍT KONTROLU STAVŮ A POKRAČOVAT**. Prosté MĚŘENÍ KYORITSU je dostupné při vypnuté volitelné kontrole. Výsledek kontroly, identifikace a interval zůstávají součástí společného výsledku měření.
- Kontrola stavů v hlavní kartě nemá vlastní ukládací akci ani persistence callback. Samotné vyplnění či opuštění kontroly nic nevytvoří v historii. Dokončené měření se uloží pouze do MĚŘENÍ; odečtové záznamy nadále vznikají v JEDNOTLIVÝ ODEČET / SÉRIE ODEČTŮ (STYLUS se převádí do standardního odečtu). Archivované samostatné Kontroly stavů zůstávají čitelné a obnovitelné ze záloh.
- Jednotné **← Zpět** vrací lokálně z uloženého výsledku, Kontroly stavů, Kyoritsu kroku/výsledku, historie EM, série, konkrétního kola, pokračování, editace SUMA, inline výsledku importu, STYLUS náhledu, nápovědy a exportního náhledu. Spodní navigace zůstává globální a pracovní navigace se ve Výsledcích nezobrazuje.
- Návrat z pokračování zachová vyplněné kolo a nabízí jeho obnovení. Rozepsané SUMA a +E/-E zůstávají při lokálních návratech zachované. Poslední otevřený odečtový kontext ve Výsledcích zůstává při návratu do přehledu připojený. Kyoritsu krok se po návratu obnoví se stejnými rozpracovanými hodnotami, pokud se základ měření nezměnil, včetně vypnutého přenosu identifikace.
- Výpočetní jádro, datové modely, matematika Energisu a +E/-E, odečtová kola, IndexedDB 4 a backup verze 3 se nemění. Nevzniká migrace ani reset databáze.

## Verze 1.3.7 – varování přímo u Kyoritsu ↔ Energis (24. 10. 2026)

- Samostatný blok **OVĚŘIT HODNOTY KYORITSU** byl odstraněn. Samostatná **Kontrola výkonu Kyoritsu** zůstává zachovaná se stejným fyzikálním výsledkem U/I/PF.
- Řádek **Kyoritsu ↔ Energis** dostává červený rámeček, tučný text, vykřičník a krátké vysvětlení pouze při `abs(percent) > 5`. Přesně +5 % i −5 % zůstává bez tohoto zvýraznění. Rozhoduje původní interní procento; formátování čísla zůstává stávající (nejvýše tři desetinná místa).
- Změna je společná pro živý i uložený výsledek. Fyzikální shoda Kyoritsu zůstává nezávislá na odchylce proti časově posunutému trendu Energisu. Matematika, diagnostika, tolerance výpočetního jádra a uložená data se nemění.

## Verze 1.3.8 – jednotná navigace odečtů

Duplicitní řady nahrazuje jedna společná navigace: Jednotlivý odečet | Série odečtů | Stylus | Historie odečtů. V odečtech je právě jedna aktivní položka se stejným stylem; menší displeje dovolují zalomení. Hlavní moduly, lokální ← Zpět a globální spodní navigace zůstávají zachované. Ve Výsledcích měření se pracovní navigace nezobrazuje.

Změna se týká pouze navigačního zobrazení. Výpočty, formuláře, rozpracovaná data, odečtová kola, historie, Stylus parser, Energis, +E/-E, IndexedDB a backup/restore zůstávají beze změny.

## Verze 1.3.9 – zjednodušení navigace a nadpisu

Horní navigace odečtů obsahuje pouze Jednotlivý odečet | Série odečtů | Stylus. Uložené výsledky, série a samostatné odečty jsou nadále přístupné přes spodní globální Výsledky měření. Na prvním kroku hlavního měření se nezobrazuje pouze nadpis „Základ / kontrola stavů“; ELEKTROMĚR, krokový indikátor, pomocný text, identifikace a celý formulář zůstávají zachované. Výpočty, odečtová logika, historie, Energis, Kyoritsu, +E/-E, IndexedDB a backup/restore nebyly změněny.

## Verze 1.4.0 – kostra výpočtu spotřeby a sazeb

Nový samostatný modul nabízí povinný výběr C (firma) / D (domácnost), volbu odhadu před připojením nebo kontroly podle skutečné spotřeby, vstupní formuláře a shrnutí ručně zadaných údajů. Vnořené kroky mají lokální ← Zpět se zachováním vstupů. Používá stejné obecné formulářové komponenty a vzhled aplikace, vlastní styly jsou omezeny na nový modul.

Zadává se jedna distribuční oblast (ČEZ Distribuce, EG.D, PREdistribuce), běžný nebo vlastní jistič, spotřeba a podle režimu výkon/proud/soudobost či sazba a délka období včetně vlastního počtu měsíců. Výběr sazeb obsahuje pouze několik výchozích kódů; nejde o kompletní katalog. Model ponechává prostor i pro budoucí VT/NT.

Ceníky dodavatelů jsou výhradně placeholder karty bez cen a načítání. ORLEN Unipetrol je pracovní referencí pouze v režimu C; v D se vůbec nevykresluje. Každá karta má vlastní stav aktualizace, platnosti, ověření a chyby. Tlačítko aktualizace pouze zobrazí informaci o budoucím doplnění. Katalog je vázaný na jedinou vybranou distribuční oblast.

Verze neobsahuje žádné výpočty cen, převody výkon/proud, roční přepočty, doporučení ani stahování ceníků. Nový stav žije jen v paměti během otevřeného workflow; nevytváří historii, IndexedDB ani backup záznamy. Existující modul Měření a jeho data, výpočty a funkce zůstávají beze změny.

## Verze 1.4.1 – katalog sazeb a dodavatelské karty

Modul sazeb obsahuje úplný zadaný katalog **12 C sazeb** (C01d, C02d, C03d, C25d, C26d, C27d, C35d, C45d, C46d, C56d, C60d, C62d) a **10 D sazeb** (D01d, D02d, D25d, D26d, D27d, D35d, D45d, D56d, D57d, D61d). Kategorie se nemíchají. Informační tlačítko u zvolené sazby ukazuje kód, kategorii, jednotarifní/dvoutarifní režim a VT/NT. C01d/C02d/C03d a D01d/D02d jsou jednotarifní s VT; ostatní zadané sazby mají VT i NT.

Každá sazba má poznámku, prázdné technické podmínky (hodiny NT, ohřev vody, akumulace, přímotop, tepelné čerpadlo, elektromobil, další podmínky) a samostatná prázdná cenová místa pro ČEZ Distribuci, EG.D a PREdistribuci. Podmínky ani ceny se nevyhodnocují a nic se automaticky nedoporučuje.

Karty dodavatelů mají jemný vlastní barevný akcent, místo pro budoucí malé logo a zdrojový adaptér, oddělené `validFrom` / `lastChecked` / `sourceStatus` a vlastní `idle/updating/success/error`. Skutečné načítání není zapojené: tlačítko zobrazí jen „Aktualizace ceníku bude doplněna v další etapě.“ a nevymyslí datum ani úspěšné ověření. ORLEN UNIPETROL zůstává první pracovní referencí pouze v C; v D se jeho karta vůbec nevytváří. Zůstávají oba formuláře, shrnutí vstupů, lokální návraty a jedna distribuční oblast na kalkulaci, bez historie a ukládání. Modul Měření nebyl změněn.

## Verze 1.4.2 – Paušální připojení a Odhad / firmy

Výběr **Výpočet** nabízí **PAUŠÁLNÍ PŘIPOJENÍ** pro C i D a **ODHAD / FIRMY** pouze pro C. Oba režimy mají samostatné vstupy a lokální ← Zpět; nic se neukládá do historie, IndexedDB, Výsledků měření ani záloh.

Paušální připojení přijímá oblast, již uživatelem určený proud, soudobost `0 < k <= 1`, spotřebu za období a počet měsíců (výchozí 1). Počítá `I × k` a spotřebu `× 12 / N`. Automatický jistič je nejbližší **striktně vyšší** člen řady 10/16/20/25/32/40/50/63/80/100/125/160 A; rozhoduje interní proud bez zaokrouhlení displeje. Příklad 40 A × 0,65 = 26 A → 3×32 A. Při překročení řady se návrh nesníží na maximum; uživatel musí zvolit vlastní hodnotu. Použitý jistič lze ručně přepsat standardní nebo vlastní hodnotou (například 64 A), která zůstává přesně stejná v budoucím cenovém modelu. Původní povinný výkon a ručně odhadovaná roční spotřeba již nejsou vstupy.

Odhad / firmy začíná pouze původním jističem a sazbou C. Následují dvě ručně editované sekce datum/čas/stav bez TEĎ. Druhý okamžik musí být pozdější a stav nesmí klesat. Spotřeba je rozdíl stavů; roční ekvivalent používá přesný časový interval v **Europe/Prague** včetně letního času a pevný model **365 dní / 8 760 hodin**. Neexistující nebo nejednoznačné místní časy během změny času se odmítnou. Teprve potom se volí distribuční oblast. Původní jistič se nenavrhuje ani nemění a jediným dodavatelem je ORLEN. Bez skutečných cen se nevydává cenový verdikt ani doporučení sazby.

Paušální C má osm karet: ORLEN Unipetrol, ČEZ, E.ON, PRE, innogy, MND, Centropol a EPET. Paušální D má sedm karet bez ORLEN. Katalog 12 C a 10 D zůstává zachovaný; budoucí kandidáti patří jedné oblasti a jednomu použitému jističi. Model ročních nákladů má prázdné položky pro silovou energii VT/NT, měsíční plat dodavatele, distribuci, jistič, regulované položky, systémové služby, POZE, OTE/povinné položky, daně, DPH a celkový rok. Zatím žádné cenové hodnoty nepočítá ani nedoplňuje. Dodavatelské stavy jsou nezávislé a budoucí neúspěšná aktualizace zachová poslední platný ceník.

Celý modul Měření včetně jeho elektrotechnické matematiky zůstává nezměněný.

## Verze 1.4.3 – VT/NT a částečný ověřený zdroj ORLEN 2026

Odhad / firmy rozlišuje sazby explicitním příznakem `dualTariff`. V nabídce jsou dvoutarifní C sazby označené `· 2T`. Jednotarif používá VT / hlavní registr a NT zobrazuje zašedlé, disabled a nepovinné; ani dříve vyplněné NT neovlivní výpočet. Dvoutarif vyžaduje obě sady VT/NT, které sdílejí jedno datum/čas pro první a jedno pro druhý odečet. Validují se oba aktivní registry, spotřeba i roční přepočet zůstávají oddělené VT/NT i celkem. Nemění se původní jistič, nevzniká tlačítko TEĎ ani soudobost ve firemním výsledku.

Nový statický cenový zdroj zachycuje výhradně uživatelem ověřený přepis fotografií: **ORLEN C01d, C02d, C03d, C25d, C45d**, platnost **1. 1. 2026**, ověření **25. 10. 2026**, vše **bez DPH**. Obsahuje silovou cenu 2 599 Kč/MWh, oddělené distribuční VT/NT ceny **pouze pro ČEZ Distribuci**, systémové služby, doložené nulové POZE, OTE a přesné ověřené jističové tabulky/pásma. C01d/C02d vlastní nevyjmenovaná hodnota pod 160 A se neinterpoluje; C03d 50 A ani neověřené nižší jističe C25d/C45d se nedoplňují. Ověřená vyšší pásma se používají přesně podle jejich hranic. EG.D ani PRE nepřebírají žádné distribuční/jističové ceny ČEZ. Jednofázové výjimky jsou uloženy pouze tam, kde byly doloženy, bez zásahu do 1f Měření.

Ostatní ORLEN sazby zůstávají cenově neověřené. Doložený zvláštní údaj C60d 2 599 Kč pro stálý měsíční / bezměrný odběr je uložený s poznámkou o nejasném významu a automaticky se nepoužívá.

Výsledek ukazuje ověřené jednotkové ceny a **částečné roční položky**, nikoli konečný součet. Roční VT/NT ovlivňuje odpovídající dvoutarifní náklady; samotný celkový odběr se na neznámý poměr VT/NT nerozděluje. Chybějící stálý plat dodavatele, další povinné/OTE a daňové položky zůstávají `null`. Proto zatím **žádná kombinace nemá konečnou roční cenu ani doporučení sazby**. Model odděluje `priceWithoutVat` a `priceWithVat`; sazba DPH je samostatná nevyplněná konfigurace a DPH se nepřičítá.

ORLEN karta uvádí částečně ověřený zdroj a obě odlišná data. Všech osm dodavatelů má viditelné, ale disabled aktualizační tlačítko s důvodem; není připojené webové načítání, API ani scraping. ORLEN zůstává pouze v C, Odhad / firmy pouze C/ORLEN, bez ukládání kalkulací. Celý modul Měření zůstal beze změny.

## Verze 1.4.4 – referenční UZEL a dokončení ORLEN 2026

Statický přepis pěti fotografií obsahuje 994 řádků původního listu (880 různých čitelných UZLŮ). Zdroj každého řádku, původní zápis MTP a neověřené buňky jsou v `src/series/reference/uzel.json`. Nečitelné, zakryté, oříznuté a nejednoznačné údaje zůstávají `null`. Report [validace UZEL](docs/uzel-validation-1.4.4.md) vzniká příkazem `npm run validate:uzel`; podrobnosti jsou i v JSON.

UZEL v existujícím formuláři prvního odečtu doplní ověřenou TS/rozvodnu, umístění a MTP primární. Jednoznačná dvojice TS/rozvodna + umístění doplní UZEL a MTP primární. Shodné duplicity jsou použitelné, konflikty v obou směrech automatické doplnění zastaví. Malá a velká písmena umístění se rozlišují. Neověřené buňky se nepřenášejí, MTP elektroměru a ostatní odečtové údaje zůstávají nezávislé a editovatelné. Uložená měření se dodatečně neupravují. Hlavní identifikace Měření a elektrotechnické výpočty se nemění.

ORLEN 2026 pro ČEZ Distribuce používá uživatelem ověřené hodnoty dodané 26. 10. 2026: všechny jističové intervaly C01d/C02d/C03d/C25d/C45d, zvláštní ceny 1f nad 25 A a 3f nad 160 A, daň z elektřiny 28,30 Kč/MWh a DPH 21 %. Roční daň se násobí spotřebou v MWh, měsíční položky dvanácti. Zaokrouhluje se až zobrazení. Samostatný nedoložený obchodní plat ani další neurčené poplatky nejsou přidané položky ani důvod blokace výsledku. Ostatní oblasti, sazby bez cen a dvoutarif bez VT/NT nemají vymyšlenou konečnou cenu.

Odhad / firmy porovnává cenu C01d/C02d/C03d a případné stávající dvoutarifní sazby při stejné spotřebě a jističi; používá stav „SAZBA ODPOVÍDÁ“ nebo cenové doporučení. Nová dvoutarifní sazba se nenavrhuje bez znalosti jejích technických podmínek. Před změnou sazby je třeba ověřit podmínky u distributora. Loga dodavatelů nejsou podmínkou release; existující textové značky zůstávají.

`npm run build` vytváří produkční aplikaci včetně service workeru a offline precache. `npm run build:pwa` je výslovný alias stejného úplného PWA buildu. Obě varianty obsahují dataset pro offline použití.

## Verze 1.4.5 – ověření a čištění referenční vazby

První stránka hlavního Měření nově obsahuje nepovinný, ručně editovatelný UZEL přímo v existující Identifikaci měření vedle TS/rozvodny a pole. Hlavní Měření, Jednotlivý odečet a Série odečtů používají společný `editReference` nad stejným datasetem 1.4.4. Nejde o novou databázi ani novou obrazovku.

Jednoznačný UZEL doplní ověřené umístění a MTP primární; jednoznačná dvojice TS/R + pole doplní UZEL a MTP primární. Formulář sleduje původ a původní hodnotu automatických údajů. Rozpoznaný UZEL je identifikátor ověřené vazby: pokud uživatel přepíše pole nebo TS a vazba přestane platit, automatický UZEL a MTP se vyčistí. Při změně na neznámý UZEL zmizí staré automatické umístění a MTP. Ručně zadané či upravené hodnoty se zachovají. Ručně zadaný neznámý UZEL se automaticky nemaže. Záznamy bez údajů o původu se bezpečně považují za ruční.

Pod identifikací se zobrazuje „Vazba ověřena podle referenčních dat.“ nebo malé červené „Vazba UZEL ↔ TS/R ↔ pole ↔ MTP není ověřena. Zkontrolujte zadané hodnoty.“ Stav vychází ze současných hodnot všech čtyř polí, nikoli z posledního úspěšného hledání. Nejednoznačné a neúplné zdroje nemají ověřený stav. Prázdný formulář nevaruje. Hláška neblokuje měření; UZEL není povinný a ruční TS/pole/MTP zůstávají použitelné.

Vyčištěné MTP je skutečně prázdné, bez skrytého náhradního převodu. MTP elektroměru zůstává nezávislé. Původ hodnot hlavního formuláře se zachovává v existujícím pracovním draftu i po reloadu. Úprava dalšího vývodu série nemění již uložený vývod. Výpočty Měření, ORLEN 1.4.4, datový model IndexedDB a backup/restore se nemění; jejich soubory a původní dataset chrání i přesné SHA-256 regression testy proti 1.4.4.

## Verze 1.4.6 – CHEZA, ověřené UZLY R701/R702 a označení 2T

U devíti existujících řádků CHEZA (BM31–BM39, UZEL 21207020 / pole 3a až UZEL 21207045 / pole 6A) je doplněna uživatelem potvrzená lokalita `1613/CHEZA`. Jejich UZLY, pole a MTP zůstávají stejné. Celá skupina má 24 obousměrně dohledatelných vývodů; `5a/5A`, `5b/5B` a `10a/10A` zůstávají různé vývody.

Dodaných 28 UZLŮ R701/R702 doplňuje 28 již existujících neúplných řádků bez UZLU. Nevznikají duplicitní řádky, které by zneplatnily zpětnou vazbu. Používají se výslovně dodaná označení RWA/RWB/RWC/RWD a původní ověřené MTP se sekundárem 1 A. Původní zápis z fotografií je zachován v metadatech spolu s novým uživatelským zdrojem. `80640401 / RWB1.35` se nevytváří. Příklad `80680701 ↔ R702 / RWD1.43 / 250/1` funguje společnou stávající logikou autofillu; MTP elektroměru zůstává nezávislé.

Paušální připojení zobrazuje `C25d · 2T` a `C45d · 2T`. Interní hodnoty voleb zůstávají `C25d` a `C45d`; seznam, ceny a výpočty se nemění. Elektrotechnické jádro, obecná logika vazeb, odečty, Energis, Stylus, historie a backup nejsou změněny. Kontrola SHA-256 zachovává původní baseline 1.4.4, ověřuje přesný rozsah schválených změn dat a textu a teprve tyto změny při porovnání vrací do původního tvaru.

`npm run validate:uzel` vytváří report pro aktuální aplikační verzi; historické reporty zůstávají zachovány. [Validace 1.4.6](docs/uzel-validation-1.4.6.md): 994 referenčních řádků, 908 různých čitelných UZLŮ, 981 úplných a 13 neúplných záznamů. Původní duplicity a konflikt 21201042 jsou beze změn, nové konflikty nevznikají.

### 1.4.7 – ČEZ / ČEZ ESCO 2026

- Firmy: orientační ČEZ ESCO SPOT pro 11 doložených C sazeb. Referenční měsíc je poslední zveřejněný měsíc v importu (září 2026); přirážka se nepřičítá podruhé. Neověřená distribuční část blokuje pouze úplný výpočet příslušné kombinace.
- Domácnosti: ČEZ Elektřina na dobu neurčitou pro 10 D sazeb na územích ČEZ Distribuce, EG.D a PREdistribuce, včetně 1f/3f jističových tabulek, VT/NT, DPH a obou variant POZE. ORLEN se v domácnostech nenabízí.
- Po 20 dnech doporučení kontroly SPOT; poslední ověřené ceny zůstávají dostupné. Bez automatického scraperu a vzdálených log.
- Originální čtyři PDF, zdrojová metadata a kontrola importu jsou v [dokumentaci importu](docs/cez-import-1.4.7.md). Měřicí část, UZEL, uložená data i ORLEN zůstávají nezměněné; kontrolují je SHA a regresní testy.

### 1.4.8 – E.ON a společné porovnání domácností

- E.ON SPOT pro firmy: skutečné zdrojové poplatky a regulovaná tabulka ČEZ Distribuce, bez vymyšlené obchodní nebo celkové roční ceny při chybějících intervalových OTE datech. Ověřená C distribuce rozšiřuje i ČEZ ESCO; ORLEN je beze změny.
- E.ON domácnosti pro všech 10 D sazeb ve třech distribučních oblastech. ČEZ × E.ON sdílejí sazbu, jistič i VT/NT; porovnání ukazuje levnější nabídku a rozdíl Kč/rok. Bez ORLEN a bez automatického potvrzení technického nároku na sazbu.
- Obě zdrojové varianty DPH jsou uchovány, POZE podle PDF; po 20 dnech pouze doporučení kontroly SPOT. [Zdrojová dokumentace a omezení](docs/eon-import-1.4.8.md).

### 1.4.9 – fixovaný E.ON Variant pro firmy

- Hlavní E.ON firemní produkt je Variant na 2 roky 10/26 Profi, fixace 2 roky, účinnost od 1. 10. 2026. Úplná roční cena pro ověřené C sazby a ČEZ Distribuce, včetně skutečných jističových pásem nad 160 A.
- Pořadí úplných nabídek ORLEN / E.ON Variant / ČEZ ESCO při stejných vstupech a rozdíly Kč/rok. ESCO zůstává označen jako orientační zářijový SPOT scénář; starý E.ON SPOT není hlavní karta.
- Měření, ORLEN a domácnosti beze změny. [Zdrojová dokumentace, výpočet a omezení](docs/eon-variant-1.4.9.md).

### 1.4.10 – ČEZ ESCO Elektřina 24 pro firmy

- Hlavní firemní ČEZ ESCO používá Elektřinu 24, fixaci 24 měsíců a celorepublikovou obchodní cenu ze zdrojového PDF. Bez aktivního SPOT scénáře nebo přirážky.
- Pořadí úplných nabídek a rozdíly používají stejné vstupy a roční ceny včetně DPH. C55d má pouze ověřenou obchodní cenu ČEZ ESCO; neověřená regulace se nedoplňuje.
- Domácnosti, ORLEN, ceny E.ON Variant a měřicí část beze změn. [Zdroj, ceny a omezení](docs/esco24-1.4.10.md).

### 1.4.11 – innogy Benefit 24

- Firmy i domácnosti: innogy elektřina Benefit 24, fixace 24 měsíců, ceníky od 1. 4. 2026 pro ČEZ Distribuce. Samostatné ověřené jističové tabulky a společné pořadí úplných ročních cen včetně DPH.
- Nad 30 MWh pouze u firem upozornění na omezení nabídky; cena a pořadí zůstávají orientačně dostupné. EG.D/PRE bez ověřeného ceníku innogy.
- Stávající ceny dodavatelů a měřicí část zachovány. [Zdroje, pravidla a omezení](docs/innogy-benefit24-1.4.11.md).
