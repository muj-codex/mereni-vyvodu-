# Opravy po terénním testu — 1.2.1

## Historie: zjištění a limity

Výchozí databáze zůstává `mereni-vyvodu-v1`, store `measurements`, verze 2.
Ve verzi před opravou nebyl filtr podle dne ani automatické mazání při startu,
změně dne či aktualizaci service workeru. Upgrade vytváří store pouze tehdy,
pokud dosud neexistuje; existující záznamy nemaže. Service worker obnovuje
pouze cache aplikačních souborů, nikoli IndexedDB.

Byla nalezena a testem reprodukována chyba čtení: `getAllFromIndex('by-time')`
nevrací záznamy bez platného indexovaného `savedAt`, přestože fyzicky existují
v object store. Nové čtení přes `getAll('measurements')` vrací všechny záznamy,
bez filtru podle dne; řadí je od nejnovějšího. Neprobíhá přepis ani reset dat.
Test vytváří starou DB verze 1 s neindexovaným záznamem a ověřuje upgrade,
přidání dalšího záznamu i opětovné otevření.

Příčina konkrétního terénního incidentu není prokázána: nemáme databázi ani
logy dotčeného Safari/PWA. Není správné vydávat reprodukovaný problém indexu
za potvrzenou příčinu incidentu. Také nelze z aplikace zaručit uchování po
smazání dat webu nebo zásahu operačního systému. Název DB/store se nemění,
ukládání čeká na dokončení transakce, každý záznam obsahuje samostatný snapshot,
a aplikace žádá o persistentní úložiště po uložení obou typů měření. TSV záloha
zůstává dostupná. Hromadné smazání je výhradně výslovná akce uživatele s potvrzením
`SMAZAT`, prováděná mazáním jednotlivých klíčů v transakci; žádné `clear()` ani
`deleteDatabase` v aplikaci nejsou.

## Režimy a interpretace

Identifikace na 3f kartě je společná pro 3f i 1f. Režim sítě obsahuje NN 400/500 V
nebo čtyři povolené VN hodnoty. Na VN se používá 1f porovnání SCADA a sekundáru
s MTP /1 A. Budoucí sazby mají pouze placeholder, bez cenových výpočtů.

ARON nepoužívá IL2. V normalizovaných datech je výslovně označena jako nepoužitá,
nezapočítává se do procent ani rad a v exportu má prázdné proudové buňky.
Proudové větve jsou IL1 1–3 a IL3 7–9. Napětí lze měřit samostatně i u 500 V;
prázdný prostřední sekundární napěťový vstup neblokuje vyhodnocení.
Původní textové vstupy jsou uchovány odděleně od normalizovaných hodnot.

Původní matematické funkce 3f a úplného ARON modelu zůstávají pokryté analytickými
testy. Bez kalibrace společného napěťového fázoru z přímých dat se nevymýšlí
náhradní proud IL2 a neurčuje se hlavní matematická varianta. Přímé procentní
porovnání výkonů dále funguje. Energis sám neprokazuje konkrétní závadu,
záměnu ani polaritu. Konkrétní doporučení větve se opírá o místní primár/sekundár.

## E-mail a testy

`emailBody` používá stejný centrální TSV export jako kopírování pro Excel.
`mailto` obsahuje zakódované neprázdné tělo s reálnými tabulátory a řádky;
nepřidává soubor ani úvod. Velikost již nespouští větev otevírající prázdný e-mail.
Ruční fallback nabízí stejný TSV text a odkaz se stejným tělem.
Test zachycuje skutečný `mailto` URL při kliknutí; nemůže ověřit chování všech
externích poštovních klientů na zařízení uživatele.

E2E běží v Chromium s viewporty iPhone a iPad, nikoli v nativním Safari.
Obsahují persistentní profil zavřený v D1 a otevřený v D2, starou DB v1,
offline reload, rozdílné history tabs, ARON závadu IL3, volitelné napětí,
změnu rozsahu, společnou identifikaci, vlastní MTP a main navigation.
Deployment workflow nebyl měněn.
