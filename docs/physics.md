# Fyzikální konvence a potřebné ověření pro provoz

## Přímé porovnání

`100 × (Energis − Kyoritsu) / Kyoritsu`. Obě znaménka výkonů se zachovávají. Rozdíl včetně hranice ±15 % je v toleranci a nespouští diagnostické scénáře. Pro `|Kyoritsu| < 0,001 kW` se procento a výběr varianty neurčují. Energis může být vyhlazený/opožděný; scénář odvozený z jediného celkového výkonu není důkaz zapojení.

## Fázory

Pevné napěťové úhly jsou `[0°, −120°, +120°]`. Pro každý fyzický proud:

- velikost posunu `φ = acos(|PF|)`;
- PF kladné nebo bez explicitního znaménka: proud lagging, `θI = θU − φ`;
- PF záporné: proud leading, `θI = θU + φ`;
- záporný činný P volí opačnou aktivní polorovinu přidáním 180°. PF tak není považováno za znaménko P.

Tato konvence u zpětného toku definuje leading/lagging vůči směru toku. Pokud konkrétní režim KEW používá pro zpětný tok jinou konvenci PF, je nutné ji potvrdit podle výstupu přístroje a upravit pouze adaptér `currentAngle`. Typ obsahuje `currentAngleDegrees` pro skutečný globální fázový úhel namísto odvození z PF (úhly napětí mají stejnou referenci jako výše).

`equivalentPhaseVoltage` odvodí pro každou fyzickou fázi `Ueq = |P| × 1000 / (I × |PF|)`. Při permutaci používá napěťová pozice své Ueq a připojený fyzický proud své I a θI:

`P(target ← source) = Ueq(target) × I(source) × cos(θU(target) − θI(source)) / 1000`.

Zadané U se ukládá a exportuje, ale nepoužije se automaticky jako napětí fáze vůči neutrálu ani se bez znalosti sítě nedělí √3. Pro správné přiřazení model rekonstruuje jednotlivé P. Součet naměřených P nemusí přesně souhlasit s nezávisle zadaným celkovým Kyoritsu; odchylka nad max(0,05 kW; 5 %) vyvolá upozornění.

**Nulové nebo neurčitelné vstupy:** při I = 0 a P = 0 je příspěvek zdrojové větve nulový. Ueq její napěťové pozice však ze samotných těchto dat určit nelze. Totéž nastává při PF = 0, nebo P = 0 při nenulovém I. Neodhadujeme napětí z jiné fáze ani z konfigurace 400/500 V. Pokud je alespoň jeden scénář neurčitelný, zobrazí se dostupná čísla v detailu, ale nevybírá se hlavní varianta z neúplného pořadí. K úplnému vyhodnocení je pak potřeba dodatečná informace o konfiguraci sítě / skutečných fázových napětích a úhlech. Aktivní P při nulovém I nebo PF formulář odmítá jako nekonzistentní.

## Tříproudové scénáře – 400 V

6 permutací proudů × 8 masek = 48. Maska vyzkratování patří **fyzickému proudu**, nikoli cílové napěťové pozici. Vyzkratovaná větev má přesně 0 kW; žádná negace P. Zatížení je po fázích nezávislé.

Scénáře se řadí podle absolutního rozdílu výkonu vůči Energis. Shoda modelu:

`max(0; 100 × (1 − |Pmodel − PEnergis| / max(|PKyoritsu|; 0,001)))`.

Shoda není statistický odhad. Hlavní obrazovka ukazuje referenční zapojení a opatrné upozornění, nikoli vítěznou závadu odvozenou z Energis. Modelové pořadí je pouze orientační technický detail. Více scénářů může mít stejný výkon; například všech šest permutací s plným vyzkratováním je nerozlišitelných. Úplný seznam zůstává v technickém detailu. Barvy vždy sledují identitu: U1/I1 červená, U2/I2 zelená, U3/I3 žlutá; vyzkratování šedé.

## ARON – 500 V, model 1.1.0

Volba 500 V automaticky aktivuje samostatný dvouwattmetrový model. Primární napětí zůstává měřitelné, proudově se používá jen IL1 a IL3. Napěťové svorky elektroměru 2/5/8 odpovídají L1/L2/L3; proudové členy 1–3 a 7–9 odpovídají L1 a L3. Společná napěťová reference je L2.

Z každého ekvivalentního fázového napětí a výše definovaného nominálního úhlu vytvoříme komplexní `V1`, `V2`, `V3`. Proudové fázory se odvozují ze skutečných I/PF/P, včetně leading/lagging a znamének P. Výpočet:

`W1 = Re[(V1 − V2) × conj(Ia)] / 1000`

`W3 = Re[(V3 − V2) × conj(Ib)] / 1000`

`Pmodel = polarity1 × W1 + polarity3 × W3`, polarity je +1 nebo −1.

Dvě přiřazení `[Ia, Ib] = [I1, I3]` a `[I3, I1]` × čtyři kombinace polarit členů dávají **8 scénářů**. Polarita patří wattmetrovému členu na elektroměru. Žádné vyzkratované scénáře nejsou bez konkrétního fyzikálního podkladu přidány. L2 není proudový člen v Aronově součtu, ale její napěťový fázor je součástí **obou** rozdílových vazeb; nové formuláře IL2/PF2/P2 nevyžadují a nezahrnují do výsledku. Bez přímé kalibrace V2 zůstane matematický model neurčený; procentní porovnání funguje dále. Původní úplná data starých záznamů se nepřepisují.

Primární model je ekvivalentem skutečného sekundárního měření: napěťová transformace při referenci 500 V je 500/100 = 5, proudový převod `r = skutečný primár / 5 A`. Výkon sekundáru je `Pprimary / (5 × r)`. Převod zpět na primární kW pro srovnání s Kyoritsu/Energis tyto faktory přesně vykrátí. Proto se do primární diagnostiky **nepřimíchává** zobrazovaný poměr skutečného/naprogramovaného MTP. Napěťových 100 V je sdružený sekundár, ne fázové napětí vůči neutrálu. Skutečné rozdílové napěťové fázory se získávají z dosavadního kalibračního adaptéru P/I/|PF|, nikoli slepým použitím zadaných 500 V jako fázového napětí.

Aronova identita celkového činného výkonu platí pro **třívodičovou síť**, kde `I1 + I2 + I3 = 0` jako komplexní fázory; zatížení nemusí být symetrické. Pokud síť má významný proud neutrálem či jinou topologii, tento model není platný. Chybějící kalibrace napěťového fázoru společné L2 znemožní výběr hlavní varianty; nevydává se za I2 = 0 nebo vyzkratování.

Kladná i záporná PF se používají jako u dosavadního fázorového adaptéru. Pro symetrický příklad při PF = 0,8 vycházejí wattmetrové příspěvky `Ull I cos(30° + acos(0,8))` a `Ull I cos(30° − acos(0,8))`; test je porovnává nezávisle s implementací. Nesymetrický test používá tři komplexní proudy se součtem nula.

Tolerance je i zde **±15 %**, nikdy ±25 %. Pořadí, definice shody a mez 5 procentních bodů pro jednu alternativu se nemění. Vizuální prostřední šedé pole obsahuje pouze „ARON“; jeho barva označuje režim, nikoli fyzickou fázi. Napěťové vstupy zůstávají dostupné. Nepoužitý proud IL2 je šedý, IL1 červený a IL3 žlutý. V řádcích větví zůstávají U1/I1 červené a U3/I3 žluté i při záměně proudů.

Starší záznamy bez pole `mode` se nepřepočítávají a zobrazují svůj původní tříproudový výsledek i při tehdejší hodnotě 500 V. Nové záznamy ukládají explicitní režim. Schéma IndexedDB a exportních sloupců se nemění.

## Samostatná kontrola stavů (1.2.2)

Registr musí být primárně škálovaný podle MTP nastaveného v elektroměru.

`korekce = skutečný MTP / MTP elektroměr`

`spotřeba elektroměru = (stav DO − stav OD) × korekce`

`rozdíl = spotřeba Energis − spotřeba elektroměru`

`procentní rozdíl = rozdíl / spotřeba elektroměru × 100`

Příklad: 300/600 = 0,500; rozdíl registru 20 kWh znamená 10 kWh po korekci. Váhy pulzů ani jejich odhad nejsou vstupem nebo výstupem nové kontroly. Staré historické hodnoty pulzů se nemění.

Do 15 % včetně spotřeby odpovídají, do 25 % včetně je třeba je ověřit, nad 25 % jde o významný rozdíl. Větší rozdíl vede pouze k ověření nastavení pulzů a případně skutečnému měření vývodu; neurčuje konkrétní elektrickou závadu ani váhu pulzu. Při obou nulových spotřebách jde o shodu; při nulovém elektroměru a nenulovém Energis procento nelze určit.

Interval musí být přesně shodný v obou systémech. Přetočení, reset registru nebo výměna elektroměru během intervalu se neodhadují. Pro jinak škálovaný registr je nutné před použitím ověřit převod. Výpočty používají plnou přesnost, zaokrouhlují se jen výstupy.

## Další rozšíření

Import z KEW/Bluetooth má vracet normalizovaný `MeasurementInput`; nesmí obcházet validaci nebo barvy. Bez veřejně potvrzeného protokolu se připojení neimplementuje. Nové skutečné fázové úhly, typy chyb, báze registru nebo PDF patří do samostatných adaptérů a exportních modulů. Historický záznam obsahuje verzi modelu a uloženou diagnostiku, proto jej budoucí aktualizace bez výslovného kroku nepřepisují.

## Nezávislá kontrola konzistence od verze 1.2.7

Kontrola `checkPowerConsistency` používá **zadané U**, nikoli ekvivalentní napětí odvozené z P. Předchozí scénářový model je zachován odděleně; jeho kalibrace z P nesmí nahrazovat tuto kontrolu ani potvrzovat konzistenci vstupů.

- ARON: pro aktivní větve 1 a 3 platí `|P_vyp| = U_větve × I × |PF_větve| / 1000`. Jde o skutečné napětí L1–L2 nebo L3–L2 a účiník téže větve. IL2 se nepoužívá.
- Ostatní 3f: volba `phase-neutral` znamená součet skutečných fázových příspěvků. Volba `line-line` předpokládá symetrii a přepočítá U/√3; při shodných U/I/PF je součet přesně √3 × U × I × |PF| / 1000. Nesymetrická sdružená napětí neumožňují tento přepočet, musí se zadat skutečná fázová napětí.
- Absolutní hodnoty větví se porovnávají se zadaným |P|. Pro algebraický součet se použije samostatné znaménko P, nikdy znaménko PF.
- Odchylka je `(zadáno − vypočteno) / vypočteno × 100`; hranice sdílí `workingBand` (15 % / 25 % s numerickou rezervou 1e-9 procentního bodu). Nulová reference a nulový výkon odpovídají; nenulový výkon proti nulové referenci je nesoulad bez nekonečného procenta.
- Chybějící/neplatné vstupy a neznámý typ napětí mají neutrální stav `unavailable`. Úplný formulář nadále vyžaduje platné PF/P. 1f proudové workflow bez PF/P kontrolu nevynucuje.

`Diagnosis.status` a `differencePercent` nadále vyjadřují samostatné porovnání Kyoritsu ↔ Energis. Celkový verdikt získává UI přes `measurementIsOk`, který u nových výsledků navíc vyžaduje `powerConsistency.status === consistent` a žádná stávající diagnostická upozornění. Nová diagnostika se ukládá beze ztráty interní přesnosti; nepřítomnost pole u historických záznamů nezpůsobí migraci ani přepis původního výsledku.
