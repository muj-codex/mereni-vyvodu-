# PROMPT 1 PRO CODEX – ROZŠÍŘENÍ MĚŘICÍ ČÁSTI APLIKACE

Projekt:
`muj-codex/mereni-vyvodu-`

Pracuj nad současnou existující aplikací.
Nezakládej nový projekt a nepřepisuj fungující aplikaci od začátku.

## CÍL PROMPTU 1
Rozšířit současnou měřicí část aplikace o:
- společnou identifikaci místa měření,
- nový proudový diagnostický režim NN/VN,
- Kyoritsu 8112,
- sekundární proudové přepočty,
- volitelné měření napětí,
- procentní výsledky,
- nové chování historie a exportu,
- systémové sdílení,
- výraznější typografii,
- bezpečnou migraci existujících dat.

V TOMTO PROMPTU NEIMPLEMENTUJ ENERGETICKOU KALKULAČKU ANI CENÍKY DODAVATELŮ.
Ty budou řešeny samostatným Promptem 2 a Promptem 3.

## A. KRITICKÁ PRAVIDLA – NIC Z TOHOTO NESMÍ BÝT ROZBITO

1. Zachovat současné funkční 3f měření.
2. Zachovat současnou 400 V diagnostiku.
3. Zachovat současný automatický 500 V ARON režim.
4. ARON nikdy nemodelovat jako chybějící nebo vyzkratovanou L2.
5. Zachovat stávající korekční koeficient MTP jako informační funkci. Nesmí ovlivnit výpočty, diagnostiku, historii ani export tam, kde to dnes nedělá.
6. Zachovat offline PWA.
7. Zachovat stávající historii.
8. Aktualizace databáze NESMÍ vymazat existující uložená měření.
9. Pokud je nutná změna IndexedDB schématu, proveď migraci starých záznamů.
10. Nikdy neporušit pevné barvy:

L1 / U1 / I1 = ČERVENÁ  
L2 / U2 / I2 = ZELENÁ  
L3 / U3 / I3 = ŽLUTÁ

500 V ARON:
- L1 = červená
- prostřední pole = šedé, pouze text ARON
- L3 = žlutá

## B. SPOLEČNÁ HLAVIČKA PRO VŠECHNA MĚŘENÍ

Stejnou identifikační hlavičku použij pro:
- současné 3f měření,
- nový NN proudový režim,
- nový VN proudový režim.

Obsah:

DATUM
- automaticky předvyplněné,
- editovatelné.

ČAS VYHODNOCENÍ
- automaticky,
- ukládat ideálně na sekundy.

ČÍSLO ELEKTROMĚRU
- textová hodnota,
- zachovat počáteční nuly.

LOKALITA
- podle režimu TRAFOSTANICE nebo ROZVODNA.

POLE / UMÍSTĚNÍ
- samostatné textové pole,
- vždy editovatelné,
- může obsahovat např. 8L, kobka 4, vývod 7 apod.

Všechny tyto údaje se musí propsat do:
- výsledku,
- historie,
- sdílení,
- TSV exportu.

## C. TRAFOSTANICE – NN

V NN režimu používej pole: TRAFOSTANICE

Přednastavený seznam:
- TS 3308/250
- TS 4601/251
- TS 4424/252
- TS 3401/253
- TS 2535/254
- TS 1515/256
- TS 3831/257
- TS 0524/258
- TS 0425/259
- TS 2312/264
- TS 1318/265
- TS 4315/269
- TS ČOV-2225
- TS k123-4616
- TS HR6-2803-6654/VEDAG
- TS 1613/CHEZACARB
- TS 6910

Vedle vždy samostatné editovatelné pole: POLE / UMÍSTĚNÍ

Příklad:
TRAFOSTANICE: TS 3831/257
POLE / UMÍSTĚNÍ: 8L

## D. ROZVODNY – VN

Při aktivním režimu VN používej místo trafostanice: ROZVODNA

Přednastavený seznam:
- R201
- R202
- R701
- R702
- R105-106
- RPCH
- RASU-AIP

Vedle opět samostatné editovatelné pole: POLE / UMÍSTĚNÍ

TVRDÉ PRAVIDLO:

Pokud VN NENÍ aktivní:
- zobrazuj pouze TRAFOSTANICE,
- nikdy nenabízej seznam R.

Pokud VN JE aktivní:
- zobrazuj pouze ROZVODNY,
- nikdy nezobrazuj ani nenabízej seznam TS.

Seznamy musí být datově oddělené, ne pouze vizuálně filtrované.

## E. PROCENTNÍ ROZDÍL SOUČASNÉHO 3f MĚŘENÍ

Do současného výsledku Kyoritsu × Energis přidej přímo číselný procentní rozdíl.

Vzorec:

Rozdíl % = (Energis − referenční měření) / referenční měření × 100

Příklady:
- referenční měření 100 kW, Energis 110 kW => +10,0 %
- referenční měření 100 kW, Energis 92 kW => −8,0 %

Znaménko zachovat.

Význam:
+ = Energis ukazuje více
− = Energis ukazuje méně

Pracovní karta:
- |rozdíl| <= 15 %: zelená
- 15 % < |rozdíl| <= 25 %: oranžová mezizóna, text ve smyslu OVĚŘIT SOUBĚŽNOST MĚŘENÍ
- |rozdíl| > 25 %: upozornění PROVĚŘIT ZAPOJENÍ

Tato barevná/slovní klasifikace je pouze pracovní pomůcka na kartě měření.

## F. ULOŽENÉ VÝSLEDKY – NEUKLÁDAT SLOVNÍ VERDIKT JAKO HLAVNÍ VÝSLEDEK

V seznamu Výsledky / Historie nechci jako hlavní údaj:
V POŘÁDKU
MIMO TOLERANCI

Uložený výsledek má zobrazovat skutečné procento se znaménkem.
Například:
+28,0 %
−7,4 %
+2,1 %

Konečné rozhodnutí, zda je konkrétní rozdíl přijatelný, dělá člověk.

## G. NOVÝ PROUDOVÝ DIAGNOSTICKÝ REŽIM

Přidej nový proudový diagnostický režim.

Nepočítá činný výkon v kW.
Bez cos φ se nesmí vytvářet falešný výpočet činného výkonu.

Základ:
- primární proud L1/L2/L3,
- sekundární proud L1/L2/L3,
- přepočet podle MTP,
- procentní rozdíl každé fáze.

Režim musí podporovat NN i VN.
VN aktivovat jednoduchým checkboxem/přepínačem: VN

## H. NN PROUDOVÝ REŽIM

Pokud VN není aktivní:
- jde o NN,
- lokalita = TRAFOSTANICE,
- primární proudy L1/L2/L3 zadává uživatel jako hodnoty naměřené velkými kleštěmi,
- sekundární proudy se měří přes Kyoritsu 8112 + multimetr,
- používat NN MTP se sekundárem 5 A podle stávajícího systému aplikace.

1A VN MTP nesmí být v NN režimu nabízena.

## I. VN PROUDOVÝ REŽIM

Pokud VN je aktivní:
- lokalita = ROZVODNA,
- primární proudy L1/L2/L3 se zadávají ze SCADA,
- sekundární proudy se měří přes Kyoritsu 8112 + multimetr,
- nabízet pouze VN MTP se sekundárem 1 A.

VN MTP:
70/1 A
75/1 A
100/1 A
200/1 A
250/1 A
300/1 A
400/1 A
500/1 A
600/1 A
750/1 A
800/1 A
1000/1 A
1250/1 A
2000/1 A
2500/1 A
3500/1 A
4000/1 A

V režimu VN nesmí být nabízena 5A MTP.

## J. KYORITSU 8112

Použitý sekundární clamp adaptor: Kyoritsu MODEL 8112

Připrav pevný výběr rozsahu:
- 200 mA
- 2 A
- 20 A

Převody:
- 200 mA: 1 mV = 1 mA
- 2 A: 1 mV = 10 mA
- 20 A: 1 mV = 100 mA

Uživatel převod ručně nezadává.
Pouze zvolí rozsah podle fyzického přepínače na kleštičkách.

Na obrazovce musí být stále dobře viditelné například:
Kyoritsu 8112 – rozsah 2 A

## K. VSTUP Z MULTIMETRU

U každé fáze zadává uživatel číslo z multimetru.

Přidej volbu jednotky:
- mV
- V

Aplikace musí přijmout například:
83 mV
0,083 V

a získat stejný výsledek.

Převod: mV = V × 1000

Podporuj:
- desetinnou čárku,
- desetinnou tečku.

## L. PŘEPOČTY KYORITSU 8112

Pevné převody:
- 200 mA: 83 mV => 83 mA => 0,083 A
- 2 A: 83 mV => 830 mA => 0,830 A
- 20 A: 83 mV => 8300 mA => 8,300 A

## M. VÝPOČET OČEKÁVANÉHO SEKUNDÁRU

Vzorec:
I_secondary_expected = I_primary_measured × CT_secondary / CT_primary

Příklad:
primár = 20,0 A
MTP = 300/5 A
20 × 5 / 300 = 0,3333 A = 333,3 mA

Na výsledku zobraz:
333,3 mA
0,333 A

## N. PŘEPOČET SKUTEČNÉHO SEKUNDÁRU ZPĚT NA PRIMÁR

Příklad:
Kyoritsu 8112 = rozsah 2 A
multimetr = 33,0 mV
33 × 10 mA = 330 mA = 0,330 A

Vzorec:
I_primary_from_secondary = I_secondary_measured × CT_primary / CT_secondary

Pro MTP 300/5 A:
0,330 × 300 / 5 = 19,8 A

## O. PROCENTNÍ ROZDÍL 1f / VN

Vzorec:
Rozdíl % = (I_primary_from_secondary − I_primary_reference) / I_primary_reference × 100

NN:
I_primary_reference = primární proud naměřený velkým klešťákem.

VN:
I_primary_reference = primární proud ze SCADA.

Příklad:
reference 20,0 A
přepočet ze sekundáru 19,8 A
=> −1,0 %

reference 20,0 A
přepočet 20,6 A
=> +3,0 %

Znaménko vždy zachovat.

## P. VÝSLEDEK JEDNÉ FÁZE

Pro každou fázi zobraz minimálně:

L1
Primár: 20,0 A
Očekávaný sekundár: 333,3 mA / 0,333 A
Vstup multimetru: 33,0 mV
Rozsah: 2 A
Skutečný sekundár: 330,0 mA / 0,330 A
Přepočtený primár: 19,8 A
Rozdíl: −1,0 %

Totéž L2 a L3.
Dodržet pevné C1 barvy.

## Q. VOLITELNÉ MĚŘENÍ NAPĚTÍ

Proudový režim musí být plně funkční bez napětí.

Přidej checkbox: PŘIDAT MĚŘENÍ NAPĚTÍ

Pokud není aktivní:
- napěťová pole jsou neaktivní / šedá,
- nejsou povinná,
- absence napětí nesmí zhoršit nebo blokovat proudový výsledek.

Pokud je aktivní:
Primár: L1–L2, L1–L3, L2–L3
Sekundár: L1–L2, L1–L3, L2–L3

Napětí se pracuje mezi fázemi.
Ne proti zemi.

## R. NN NAPĚTÍ

U NN:
primární napětí může uživatel zadat jako skutečně naměřené mezi fázemi.

Sekundární napětí:
výchozí přednastavená hodnota 100 V.
Uživatel ji může ručně zpřesnit podle multimetru, například 103,7 V nebo 106 V.
100 V je výchozí hodnota, ne povinně přesná skutečnost.

## S. VN NAPĚTÍ

VN primární napětí se NESMÍ měřit multimetrem přímo na VN.
Primární napětí se bere ze SCADA.

Připrav výběr:
- 6 kV
- 10 kV
- 10,3 kV
- VLASTNÍ

Pokud uživatel zvolí VLASTNÍ, může zadat vlastní hodnotu.

Sekundární napětí:
výchozí 100 V, s možností ručního zpřesnění hodnotou naměřenou na sekundární straně multimetrem.

## T. DIAGNOSTIKA NAPĚŤOVÝCH VĚTVÍ

Napětí je doplňková diagnostika.
Primární hodnoty jsou referenční.
Na sekundární straně mohou být větve prohozené.

Porovnej:
L1–L2
L1–L3
L2–L3

primár proti sekundáru.

Pokud data jasně ukážou pravděpodobné prohození, může aplikace nabídnout pravděpodobnou variantu.
Pokud jsou hodnoty příliš podobné a nelze pořadí spolehlivě určit, NESMÍ aplikace hádat.

Zobraz:
Napěťové zapojení nelze z naměřených hodnot jednoznačně určit.

## U. HISTORIE – CO UKLÁDAT

Každý záznam musí uložit dost dat, aby byl zpětně reprodukovatelný.

Společně:
- datum,
- čas,
- číslo elektroměru,
- TS nebo R,
- pole / umístění,
- typ režimu,
- MTP.

U proudového režimu pro každou fázi:
- primární referenční proud,
- zdroj primárního proudu: NN = měřený proud, VN = SCADA,
- nastavený rozsah Kyoritsu 8112,
- jednotku vstupu mV/V,
- původní zadané číslo,
- normalizovanou hodnotu mV,
- skutečný sekundární proud mA,
- skutečný sekundární proud A,
- očekávaný sekundární proud,
- přepočtený primární proud,
- procentní rozdíl se znaménkem.

Pokud bylo aktivní měření napětí:
- všechny zadané primární hodnoty,
- všechny sekundární hodnoty,
- zda byla použita výchozí nebo ručně změněná hodnota.

U současného 3f měření zachovat všechny stávající podstatné hodnoty a doplnit novou společnou hlavičku a procentní rozdíl.

## V. HISTORIE SE NESMÍ PŘI UPDATE SMAZAT

Toto je kritický acceptance requirement.

Při změně databáze:
- použít migraci,
- nikdy clear()/deleteDatabase jako součást běžné aktualizace,
- zachovat staré měřicí záznamy.

Přidej test:
1. uložit existující starý typ měření,
2. simulovat upgrade DB,
3. načíst data,
4. původní záznam musí stále existovat.

## W. OPRAVIT ZNÁMÝ IPHONE OFFLINE E2E PROBLÉM

Současné CI mělo známý problém:

iPhone:
PWA se znovu načte offline a uchová historii

Po offline reloadu test očekával jeden .history-item, ale dostal 0.
Unit testy a build tehdy prošly.

Tento problém v rámci Promptu 1 oprav.

Po opravě musí:
- historie přežít reload,
- historie přežít offline reload,
- fungovat na iPhone emulaci,
- současné ostatní testy nesmí být rozbité.

## X. ZÁLOHA HISTORIE

Přidej možnost exportovat historii jako zálohu.
Formát: TSV nebo jednoduchý textový export vhodný pro Excel.
Nemusí se řešit import zpět, pokud by to zbytečně komplikovalo Prompt 1.

## Y. SDÍLENÍ

Současné sdílení rozšiř na systémové: SDÍLET

Použij Web Share API / vhodný PWA fallback.

Na iPhone/iPad má systémový share sheet umožnit podle dostupnosti:
- Mail,
- AirDrop,
- Zprávy,
- Uložit do Souborů,
- další aplikace.

Pokud systémové sdílení není dostupné, zachovej rozumný fallback.

## Z. TSV EXPORT

Export musí být vhodný pro vložení do Excelu.
Jeden měřicí záznam = jeden řádek.
Jednotlivé hodnoty = samostatné buňky oddělené TAB.

Pro 3f zachovat logické pořadí přibližně:
Datum
Čas
Trafostanice
Pole / umístění
Číslo elektroměru
Síť
U1
U2
U3
I1
I2
I3
cosφ1
cosφ2
cosφ3
P1
P2
P3
P celkem
Energis
Rozdíl %

Pro NN proudový režim:
Datum
Čas
Trafostanice
Pole / umístění
Číslo elektroměru
MTP
potom údaje L1, L2, L3, včetně primáru, sekundáru, přepočtu na primár, rozdílu %.
Pokud bylo měřeno napětí, doplnit napěťové hodnoty.

Pro VN používej stejné logické místo sloupce, ale místo názvu TRAFOSTANICE použij ROZVODNA.

TS/R a POLE/UMÍSTĚNÍ MUSÍ BÝT VŽDY DVĚ SAMOSTATNÉ BUŇKY.

Přesné finální pořadí Excel sloupců může být později upraveno, proto exportní logiku napiš tak, aby se pořadí dalo snadno změnit na jednom místě.

## AA. TYPOGRAFIE

Zvýrazni písmo bez dramatického zvětšení layoutu.

Pevná pravidla:
- nadpis obrazovky: bold
- název sekce: bold
- popisky polí: semibold
- hodnota ve vstupu: normální/medium, ale dobrý kontrast
- výsledné hodnoty: bold
- hlavní procenta: výrazně bold
- tlačítka: semibold
- pomocné poznámky: normální, menší
- hlavní řádek historie: semibold
- detail historie: normal

Důležité informace nesmí používat thin/light font weight.

## AB. VALIDACE

Aplikace musí bezpečně hlídat:
- prázdné povinné hodnoty,
- nulový MTP,
- neplatná čísla,
- NaN,
- Infinity,
- neplatný rozsah,
- záporné hodnoty tam, kde fyzikálně nedávají smysl.

Při validační chybě NESMÍ vymazat uživateli již zadaná data.
Desetinná čárka i tečka musí fungovat.

## AC. VERZE APLIKACE

Do nenápadného místa / nastavení přidej:
- verzi aplikace,
- datum buildu / aktualizace.

## AD. TESTY

Rozšiř unit testy minimálně o:
- Kyoritsu 8112 200 mA převod,
- 2 A převod,
- 20 A převod,
- V → mV,
- čárka i tečka,
- MTP 300/5 příklad,
- MTP 300/1 VN příklad,
- procentní rozdíl se znaménkem,
- kladný rozdíl,
- záporný rozdíl,
- nulový rozdíl,
- VN filtr MTP pouze /1 A,
- NN nesmí nabídnout /1 A,
- VN seznam pouze R,
- NN seznam pouze TS,
- zachování C1 barev,
- 500 V ARON invariant,
- DB migrace bez ztráty historie.

E2E minimálně:
1. současné 3f měření stále funguje,
2. 500 V přepne na ARON,
3. nový NN proudový režim,
4. nový VN proudový režim,
5. uložení do historie,
6. reload,
7. offline reload,
8. historie zůstane,
9. share/export se vytvoří,
10. starý záznam před DB upgradem zůstane čitelný.

## AE. BEZPEČNÝ POSTUP IMPLEMENTACE

Nejdřív si projdi existující projekt a existující datové modely.
Nedělej velký rewrite.
Rozšiř současnou architekturu.

Pokud je potřeba změnit IndexedDB:
- zvyš schema version,
- vytvoř migraci,
- zachovej backward compatibility uložených záznamů.

Měřicí část a energetická kalkulačka musí zůstat architektonicky oddělené.
V TOMTO PROMPTU ENERGETICKOU KALKULAČKU NEIMPLEMENTUJ.

## AF. HOTOVO ZNAMENÁ

Prompt 1 je hotový pouze pokud:
- build projde,
- unit testy projdou,
- E2E testy projdou,
- iPhone offline historie projde,
- současné 3f měření funguje,
- 500 V ARON funguje,
- C1 barvy jsou správně,
- nový NN proudový režim funguje,
- nový VN proudový režim funguje,
- Kyoritsu 8112 přepočty jsou otestované,
- TS/R jsou tvrdě oddělené,
- volitelné napětí funguje,
- historie se neztratila,
- sdílení funguje,
- TSV export funguje,
- typografie je upravená.

## AG. NA KONCI

Na konci práce:
1. spusť všechny testy,
2. spusť production build,
3. oprav případné regresní chyby,
4. dej mi krátký přehled změněných souborů,
5. napiš výsledky testů,
6. vytvoř jeden čistý commit pro Prompt 1.

NEMĚŇ zatím energetickou kalkulačku ani veřejné ceníky.