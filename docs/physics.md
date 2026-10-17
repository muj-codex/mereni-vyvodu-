# Fyzikální konvence a potřebné ověření pro provoz

## Přímé porovnání

`100 × (Energis − Kyoritsu) / |Kyoritsu|`. Obě znaménka výkonů se zachovávají. Rozdíl včetně hranice ±15 % je v toleranci a nespouští diagnostické scénáře. Pro `|Kyoritsu| < 0,001 kW` se procento a výběr varianty neurčují. Energis může být vyhlazený/opožděný; scénář odvozený z jediného celkového výkonu není důkaz zapojení.

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

## Scénáře

6 permutací proudů × 8 masek = 48. Maska vyzkratování patří **fyzickému proudu**, nikoli cílové napěťové pozici. Vyzkratovaná větev má přesně 0 kW; žádná negace P. Zatížení je po fázích nezávislé.

Scénáře se řadí podle absolutního rozdílu výkonu vůči Energis. Shoda modelu:

`max(0; 100 × (1 − |Pmodel − PEnergis| / max(|PKyoritsu|; 0,001)))`.

Shoda není statistický odhad. Hlavní obrazovka má nejlepší scénář a nejvýše jeden další, pokud rozdíl shody nepřesáhne `CONFIG.alternativeMaxScoreGap = 5` procentních bodů. Více scénářů může mít stejný výkon; například všech šest permutací s plným vyzkratováním je nerozlišitelných. Úplný seznam zůstává v technickém detailu. Barvy vždy sledují identitu: U1/I1 červená, U2/I2 zelená, U3/I3 žlutá; vyzkratování šedé.

## Ruční kontrola stavů a pulzy – předpoklad k potvrzení podle elektroměru

Registr v kWh se zde předpokládá škálovaný na primární stranu podle **MTP nastaveného v elektroměru**. Pro společný sekundár 5 A:

`korekce = skutečný primár MTP / naprogramovaný primár MTP`

`skutečná energie = (stav DO − stav OD) × korekce`.

Váha pulzu elektroměru se předpokládá ve stejné škálovací bázi jako registr. Pro Energis = X:

`počet pulzů = korigovaná energie elektroměru / (váha pulzu elektroměru × korekce)`

`efektivní váha Energis = energie Energis / počet pulzů`.

Odhad předpokládá stejný počet pulzů bez ztrát a přesně shodný interval. Nejbližší standard je „smysluplný“, pouze pokud relativní odchylka od standardu nepřesáhne 15 %; jinak se zobrazí vzdálenost bez doporučení standardu. Jednotka všech pulzů je interně kWh/puls.

**Je třeba potvrdit pro konkrétní typ elektroměru:** zda registr a pulz skutečně používají tutéž primární škálovací bázi. Pro sekundární/neškálovaný registr či jinou bázi pulzu je potřeba změnit adaptér `mtpCorrection` a převod pulzu. Aplikace tento předpoklad ukazuje i ve formuláři. Interval je volitelný; jeho přeskočení nebrání diagnostice okamžitých hodnot. Přetočení registru, výměna elektroměru uprostřed intervalu a reset stavů se neodhadují.

## Další rozšíření

Import z KEW/Bluetooth má vracet normalizovaný `MeasurementInput`; nesmí obcházet validaci nebo barvy. Bez veřejně potvrzeného protokolu se připojení neimplementuje. Nové skutečné fázové úhly, typy chyb, báze registru nebo PDF patří do samostatných adaptérů a exportních modulů. Historický záznam obsahuje verzi modelu a uloženou diagnostiku, proto jej budoucí aktualizace bez výslovného kroku nepřepisují.
